import { Router } from 'express';
import { db } from '../db.js';

const r = Router();

r.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM contacts WHERE company_id=c.id) AS contact_count
       FROM companies c
       WHERE c.name LIKE ? OR c.domain LIKE ? OR c.industry LIKE ?
       ORDER BY c.updated_at DESC`
    ).all(like, like, like);
  } else {
    rows = db.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM contacts WHERE company_id=c.id) AS contact_count
       FROM companies c
       ORDER BY c.updated_at DESC`
    ).all();
  }
  res.json(rows);
});

r.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const contacts = db.prepare(`SELECT * FROM contacts WHERE company_id = ? ORDER BY updated_at DESC`).all(req.params.id);
  const deals = db.prepare(`SELECT * FROM deals WHERE company_id = ? ORDER BY updated_at DESC`).all(req.params.id);
  res.json({ ...row, contacts, deals });
});

r.post('/', (req, res) => {
  const { name, domain, industry, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare(
    `INSERT INTO companies (name, domain, industry, notes) VALUES (?, ?, ?, ?)`
  ).run(name, domain || null, industry || null, notes || null);
  res.status(201).json(db.prepare(`SELECT * FROM companies WHERE id = ?`).get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const { name, domain, industry, notes } = req.body;
  db.prepare(
    `UPDATE companies SET name=?, domain=?, industry=?, notes=?, updated_at=datetime('now') WHERE id = ?`
  ).run(name, domain || null, industry || null, notes || null, req.params.id);
  res.json(db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM companies WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});

export default r;
