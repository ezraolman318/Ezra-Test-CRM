import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const blank = { first_name: '', last_name: '', email: '', phone: '', title: '', company_id: '', notes: '' };

export default function Contacts() {
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [c, co] = await Promise.all([
      api.get(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
      api.get('/companies')
    ]);
    setRows(c); setCompanies(co);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  async function save(form) {
    const payload = { ...form, company_id: form.company_id || null };
    if (form.id) await api.put(`/contacts/${form.id}`, payload);
    else await api.post('/contacts', payload);
    setEditing(null); load();
  }

  async function remove(id) {
    if (!confirm('Delete this contact?')) return;
    await api.del(`/contacts/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Contacts</h1>
        <div className="actions">
          <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New contact</button>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search contacts, emails, companies…" value={q} onChange={e => setQ(e.target.value)} />
        <span className="muted small">{rows.length} {rows.length === 1 ? 'contact' : 'contacts'}</span>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">No contacts yet. Add one to get started.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Title</th><th>Company</th><th>Email</th><th>Phone</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="clickable" onClick={() => setEditing({ ...blank, ...r })}>
                  <td><strong>{r.first_name} {r.last_name}</strong></td>
                  <td>{r.title || '—'}</td>
                  <td>{r.company_name || '—'}</td>
                  <td>{r.email || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost btn-sm danger-text" onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ContactModal record={editing} companies={companies} onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}

function ContactModal({ record, companies, onClose, onSave }) {
  const [form, setForm] = useState(record || blank);
  useEffect(() => { setForm(record || blank); }, [record]);
  if (!record) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <Modal open={!!record} title={record.id ? 'Edit contact' : 'New contact'} onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Save</button>
        </>
      }>
      <form onSubmit={submit}>
        <div className="row">
          <div className="field"><label>First name *</label><input required value={form.first_name} onChange={e => update('first_name', e.target.value)} /></div>
          <div className="field"><label>Last name</label><input value={form.last_name || ''} onChange={e => update('last_name', e.target.value)} /></div>
        </div>
        <div className="field"><label>Title</label><input value={form.title || ''} onChange={e => update('title', e.target.value)} /></div>
        <div className="field">
          <label>Company</label>
          <select value={form.company_id || ''} onChange={e => update('company_id', e.target.value)}>
            <option value="">—</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field"><label>Email</label><input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} /></div>
          <div className="field"><label>Phone</label><input value={form.phone || ''} onChange={e => update('phone', e.target.value)} /></div>
        </div>
        <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} /></div>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
