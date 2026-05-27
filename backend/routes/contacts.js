import { Router } from 'express';
import { db, CONTACT_STATUSES } from '../db.js';
import { runEnabledWorkflowsForContact } from './workflows.js';

const r = Router();

function normalizeStatus(s) {
  return CONTACT_STATUSES.includes(s) ? s : 'Cold';
}

function fetchContact(id) {
  return db.prepare(
    `SELECT c.*, co.name AS company_name FROM contacts c
     LEFT JOIN companies co ON c.company_id = co.id
     WHERE c.id = ?`
  ).get(id);
}

r.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(
      `SELECT c.*, co.name AS company_name FROM contacts c
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR co.name LIKE ?
       ORDER BY c.updated_at DESC`
    ).all(like, like, like, like);
  } else {
    rows = db.prepare(
      `SELECT c.*, co.name AS company_name FROM contacts c
       LEFT JOIN companies co ON c.company_id = co.id
       ORDER BY c.updated_at DESC`
    ).all();
  }
  res.json(rows);
});

r.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT c.*, co.name AS company_name FROM contacts c
     LEFT JOIN companies co ON c.company_id = co.id
     WHERE c.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const deals = db.prepare(`SELECT * FROM deals WHERE contact_id = ? ORDER BY updated_at DESC`).all(req.params.id);
  const activities = db.prepare(`SELECT * FROM activities WHERE contact_id = ? ORDER BY COALESCE(due_date, created_at) DESC`).all(req.params.id);
  res.json({ ...row, deals, activities });
});

r.post('/', (req, res) => {
  const { first_name, last_name, email, phone, title, company_id, contact_status, notes } = req.body;
  if (!first_name) return res.status(400).json({ error: 'first_name required' });
  const status = normalizeStatus(contact_status);
  const info = db.prepare(
    `INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, contact_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(first_name, last_name || null, email || null, phone || null, title || null, company_id || null, status, notes || null);
  const wfResult = runEnabledWorkflowsForContact(info.lastInsertRowid);
  const row = fetchContact(info.lastInsertRowid);
  res.status(201).json({ ...row, _workflows: wfResult });
});

r.put('/:id', (req, res) => {
  const { first_name, last_name, email, phone, title, company_id, contact_status, notes } = req.body;
  const status = normalizeStatus(contact_status);
  db.prepare(
    `UPDATE contacts SET first_name=?, last_name=?, email=?, phone=?, title=?, company_id=?, contact_status=?, notes=?, updated_at=datetime('now') WHERE id = ?`
  ).run(first_name, last_name || null, email || null, phone || null, title || null, company_id || null, status, notes || null, req.params.id);
  const wfResult = runEnabledWorkflowsForContact(req.params.id);
  const row = fetchContact(req.params.id);
  res.json({ ...row, _workflows: wfResult });
});

// Lightweight status update (for inline edits if added later).
r.patch('/:id/status', (req, res) => {
  const status = normalizeStatus(req.body.contact_status);
  db.prepare(`UPDATE contacts SET contact_status=?, updated_at=datetime('now') WHERE id = ?`).run(status, req.params.id);
  res.json(db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM contacts WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

export default r;
