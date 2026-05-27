import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'crm.db');

export const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

const schema = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  contact_status TEXT NOT NULL DEFAULT 'Cold',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'Lead',
  expected_close_date TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  notes TEXT,
  won INTEGER,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'task',
  subject TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  completed INTEGER DEFAULT 0,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  conditions TEXT NOT NULL DEFAULT '[]',
  match_mode TEXT NOT NULL DEFAULT 'all',
  actions TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_match_count INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_completed ON activities(completed);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
`;

db.exec(schema);

// Migration: add contact_status to pre-existing DBs that don't have it yet.
const contactCols = db.prepare("PRAGMA table_info(contacts)").all();
if (!contactCols.some(c => c.name === 'contact_status')) {
  db.exec("ALTER TABLE contacts ADD COLUMN contact_status TEXT NOT NULL DEFAULT 'Cold'");
}

export const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const CLOSED_STAGES = ['Won', 'Lost'];
export const CONTACT_STATUSES = ['Cold', 'Aware', 'Engaged', 'Hot'];

// Workflow field allowlists
export const WORKFLOW_CONDITION_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'title', 'company_name', 'contact_status', 'notes'];
export const WORKFLOW_ACTION_FIELDS = ['contact_status', 'title', 'notes', 'phone', 'email'];
export const WORKFLOW_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'];
test_marker_1779894703
