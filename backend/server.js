import express from 'express';
import cors from 'cors';
import { db, STAGES, CONTACT_STATUSES } from './db.js';
import contacts from './routes/contacts.js';
import companies from './routes/companies.js';
import deals from './routes/deals.js';
import activities from './routes/activities.js';
import workflows from './routes/workflows.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/meta/stages', (_req, res) => res.json(STAGES));
app.get('/api/meta/contact-statuses', (_req, res) => res.json(CONTACT_STATUSES));

app.use('/api/contacts', contacts);
app.use('/api/companies', companies);
app.use('/api/deals', deals);
app.use('/api/activities', activities);
app.use('/api/workflows', workflows);

// Dashboard summary
app.get('/api/dashboard', (_req, res) => {
  const openStages = STAGES.filter(s => s !== 'Won' && s !== 'Lost');
  const placeholders = openStages.map(() => '?').join(',');

  const pipelineByStage = db.prepare(
    `SELECT stage, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value
     FROM deals WHERE stage IN (${placeholders})
     GROUP BY stage`
  ).all(...openStages);

  // Backfill stages with zero
  const byStage = STAGES.filter(s => s !== 'Won' && s !== 'Lost').map(stage => {
    const row = pipelineByStage.find(r => r.stage === stage);
    return { stage, count: row?.count || 0, value: row?.value || 0 };
  });

  const openTotal = db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(SUM(value), 0) AS value FROM deals WHERE stage NOT IN ('Won', 'Lost')`
  ).get();

  const won = db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS v FROM deals WHERE stage='Won'`).get();
  const lost = db.prepare(`SELECT COUNT(*) AS c FROM deals WHERE stage='Lost'`).get();
  const winRate = (won.c + lost.c) > 0 ? won.c / (won.c + lost.c) : 0;

  const activitiesDue = db.prepare(
    `SELECT COUNT(*) AS c FROM activities
     WHERE completed = 0 AND due_date IS NOT NULL
     AND date(due_date) <= date('now', '+7 days')`
  ).get();

  const overdue = db.prepare(
    `SELECT COUNT(*) AS c FROM activities
     WHERE completed = 0 AND due_date IS NOT NULL AND date(due_date) < date('now')`
  ).get();

  const recentActivities = db.prepare(
    `SELECT a.*, c.first_name, c.last_name, d.name AS deal_name
     FROM activities a
     LEFT JOIN contacts c ON a.contact_id = c.id
     LEFT JOIN deals d ON a.deal_id = d.id
     ORDER BY a.created_at DESC LIMIT 8`
  ).all();

  res.json({
    pipelineByStage: byStage,
    openTotal,
    wonValue: won.v,
    wonCount: won.c,
    lostCount: lost.c,
    winRate,
    activitiesDue: activitiesDue.c,
    overdue: overdue.c,
    recentActivities
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 4317;
app.listen(PORT, () => console.log(`CRM API on http://localhost:${PORT}`));
