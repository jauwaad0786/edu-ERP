// frontend/src/pages/dashboard/LibrarianDashboard.jsx
// Librarian — Library Operations Center

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const C = {
  bg:      '#f0f4f8',
  surface: '#ffffff',
  border:  '#e2e8f0',
  primary: '#0176d3',
  teal:    '#0891b2',
  green:   '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
  text:    '#1e293b',
  muted:   '#64748b',
  light:   '#f8fafc',
};

const PIE_COLORS = [C.teal, C.green, C.warning, C.error];

function KPI({ icon, label, value, sub, color = C.primary, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
        boxShadow: hover && onClick ? '0 6px 20px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transform: hover && onClick ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{ width: 50, height: 50, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Card({ title, icon, action, children, extra = {} }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 22px', ...extra }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 15, color: C.teal }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QA({ icon, label, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px',
        background: hover ? `${color}15` : `${color}08`,
        border: `1px solid ${hover ? color + '60' : color + '25'}`,
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </button>
  );
}

export default function LibrarianDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const goTo = useCallback((path) => navigate(resolveTenantPath(path, user)), [navigate, user]);

  const [dashboard, setDashboard] = useState(null);
  const [recentTx,  setRecentTx]  = useState([]);
  const [overdue,   setOverdue]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/library/dashboard').catch(() => ({ data: null })),
      api.get('/library/issue-return', { params: { per_page: 8, sort_by: 'issued_at', sort_dir: 'desc' } }).catch(() => ({ data: { transactions: [] } })),
      api.get('/library/issue-return', { params: { status: 'OVERDUE', per_page: 6 } }).catch(() => ({ data: { transactions: [] } })),
    ]).then(([dash, tx, ov]) => {
      setDashboard(dash.data);
      setRecentTx(tx.data?.transactions || tx.data?.issues || []);
      setOverdue(ov.data?.transactions || ov.data?.issues || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = dashboard || {};
  const totalBooks     = d.total_books     ?? d.books_total     ?? null;
  const availableBooks = d.available_books ?? d.books_available ?? null;
  const issuedBooks    = d.issued_books    ?? d.books_issued    ?? null;
  const overdueCount   = d.overdue_books   ?? d.overdue_count   ?? overdue.length;
  const finesCollected = d.fines_collected ?? null;
  const pendingFines   = d.pending_fines   ?? null;
  const totalMembers   = d.total_members   ?? null;

  const pieData = [
    availableBooks != null && { name: 'Available', value: availableBooks },
    issuedBooks    != null && { name: 'Issued',    value: issuedBooks    },
    overdueCount   != null && overdueCount > 0 && { name: 'Overdue', value: overdueCount },
  ].filter(Boolean);

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Library Operations Center" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
        <div className="page-body" style={{ background: C.bg, padding: '20px 24px', minHeight: '100vh' }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 18, padding: '26px 32px', marginBottom: 24,
            background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #0369a1 80%, #0891b2 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(8,145,178,0.35)',
          }}>
            <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.75, marginBottom: 6 }}>
                  {todayStr.toUpperCase()} · LIBRARY OPERATIONS
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Library Command Center</h1>
                <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>
                  {totalBooks != null ? `${totalBooks.toLocaleString()} books` : 'Loading…'}
                  {availableBooks != null ? ` · ${availableBooks} available` : ''}
                  {totalMembers != null ? ` · ${totalMembers} members` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => goTo('/library/issue-return')} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: '#fff', color: '#0891b2', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <i className="ti ti-arrows-exchange" /> Issue / Return
                </button>
                <button onClick={() => goTo('/library/books')} style={{
                  padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(4px)',
                }}>
                  <i className="ti ti-books" /> Book Master
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
              <i className="ti ti-loader-2" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Loading library data…</p>
            </div>
          ) : (
            <>
              {/* ── KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KPI icon="ti-books" label="Total Books" value={totalBooks?.toLocaleString()} color={C.teal} onClick={() => goTo('/library/books')} />
                <KPI icon="ti-book-2" label="Available" value={availableBooks?.toLocaleString()} color={C.green} onClick={() => goTo('/library/books')} />
                <KPI icon="ti-arrows-exchange" label="Currently Issued" value={issuedBooks?.toLocaleString()} color={C.primary} onClick={() => goTo('/library/issue-return')} />
                <KPI icon="ti-clock" label="Overdue Books" value={overdueCount?.toLocaleString()}
                     sub="Action needed"
                     color={overdueCount > 0 ? C.error : C.green}
                     onClick={() => goTo('/library/fines')} />
                <KPI icon="ti-currency-rupee" label="Fines Collected" value={finesCollected != null ? `₹${Number(finesCollected).toLocaleString('en-IN')}` : '—'}
                     color={C.green} onClick={() => goTo('/library/fines')} />
                <KPI icon="ti-users" label="Active Members" value={totalMembers?.toLocaleString()} color={C.primary} onClick={() => goTo('/library/members')} />
              </div>

              {/* ── Row 2: Pie + Quick Actions ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Book Status Pie */}
                <Card title="Book Status Distribution" icon="ti-chart-pie">
                  {pieData.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ResponsiveContainer width="50%" height={160}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [v, '']} contentStyle={{ fontSize: 11, borderRadius: 7 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1 }}>
                        {pieData.map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i], flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{item.name}</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: PIE_COLORS[i] }}>{item.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-book" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No book data available</p>
                    </div>
                  )}
                </Card>

                {/* Quick Actions */}
                <Card title="Quick Actions" icon="ti-bolt">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <QA icon="ti-arrows-exchange" label="Issue Book"    color={C.teal}    onClick={() => goTo('/library/issue-return')} />
                    <QA icon="ti-book-upload"    label="Return Book"   color={C.green}   onClick={() => goTo('/library/issue-return')} />
                    <QA icon="ti-book-2"          label="Add Book"      color={C.primary} onClick={() => goTo('/library/books')} />
                    <QA icon="ti-clock"           label="Reservations"  color={C.warning} onClick={() => goTo('/library/reservations')} />
                    <QA icon="ti-users"           label="Members"       color="#7c3aed"   onClick={() => goTo('/library/members')} />
                    <QA icon="ti-currency-rupee"  label="Fines"         color={C.error}   onClick={() => goTo('/library/fines')} />
                    <QA icon="ti-report"          label="Reports"       color={C.muted}   onClick={() => goTo('/library/reports')} />
                  </div>
                </Card>
              </div>

              {/* ── Row 3: Recent Transactions + Overdue ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Recent Transactions */}
                <Card
                  title="Recent Transactions"
                  icon="ti-arrows-exchange"
                  action={
                    <button onClick={() => goTo('/library/issue-return')} style={{
                      fontSize: 12, color: C.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>View All →</button>
                  }
                >
                  {recentTx.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-arrows-exchange" style={{ fontSize: 28, opacity: 0.4 }} />
                      <p style={{ marginTop: 8 }}>No recent transactions</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recentTx.slice(0, 6).map((tx, i) => (
                        <div key={i} style={{
                          padding: '10px 12px', borderRadius: 9, background: C.light,
                          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: tx.status === 'RETURNED' ? `${C.green}15` : tx.status === 'OVERDUE' ? `${C.error}15` : `${C.teal}15`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <i className={`ti ${tx.status === 'RETURNED' ? 'ti-check' : tx.status === 'OVERDUE' ? 'ti-alert-circle' : 'ti-arrow-right'}`}
                               style={{ fontSize: 14, color: tx.status === 'RETURNED' ? C.green : tx.status === 'OVERDUE' ? C.error : C.teal }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.book_title || tx.book?.title || 'Book'}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                              {tx.member_name || tx.student_name || tx.user_name || 'Member'} · {tx.issued_date || tx.issue_date ? new Date(tx.issued_date || tx.issue_date).toLocaleDateString('en-IN') : '—'}
                            </div>
                          </div>
                          <span style={{
                            padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, flexShrink: 0,
                            background: tx.status === 'RETURNED' ? `${C.green}15` : tx.status === 'OVERDUE' ? `${C.error}15` : `${C.teal}15`,
                            color: tx.status === 'RETURNED' ? C.green : tx.status === 'OVERDUE' ? C.error : C.teal,
                          }}>{tx.status || 'ISSUED'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Overdue Books */}
                <Card
                  title={`Overdue Books (${overdueCount || 0})`}
                  icon="ti-clock"
                  action={
                    <button onClick={() => goTo('/library/fines')} style={{
                      fontSize: 12, color: C.error, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>Manage Fines →</button>
                  }
                >
                  {overdue.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted, fontSize: 13 }}>
                      <i className="ti ti-circle-check" style={{ fontSize: 28, color: C.green, opacity: 0.7 }} />
                      <p style={{ marginTop: 8 }}>No overdue books! All clear.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {overdue.slice(0, 6).map((ov, i) => {
                        const dueDate = ov.due_date || ov.return_due_date;
                        const days = dueDate ? Math.floor((new Date() - new Date(dueDate)) / 86400000) : null;
                        return (
                          <div key={i} style={{
                            padding: '10px 12px', borderRadius: 9, background: '#fef2f2',
                            border: `1px solid #fecaca`, display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: C.error, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ov.book_title || ov.book?.title || 'Book'}
                              </div>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                                {ov.member_name || ov.student_name || 'Member'}
                                {days != null && ` · ${days} day${days !== 1 ? 's' : ''} overdue`}
                              </div>
                            </div>
                            {ov.fine_amount != null && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.error, flexShrink: 0 }}>
                                ₹{ov.fine_amount}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
