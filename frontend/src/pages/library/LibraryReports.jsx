import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

const fmt = n => (n || 0).toLocaleString('en-IN');

export default function LibraryReports() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [tab, setTab] = useState('OVERDUE'); // OVERDUE | FINES | POPULAR | ACTIVITY

  const [loading, setLoading] = useState(true);

  // Overdue
  const [overdue, setOverdue] = useState([]);

  // Fines
  const [fineFrom, setFineFrom] = useState('');
  const [fineTo, setFineTo]     = useState('');
  const [fines, setFines]       = useState([]);
  const [fineSummary, setFineSummary] = useState({ total_collected: 0, total_pending: 0, total_waived: 0 });

  // Popular books
  const [popular, setPopular] = useState([]);

  // Activity log
  const [activity, setActivity] = useState([]);

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 18,
  };

  const loadOverdue = useCallback(() => {
    setLoading(true);
    api.get('/library/reports/overdue')
      .then(r => setOverdue(r.data || []))
      .catch(() => toast.error('Overdue report load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  const loadFines = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fineFrom) params.set('from', fineFrom);
    if (fineTo)   params.set('to', fineTo);
    api.get('/library/reports/fines?' + params.toString())
      .then(r => {
        setFines(r.data.transactions || []);
        setFineSummary(r.data.summary || { total_collected: 0, total_pending: 0, total_waived: 0 });
      })
      .catch(() => toast.error('Fine report load nahi ho payi'))
      .finally(() => setLoading(false));
  }, [fineFrom, fineTo]);

  const loadPopular = useCallback(() => {
    setLoading(true);
    api.get('/library/reports/popular-books')
      .then(r => setPopular(r.data || []))
      .catch(() => toast.error('Popular books report load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  const loadActivity = useCallback(() => {
    setLoading(true);
    api.get('/library/activity-log?per_page=50')
      .then(r => setActivity(r.data || []))
      .catch(() => toast.error('Activity log load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'OVERDUE')  loadOverdue();
    if (tab === 'FINES')    loadFines();
    if (tab === 'POPULAR')  loadPopular();
    if (tab === 'ACTIVITY') loadActivity();
  }, [tab, loadOverdue, loadFines, loadPopular, loadActivity]);

  async function sendReminder(issueId) {
    try {
      await api.post(`/library/reports/overdue/${issueId}/remind`);
      toast.success('Reminder sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reminder nahi bheja ja saka');
    }
  }

  function exportCSV(rows, filename, headers) {
    if (!rows.length) { toast.error('Export karne ke liye data nahi hai'); return; }
    const csvRows = [
      headers.map(h => h.label).join(','),
      ...rows.map(row => headers.map(h => `"${(row[h.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const TABS = [
    { key: 'OVERDUE',  label: '⏰ Overdue Books' },
    { key: 'FINES',    label: '💰 Fine Collection' },
    { key: 'POPULAR',  label: '📈 Popular Books' },
    { key: 'ACTIVITY', label: '📋 Activity Log' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Library Reports" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24, maxWidth: 1100 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#4f46e5' : (darkMode ? '#1e293b' : '#e2e8f0'),
                color: tab === t.key ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERDUE ── */}
          {tab === 'OVERDUE' && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                  Overdue Books ({overdue.length})
                </h4>
                <button onClick={() => exportCSV(overdue, 'overdue_books.csv', [
                  { key: 'book_title', label: 'Book' },
                  { key: 'member_name', label: 'Member' },
                  { key: 'due_date', label: 'Due Date' },
                  { key: 'overdue_days', label: 'Overdue Days' },
                  { key: 'estimated_fine', label: 'Estimated Fine' },
                ])} style={{
                  background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                  padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  ⬇ Export CSV
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : overdue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi overdue book nahi hai 🎉</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>BOOK</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>MEMBER</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>DUE DATE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>OVERDUE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>EST. FINE</th>
                      <th style={{ padding: '8px 6px', color: '#94a3b8', fontSize: 11 }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map(o => (
                      <tr key={o.issue_id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '10px 6px', fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{o.book_title}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{o.member_name}</td>
                        <td style={{ padding: '10px 6px', color: '#64748b' }}>{o.due_date}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            background: '#fef2f2', color: '#dc2626',
                          }}>
                            {o.overdue_days} days
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', color: '#dc2626', fontWeight: 700 }}>₹{fmt(o.estimated_fine)}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <button onClick={() => sendReminder(o.issue_id)} style={{
                            background: '#eff6ff', color: '#0176d3', border: 'none', borderRadius: 6,
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>
                            🔔 Remind
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── FINES ── */}
          {tab === 'FINES' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="date" value={fineFrom} onChange={e => setFineFrom(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
                <input type="date" value={fineTo} onChange={e => setFineTo(e.target.value)}
                  style={{ padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }} />
                {(fineFrom || fineTo) && (
                  <button onClick={() => { setFineFrom(''); setFineTo(''); }} style={{
                    background: '#f1f5f9', border: 'none', borderRadius: 6,
                    padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    ✕ Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
                {[
                  { label: 'Collected', value: fineSummary.total_collected, color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Pending',   value: fineSummary.total_pending,   color: '#dc2626', bg: '#fef2f2' },
                  { label: 'Waived',    value: fineSummary.total_waived,    color: '#64748b', bg: '#f1f5f9' },
                ].map(s => (
                  <div key={s.label} style={{ ...cardStyle, background: s.bg, border: 'none' }}>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>₹{fmt(s.value)}</div>
                  </div>
                ))}
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    Transactions ({fines.length})
                  </h4>
                  <button onClick={() => exportCSV(fines, 'fine_transactions.csv', [
                    { key: 'member_name', label: 'Member' },
                    { key: 'reason', label: 'Reason' },
                    { key: 'amount', label: 'Amount' },
                    { key: 'status', label: 'Status' },
                    { key: 'created_at', label: 'Date' },
                  ])} style={{
                    background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6,
                    padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    ⬇ Export CSV
                  </button>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
                ) : fines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Is range mein koi transaction nahi hai</div>
                ) : (
                  fines.map(f => (
                    <div key={f.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                          {f.member_name} — {f.reason}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(f.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>₹{fmt(f.amount)}</div>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: f.status === 'PAID' ? '#16a34a' : f.status === 'WAIVED' ? '#64748b' : '#dc2626',
                        }}>
                          {f.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── POPULAR BOOKS ── */}
          {tab === 'POPULAR' && (
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Most Issued Books
              </h4>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : popular.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Abhi data nahi hai</div>
              ) : (
                popular.map((p, idx) => (
                  <div key={p.book_id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                  }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: idx < 3 ? '#fef3c7' : '#f1f5f9',
                      color: idx < 3 ? '#d97706' : '#64748b',
                      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.author}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#4f46e5' }}>{p.issue_count}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>issues</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ACTIVITY LOG ── */}
          {tab === 'ACTIVITY' && (
            <div style={cardStyle}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                Recent Activity
              </h4>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
              ) : activity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi activity nahi hai</div>
              ) : (
                activity.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                  }}>
                    <div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: '#eef2ff', color: '#4f46e5', marginRight: 8,
                      }}>
                        {a.action}
                      </span>
                      <span style={{ fontSize: 12, color: darkMode ? '#cbd5e1' : '#334155' }}>{a.details}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {new Date(a.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
