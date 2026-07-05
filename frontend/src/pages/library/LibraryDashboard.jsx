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
  { key: 'total_books',     label: 'Total Books',       icon: 'ti-books',           color: '#4f46e5' },
  { key: 'available_books', label: 'Available Books',   icon: 'ti-book-2',          color: '#16a34a' },
  { key: 'issued_books',    label: 'Issued Books',      icon: 'ti-arrows-exchange', color: '#0176d3' },
  { key: 'overdue_books',   label: 'Overdue Books',     icon: 'ti-alert-triangle',  color: '#dc2626' },
  { key: 'reserved_books',  label: 'Reserved Books',    icon: 'ti-clock',           color: '#d97706' },
  { key: 'lost_books',      label: 'Lost Books',        icon: 'ti-file-x',         color: '#991b1b' },
  { key: 'total_members',   label: 'Total Members',     icon: 'ti-users',           color: '#7c3aed' },
  { key: 'today_issued',    label: "Today's Issue",     icon: 'ti-plus',            color: '#0891b2' },
  { key: 'today_returned',  label: "Today's Return",    icon: 'ti-corner-down-left',color: '#059669' },
  { key: 'today_fine',      label: "Today's Fine",      icon: 'ti-cash',            color: '#ea580c', money: true },
  { key: 'month_fine',      label: 'Monthly Fine',      icon: 'ti-report-money',    color: '#b45309', money: true },
  { key: 'new_books_month', label: 'New Books (Month)', icon: 'ti-sparkles',        color: '#4338ca' },
];

export default function LibraryDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
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
      api.get('/library/reports/popular-books?limit=5'),
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
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Library Dashboard" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
          ) : (
            <>
              {/* ── KPI Cards ── */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14, marginBottom: 24,
              }}>
                {CARD_DEFS.map(c => (
                  <div key={c.key} style={{
                    background: darkMode ? '#1e293b' : '#fff',
                    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    borderRadius: 12, padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: `${c.color}18`, color: c.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: 16 }} />
                      </div>
                      <span style={{ fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
                        {c.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      {c.money ? `₹${fmt(stats?.[c.key])}` : fmt(stats?.[c.key])}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Two-column: Overdue + Popular Books ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>

                {/* Overdue */}
                <div style={{
                  background: darkMode ? '#1e293b' : '#fff',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 12, padding: 18,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h4 style={{ margin: 0, fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                      ⚠️ Overdue Books
                    </h4>
                    <button onClick={() => navigate('/library/issue-return')} style={{
                      fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}>
                      Issue / Return →
                    </button>
                  </div>
                  {overdue.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: '#94a3b8' }}>
                      Koi overdue book nahi hai 🎉
                    </div>
                  ) : (
                    overdue.map(o => (
                      <div key={o.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                            {o.book_title}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.member_name} · Due {o.due_date}</div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#dc2626',
                          background: '#fef2f2', padding: '3px 8px', borderRadius: 20,
                        }}>
                          {o.overdue_days}d late
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Popular Books */}
                <div style={{
                  background: darkMode ? '#1e293b' : '#fff',
                  border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  borderRadius: 12, padding: 18,
                }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                    📈 Most Popular Books
                  </h4>
                  {popular.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: '#94a3b8' }}>
                      Abhi tak koi issue data nahi hai
                    </div>
                  ) : (
                    popular.map((p, i) => (
                      <div key={p.book_id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 0', borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
                      }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          background: '#f3f0ff', color: '#7c3aed', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.author}</div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{p.issue_count}×</span>
                      </div>
                    ))
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
