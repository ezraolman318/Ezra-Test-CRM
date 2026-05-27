import { Router } from 'express';
import { db } from '../db.js';

const r = Router();

r.get('/', (req, res) => {
  const filter = req.query.filter || 'all'; // all, open, completed, due_week, overdue
  let where = '1=1';
  if (filter === 'open') where = 'a.completed = 0';
  if (filter === 'completed') where = 'a.completed = 1';
  if (filter === 'due_week') where = `a.completed = 0 AND a.due_date IS NOT NULL AND date(a.due_date) <= date('now', '+7 days')`;
  if (filter === 'overdue') where = `a.completed = 0 AND a.due_date IS NOT NULL AND date(a.due_date) < date('now')`;

  const rows = db.prepare(
    `SELECT a.*,
        c.first_name AS contact_first, c.last_name AS contact_last,
        d.name AS deal_name
     FROM activities a
     LEFT JOIN contacts c ON a.contact_id = c.id
     LEFT JOIN deals d ON a.deal_id = d.id
     WHERE ${where}
     ORDER BY (a.due_date IS NULL), a.due_date ASC, a.created_at DESC`
  ).all();
  res.json(rows);
});

r.post('/', (req, res) => {
  const { type, subject, notes, due_date, contact_id, deal_id, completed } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject required' });
  const info = db.prepare(
    `INSERT INTO activities (type, subject, notes, due_date, contact_id, deal_id, completed, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    type || 'task', subject, notes || null, due_date || null,
    contact_id || null, deal_id || null,
    completed ? 1 : 0,
    completed ? new Date().toISOString() : null
  );
  res.status(201).json(db.prepare(`SELECT * FROM activities WHERE id = ?`).get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const { type, subject, notes, due_date, contact_id, deal_id, completed } = req.body;
  const existing = db.prepare(`SELECT completed FROM activities WHERE id = ?`).get(req.params.id);
  const newCompleted = completed ? 1 : 0;
  const completedAt = newCompleted && !existing.completed ? new Date().toISOString()
                    : (!newCompleted ? null : db.prepare(`SELECT completed_at FROM activities WHERE id=?`).get(req.params.id).completed_at);
  db.prepare(
    `UPDATE activities SET type=?, subject=?, notes=?, due_date=?, contact_id=?, deal_id=?, completed=?, completed_at=? WHERE id = ?`
  ).run(type || 'task', subject, notes || null, due_date || null, contact_id || null, deal_id || null, newCompleted, completedAt, req.params.id);
  res.json(db.prepare(`SELECT * FROM activities WHERE id = ?`).get(req.params.id));
});

r.patch('/:id/toggle', (req, res) => {
  const cur = db.prepare(`SELECT completed FROM activities WHERE id = ?`).get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const next = cur.completed ? 0 : 1;
  db.prepare(
    `UPDATE activities SET completed = ?, completed_at = ? WHERE id = ?`
  ).run(next, next ? new Date().toISOString() : null, req.params.id);
  res.json(db.prepare(`SELECT * FROM activities WHERE id = ?`).get(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM activities WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

export default r;
