import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, fmtMoney, fmtDate, daysFromNow } from '../api.js';

const STAGE_COLORS = {
  Lead: '#6366f1',
  Qualified: '#3b82f6',
  Proposal: '#f59e0b',
  Negotiation: '#ea580c'
};

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/dashboard').then(setData); }, []);

  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      <div className="kpi-grid">
        <div className="card kpi">
          <h3>Open pipeline</h3>
          <div className="value">{fmtMoney(data.openTotal.value)}</div>
          <div className="sub">{data.openTotal.count} open {data.openTotal.count === 1 ? 'deal' : 'deals'}</div>
        </div>
        <div className="card kpi">
          <h3>Closed won</h3>
          <div className="value">{fmtMoney(data.wonValue)}</div>
          <div className="sub">{data.wonCount} won · {data.lostCount} lost</div>
        </div>
        <div className="card kpi">
          <h3>Win rate</h3>
          <div className="value">{Math.round(data.winRate * 100)}%</div>
          <div className="sub">of closed deals</div>
        </div>
        <div className={`card kpi ${data.overdue > 0 ? 'danger' : ''}`}>
          <h3>Activities due (7d)</h3>
          <div className="value">{data.activitiesDue}</div>
          <div className="sub">{data.overdue > 0 ? `${data.overdue} overdue` : 'On track'}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3>Pipeline by stage</h3>
          {data.pipelineByStage.every(s => s.count === 0) ? (
            <div className="empty">Nothing in the pipeline yet. <Link to="/pipeline">Add a deal →</Link></div>
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={data.pipelineByStage} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="stage" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => v >= 1000 ? `$${v/1000}k` : `$${v}`} />
                  <Tooltip
                    formatter={(value, _name, props) => [fmtMoney(value), `${props.payload.count} deal${props.payload.count === 1 ? '' : 's'}`]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {data.pipelineByStage.map(d => (
                      <Cell key={d.stage} fill={STAGE_COLORS[d.stage] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Recent activity</h3>
          {data.recentActivities.length === 0 ? (
            <div className="empty">No activity logged yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.recentActivities.map(a => {
                const dn = a.due_date ? daysFromNow(a.due_date) : null;
                let due = a.due_date ? fmtDate(a.due_date) : '';
                let cls = '';
                if (!a.completed && dn !== null && dn < 0) cls = 'danger-text';
                return (
                  <li key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <strong style={{ textDecoration: a.completed ? 'line-through' : 'none', color: a.completed ? 'var(--muted)' : 'inherit' }}>
                          {a.subject}
                        </strong>
                        <div className="muted small">
                          {a.type}
                          {a.first_name && ` · ${a.first_name} ${a.last_name || ''}`.trim()}
                          {a.deal_name && ` · ${a.deal_name}`}
                        </div>
                      </div>
                      <span className={`small ${cls}`}>{due}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
