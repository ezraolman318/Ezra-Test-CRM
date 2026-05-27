import { Router } from 'express';
import {
  db,
  CONTACT_STATUSES,
  WORKFLOW_CONDITION_FIELDS,
  WORKFLOW_ACTION_FIELDS,
  WORKFLOW_OPERATORS
} from '../db.js';

const r = Router();

// ---------- engine ----------

function matchesCondition(contact, cond) {
  if (!cond || !cond.field || !WORKFLOW_CONDITION_FIELDS.includes(cond.field)) return false;
  if (!WORKFLOW_OPERATORS.includes(cond.operator)) return false;
  const raw = contact[cond.field];
  const v = raw == null ? '' : String(raw).toLowerCase();
  const target = (cond.value == null ? '' : String(cond.value)).toLowerCase();
  switch (cond.operator) {
    case 'equals':       return v === target;
    case 'not_equals':   return v !== target;
    case 'contains':     return target !== '' && v.includes(target);
    case 'not_contains': return target === '' || !v.includes(target);
    case 'is_empty':     return v.trim() === '';
    case 'is_not_empty': return v.trim() !== '';
    default: return false;
  }
}

function matchesWorkflow(contact, wf) {
  let conds = [];
  try { conds = JSON.parse(wf.conditions || '[]'); } catch { conds = []; }
  if (!Array.isArray(conds) || conds.length === 0) return false; // empty conditions = never auto-fire
  const results = conds.map(c => matchesCondition(contact, c));
  return wf.match_mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function validateAction(a) {
  if (!a || !WORKFLOW_ACTION_FIELDS.includes(a.field)) return null;
  let value = a.value == null ? '' : String(a.value);
  if (a.field === 'contact_status' && !CONTACT_STATUSES.includes(value)) return null;
  const mode = (a.mode === 'append' && a.field === 'notes') ? 'append' : 'set';
  return { field: a.field, value, mode };
}

function buildUpdates(contact, actions) {
  const updates = {};
  for (const raw of actions) {
    const a = validateAction(raw);
    if (!a) continue;
    if (a.mode === 'append') {
      const prev = contact[a.field] || '';
      const next = prev ? `${prev}\n${a.value}` : a.value;
      if (next !== prev) updates[a.field] = next;
    } else {
      if ((contact[a.field] ?? '') !== a.value) updates[a.field] = a.value;
    }
  }
  return updates;
}

function applyUpdatesToContact(id, updates) {
  const cols = Object.keys(updates);
  if (cols.length === 0) return false;
  const setClause = cols.map(c => `${c} = ?`).join(', ');
  const params = cols.map(c => updates[c]);
  params.push(id);
  db.prepare(`UPDATE contacts SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...params);
  return true;
}

function fetchContactWithCompany(id) {
  return db.prepare(
    `SELECT c.*, co.name AS company_name FROM contacts c
     LEFT JOIN companies co ON c.company_id = co.id
     WHERE c.id = ?`
  ).get(id);
}

/**
 * Run all enabled workflows against a single contact (called after POST/PUT contacts).
 * Returns { applied: number, workflowsHit: [{id,name,fields}] }.
 */
export function runEnabledWorkflowsForContact(contactId) {
  const workflows = db.prepare(`SELECT * FROM workflows WHERE enabled = 1 ORDER BY id ASC`).all();
  if (workflows.length === 0) return { applied: 0, workflowsHit: [] };
  let contact = fetchContactWithCompany(contactId);
  if (!contact) return { applied: 0, workflowsHit: [] };
  const hits = [];
  for (const wf of workflows) {
    if (!matchesWorkflow(contact, wf)) continue;
    let actions = [];
    try { actions = JSON.parse(wf.actions || '[]'); } catch { actions = []; }
    if (!Array.isArray(actions) || actions.length === 0) continue;
    const updates = buildUpdates(contact, actions);
    if (Object.keys(updates).length > 0) {
      applyUpdatesToContact(contactId, updates);
      contact = fetchContactWithCompany(contactId);
      hits.push({ id: wf.id, name: wf.name, fields: Object.keys(updates) });
    }
  }
  return { applied: hits.length, workflowsHit: hits };
}

/**
 * Run a workflow against all contacts. Used by "Run now" button.
 */
function runWorkflowOnAll(wf) {
  const contacts = db.prepare(
    `SELECT c.*, co.name AS company_name FROM contacts c
     LEFT JOIN companies co ON c.company_id = co.id`
  ).all();
  let matched = 0, updated = 0;
  let actions = [];
  try { actions = JSON.parse(wf.actions || '[]'); } catch { actions = []; }
  if (!Array.isArray(actions)) actions = [];
  for (const c of contacts) {
    if (!matchesWorkflow(c, wf)) continue;
    matched++;
    if (actions.length === 0) continue;
    const updates = buildUpdates(c, actions);
    if (Object.keys(updates).length > 0) {
      applyUpdatesToContact(c.id, updates);
      updated++;
    }
  }
  db.prepare(`UPDATE workflows SET last_run_at = datetime('now'), last_match_count = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(matched, wf.id);
  return { matched, updated };
}

// ---------- validation ----------

function sanitizeConditions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(c => c && WORKFLOW_CONDITION_FIELDS.includes(c.field) && WORKFLOW_OPERATORS.includes(c.operator))
    .map(c => ({
      field: c.field,
      operator: c.operator,
      value: (c.operator === 'is_empty' || c.operator === 'is_not_empty') ? '' : String(c.value ?? '')
    }));
}

function sanitizeActions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map(a => validateAction(a))
    .filter(Boolean);
}

