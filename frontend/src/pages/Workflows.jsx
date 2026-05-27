import { useEffect, useState, useCallback } from 'react';
import { api, CONTACT_STATUSES } from '../api.js';
import Modal from '../components/Modal.jsx';

const CONDITION_FIELDS = [
  { value: 'contact_status', label: 'Contact status' },
  { value: 'company_name', label: 'Company' },
  { value: 'title', label: 'Title' },
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'phone', label: 'Phone' },
  { value: 'notes', label: 'Notes' }
];

const ACTION_FIELDS = [
  { value: 'contact_status', label: 'Contact status' },
  { value: 'title', label: 'Title' },
  { value: 'notes', label: 'Notes' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' }
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' }
];

const blank = {
  name: '',
  conditions: [{ field: 'contact_status', operator: 'equals', value: 'Cold' }],
  match_mode: 'all',
  actions: [{ field: 'contact_status', value: 'Aware', mode: 'set' }],
  enabled: true
};

export default function Workflows() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [runResult, setRunResult] = useState(null);

  const load = useCallback(async () => {
    setRows(await api.get('/workflows'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(form) {
    const payload = {
      name: form.name,
      match_mode: form.match_mode === 'any' ? 'any' : 'all',
      conditions: form.conditions || [],
      actions: form.actions || [],
      enabled: !!form.enabled
    };
    if (form.id) await api.put(`/workflows/${form.id}`, payload);
    else await api.post('/workflows', payload);
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this workflow?')) return;
    await api.del(`/workflows/${id}`);
    load();
  }

  async function toggle(id) {
    await api.patch(`/workflows/${id}/toggle`);
    load();
  }

  async function runNow(wf) {
    const result = await api.post(`/workflows/${wf.id}/run`);
    setRunResult({ workflow: wf.name, ...result });
    load();
    setTimeout(() => setRunResult(null), 6000);
  }

  return (
    <div>
      <div className="page-head">
        <h1>Workflows</h1>
        <div className="actions">
          <button className="btn-primary" onClick={() => setEditing({ ...blank })}>+ New workflow</button>
        </div>
      </div>

      <p className="muted small" style={{ marginTop: -12, marginBottom: 16 }}>
        Enabled workflows run automatically whenever a contact is created or updated. "Run now" applies the workflow to all existing contacts.
      </p>

      {runResult && (
        <div className="card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', marginBottom: 16 }}>
          <strong>"{runResult.workflow}"</strong> matched {runResult.matched} contact{runResult.matched === 1 ? '' : 's'} · updated {runResult.updated}.
        </div>
      )}

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">No workflows yet. Build one to automate contact updates.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>When</th><th>Then</th><th>Last run</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(w => (
                <tr key={w.id} className="clickable" onClick={() => setEditing({ ...w })}>
                  <td><strong>{w.name}</strong></td>
                  <td className="muted small">{summarizeConditions(w)}</td>
                  <td className="muted small">{summarizeActions(w)}</td>
                  <td className="muted small">
                    {w.last_run_at
                      ? <>{new Date(w.last_run_at).toLocaleDateString()} · {w.last_match_count} matched</>
                      : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                      <input type="checkbox" style={{ width: 16, height: 16 }} checked={!!w.enabled} onChange={() => toggle(w.id)} />
                      {w.enabled ? 'On' : 'Off'}
                    </label>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex-row" style={{ gap: 4 }}>
                      <button className="btn-sm" onClick={() => runNow(w)}>Run now</button>
                      <button className="btn-ghost btn-sm danger-text" onClick={() => remove(w.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <WorkflowModal record={editing} onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}

function summarizeConditions(w) {
  const conds = w.conditions || [];
  if (conds.length === 0) return '(no conditions — will never auto-fire)';
  const joiner = w.match_mode === 'any' ? ' OR ' : ' AND ';
  return conds.map(c => {
    const f = labelFor(CONDITION_FIELDS, c.field);
    const op = labelFor(OPERATORS, c.operator);
    if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return `${f} ${op}`;
    return `${f} ${op} "${c.value}"`;
  }).join(joiner);
}

function summarizeActions(w) {
  const actions = w.actions || [];
  if (actions.length === 0) return '(no actions)';
  return actions.map(a => {
    const f = labelFor(ACTION_FIELDS, a.field);
    const verb = a.mode === 'append' ? 'append to' : 'set';
    return `${verb} ${f} = "${a.value}"`;
  }).join(', ');
}

function labelFor(list, value) {
  return list.find(x => x.value === value)?.label || value;
}

function WorkflowModal({ record, onClose, onSave }) {
  const [form, setForm] = useState(record || blank);
  useEffect(() => { setForm(record || blank); }, [record]);
  if (!record) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function updateCondition(i, patch) {
    const next = [...(form.conditions || [])];
    next[i] = { ...next[i], ...patch };
    // If switching to is_empty/is_not_empty, clear the value.
    if (patch.operator === 'is_empty' || patch.operator === 'is_not_empty') next[i].value = '';
    update('conditions', next);
  }
  function addCondition() {
    update('conditions', [...(form.conditions || []), { field: 'email', operator: 'contains', value: '' }]);
  }
  function removeCondition(i) {
    update('conditions', (form.conditions || []).filter((_, idx) => idx !== i));
  }

  function updateAction(i, patch) {
    const next = [...(form.actions || [])];
    next[i] = { ...next[i], ...patch };
    if (patch.field && patch.field !== 'notes' && next[i].mode === 'append') next[i].mode = 'set';
    update('actions', next);
  }
  function addAction() {
    update('actions', [...(form.actions || []), { field: 'contact_status', value: 'Aware', mode: 'set' }]);
  }
  function removeAction(i) {
    update('actions', (form.actions || []).filter((_, idx) => idx !== i));
  }

  const submit = (e) => { e.preventDefault(); if (!form.name?.trim()) return; onSave(form); };

  return (
    <Modal open={!!record} title={record.id ? 'Edit workflow' : 'New workflow'} onClose={onClose}
      footer={
        <>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            <input type="checkbox" style={{ width: 16, height: 16 }} checked={!!form.enabled} onChange={e => update('enabled', e.target.checked)} />
            Enabled (runs on contact create/update)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={submit}>Save</button>
          </div>
        </>
      }>
      <form onSubmit={submit}>
        <div className="field"><label>Workflow name *</label><input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g., Tag enterprise contacts" /></div>

        <div className="section">
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>When a contact matches</span>
            <select value={form.match_mode || 'all'} onChange={e => update('match_mode', e.target.value)}
              style={{ width: 'auto', textTransform: 'none', letterSpacing: 0, fontSize: 12, padding: '4px 8px' }}>
              <option value="all">all of these</option>
              <option value="any">any of these</option>
            </select>
          </h2>
          {(form.conditions || []).map((c, i) => (
            <ConditionRow key={i} c={c} onChange={p => updateCondition(i, p)} onRemove={() => removeCondition(i)} />
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={addCondition}>+ Add condition</button>
        </div>

        <div className="section">
          <h2>Then set these field values</h2>
          {(form.actions || []).map((a, i) => (
            <ActionRow key={i} a={a} onChange={p => updateAction(i, p)} onRemove={() => removeAction(i)} />
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={addAction}>+ Add action</button>
        </div>

        <button type="submit" style={{ display: 'none' }} />
      </form>
    </Modal>
  );
}

function ConditionRow({ c, onChange, onRemove }) {
  const noValue = c.operator === 'is_empty' || c.operator === 'is_not_empty';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: 6, marginBottom: 6 }}>
      <select value={c.field} onChange={e => onChange({ field: e.target.value })}>
        {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={c.operator} onChange={e => onChange({ operator: e.target.value })}>
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {noValue ? (
        <input disabled value="" placeholder="—" />
      ) : c.field === 'contact_status' ? (
        <select value={c.value || 'Cold'} onChange={e => onChange({ value: e.target.value })}>
          {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input value={c.value || ''} onChange={e => onChange({ value: e.target.value })} placeholder="value" />
      )}
      <button type="button" className="btn-ghost btn-sm danger-text" onClick={onRemove} title="Remove">×</button>
    </div>
  );
}

function ActionRow({ a, onChange, onRemove }) {
  const isNotes = a.field === 'notes';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: 6, marginBottom: 6 }}>
      <select value={a.field} onChange={e => onChange({ field: e.target.value })}>
        {ACTION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={a.mode || 'set'} onChange={e => onChange({ mode: e.target.value })} disabled={!isNotes}>
        <option value="set">set to</option>
        {isNotes && <option value="append">append</option>}
      </select>
      {a.field === 'contact_status' ? (
        <select value={a.value || 'Cold'} onChange={e => onChange({ value: e.target.value })}>
          {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input value={a.value || ''} onChange={e => onChange({ value: e.target.value })} placeholder="value" />
      )}
      <button type="button" className="btn-ghost btn-sm danger-text" onClick={onRemove} title="Remove">×</button>
    </div>
  );
}
