import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar   from '../../components/Sidebar';
import Navbar    from '../../components/Navbar';
import api       from '../../api/axios';
import TicketCard from '../../components/communication/TicketCard';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',           label: 'All'         },
  { key: 'OPEN',       label: 'Open'        },
  { key: 'IN_PROGRESS',label: 'In Progress' },
  { key: 'PENDING',    label: 'Pending'     },
  { key: 'WAITING',    label: 'Waiting'     },
  { key: 'RESOLVED',   label: 'Resolved'    },
  { key: 'CLOSED',     label: 'Closed'      },
];

const PRIORITY_OPTIONS = [
  { value: '',         label: 'All Priorities' },
  { value: 'CRITICAL', label: '🔴 Critical'    },
  { value: 'HIGH',     label: '🟠 High'        },
  { value: 'MEDIUM',   label: '🟡 Medium'      },
  { value: 'LOW',      label: '⚪ Low'         },
];

const CATEGORY_OPTIONS = [
  { value: '',                label: 'All Categories'  },
  { value: 'COMPLAINT',       label: 'Complaint'       },
  { value: 'SUGGESTION',      label: 'Suggestion'      },
  { value: 'FEEDBACK',        label: 'Feedback'        },
  { value: 'TECHNICAL',       label: 'Technical'       },
  { value: 'ACADEMIC',        label: 'Academic'        },
  { value: 'FEE',             label: 'Fee Related'     },
  { value: 'TEACHER',         label: 'Teacher Related' },
  { value: 'STUDENT',         label: 'Student Related' },
  { value: 'PARENT_QUERY',    label: 'Parent Query'    },
  { value: 'WEBSITE_BUG',     label: 'Website Bug'     },
  { value: 'ERP_BUG',         label: 'ERP Bug'         },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'GENERAL',         label: 'General'         },
  { value: 'EMERGENCY',       label: 'Emergency'       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, count, color, icon, darkMode, onClick, active }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background:   active
          ? (color + '18')
          : (darkMode ? '#141b2d' : '#fff'),
        border:       `1px solid ${active ? color : (darkMode ? '#1e293b' : '#e2e8f0')}`,
        borderRadius: 12,
        padding:      '14px 16px',
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'all 0.15s',
        display:      'flex',
        alignItems:   'center',
        gap:          12,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: color + '1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: active ? color : (darkMode ? '#f1f5f9' : '#0f172a') }}>
          {count ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8', fontWeight: 500 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SupportInbox({ isAdminView = false }) {
  const navigate  = useNavigate();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  // Filters
  const [statusTab,  setStatusTab]  = useState('');
  const [priority,   setPriority]   = useState('');
  const [category,   setCategory]   = useState('');
  const [search,     setSearch]     = useState('');
  const [searchInput,setSearchInput]= useState('');
  const [page,       setPage]       = useState(1);

  // Data
  const [tickets,  setTickets]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [summary,  setSummary]  = useState(null);

  const PER_PAGE = 10;

  // ── Fetch summary cards ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdminView) return;
    api.get('/support/tickets/dashboard/summary')
      .then(r => setSummary(r.data))
      .catch(() => {});
  }, [isAdminView]);

  // ── Fetch tickets ────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusTab)  params.set('status',   statusTab);
    if (priority)   params.set('priority', priority);
    if (category)   params.set('category', category);
    if (search)     params.set('search',   search);
    params.set('page',     page);
    params.set('per_page', PER_PAGE);

    api.get(`/support/tickets?${params}`)
      .then(r => {
        setTickets(r.data?.data  || []);
        setTotal(r.data?.total   || 0);
        setPages(r.data?.pages   || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusTab, priority, category, search, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusTab, priority, category, search]);

  // Search submit
  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  // ── Theme ────────────────────────────────────────────────────────────────────
  const bg      = darkMode ? '#0b1220' : '#f4f6fa';
  const cardBg  = darkMode ? '#141b2d' : '#ffffff';
  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';
  const inputBg = darkMode ? '#0f172a' : '#fff';

  const tabActive = {
    background: '#4f46e5',
    color:      '#fff',
    fontWeight: 700,
  };
  const tabInactive = {
    background: darkMode ? '#1e293b' : '#f1f5f9',
    color:      textSec,
    fontWeight: 500,
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar
          title="Support Requests"
          darkMode={darkMode}
          onToggleDark={() => {}}
        />

        <div className="page-body" style={{ background: bg }}>

          {/* ── Page Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPri }}>
                {isAdminView ? 'All Support Requests' : 'My Support Requests'}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: textSec }}>
                {isAdminView
                  ? 'Manage tickets across all schools and products'
                  : 'Track and manage your support tickets'}
              </p>
            </div>
            <button
              onClick={() => navigate('/support/tickets/new')}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         6,
                padding:     '9px 18px',
                borderRadius: 9,
                background:  '#4f46e5',
                color:       '#fff',
                border:      'none',
                cursor:      'pointer',
                fontSize:    13,
                fontWeight:  700,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 15 }} />
              Raise a Ticket
            </button>
          </div>

          {/* ── Summary Cards (admin only) ── */}
          {isAdminView && summary && (
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap:                 12,
              marginBottom:        20,
            }}>
              <StatCard label="Open"        count={summary.by_status?.OPEN}        color="#3b82f6" icon="ti-folder-open"   darkMode={darkMode} onClick={() => setStatusTab('OPEN')}        active={statusTab === 'OPEN'} />
              <StatCard label="In Progress" count={summary.by_status?.IN_PROGRESS} color="#8b5cf6" icon="ti-progress"      darkMode={darkMode} onClick={() => setStatusTab('IN_PROGRESS')} active={statusTab === 'IN_PROGRESS'} />
              <StatCard label="Pending"     count={summary.by_status?.PENDING}     color="#f59e0b" icon="ti-clock"         darkMode={darkMode} onClick={() => setStatusTab('PENDING')}     active={statusTab === 'PENDING'} />
              <StatCard label="Critical"    count={summary.by_priority?.CRITICAL}  color="#ef4444" icon="ti-alert-triangle"darkMode={darkMode} onClick={() => setPriority('CRITICAL')}    active={priority === 'CRITICAL'} />
              <StatCard label="Resolved"    count={summary.by_status?.RESOLVED}    color="#10b981" icon="ti-circle-check"  darkMode={darkMode} onClick={() => setStatusTab('RESOLVED')}   active={statusTab === 'RESOLVED'} />
            </div>
          )}

          {/* ── Filters bar ── */}
          <div style={{
            background:   cardBg,
            border:       `1px solid ${border}`,
            borderRadius: 12,
            padding:      '12px 16px',
            marginBottom: 14,
            display:      'flex',
            gap:          10,
            flexWrap:     'wrap',
            alignItems:   'center',
          }}>
            {/* Search */}
            <form onSubmit={handleSearch} style={{ flex: '1 1 200px', display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <i className="ti ti-search" style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, color: textSec,
                }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search tickets..."
                  style={{
                    width: '100%', padding: '8px 10px 8px 32px',
                    border: `1px solid ${border}`, borderRadius: 8,
                    background: inputBg, color: textPri,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button type="submit" style={{
                padding: '8px 14px', borderRadius: 8,
                background: '#4f46e5', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                Search
              </button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: textSec, border: `1px solid ${border}`,
                  cursor: 'pointer', fontSize: 12,
                }}>
                  Clear
                </button>
              )}
            </form>

            {/* Priority filter */}
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              style={{
                padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${border}`, background: inputBg,
                color: textPri, fontSize: 13, cursor: 'pointer',
              }}
            >
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Category filter */}
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${border}`, background: inputBg,
                color: textPri, fontSize: 13, cursor: 'pointer',
              }}
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Reset all */}
            {(priority || category || search || statusTab) && (
              <button
                onClick={() => {
                  setStatusTab(''); setPriority(''); setCategory('');
                  setSearch(''); setSearchInput(''); setPage(1);
                }}
                style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'none', border: `1px solid ${border}`,
                  color: textSec, cursor: 'pointer', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <i className="ti ti-x" style={{ fontSize: 12 }} /> Reset filters
              </button>
            )}
          </div>

          {/* ── Status tabs ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                style={{
                  padding:      '6px 14px',
                  borderRadius: 20,
                  border:       'none',
                  cursor:       'pointer',
                  fontSize:     12,
                  transition:   'all 0.13s',
                  ...(statusTab === t.key ? tabActive : tabInactive),
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Ticket list ── */}
          <div style={{
            background:   cardBg,
            border:       `1px solid ${border}`,
            borderRadius: 12,
            overflow:     'hidden',
          }}>
            {/* List header */}
            <div style={{
              padding:     '12px 18px',
              borderBottom: `1px solid ${border}`,
              display:     'flex',
              justifyContent: 'space-between',
              alignItems:  'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                {loading ? 'Loading...' : `${total} ticket${total !== 1 ? 's' : ''}`}
              </span>
              {total > 0 && (
                <span style={{ fontSize: 11, color: textSec }}>
                  Page {page} of {pages}
                </span>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: textSec }}>
                <i className="ti ti-loader-2" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>Loading tickets...</div>
              </div>
            )}

            {/* Empty state */}
            {!loading && tickets.length === 0 && (
              <div style={{ padding: 52, textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: darkMode ? '#1e293b' : '#eef2ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <i className="ti ti-ticket" style={{ fontSize: 28, color: '#4f46e5' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: textPri, marginBottom: 6 }}>
                  No tickets found
                </div>
                <div style={{ fontSize: 13, color: textSec, marginBottom: 20 }}>
                  {search || statusTab || priority || category
                    ? 'Try adjusting your filters'
                    : 'Raise your first support ticket to get started'}
                </div>
                <button
                  onClick={() => navigate('/support/tickets/new')}
                  style={{
                    padding: '9px 22px', borderRadius: 9,
                    background: '#4f46e5', color: '#fff',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  Raise a Ticket
                </button>
              </div>
            )}

            {/* Ticket cards */}
            {!loading && tickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                darkMode={darkMode}
                showSchool={isAdminView}
              />
            ))}

            {/* Pagination */}
            {!loading && pages > 1 && (
              <div style={{
                padding:     '12px 18px',
                borderTop:   `1px solid ${border}`,
                display:     'flex',
                justifyContent: 'center',
                gap:         8,
              }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    padding: '7px 14px', borderRadius: 8,
                    border: `1px solid ${border}`,
                    background: page === 1 ? (darkMode ? '#0f172a' : '#f8fafc') : inputBg,
                    color: page === 1 ? textSec : textPri,
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  <i className="ti ti-arrow-left" style={{ fontSize: 12 }} /> Prev
                </button>
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        width: 34, height: 34, borderRadius: 8,
                        border: `1px solid ${p === page ? '#4f46e5' : border}`,
                        background: p === page ? '#4f46e5' : inputBg,
                        color: p === page ? '#fff' : textPri,
                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={page === pages}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    padding: '7px 14px', borderRadius: 8,
                    border: `1px solid ${border}`,
                    background: page === pages ? (darkMode ? '#0f172a' : '#f8fafc') : inputBg,
                    color: page === pages ? textSec : textPri,
                    cursor: page === pages ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  Next <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
      `}</style>
    </div>
  );
}