// ---------- routes ----------

r.get('/', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM workflows ORDER BY enabled DESC, updated_at DESC`).all();
  res.json(rows.map(w => ({
    ...w,
    enabled: !!w.enabled,
    conditions: safeParse(w.conditions, []),
    actions: safeParse(w.actions, [])
  })));
});

r.get('/:id', (req, res) => {
  const w = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json({ ...w, enabled: !!w.enabled, conditions: safeParse(w.conditions, []), actions: safeParse(w.actions, []) });
});

r.post('/', (req, res) => {
  const { name, conditions, match_mode, actions, enabled } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const mm = match_mode === 'any' ? 'any' : 'all';
  const c = sanitizeConditions(conditions);
  const a = sanitizeActions(actions);
  const info = db.prepare(
    `INSERT INTO workflows (name, conditions, match_mode, actions, enabled) VALUES (?, ?, ?, ?, ?)`
  ).run(name.trim(), JSON.stringify(c), mm, JSON.stringify(a), enabled === false ? 0 : 1);
  const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ ...row, enabled: !!row.enabled, conditions: safeParse(row.conditions, []), actions: safeParse(row.actions, []) });
});

r.put('/:id', (req, res) => {
  const { name, conditions, match_mode, actions, enabled } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const mm = match_mode === 'any' ? 'any' : 'all';
  const c = sanitizeConditions(conditions);
  const a = sanitizeActions(actions);
  db.prepare(
    `UPDATE workflows SET name=?, conditions=?, match_mode=?, actions=?, enabled=?, updated_at=datetime('now') WHERE id = ?`
  ).run(name.trim(), JSON.stringify(c), mm, JSON.stringify(a), enabled === false ? 0 : 1, req.params.id);
  const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(req.params.id);
  res.json({ ...row, enabled: !!row.enabled, conditions: safeParse(row.conditions, []), actions: safeParse(row.actions, []) });
});

r.patch('/:id/toggle', (req, res) => {
  const cur = db.prepare(`SELECT enabled FROM workflows WHERE id = ?`).get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const next = cur.enabled ? 0 : 1;
  db.prepare(`UPDATE workflows SET enabled=?, updated_at=datetime('now') WHERE id = ?`).run(next, req.params.id);
  const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(req.params.id);
  res.json({ ...row, enabled: !!row.enabled, conditions: safeParse(row.conditions, []), actions: safeParse(row.actions, []) });
});

r.post('/:id/run', (req, res) => {
  const wf = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Not found' });
  const result = runWorkflowOnAll(wf);
  res.json(result);
});

r.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM workflows WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

// ---------- helpers ----------

function safeParse(s, fallback) {
  try { const v = JSON.parse(s); return v == null ? fallback : v; } catch { return fallback; }
}

export default r;
