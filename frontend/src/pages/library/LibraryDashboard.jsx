import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

function fmt(n) {
  return (n || 0).toLocaleString('en-IN');
}

const CARD_DEFS = [
  { key: 'total_books',     label: 'Total Books',       icon: 'ti-books',           color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
  { key: 'available_books', label: 'Available in Stack', icon: 'ti-book-2',          color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { key: 'issued_books',    label: 'Currently Issued',  icon: 'ti-arrows-exchange', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  { key: 'overdue_books',   label: 'Overdue Returns',   icon: 'ti-alert-triangle',  color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  { key: 'reserved_books',  label: 'Reserved Books',    icon: 'ti-clock',           color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { key: 'lost_books',      label: 'Lost / Damaged',    icon: 'ti-file-x',         color: '#991b1b', gradient: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)' },
  { key: 'total_members',   label: 'Registered Members',icon: 'ti-users',           color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' },
  { key: 'today_issued',    label: "Today's Issues",    icon: 'ti-plus',            color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { key: 'today_returned',  label: "Today's Returns",   icon: 'ti-corner-down-left',color: '#059669', gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
  { key: 'today_fine',      label: "Today's Fines",     icon: 'ti-cash',            color: '#ea580c', gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', money: true },
  { key: 'month_fine',      label: 'Monthly Fine Total',icon: 'ti-report-money',    color: '#b45309', gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)', money: true },
  { key: 'new_books_month', label: 'New Catalog Added', icon: 'ti-sparkles',        color: '#4f46e5', gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' },
];

export default function LibraryDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [overdue, setOverdue]   = useState([]);
  const [popular, setPopular]   = useState([]);

  useEffect(() => {
    localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/library/dashboard'),
      api.get('/library/reports/overdue'),
      api.get('/library/reports/popular-books?limit=6'),
    ])
      .then(([d, o, p]) => {
        setStats(d.data);
        setOverdue(Array.isArray(o.data) ? o.data.slice(0, 6) : []);
        setPopular(Array.isArray(p.data) ? p.data : []);
      })
      .catch(() => toast.error('Dashboard load nahi ho paya'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Smart Library Management System" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">

          {/* ══ Hero Command Banner ══ */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '20px', padding: '24px 28px', marginBottom: '22px',
            background: darkMode
              ? 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
            color: '#ffffff',
            boxShadow: '0 10px 30px -5px rgba(79, 70, 229, 0.35)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.2)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase'
                  }}>
                    📚 Learning Resource Center
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Active Circulation Engine
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  Library Operations Center
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'rgba(255,255,255,0.85)' }}>
                  Monitor book circulation, manage reservations, track overdue returns, and collect fines.
                </p>
              </div>

              {/* Quick Launchpad Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/library/issue-return')}
                  style={{
                    background: '#ffffff', color: '#4f46e5', border: 'none', borderRadius: '10px',
                    padding: '10px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-arrows-exchange" /> Issue / Return Book
                </button>
                <button
                  onClick={() => navigate('/library/books')}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-books" /> Catalog Search
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>Loading Library Catalog &amp; Metrics...</div>
            </div>
          ) : (
            <>
              {/* ══ Bento Metric Cards ══ */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '14px', marginBottom: '24px',
              }}>
                {CARD_DEFS.map(c => (
                  <div
                    key={c.key}
                    style={{
                      background: darkMode ? '#111827' : '#ffffff',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                      borderRadius: '16px', padding: '16px 18px',
                      boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(15,23,42,0.03)',
                      transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: c.gradient, color: '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 10px -2px ${c.color}60`
                      }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: '18px' }} />
                      </div>
                      <span style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                        {c.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      {c.money ? `₹${fmt(stats?.[c.key])}` : fmt(stats?.[c.key])}
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ Two-Column Intelligence Grid ══ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>

                {/* Overdue Returns Alert Panel */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block'
                      }} />
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        Overdue Books Pending Return
                      </h4>
                    </div>
                    <button
                      onClick={() => navigate('/library/issue-return')}
                      style={{
                        fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      Process Return <i className="ti ti-arrow-right" />
                    </button>
                  </div>

                  {overdue.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 12px', fontSize: '13px', color: '#94a3b8' }}>
                      <i className="ti ti-circle-check" style={{ fontSize: '32px', color: '#10b981', display: 'block', marginBottom: '6px' }} />
                      Koi overdue book pending nahi hai 🎉
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {overdue.map(o => (
                        <div key={o.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 14px', borderRadius: '12px',
                          background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                        }}>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {o.book_title}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                              👤 {o.member_name} · Due: {o.due_date}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: 800, color: '#ef4444',
                            background: darkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                            padding: '4px 10px', borderRadius: '20px', flexShrink: 0
                          }}>
                            {o.overdue_days}d overdue
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Popular Circulated Books Leaderboard */}
                <div style={{
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
                  borderRadius: '18px', padding: '20px',
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <i className="ti ti-trophy" style={{ color: '#f59e0b', fontSize: '18px' }} />
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      Most Popular Books
                    </h4>
                  </div>

                  {popular.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 12px', fontSize: '13px', color: '#94a3b8' }}>
                      Abhi tak koi circulation frequency record nahi hua
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {popular.map((p, i) => (
                        <div key={p.book_id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', borderRadius: '12px',
                          background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                        }}>
                          <span style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                            background: i === 0 ? '#fef3c7' : i === 1 ? '#e2e8f0' : i === 2 ? '#ffedd5' : (darkMode ? '#0f172a' : '#f1f5f9'),
                            color: i === 0 ? '#b45309' : i === 1 ? '#475569' : i === 2 ? '#c2410c' : '#64748b',
                            fontSize: '11px', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {i + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>✍️ {p.author}</div>
                          </div>
                          <span style={{
                            fontSize: '12px', fontWeight: 800, color: '#6366f1',
                            background: darkMode ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
                            padding: '3px 8px', borderRadius: '8px'
                          }}>
                            {p.issue_count}× issued
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
