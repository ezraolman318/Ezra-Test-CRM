import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const blank = { name: '', domain: '', industry: '', notes: '' };

export default function Companies() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setRows(await api.get(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  async function save(form) {
    if (form.id) await api.put(`/companies/${form.id}`, form);
    else await api.post('/companies', form);
    setEditing(null); load();
  }

  async function remove(id) {
    if (!confirm('Delete this company? Contacts and deals will be unlinked.')) return;
    await api.del(`/companies/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Companies</h1>
        <div className="actions">
          <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New company</button>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search companies…" value={q} onChange={e => setQ(e.target.value)} />
        <span className="muted small">{rows.length} {rows.length === 1 ? 'company' : 'companies'}</span>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">No companies yet.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Domain</th><th>Industry</th><th>Contacts</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="clickable" onClick={() => setEditing({ ...blank, ...r })}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.domain || '—'}</td>
                  <td>{r.industry || '—'}</td>
                  <td>{r.contact_count}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost btn-sm danger-text" onClick={() => remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CompanyModal record={editing} onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}

function CompanyModal({ record, onClose, onSave }) {
  const [form, setForm] = useState(record || blank);
  useEffect(() => { setForm(record || blank); }, [record]);
  if (!record) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <Modal open={!!record} title={record.id ? 'Edit company' : 'New company'} onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Save</button>
        </>
      }>
      <form onSubmit={submit}>
        <div className="field"><label>Name *</label><input required value={form.name} onChange={e => update('name', e.target.value)} /></div>
        <div className="row">
          <div className="field"><label>Domain</label><input value={form.domain || ''} onChange={e => update('domain', e.target.value)} placeholder="example.com" /></div>
          <div className="field"><label>Industry</label><input value={form.industry || ''} onChange={e => update('industry', e.target.value)} /></div>
        </div>
        <div className="field"><label>Notes</label><textarea value={form.notes || ''} onChange={e => update('notes', e.target.value)} /></div>
        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}
