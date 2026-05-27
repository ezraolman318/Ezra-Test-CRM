import { useEffect, useState, useCallback } from 'react';
import { api, STAGES, fmtMoney, fmtDate } from '../api.js';
import Modal from '../components/Modal.jsx';

const blank = { name: '', value: 0, stage: 'Lead', expected_close_date: '', contact_id: '', company_id: '', notes: '' };

export default function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    const [d, c, co] = await Promise.all([api.get('/deals'), api.get('/contacts'), api.get('/companies')]);
    setDeals(d); setContacts(c); setCompanies(co);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(form) {
    const payload = {
      ...form,
      value: parseFloat(form.value) || 0,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null
    };
    if (form.id) await api.put(`/deals/${form.id}`, payload);
    else await api.post('/deals', payload);
    setEditing(null); load();
  }

  async function remove(id) {
    if (!confirm('Delete this deal?')) return;
    await api.del(`/deals/${id}`);
    load();
  }

  async function moveStage(id, stage) {
    await api.patch(`/deals/${id}/stage`, { stage });
    load();
  }

  function onDragStart(e, deal) {
    e.dataTransfer.setData('text/plain', String(deal.id));
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e, stage) {
    e.preventDefault();
    setDragOver(stage);
  }
  function onDrop(e, stage) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDragOver(null);
    if (!id) return;
    const deal = deals.find(d => String(d.id) === id);
    if (deal && deal.stage !== stage) moveStage(id, stage);
  }

  return (
    <div>
      <div className="page-head">
        <h1>Pipeline</h1>
        <div className="actions">
          <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New deal</button>
        </div>
      </div>

      <div className="kanban">
        {STAGES.filter(s => s !== 'Won' && s !== 'Lost').map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const total = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
          return (
            <div
              key={stage}
              className={`col ${dragOver === stage ? 'drag-over' : ''}`}
              onDragOver={(e) => onDragOver(e, stage)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, stage)}
            >
              <header>
                <span className="name">{stage}</span>
                <span className="meta">{stageDeals.length} · {fmtMoney(total)}</span>
              </header>
              {stageDeals.map(d => (
                <div key={d.id}
                  className="deal-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, d)}
                  onClick={() => setEditing({ ...blank, ...d })}>
                  <div className="name">{d.name}</div>
                  <div className="meta">
                    {d.company_name || (d.contact_first ? `${d.contact_first} ${d.contact_last || ''}`.trim() : '—')}
                    {d.expected_close_date && <> · close {fmtDate(d.expected_close_date)}</>}
                  </div>
                  <div className="value">{fmtMoney(d.value)}</div>
                </div>
              ))}
              {stageDeals.length === 0 && <div className="muted small" style={{ padding: '8px 6px' }}>Drop deals here</div>}
            </div>
          );
        })}
      </div>

      <ClosedSection deals={deals} onEdit={(d) => setEditing({ ...blank, ...d })} onMove={moveStage} />

      <DealModal record={editing} contacts={contacts} companies={companies}
        onClose={() => setEditing(null)} onSave={save} onDelete={(id) => { remove(id); setEditing(null); }} />
    </div>
  );
}

function ClosedSection({ deals, onEdit, onMove }) {
  const won = deals.filter(d => d.stage === 'Won');
  const lost = deals.filter(d => d.stage === 'Lost');
  if (won.length === 0 && lost.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', margin: '0 0 10px' }}>Closed</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ClosedCol title={`Won · ${won.length} · ${fmtMoney(won.reduce((s, d) => s + (d.value || 0), 0))}`} deals={won} onEdit={onEdit} onMove={onMove} />
        <ClosedCol title={`Lost · ${lost.length}`} deals={lost} onEdit={onEdit} onMove={onMove} />
      </div>
    </div>
  );
}

function ClosedCol({ title, deals, onEdit, onMove }) {
  return (
    <div className="col" style={{ background: '#f8f9fa' }}>
      <header><span className="name">{title}</span></header>
      {deals.map(d => (
        <div key={d.id} className="deal-card" onClick={() => onEdit(d)}>
          <div className="name">{d.name}</div>
          <div className="meta">{d.company_name || '—'} · closed {fmtDate(d.closed_at)}</div>
          <div className="value">{fmtMoney(d.value)}</div>
        </div>
      ))}
      {deals.length === 0 && <div className="muted small" style={{ padding: '6px' }}>None.</div>}
    </div>
  );
}

function DealModal({ record, contacts, companies, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(record || blank);
  useEffect(() => { setForm(record || blank); }, [record]);
  if (!record) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <Modal open={!!record} title={record.id ? 'Edit deal' : 'New deal'} onClose={onClose}
      footer={
        <>
          {record.id ? <button className="btn-danger" onClick={() => onDelete(record.id)}>Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Save</button>
          </div>
        </>
      }>
      <form onSubmit={submit}>
        <div className="field"><label>Deal name *</label><input required value={form.name} onChange={e => update('name', e.target.value)} /></div>
        <div className="row">
          <div className="field"><label>Value (USD)</label><input type="number" step="0.01" value={form.value || ''} onChange={e => update('value', e.target.value)} /></div>
          <div className="field">
            <label>Stage</label>
            <select value={form.stage} onChange={e => update('stage', e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Expected close date</label><input type="date" value={form.expected_close_date || ''} onChange={e => update('expected_close_date', e.target.value)} /></div>
        <div className="row">
          <div className="field">
            <label>Contact</label>
            <select value={form.contact_id || ''} onChange={e => update('contact_id', e.target.value)}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Company</label>
            <select value={form.company_id || ''} onChange={e => update('company_id', e.target.value)}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} /></div>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
