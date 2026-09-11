import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar  from '../../components/Sidebar';
import Navbar   from '../../components/Navbar';
import api      from '../../api/axios';
import { StatusBadge, PriorityBadge } from '../../components/communication/StatusBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, sub, darkMode, onClick, active }) {
  const border = darkMode ? '#1e293b' : '#e2e8f0';
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
        background:   active ? (color + '14') : (darkMode ? '#141b2d' : '#fff'),
        border:       `1px solid ${active ? color : border}`,
        borderRadius: 14,
        padding:      '18px 20px',
        cursor:       onClick ? 'pointer' : 'default',
        transition:   'all 0.15s',
        display:      'flex',
        flexDirection:'column',
        gap:          6,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => onClick && !active && (e.currentTarget.style.borderColor = border)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
        </div>
        {sub !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: darkMode ? '#1e293b' : '#f1f5f9',
            color: darkMode ? '#64748b' : '#94a3b8',
          }}>{sub}</span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: active ? color : (darkMode ? '#f1f5f9' : '#0f172a') }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: darkMode ? '#64748b' : '#94a3b8', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Mini ticket row ──────────────────────────────────────────────────────────

function TicketRow({ ticket, darkMode, onClick }) {
  const border  = darkMode ? '#1e293b' : '#f1f5f9';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '11px 16px',
        borderBottom: `1px solid ${border}`,
        cursor:       'pointer',
        transition:   'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#1a2236' : '#f8faff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Priority dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: ticket.priority === 'CRITICAL' ? '#ef4444'
          : ticket.priority === 'HIGH'     ? '#f97316'
          : ticket.priority === 'MEDIUM'   ? '#f59e0b'
          : '#94a3b8',
      }} />

      {/* Ticket info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: textPri,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ticket.subject}
        </div>
        <div style={{ fontSize: 11, color: textSec, marginTop: 2, display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: 'monospace' }}>{ticket.ticket_no}</span>
          <span>·</span>
          <span>{ticket.school_name || 'Unknown'}</span>
          {ticket.module_name && <><span>·</span><span>{ticket.module_name}</span></>}
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <StatusBadge status={ticket.status} size="xs" />
        <span style={{ fontSize: 10, color: textSec }}>{timeAgo(ticket.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PRODUCT_OPTIONS = [
  { value: '',            label: 'All Products'   },
  { value: 'EduERP',      label: '🎓 EduERP'      },
  { value: 'CollegeERP',  label: '🏛️ CollegeERP'  },
  { value: 'HotelERP',    label: '🏨 HotelERP'    },
  { value: 'HospitalERP', label: '🏥 HospitalERP' },
  { value: 'HRMERP',      label: '👥 HRMERP'      },
  { value: 'SalesERP',    label: '📊 SalesERP'    },
];

const STATUS_TABS = [
  { key: '',            label: 'All'         },
  { key: 'OPEN',        label: 'Open'        },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'PENDING',     label: 'Pending'     },
  { key: 'RESOLVED',    label: 'Resolved'    },
  { key: 'CLOSED',      label: 'Closed'      },
];

export default function SupportDashboard() {
  const navigate   = useNavigate();
  const [darkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');

  // Summary
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [statusTab,   setStatusTab]   = useState('');
  const [productType, setProductType] = useState('');
  const [priority,    setPriority]    = useState('');
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page,        setPage]        = useState(1);

  // Tickets
  const [tickets, setTickets] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Today's meetings
  const [meetings, setMeetings] = useState([]);

  const PER_PAGE = 15;

  // ── Fetch summary ────────────────────────────────────────────────────────────
  useEffect(() => {
    setSummaryLoading(true);
    api.get('/support/tickets/dashboard/summary')
      .then(r => setSummary(r.data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  // ── Fetch today's meetings ───────────────────────────────────────────────────
  useEffect(() => {
    api.get('/support/meetings/today')
      .then(r => setMeetings(r.data?.meetings || []))
      .catch(() => {});
  }, []);

  // ── Fetch tickets ────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(() => {
    setTicketsLoading(true);
    const params = new URLSearchParams();
    if (statusTab)   params.set('status',       statusTab);
    if (productType) params.set('product_type', productType);
    if (priority)    params.set('priority',     priority);
    if (search)      params.set('search',       search);
    params.set('page',     page);
    params.set('per_page', PER_PAGE);

    api.get(`/support/tickets?${params}`)
      .then(r => {
        setTickets(r.data?.data  || []);
        setTotal(r.data?.total   || 0);
        setPages(r.data?.pages   || 1);
      })
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, [statusTab, productType, priority, search, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); }, [statusTab, productType, priority, search]);

  // ── Theme ────────────────────────────────────────────────────────────────────
  const bg      = darkMode ? '#0b1220' : '#f4f6fa';
  const cardBg  = darkMode ? '#141b2d' : '#ffffff';
  const border  = darkMode ? '#1e293b' : '#e2e8f0';
  const textPri = darkMode ? '#f1f5f9' : '#0f172a';
  const textSec = darkMode ? '#64748b' : '#94a3b8';
  const inputBg = darkMode ? '#0f172a' : '#fff';

  const tabActive   = { background: '#4f46e5', color: '#fff', fontWeight: 700 };
  const tabInactive = { background: darkMode ? '#1e293b' : '#f1f5f9', color: textSec, fontWeight: 500 };

  const s = summary;

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Support Dashboard" darkMode={darkMode} onToggleDark={() => {}} />

        <div className="page-body" style={{ background: bg }}>

          {/* ── Page Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: textPri }}>
                Support Dashboard
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: textSec }}>
                All tickets across all schools and products
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/support/meetings')}
                style={{
                  padding: '8px 16px', borderRadius: 9,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: darkMode ? '#cbd5e1' : '#475569',
                  border: `1px solid ${border}`, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="ti ti-calendar" style={{ fontSize: 14 }} />
                Meetings
              </button>
              <button
                onClick={() => navigate('/support/kb')}
                style={{
                  padding: '8px 16px', borderRadius: 9,
                  background: '#4f46e5', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <i className="ti ti-book" style={{ fontSize: 14 }} />
                Help Center
              </button>
            </div>
          </div>

          {/* ── Stat Cards ── */}
          {summaryLoading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12, marginBottom: 22,
            }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 14, padding: 20, height: 96,
                  opacity: 0.5,
                }} />
              ))}
            </div>
          ) : s && (
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap:                 12,
              marginBottom:        22,
            }}>
              <StatCard
                label="Total Tickets" value={s.summary?.total}
                icon="ti-ticket" color="#4f46e5" darkMode={darkMode}
              />
              <StatCard
                label="Open" value={s.summary?.open}
                icon="ti-folder-open" color="#3b82f6" darkMode={darkMode}
                onClick={() => setStatusTab('OPEN')} active={statusTab === 'OPEN'}
              />
              <StatCard
                label="In Progress" value={s.summary?.pending}
                icon="ti-progress" color="#8b5cf6" darkMode={darkMode}
                onClick={() => setStatusTab('IN_PROGRESS')} active={statusTab === 'IN_PROGRESS'}
              />
              <StatCard
                label="Pending" value={s.summary?.pending}
                icon="ti-clock" color="#f59e0b" darkMode={darkMode}
                onClick={() => setStatusTab('PENDING')} active={statusTab === 'PENDING'}
              />
              <StatCard
                label="Critical" value={s.summary?.critical}
                icon="ti-alert-triangle" color="#ef4444" darkMode={darkMode}
                onClick={() => setPriority('CRITICAL')} active={priority === 'CRITICAL'}
              />
              <StatCard
                label="Resolved" value={s.summary?.resolved}
                icon="ti-circle-check" color="#10b981" darkMode={darkMode}
                onClick={() => setStatusTab('RESOLVED')} active={statusTab === 'RESOLVED'}
              />
              
            </div>
          )}

          {/* ── Two-column layout ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'flex-start' }}>

            {/* ── Left: Tickets ── */}
            <div>
              {/* Filters */}
              <div style={{
                background: cardBg, border: `1px solid ${border}`,
                borderRadius: 12, padding: '12px 14px',
                marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
              }}>
                {/* Search */}
                <form
                  onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}
                  style={{ flex: '1 1 180px', display: 'flex', gap: 6 }}
                >
                  <div style={{ position: 'relative', flex: 1 }}>
                    <i className="ti ti-search" style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 13, color: textSec,
                    }} />
                    <input
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      placeholder="Ticket no, school, subject..."
                      style={{
                        width: '100%', padding: '7px 10px 7px 30px',
                        border: `1px solid ${border}`, borderRadius: 8,
                        background: inputBg, color: textPri,
                        fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <button type="submit" style={{
                    padding: '7px 14px', borderRadius: 8,
                    background: '#4f46e5', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}>Go</button>
                  {search && (
                    <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} style={{
                      padding: '7px 10px', borderRadius: 8,
                      background: 'none', border: `1px solid ${border}`,
                      color: textSec, cursor: 'pointer', fontSize: 11,
                    }}>✕</button>
                  )}
                </form>

                {/* Product filter */}
                <select
                  value={productType}
                  onChange={e => setProductType(e.target.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 8,
                    border: `1px solid ${border}`, background: inputBg,
                    color: textPri, fontSize: 12.5, cursor: 'pointer',
                  }}
                >
                  {PRODUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* Priority filter */}
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 8,
                    border: `1px solid ${border}`, background: inputBg,
                    color: textPri, fontSize: 12.5, cursor: 'pointer',
                  }}
                >
                  <option value="">All Priorities</option>
                  <option value="CRITICAL">🔴 Critical</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">⚪ Low</option>
                </select>

                {(priority || productType || search || statusTab) && (
                  <button
                    onClick={() => { setStatusTab(''); setPriority(''); setProductType(''); setSearch(''); setSearchInput(''); }}
                    style={{
                      padding: '7px 10px', borderRadius: 8,
                      background: 'none', border: `1px solid ${border}`,
                      color: textSec, cursor: 'pointer', fontSize: 11,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <i className="ti ti-x" style={{ fontSize: 11 }} /> Reset
                  </button>
                )}
              </div>

              {/* Status tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {STATUS_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setStatusTab(t.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none',
                      cursor: 'pointer', fontSize: 11.5, transition: 'all 0.13s',
                      ...(statusTab === t.key ? tabActive : tabInactive),
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Ticket list */}
              <div style={{
                background: cardBg, border: `1px solid ${border}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '11px 16px', borderBottom: `1px solid ${border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                    {ticketsLoading ? 'Loading...' : `${total} ticket${total !== 1 ? 's' : ''}`}
                  </span>
                  {!ticketsLoading && pages > 1 && (
                    <span style={{ fontSize: 11, color: textSec }}>Page {page} of {pages}</span>
                  )}
                </div>

                {ticketsLoading && (
                  <div style={{ padding: 36, textAlign: 'center', color: textSec, fontSize: 13 }}>
                    <i className="ti ti-loader-2" style={{ fontSize: 24, display: 'block', marginBottom: 6 }} />
                    Loading...
                  </div>
                )}

                {!ticketsLoading && tickets.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: textSec, fontSize: 13 }}>
                    <i className="ti ti-ticket" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                    No tickets match filters
                  </div>
                )}

                {!ticketsLoading && tickets.map(t => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    darkMode={darkMode}
                    onClick={() => navigate(`/support/tickets/${t.id}`)}
                  />
                ))}

                {/* Pagination */}
                {!ticketsLoading && pages > 1 && (
                  <div style={{
                    padding: '10px 16px', borderTop: `1px solid ${border}`,
                    display: 'flex', justifyContent: 'center', gap: 6,
                  }}>
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: `1px solid ${border}`, cursor: page === 1 ? 'not-allowed' : 'pointer',
                        background: inputBg, color: page === 1 ? textSec : textPri,
                      }}
                    >
                      ← Prev
                    </button>
                    {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)} style={{
                        width: 30, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: `1px solid ${p === page ? '#4f46e5' : border}`,
                        background: p === page ? '#4f46e5' : inputBg,
                        color: p === page ? '#fff' : textPri, cursor: 'pointer',
                      }}>{p}</button>
                    ))}
                    <button
                      disabled={page === pages}
                      onClick={() => setPage(p => p + 1)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: `1px solid ${border}`, cursor: page === pages ? 'not-allowed' : 'pointer',
                        background: inputBg, color: page === pages ? textSec : textPri,
                      }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Sidebar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* By Product */}
              {s?.by_product && s.by_product.length > 0 && (
                <div style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                      <i className="ti ti-apps" style={{ fontSize: 14, marginRight: 6, color: '#4f46e5' }} />
                      By Product
                    </span>
                  </div>
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {s.by_product.map((item) => (
                      <div
                        key={item.product_type}
                        role="button"
                        tabIndex={0}
                        onClick={() => setProductType(item.product_type)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setProductType(item.product_type);
                          }
                        }}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                          background: productType === item.product_type
                            ? (darkMode ? '#1e1b4b' : '#eef2ff')
                            : 'transparent',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#1e293b' : '#f8faff'}
                        onMouseLeave={e => e.currentTarget.style.background =
                          productType === item.product_type
                            ? (darkMode ? '#1e1b4b' : '#eef2ff')
                            : 'transparent'
                        }
                      >
                        <span style={{ fontSize: 13, color: textPri, fontWeight: 500 }}>{item.product_type}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: '#eef2ff', color: '#4f46e5',
                        }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Today's Meetings */}
              <div style={{
                background: cardBg, border: `1px solid ${border}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 16px', borderBottom: `1px solid ${border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                    <i className="ti ti-calendar-event" style={{ fontSize: 14, marginRight: 6, color: '#7c3aed' }} />
                    Today's Meetings
                  </span>
                  <button
                    onClick={() => navigate('/support/meetings')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: '#4f46e5', fontWeight: 600,
                    }}
                  >
                    View all
                  </button>
                </div>

                {meetings.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: textSec, fontSize: 12 }}>
                    <i className="ti ti-calendar-off" style={{ fontSize: 24, display: 'block', marginBottom: 6 }} />
                    No meetings today
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {meetings.map(m => (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/support/meetings')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/support/meetings');
                          }
                        }}
                        style={{
                          padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${border}`,
                          background: darkMode ? '#0f172a' : '#f8fafc',
                          transition: 'border-color 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = border}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: textPri }}>{m.topic}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                            background: m.status === 'ACCEPTED' ? '#dcfce7' : '#fef9c3',
                            color:      m.status === 'ACCEPTED' ? '#16a34a' : '#ca8a04',
                          }}>{m.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: textSec, display: 'flex', gap: 8 }}>
                          <span><i className="ti ti-clock" style={{ fontSize: 11 }} /> {m.meeting_time}</span>
                          <span><i className="ti ti-building" style={{ fontSize: 11 }} /> {m.school_name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: textSec, marginTop: 3 }}>
                          <i className="ti ti-video" style={{ fontSize: 11, marginRight: 3 }} />
                          {m.preferred_mode?.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By School — top 5 */}
              {s?.by_school && s.by_school.length > 0 && (
                <div style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: textPri }}>
                      <i className="ti ti-building" style={{ fontSize: 14, marginRight: 6, color: '#0891b2' }} />
                      Top Schools by Tickets
                    </span>
                  </div>
                  <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.by_school.slice(0, 5).map((school, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 0', borderBottom: i < 4 ? `1px solid ${border}` : 'none',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12.5, fontWeight: 600, color: textPri,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {school.school_name || 'Unknown'}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: '#ecfeff', color: '#0891b2', flexShrink: 0, marginLeft: 8,
                        }}>
                          {school.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card { background: #141b2d !important; border-color: #1e293b !important; }
      `}</style>
    </div>
  );
}
