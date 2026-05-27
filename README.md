# CRM

A personal CRM for freelance work. Tracks contacts, companies, deals, and activities, with a dashboard for pipeline value, win rate, and what's due this week.

Everything runs locally. Data lives in a single SQLite file at `backend/crm.db`. No accounts, no cloud, no telemetry.

## What's in it

- **Dashboard** — open pipeline value, win rate, activities due, pipeline by stage, recent activity.
- **Pipeline** — kanban board with drag-and-drop between stages (Lead, Qualified, Proposal, Negotiation). Won and Lost columns sit below.
- **Contacts** — people with their company, title, email, phone, notes.
- **Companies** — orgs with domain, industry, contact count.
- **Activities** — calls, emails, meetings, tasks. Filter by Open / Due this week / Overdue / Done / All.

## Stack

- Frontend: React 18, Vite, React Router, Recharts. Plain CSS, no framework.
- Backend: Node + Express, better-sqlite3.
- Storage: SQLite (`backend/crm.db`).

## Setup

You need Node 20+ and npm.

```bash
# from the crm/ folder
npm run install:all

# load demo data (5 companies, 7 contacts, 7 deals, 7 activities)
npm run seed

# run backend + frontend together
npm run dev
```

Open http://localhost:5317.

Backend API runs on http://localhost:4317. Vite proxies `/api` to it, so you don't need to think about it.

## Useful commands

```bash
npm run dev            # both backend and frontend
npm run dev:backend    # API only (http://localhost:4317)
npm run dev:frontend   # UI only (http://localhost:5317)
npm run seed           # wipe and reseed demo data
npm run build          # production build of the frontend
```

## Resetting data

To start from scratch, delete `backend/crm.db` and run `npm run seed` (or just start the app — it will create an empty DB).

## Folder layout

```
crm/
├── backend/
│   ├── server.js          # Express app, /api/dashboard
│   ├── db.js              # SQLite schema, stage constants
│   ├── seed.js            # demo data
│   └── routes/            # contacts, companies, deals, activities
└── frontend/
    └── src/
        ├── App.jsx        # sidebar + routes
        ├── api.js         # tiny fetch wrapper
        ├── styles.css     # all styles
        ├── components/
        └── pages/         # Dashboard, Pipeline, Contacts, Companies, Activities
```

## Notes

- Ports: backend 4317, frontend 5317. Change in `backend/server.js` and `frontend/vite.config.js` if you need to.
- Foreign keys are on. Deleting a company unlinks its contacts and deals; deleting a contact unlinks its deals and activities.
- Stage moves use a lightweight `PATCH /api/deals/:id/stage` endpoint so drag-and-drop doesn't replay the whole form.
