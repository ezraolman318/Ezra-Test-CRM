import { db } from './db.js';

// Wipe and reseed for a clean demo state.
db.exec(`DELETE FROM activities; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;
         DELETE FROM sqlite_sequence WHERE name IN ('activities','deals','contacts','companies');`);

const companies = [
  { name: 'Northwind Studios', domain: 'northwind.studio', industry: 'Media' },
  { name: 'Beacon Labs', domain: 'beaconlabs.io', industry: 'B2B SaaS' },
  { name: 'Tideline Capital', domain: 'tidelinecap.com', industry: 'Finance' },
  { name: 'Arboretum Software', domain: 'arboretum.dev', industry: 'Developer Tools' },
  { name: 'Pinecone Bakery', domain: 'pineconebakery.com', industry: 'Retail' }
];
const insertCompany = db.prepare(`INSERT INTO companies (name, domain, industry) VALUES (?, ?, ?)`);
const companyIds = companies.map(c => insertCompany.run(c.name, c.domain, c.industry).lastInsertRowid);

const contacts = [
  { f: 'Maya',     l: 'Halpern',   e: 'maya@northwind.studio',   p: '555-0101', t: 'Head of Brand',  ci: 0 },
  { f: 'Theo',     l: 'Park',      e: 'theo@beaconlabs.io',      p: '555-0102', t: 'CEO',            ci: 1 },
  { f: 'Diana',    l: 'Okonkwo',   e: 'diana@tidelinecap.com',   p: '555-0103', t: 'Partner',        ci: 2 },
  { f: 'Sam',      l: 'Reyes',     e: 'sam@arboretum.dev',       p: '555-0104', t: 'VP Growth',      ci: 3 },
  { f: 'Priya',    l: 'Iyer',      e: 'priya@beaconlabs.io',     p: '555-0105', t: 'Marketing Lead', ci: 1 },
  { f: 'Jules',    l: 'Calderon',  e: 'jules@pineconebakery.com',p: '555-0106', t: 'Owner',          ci: 4 },
  { f: 'Felix',    l: 'Brand',     e: 'felix@northwind.studio',  p: '555-0107', t: 'Producer',       ci: 0 }
];
const insertContact = db.prepare(`INSERT INTO contacts (first_name, last_name, email, phone, title, company_id) VALUES (?, ?, ?, ?, ?, ?)`);
const contactIds = contacts.map(c =>
  insertContact.run(c.f, c.l, c.e, c.p, c.t, companyIds[c.ci]).lastInsertRowid
);

const today = new Date();
function inDays(n) {
  const d = new Date(today); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const deals = [
  { name: 'Q3 brand refresh',          value: 18000, stage: 'Proposal',    close: inDays(14),  ci: 0, co: 0 },
  { name: 'Lifecycle email retainer',  value: 6500,  stage: 'Qualified',   close: inDays(21),  ci: 1, co: 1 },
  { name: 'Investor deck rewrite',     value: 9500,  stage: 'Negotiation', close: inDays(7),   ci: 2, co: 2 },
  { name: 'Docs site overhaul',        value: 22000, stage: 'Lead',        close: inDays(45),  ci: 3, co: 3 },
  { name: 'Launch campaign — v2 API',  value: 12000, stage: 'Won',         close: inDays(-12), ci: 4, co: 1 },
  { name: 'Holiday menu landing page', value: 2200,  stage: 'Won',         close: inDays(-30), ci: 5, co: 4 },
  { name: 'Annual report design',      value: 8000,  stage: 'Lost',        close: inDays(-20), ci: 6, co: 0 }
];
const insertDeal = db.prepare(
  `INSERT INTO deals (name, value, stage, expected_close_date, contact_id, company_id, won, closed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const dealIds = deals.map(d => {
  const closed = (d.stage === 'Won' || d.stage === 'Lost');
  return insertDeal.run(
    d.name, d.value, d.stage, d.close,
    contactIds[d.ci], companyIds[d.co],
    closed ? (d.stage === 'Won' ? 1 : 0) : null,
    closed ? d.close : null
  ).lastInsertRowid;
});

const activities = [
  { type: 'call',    subject: 'Kickoff call with Maya',         due: inDays(1),  ci: 0, di: 0 },
  { type: 'email',   subject: 'Send proposal draft',            due: inDays(-1), ci: 0, di: 0 }, // overdue
  { type: 'meeting', subject: 'Strategy review — Beacon Labs',  due: inDays(3),  ci: 1, di: 1 },
  { type: 'task',    subject: 'Outline investor narrative',     due: inDays(2),  ci: 2, di: 2 },
  { type: 'call',    subject: 'Discovery call with Sam',        due: inDays(5),  ci: 3, di: 3 },
  { type: 'email',   subject: 'Follow up after no-reply',       due: inDays(0),  ci: 1, di: 1 }, // today
  { type: 'task',    subject: 'Wrap project + send invoice',    due: inDays(-5), ci: 4, di: 4, done: true }
];
const insertActivity = db.prepare(
  `INSERT INTO activities (type, subject, due_date, contact_id, deal_id, completed, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
);
activities.forEach(a => {
  insertActivity.run(
    a.type, a.subject, a.due,
    contactIds[a.ci], dealIds[a.di],
    a.done ? 1 : 0,
    a.done ? new Date().toISOString() : null
  );
});

console.log(`Seeded: ${companies.length} companies, ${contacts.length} contacts, ${deals.length} deals, ${activities.length} activities.`);
