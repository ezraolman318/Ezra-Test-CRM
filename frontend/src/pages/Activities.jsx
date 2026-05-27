import { useEffect, useState, useCallback } from 'react';
import { api, fmtDate, daysFromNow } from '../api.js';
import Modal from '../components/Modal.jsx';

const blank = { type: 'task', subject: '', notes: '', due_date: '', contact_id: '', deal_id: '', completed: 0 };
const FILTERS = [
  { key: 'open',     label: 'Open' },
  { key: 'due_week', label: 'Due this week' },
  { key: 'overdue',  label: 'Overdue' },
  { key: 'completed',label: 'Done' },
  { key: 'all',      label: 'All' }
];

export default function Activities() {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [a, c, d] = await Promise.all([
      api.get(`/activities?filter=${filter}`),
      api.get('/contacts'),
      api.get('/deals')
    ]);
    setRows(a); setContacts(c); setDeals(d);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function save(form) {
    const payload = {
      ...form,
      contact_id: form.contact_id || null,
      deal_id: form.deal_id || null,
      completed: form.completed ? 1 : 0
    };
    if (form.id) await api.put(`/activities/${form.id}`, payload);
    else await api.post('/activities', payload);
    setEditing(null); load();
  }

  async function toggle(id) {
    await api.patch(`/activities/${id}/toggle`);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this activity?')) return;
    await api.del(`/activities/${id}`);
    setEditing(null); load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Activities</h1>
        <div className="actions">
          <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New activity</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          {FILTERS.map(f => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <span className="spacer" />
        <span className="muted small">{rows.length} {rows.length === 1 ? 'activity' : 'activities'}</span>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">Nothing to show.</div>
        ) : rows.map(a => {
          const dn = daysFromNow(a.due_date);
          let dueClass = '';
          let dueLabel = a.due_date ? fmtDate(a.due_date) : 'No due date';
          if (!a.completed && dn !== null) {
            if (dn < 0) { dueClass = 'overdue'; dueLabel = `${Math.abs(dn)}d overdue · ${dueLabel}`; }
            else if (dn === 0) { dueClass = 'soon'; dueLabel = `Today · ${dueLabel}`; }
            else if (dn <= 3) { dueClass = 'soon'; dueLabel = `In ${dn}d · ${dueLabel}`; }
          }
          return (
            <div key={a.id} className={`activity-row ${a.completed ? 'done' : ''}`}>
              <input type="checkbox" className="checkbox" checked={!!a.completed} onChange={() => toggle(a.id)} />
              <span className="type-tag">{a.type}</span>
              <div className="subject" style={{ cursor: 'pointer' }} onClick={() => setEditing({ ...blank, ...a })}>
                <strong>{a.subject}</strong>
                {(a.contact_first || a.deal_name) && (
                  <div className="muted small">
                    {[
                      a.contact_first ? `${a.contact_first} ${a.contact_last || ''}`.trim() : null,
                      a.deal_name
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <span className={`due ${dueClass}`}>{dueLabel}</span>
              <button className="btn-ghost btn-sm danger-text" onClick={() => remove(a.id)}>Delete</button>
            </div>
          );
        })}
      </div>

      <ActivityModal record={editing} contacts={contacts} deals={deals}
        onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}

function ActivityModal({ record, contacts, deals, onClose, onSave }) {
  const [form, setForm] = useState(record || blank);
  useEffect(() => { setForm(record || blank); }, [record]);
  if (!record) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <Modal open={!!record} title={record.id ? 'Edit activity' : 'New activity'} onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Save</button>
        </>
      }>
      <form onSubmit={submit}>
        <div className="row">
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={e => update('type', e.target.value)}>
              <option value="task">Task</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div className="field"><label>Due date</label><input type="date" value={form.due_date || ''} onChange={e => update('due_date', e.target.value)} /></div>
        </div>
        <div className="field"><label>Subject *</label><input required value={form.subject} onChange={e => update('subject', e.target.value)} /></div>
        <div className="row">
          <div className="field">
            <label>Contact</label>
            <select value={form.contact_id || ''} onChange={e => update('contact_id', e.target.value)}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name || ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Deal</label>
            <select value={form.deal_id || ''} onChange={e => update('deal_id', e.target.value)}>
              <option value="">—</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} /></div>
        <div className="field" style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" style={{ width: 16, height: 16 }} checked={!!form.completed} onChange={e => update('completed', e.target.checked ? 1 : 0)} />
            <span>Completed</span>
          </label>
        </div>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
