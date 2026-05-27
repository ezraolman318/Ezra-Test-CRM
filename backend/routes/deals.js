import { Router } from 'express';
import { db, STAGES } from '../db.js';

const r = Router();

r.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT d.*,
        c.first_name AS contact_first, c.last_name AS contact_last,
        co.name AS company_name
     FROM deals d
     LEFT JOIN contacts c ON d.contact_id = c.id
     LEFT JOIN companies co ON d.company_id = co.id
     ORDER BY d.updated_at DESC`
  ).all();
  res.json(rows);
});

r.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT d.*,
        c.first_name AS contact_first, c.last_name AS contact_last,
        co.name AS company_name
     FROM deals d
     LEFT JOIN contacts c ON d.contact_id = c.id
     LEFT JOIN companies co ON d.company_id = co.id
     WHERE d.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const activities = db.prepare(`SELECT * FROM activities WHERE deal_id = ? ORDER BY COALESCE(due_date, created_at) DESC`).all(req.params.id);
  res.json({ ...row, activities });
});

function validateStage(s) {
  return STAGES.includes(s);
}

r.post('/', (req, res) => {
  const { name, value, stage, expected_close_date, contact_id, company_id, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const s = stage && validateStage(stage) ? stage : 'Lead';
  const info = db.prepare(
    `INSERT INTO deals (name, value, stage, expected_close_date, contact_id, company_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, value || 0, s, expected_close_date || null, contact_id || null, company_id || null, notes || null);
  res.status(201).json(db.prepare(`SELECT * FROM deals WHERE id = ?`).get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const { name, value, stage, expected_close_date, contact_id, company_id, notes } = req.body;
  const s = stage && validateStage(stage) ? stage : 'Lead';
  const closedFields = (s === 'Won' || s === 'Lost')
    ? { won: s === 'Won' ? 1 : 0, closed_at: new Date().toISOString().slice(0, 10) }
    : { won: null, closed_at: null };
  db.prepare(
    `UPDATE deals SET name=?, value=?, stage=?, expected_close_date=?, contact_id=?, company_id=?, notes=?, won=?, closed_at=?, updated_at=datetime('now') WHERE id = ?`
  ).run(
    name, value || 0, s, expected_close_date || null, contact_id || null, company_id || null, notes || null,
    closedFields.won, closedFields.closed_at, req.params.id
  );
  res.json(db.prepare(`SELECT * FROM deals WHERE id = ?`).get(req.params.id));
});

// Lightweight stage move (for kanban drag)
r.patch('/:id/stage', (req, res) => {
  const { stage } = req.body;
  if (!validateStage(stage)) return res.status(400).json({ error: 'invalid stage' });
  const closed = (stage === 'Won' || stage === 'Lost');
  db.prepare(
    `UPDATE deals SET stage=?, won=?, closed_at=?, updated_at=datetime('now') WHERE id = ?`
  ).run(
    stage,
    closed ? (stage === 'Won' ? 1 : 0) : null,
    closed ? new Date().toISOString().slice(0, 10) : null,
    req.params.id
  );
  res.json(db.prepare(`SELECT * FROM deals WHERE id = ?`).get(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM deals WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

export default r;
