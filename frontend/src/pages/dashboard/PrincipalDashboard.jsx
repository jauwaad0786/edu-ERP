import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
//  Role → greeting label + tagline shown in the Welcome Banner.
//  Same component is used by Principal, Vice Principal, Hostel Warden,
//  Transport Manager etc. (they all resolve to this dashboard) so the name
//  AND the role line must come from the logged-in `user` object, never be
//  hardcoded to "Principal".
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_META = {
  PRINCIPAL:       { label: 'Principal',        tagline: 'Great leadership builds great institutions.' },
  DIRECTOR:        { label: 'Director',         tagline: 'Steering the institution forward, one decision at a time.' },
  VICE_PRINCIPAL:  { label: 'Vice Principal',   tagline: 'Supporting every classroom, every single day.' },
  ACCOUNTANT:      { label: 'Accountant',       tagline: 'Precision today, prosperity tomorrow.' },
  LIBRARIAN:       { label: 'Librarian',        tagline: 'Opening minds, one book at a time.' },
  HOSTEL:          { label: 'Hostel Warden',    tagline: 'A safe, caring home away from home.' },
  TRANSPORT:       { label: 'Transport Manager',tagline: 'Every route safe, every child on time.' },
  RECEPTIONIST:    { label: 'Receptionist',     tagline: 'The first smile every visitor sees.' },
  HR:              { label: 'HR Manager',       tagline: 'People first, always.' },
};

function roleMeta(role) {
  if (ROLE_META[role]) return ROLE_META[role];
  const label = (role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'Team Member';
  return { label, tagline: 'Great leadership builds great institutions.' };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Inline SVG illustration for the Welcome Banner — deliberately NOT an icon
//  font glyph (those depend on an icon set being loaded/matching a valid
//  class name; if the class doesn't exist you get nothing rendered, no
//  console error, no broken-image icon — just blank space). Plain SVG always
//  renders, no external asset or font dependency.
// ═══════════════════════════════════════════════════════════════════════════
function SchoolIllustration({ darkMode }) {
  const wall   = darkMode ? '#3b2f78' : '#efe7ff';
  const roof   = '#7c3aed';
  const door   = darkMode ? '#241a56' : '#c9b8f7';
  const glass  = darkMode ? '#4c3d99' : '#ffffff';
  const flag   = '#f59e0b';
  const tree   = '#22c55e';
  const trunk  = '#92400e';

  return (
    <svg width="180" height="144" viewBox="0 0 188 150" aria-hidden="true" focusable="false">
      {/* birds */}
      <path d="M20 22 q4 -6 8 0 q4 -6 8 0" stroke="#7c3aed" strokeWidth="2" fill="none" opacity="0.5" />
      <path d="M150 36 q4 -6 8 0 q4 -6 8 0" stroke="#7c3aed" strokeWidth="2" fill="none" opacity="0.4" />

      {/* trees */}
      <rect x="14" y="96" width="6" height="26" fill={trunk} rx="1" />
      <circle cx="17" cy="88" r="16" fill={tree} opacity="0.85" />
      <rect x="164" y="100" width="6" height="22" fill={trunk} rx="1" />
      <circle cx="167" cy="92" r="14" fill={tree} opacity="0.85" />

      {/* building */}
      <rect x="44" y="60" width="100" height="62" rx="4" fill={wall} />
      <polygon points="94,32 40,60 148,60" fill={roof} />

      {/* flag */}
      <rect x="92" y="14" width="3" height="20" fill={roof} />
      <polygon points="95,14 112,20 95,26" fill={flag} />

      {/* clock */}
      <circle cx="94" cy="70" r="9" fill={glass} stroke={roof} strokeWidth="2" />
      <line x1="94" y1="70" x2="94" y2="64" stroke={roof} strokeWidth="1.5" />
      <line x1="94" y1="70" x2="98" y2="70" stroke={roof} strokeWidth="1.5" />

      {/* windows */}
      <rect x="54" y="86" width="14" height="16" rx="2" fill={glass} />
      <rect x="120" y="86" width="14" height="16" rx="2" fill={glass} />

      {/* door */}
      <rect x="84" y="94" width="20" height="28" rx="2" fill={door} />
      <circle cx="100" cy="108" r="1.4" fill={roof} />

      {/* ground shadow */}
      <rect x="30" y="122" width="128" height="4" rx="2" fill={roof} opacity="0.22" />
    </svg>
  );
}

function StatCard({ icon, label, value, sub, color = '#4f46e5', tint, darkMode }) {
  return (
    <div className="stat-card" style={{
      background: darkMode ? '#141b2d' : undefined,
      borderColor: darkMode ? '#1e293b' : undefined,
    }}>
      <div className="stat-icon" style={{ background: tint || color + '16' }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color }} aria-hidden="true" />
      </div>
      <div className="stat-label" style={{ color: darkMode ? '#94a3b8' : undefined }}>{label}</div>
      <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
      {sub && <div className="stat-sub" style={{ color: darkMode ? '#64748b' : undefined }}>{sub}</div>}
    </div>
  );
}

function UpcomingExams({ darkMode }) {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);

  useEffect(() => {
    api.get('/principal/exams?status=PUBLISHED')
      .then(r => setExams((r.data || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  if (exams.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20, background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-clipboard-text" style={{ color: '#7c3aed', fontSize: 17 }} aria-hidden="true" /> Upcoming Exams
        </h4>
        <button className="btn btn-neutral btn-sm" onClick={() => navigate('/exams')}>View All</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '12px 16px' }}>
        {exams.map(e => (
          <div key={e.id} style={{
            border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, borderRadius: 10, padding: '14px 16px',
            borderLeft: '4px solid #7c3aed', background: darkMode ? '#0f172a' : undefined,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a', marginBottom: 4 }}>{e.exam_name}</div>
            <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#64748b', marginBottom: 6 }}>{e.exam_type?.replace('_', ' ')}</div>
            <div style={{ fontSize: 11, color: darkMode ? '#94a3b8' : '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="ti ti-calendar" style={{ fontSize: 12 }} aria-hidden="true" /> {e.start_date} → {e.end_date}
            </div>
            <span style={{
              display: 'inline-block', marginTop: 8, background: darkMode ? 'rgba(124,58,237,0.15)' : '#f5f3ff',
              color: '#a78bfa', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            }}>PUBLISHED</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  NEW — Welcome Banner
// ═══════════════════════════════════════════════════════════════════════════
function WelcomeBanner({ user, darkMode, navigate }) {
  const { label, tagline } = roleMeta(user?.role);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 18, marginBottom: 22,
      padding: '30px 32px',
      background: darkMode
        ? 'linear-gradient(120deg, #1b1440 0%, #241a56 45%, #17223f 100%)'
        : 'linear-gradient(120deg, #eef0ff 0%, #f4ecff 45%, #eaf3ff 100%)',
      border: `1px solid ${darkMode ? '#2a2560' : '#e4defc'}`,
    }}>
      {/* decorative floating shapes — lightweight illustration, no external asset needed */}
      <div style={{ position: 'absolute', top: -46, right: -30, width: 170, height: 170, borderRadius: '50%', background: darkMode ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.10)' }} />
      <div style={{ position: 'absolute', bottom: -60, right: 130, width: 130, height: 130, borderRadius: '50%', background: darkMode ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.08)' }} />
      <div style={{ position: 'absolute', top: 20, right: 260, width: 46, height: 46, borderRadius: '50%', background: darkMode ? 'rgba(236,72,153,0.16)' : 'rgba(236,72,153,0.10)' }} />

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#7c3aed', marginBottom: 6 }}>
            {greeting} &nbsp;·&nbsp; {label}
          </div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: darkMode ? '#f5f3ff' : '#1e1b3a', letterSpacing: '-0.01em' }}>
            Welcome back, {user?.name || 'there'} <span aria-hidden="true">👋</span>
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: darkMode ? '#b9b3e0' : '#5b5580' }}>{tagline}</p>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/admission')} style={{
              background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="ti ti-bolt" style={{ fontSize: 14 }} aria-hidden="true" /> Quick Action
            </button>
            <button onClick={() => navigate('/school-settings')} style={{
              background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
              color: darkMode ? '#e9e4ff' : '#4c3d8f',
              border: `1px solid ${darkMode ? '#3a3170' : '#ddd4f7'}`, borderRadius: 9, padding: '9px 18px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="ti ti-building-school" style={{ fontSize: 14 }} aria-hidden="true" /> View School Profile
            </button>
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <SchoolIllustration darkMode={darkMode} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  NEW — Announcements (right sidebar). Reads from the Communication Hub.
//  If your Announcements API path differs from '/communication/announcements',
//  just change the one api.get call below — everything else stays the same.
// ═══════════════════════════════════════════════════════════════════════════
function AnnouncementsCard({ announcements, darkMode, navigate }) {
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  return (
    <div className="card" style={{ margin: '0 0 16px', ...cardBg }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-speakerphone" style={{ color: '#f59e0b', fontSize: 16 }} aria-hidden="true" /> Announcements
        </h4>
        <button className="btn btn-neutral btn-sm" onClick={() => navigate('/support/announcements')}>View All</button>
      </div>

      <div>
        {announcements.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            No announcements yet
          </div>
        ) : announcements.slice(0, 3).map((a, i, arr) => (
          <div key={a.id ?? i} style={{
            padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#0f172a' }}>{a.title}</span>
              {(a.priority === 'IMPORTANT' || a.is_important) && (
                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, background: darkMode ? 'rgba(220,38,38,0.18)' : '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: 20 }}>
                  Important
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {(a.date || a.created_at || '').toString().slice(0, 10)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 12px', borderTop: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` }}>
        <button onClick={() => navigate('/support/announcements')} style={{
          width: '100%', background: darkMode ? 'rgba(124,58,237,0.15)' : '#f5f3ff', color: '#7c3aed',
          border: 'none', borderRadius: 8, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" /> Create New Announcement
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  NEW — Upcoming Events (right sidebar). Built entirely from the EXISTING
//  /principal/holidays endpoint — no new backend route needed for this card.
// ═══════════════════════════════════════════════════════════════════════════
function UpcomingEventsCard({ events, darkMode, navigate }) {
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  const monthShort = d => new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayNum     = d => new Date(d).getDate();

  return (
    <div className="card" style={{ margin: '0 0 16px', ...cardBg }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-calendar-event" style={{ color: '#0891b2', fontSize: 16 }} aria-hidden="true" /> Upcoming Events
        </h4>
        <button className="btn btn-neutral btn-sm" onClick={() => navigate('/holidays')}>View Calendar</button>
      </div>

      <div>
        {events.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            No upcoming events
          </div>
        ) : events.map((h, i, arr) => (
          <div key={h.id ?? i} style={{
            display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}` : 'none',
          }}>
            <div style={{ width: 42, textAlign: 'center', background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: 8, padding: '4px 0', flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed' }}>{monthShort(h.date)}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#e2e8f0' : '#0f172a' }}>{dayNum(h.date)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.title}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{(h.holiday_type || '').replace('_', ' ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  NEW — Tasks & Approvals (right sidebar).
//  "Leave Applications" uses REAL data — the existing
//  /principal/teachers/attendance/requests?approval=PENDING endpoint.
//  The other three tiles call endpoints that don't exist yet in principal.py
//  — they degrade to "—" until those are built (see chat message for specs).
// ═══════════════════════════════════════════════════════════════════════════
function TasksApprovalsCard({ leaveCount, feeConcessions, admissions, docRequests, darkMode, onLeaveClick, navigate }) {
  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };
  const tiles = [
    { label: 'Leave Applications', value: leaveCount,      icon: 'ti-calendar-time', color: '#7c3aed', onClick: onLeaveClick },
    { label: 'Fee Concessions',    value: feeConcessions,  icon: 'ti-receipt-2',     color: '#16a34a', onClick: () => navigate('/fees') },
    { label: 'New Admissions',     value: admissions,      icon: 'ti-user-plus',    color: '#2563eb', onClick: () => navigate('/admission') },
    { label: 'Document Requests',  value: docRequests,     icon: 'ti-file-text',    color: '#d97706', onClick: () => navigate('/documents') },
  ];

  return (
    <div className="card" style={{ margin: '0 0 16px', ...cardBg }}>
      <div className="card-header">
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-list-check" style={{ color: '#dc2626', fontSize: 16 }} aria-hidden="true" /> Tasks &amp; Approvals
        </h4>
      </div>
      <div style={{ padding: '6px 10px 10px' }}>
        {tiles.map(t => (
          <div key={t.label} onClick={t.onClick} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px',
            borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#1c2436' : '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 14, color: t.color }} aria-hidden="true" />
            </div>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: darkMode ? '#cbd5e1' : '#334155' }}>{t.label}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 20, flexShrink: 0,
              color:      t.value ? '#dc2626' : (darkMode ? '#64748b' : '#94a3b8'),
              background: t.value ? (darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2') : (darkMode ? '#1e293b' : '#f1f5f9'),
            }}>
              {t.value == null ? '—' : `${t.value} Pending`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrincipalDashboard() {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [classes, setClasses] = useState([]);
  const [fees,    setFees]    = useState(null);
  const [attClass,   setAttClass]   = useState([]);
  const [teacherAtt, setTeacherAtt] = useState(null);
  const [attFilter,  setAttFilter]  = useState('');
  const [weeklyData,    setWeeklyData]    = useState(null);
  const [chartTab,      setChartTab]      = useState('student');
  const [pendingReqs, setPendingReqs] = useState([]);
  const [approving,   setApproving]   = useState(null);

  const [financeMonth, setFinanceMonth] = useState(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [profitSummary,  setProfitSummary]  = useState(null);
  const [trendData,      setTrendData]      = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);

  // ── NEW state for the redesigned widgets ──────────────────────────────────
  const [announcements,      setAnnouncements]      = useState([]);
  const [upcomingEvents,     setUpcomingEvents]      = useState([]);
  const [feeConcessions,     setFeeConcessions]      = useState(null); // null = endpoint not built yet
  const [admissionsRecent,   setAdmissionsRecent]    = useState(null); // null = endpoint not built yet
  const [docRequestsPending, setDocRequestsPending]  = useState(null); // null = endpoint not built yet
  const leaveSectionRef = useRef(null);

  const { user } = useAuth();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);
  const toggleDark = () => setDarkMode(d => !d);

  useEffect(() => {
    Promise.all([
      api.get('/principal/dashboard').catch(() => ({ data: null })),
      api.get('/principal/classes').catch(() => ({ data: [] })),
      api.get('/principal/fees/class-summary').catch(() => ({ data: [] })),
      api.get('/principal/attendance/class-summary').catch(() => ({ data: [] })),
      api.get('/principal/teachers/attendance/today').catch(() => ({ data: null })),
      api.get('/principal/teachers/attendance/requests?approval=PENDING').catch(() => ({ data: [] })),
      api.get('/principal/attendance/weekly').catch(() => ({ data: null })),
    ]).then(([s, c, f, att, tatt, reqs, weekly]) => {
      setPendingReqs(reqs.data || []);
      setStats(s.data);
      setClasses(c.data || []);
      setFees(f.data);
      setAttClass(att.data || []);
      setTeacherAtt(tatt.data);
      setWeeklyData(weekly.data);
    });
  }, []);

  useEffect(() => {
    api.get('/finance/monthly-trend', { params: { months: 6 } })
      .then(r => setTrendData(r.data || []))
      .catch(() => setTrendData([]));
  }, []);

  useEffect(() => {
    setFinanceLoading(true);
    api.get('/finance/profit-summary', { params: { month: financeMonth } })
      .then(r => setProfitSummary(r.data))
      .catch(() => setProfitSummary(null))
      .finally(() => setFinanceLoading(false));
  }, [financeMonth]);

  // ── NEW: Upcoming Events — reuses the EXISTING /principal/holidays route ──
  useEffect(() => {
    api.get('/principal/holidays').then(r => {
      const today = new Date(new Date().toDateString());
      const list = (r.data || [])
        .filter(h => new Date(h.date) >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);
      setUpcomingEvents(list);
    }).catch(() => setUpcomingEvents([]));
  }, []);

  // ── Announcements — uses the backend's dedicated dashboard-widget
  // endpoint (pinned-first, top 5), same blueprint the full Announcements
  // page (pages/communication/Announcements.jsx) already uses. ────────────
  useEffect(() => {
    api.get('/support/announcements/latest')
      .then(r => setAnnouncements(r.data || []))
      .catch(() => setAnnouncements([]));
  }, []);

  // ── NEW: Tasks & Approvals extra tiles — these three endpoints don't exist
  // in principal.py yet. Safe no-ops for now (tile shows "—"); see chat reply
  // for the exact route + response shape needed to make them live. ──────────
  useEffect(() => {
    api.get('/principal/fees/concessions/pending-count')
      .then(r => setFeeConcessions(r.data?.count ?? 0)).catch(() => setFeeConcessions(null));
    api.get('/principal/admissions/recent-count')
      .then(r => setAdmissionsRecent(r.data?.count ?? 0)).catch(() => setAdmissionsRecent(null));
    api.get('/principal/documents/requests/pending-count')
      .then(r => setDocRequestsPending(r.data?.count ?? 0)).catch(() => setDocRequestsPending(null));
  }, []);

  const fmt = n => n?.toLocaleString('en-IN') ?? '0';
  const fmtK = n => {
    n = Number(n || 0);
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
  };

  const financeMonths = (() => {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      out.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  })();

  const feeTotals = Array.isArray(fees) ? {
    total_due:       fees.reduce((a, c) => a + (c.total_due       || 0), 0),
    total_collected: fees.reduce((a, c) => a + (c.total_collected || 0), 0),
    pending_count:   fees.filter(c => c.pending > 0).length,
  } : (fees || { total_due: 0, total_collected: 0, pending_count: 0 });

  const collectionPct = feeTotals.total_due > 0
    ? Math.round(feeTotals.total_collected / feeTotals.total_due * 100)
    : 0;

  const cardBg = { background: darkMode ? '#141b2d' : undefined, borderColor: darkMode ? '#1e293b' : undefined };

  function scrollToLeaveSection() {
    leaveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="School Dashboard" darkMode={darkMode} onToggleDark={toggleDark} />
        <div className="page-body">

          {/* Page Header */}
          <div className="page-header flex justify-between items-center">
            <div>
              <h2 className="page-title">School Overview</h2>
              <p className="page-subtitle">Session 2024–25 &nbsp;·&nbsp; Real-time data</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569', fontSize: 12,
                fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <i className="ti ti-calendar-event" style={{ fontSize: 13 }} aria-hidden="true" />
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <button className="btn btn-neutral btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => {
                const rows = [
                  ['Metric', 'Value'],
                  ['Total Students', stats?.total_students ?? 0],
                  ['Total Teachers', stats?.total_teachers ?? 0],
                  ['Fee Collected', feeTotals.total_collected],
                  ['Fee Pending', feeTotals.total_due - feeTotals.total_collected],
                  ['Collection Rate', collectionPct + '%'],
                  ['Students Present Today', stats?.students_present ?? 0],
                  ['Teachers Present Today', stats?.teachers_present ?? 0],
                ];
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `EduERP_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" /> Export
              </button>
              <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/admission')}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" /> New Admission
              </button>
            </div>
          </div>

          {/* NEW — Welcome Banner (name + role are always dynamic, driven by the logged-in user) */}
          <WelcomeBanner user={user} darkMode={darkMode} navigate={navigate} />

          {/* ══ Main content (left) + Announcements / Events / Tasks (right) ══ */}
          <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>

            {/* ─────────────────────────── LEFT: everything that was already here ─────────────────────────── */}
            <div style={{ minWidth: 0 }}>

              {/* Top Stat Cards */}
              <div className="grid-4 mb-6">
                <StatCard icon="ti-user-graduate" label="Total Students" value={fmt(stats?.total_students)}
                  sub={`${classes.length} classes active`} color="#4f46e5" darkMode={darkMode} />
                <StatCard icon="ti-chalkboard" label="Total Teachers" value={fmt(stats?.total_teachers)}
                  sub="Active staff" color="#7c3aed" darkMode={darkMode} />
                <StatCard icon="ti-receipt" label="Fee Collected" value={fmtK(feeTotals.total_collected)}
                  sub={`${collectionPct}% collection rate`} color="#16a34a" darkMode={darkMode} />
                <StatCard icon="ti-alert-triangle" label="Fee Pending" value={fmtK(feeTotals.total_due - feeTotals.total_collected)}
                  sub={`${fmt(feeTotals.pending_count)} pending`} color="#d97706" darkMode={darkMode} />
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { icon: 'ti-clipboard-check', label: 'Mark Attendance', path: '/attendance', color: '#4f46e5', bg: darkMode ? 'rgba(79,70,229,0.15)' : '#eef2ff' },
                  { icon: 'ti-receipt',         label: 'Collect Fee',     path: '/fees',       color: '#16a34a', bg: darkMode ? 'rgba(22,163,74,0.15)'  : '#f0fdf4' },
                  { icon: 'ti-pencil',          label: 'Add Exam',        path: '/exams',      color: '#7c3aed', bg: darkMode ? 'rgba(124,58,237,0.15)' : '#f5f3ff' },
                  { icon: 'ti-user-plus',       label: 'Enroll Student',  path: '/admission',  color: '#db2777', bg: darkMode ? 'rgba(219,39,119,0.15)' : '#fdf2f8' },
                  { icon: 'ti-chalkboard',      label: 'Add Teacher',     path: '/teachers',   color: '#d97706', bg: darkMode ? 'rgba(217,119,6,0.15)'  : '#fffbeb' },
                  { icon: 'ti-upload',          label: 'Upload Notes',    path: '/notes',      color: '#0891b2', bg: darkMode ? 'rgba(8,145,178,0.15)'  : '#ecfeff' },
                ].map(a => (
                  <button key={a.path} onClick={() => navigate(a.path)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
                    background: a.bg, color: a.color, border: `1px solid ${a.color}33`,
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                    <i className={`ti ${a.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Financial Overview */}
              <div className="card" style={{ marginBottom: 24, ...cardBg }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-report-money" style={{ color: '#16a34a', fontSize: 17 }} aria-hidden="true" /> Financial Overview
                  </h4>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="form-select" style={{ width: 170, fontSize: 12 }} value={financeMonth} onChange={e => setFinanceMonth(e.target.value)}>
                      {financeMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button className="btn btn-neutral btn-sm" onClick={() => navigate('/finance/expenses')}>Manage Expenses</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: '16px 20px' }}>
                  {[
                    { label: 'Revenue',       value: profitSummary?.revenue,  display: null, color: '#16a34a', icon: 'ti-arrow-up-right' },
                    { label: 'Expenses',      value: profitSummary?.expenses, display: null, color: '#dc2626', icon: 'ti-arrow-down-right' },
                    { label: 'Net Profit',    value: profitSummary?.profit,   display: null, color: (profitSummary?.profit ?? 0) >= 0 ? '#16a34a' : '#dc2626', icon: 'ti-wallet' },
                    { label: 'Profit Margin', value: null, display: `${profitSummary?.profit_margin_pct ?? 0}%`, color: '#4f46e5', icon: 'ti-percentage' },
                  ].map(c => (
                    <div key={c.label} style={{
                      border: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px',
                      background: darkMode ? '#0f172a' : '#fafafa',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <i className={`ti ${c.icon}`} style={{ fontSize: 13, color: c.color }} aria-hidden="true" />
                        <span style={{ fontSize: 11, color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>{c.label}</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>
                        {financeLoading ? '...' : (c.display ?? `₹${fmt(c.value)}`)}
                      </div>
                    </div>
                  ))}
                </div>

                {profitSummary && (
                  <div style={{ padding: '0 20px 16px', fontSize: 12, color: darkMode ? '#94a3b8' : '#64748b' }}>
                    Is mahine salary ₹{fmt(profitSummary.salary_expense)} thi ({profitSummary.salary_pct_of_expense}% of total expense)
                  </div>
                )}

                <div style={{ padding: '4px 20px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-7)', marginBottom: 12 }}>Last 6 Months — Revenue vs Expense vs Profit</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={m => m.split(' ')[0].slice(0, 3)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => `₹${fmt(v)}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue"  name="Revenue"  fill="#4ade80" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name="Profit" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Today's Attendance + Teacher Sidebar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>

                <div className="card" style={{ margin: 0, ...cardBg }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className="ti ti-backpack" style={{ color: '#4f46e5', fontSize: 17 }} aria-hidden="true" /> Student Attendance — Today
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                    <select className="form-select" style={{ width: 160, fontSize: 12 }} value={attFilter} onChange={e => setAttFilter(e.target.value)}>
                      <option value="">All Classes</option>
                      {attClass.map(c => (
                        <option key={c.class_id} value={c.class_id}>{c.class_name} - {c.section}</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const rows = attFilter ? attClass.filter(c => String(c.class_id) === String(attFilter)) : attClass;
                    const totals = rows.reduce((acc, c) => ({
                      total: acc.total + c.total, present: acc.present + c.present, absent: acc.absent + c.absent,
                      late: acc.late + c.late, unmarked: acc.unmarked + c.not_marked,
                    }), { total: 0, present: 0, absent: 0, late: 0, unmarked: 0 });

                    return (
                      <>
                        <div style={{ display: 'flex', gap: 12, padding: '12px 20px', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Total', value: totals.total, bg: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#0f172a' },
                            { label: 'Present', value: totals.present, bg: darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a' },
                            { label: 'Absent', value: totals.absent, bg: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626' },
                            { label: 'Late', value: totals.late, bg: darkMode ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: '#d97706' },
                            { label: 'Not Marked', value: totals.unmarked, bg: darkMode ? '#1e293b' : '#f3f4f6', color: darkMode ? '#94a3b8' : '#6b7280' },
                          ].map(p => (
                            <div key={p.label} style={{ background: p.bg, borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 72 }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: p.color }}>{p.value}</div>
                              <div style={{ fontSize: 10, color: darkMode ? '#64748b' : '#64748b', marginTop: 1 }}>{p.label}</div>
                            </div>
                          ))}
                          {totals.total > 0 && (
                            <div style={{ background: darkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff', borderRadius: 10, padding: '8px 16px', textAlign: 'center', minWidth: 72 }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>{Math.round(totals.present / totals.total * 100)}%</div>
                              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Attendance</div>
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: '1px solid var(--neutral-2)' }}>
                          {rows.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutral-4)', fontSize: 13 }}>
                              Aaj ki attendance mark nahi ki gayi
                            </div>
                          ) : rows.map(c => {
                            const pct = c.total > 0 ? Math.round(c.present / c.total * 100) : 0;
                            return (
                              <div key={c.class_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--neutral-1)' }}>
                                <div style={{ minWidth: 90, fontWeight: 600, fontSize: 13 }}>
                                  {c.class_name} <span style={{ color: 'var(--neutral-5)', fontWeight: 400 }}>{c.section}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                                  <span style={{ background: darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                    <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true" /> {c.present}
                                  </span>
                                  <span style={{ background: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                    <i className="ti ti-x" style={{ fontSize: 11 }} aria-hidden="true" /> {c.absent}
                                  </span>
                                  {c.late > 0 && (
                                    <span style={{ background: darkMode ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                                      <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" /> {c.late}
                                    </span>
                                  )}
                                </div>
                                <div style={{ flex: 1, height: 6, background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: 99 }}>
                                  <div style={{
                                    width: `${pct}%`, height: '100%', borderRadius: 99,
                                    background: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626', transition: 'width 0.4s',
                                  }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32, color: 'var(--neutral-6)' }}>{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', ...cardBg }}>
                  <div className="card-header">
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="ti ti-chalkboard" style={{ color: '#7c3aed', fontSize: 17 }} aria-hidden="true" /> Staff Today
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px' }}>
                    {[
                      { label: 'Total', value: teacherAtt?.total ?? stats?.total_teachers ?? 0, bg: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#0f172a' },
                      { label: 'Present', value: teacherAtt?.present ?? 0, bg: darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a' },
                      { label: 'Absent', value: (teacherAtt?.absent ?? 0) + (teacherAtt?.on_leave ?? 0), bg: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626' },
                    ].map(p => (
                      <div key={p.label} style={{ background: p.bg, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: p.color }}>{p.value}</div>
                        <div style={{ fontSize: 10, color: darkMode ? '#94a3b8' : '#64748b' }}>{p.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280, borderTop: '1px solid var(--neutral-2)' }}>
                    {!teacherAtt || teacherAtt.absent_list?.length === 0 ? (
                      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {!teacherAtt ? (
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Attendance mark nahi ki gayi abhi</span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <i className="ti ti-circle-check" style={{ fontSize: 15 }} aria-hidden="true" /> Sab teachers present hain!
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>ABSENT / ON LEAVE</div>
                        {teacherAtt.absent_list.map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--neutral-1)' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: t.on_leave ? (darkMode ? 'rgba(217,119,6,0.2)' : '#fef3c7') : (darkMode ? 'rgba(220,38,38,0.2)' : '#fee2e2'),
                              color: t.on_leave ? '#d97706' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                            }}>{t.name?.charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: darkMode ? '#e2e8f0' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{t.designation}</div>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: t.on_leave ? (darkMode ? 'rgba(217,119,6,0.2)' : '#fef3c7') : (darkMode ? 'rgba(220,38,38,0.2)' : '#fee2e2'),
                              color: t.on_leave ? '#d97706' : '#dc2626', flexShrink: 0,
                            }}>{t.on_leave ? 'Leave' : 'Absent'}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {teacherAtt?.not_marked > 0 && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--neutral-2)', background: darkMode ? 'rgba(217,119,6,0.1)' : '#fffbeb', fontSize: 11, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: 13 }} aria-hidden="true" /> {teacherAtt.not_marked} teachers ki attendance mark nahi hui
                    </div>
                  )}
                </div>
              </div>

              {/* Teacher Attendance Approval */}
              {pendingReqs.length > 0 && (
                <div ref={leaveSectionRef} className="card" style={{ marginBottom: 24, ...cardBg }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="ti ti-hand-stop" style={{ color: '#d97706', fontSize: 17 }} aria-hidden="true" /> Teacher Attendance — Approval Pending
                    </h4>
                    <span style={{ background: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {pendingReqs.length} pending
                    </span>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Teacher</th><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Remarks</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReqs.map((r, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.teacher_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>{r.designation}</div>
                            </td>
                            <td style={{ fontSize: 12 }}>{r.date}</td>
                            <td>
                              <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                background: r.status === 'PRESENT' ? (darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7') : r.status === 'ABSENT' ? (darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2') : (darkMode ? 'rgba(217,119,6,0.15)' : '#fef3c7'),
                                color: r.status === 'PRESENT' ? '#16a34a' : r.status === 'ABSENT' ? '#dc2626' : '#d97706',
                              }}>{r.status}</span>
                            </td>
                            <td style={{ fontSize: 12 }}>{r.check_in || '—'}</td>
                            <td style={{ fontSize: 12 }}>{r.check_out || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{r.remarks || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button disabled={approving === r.id} onClick={async () => {
                                  setApproving(r.id);
                                  try {
                                    await api.post(`/principal/teachers/attendance/requests/${r.id}/approve`);
                                    setPendingReqs(prev => prev.filter(x => x.id !== r.id));
                                  } catch { alert('Approve nahi hua, dobara try karo'); }
                                  setApproving(null);
                                }} style={{
                                  background: darkMode ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: '#16a34a', border: 'none',
                                  borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                  <i className="ti ti-check" style={{ fontSize: 12 }} aria-hidden="true" /> Approve
                                </button>
                                <button disabled={approving === r.id} onClick={async () => {
                                  setApproving(r.id);
                                  try {
                                    await api.post(`/principal/teachers/attendance/requests/${r.id}/deny`);
                                    setPendingReqs(prev => prev.filter(x => x.id !== r.id));
                                  } catch { alert('Deny nahi hua, dobara try karo'); }
                                  setApproving(null);
                                }} style={{
                                  background: darkMode ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: '#dc2626', border: 'none',
                                  borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                  <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" /> Deny
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {feeTotals.total_due >= 0 && (
                <div className="card mb-6" style={cardBg}>
                  <div className="card-body" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--neutral-7)' }}>Overall Fee Collection</span>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                        <span><span style={{ color: 'var(--neutral-5)' }}>Collected: </span><strong style={{ color: '#16a34a' }}>₹{fmt(feeTotals.total_collected)}</strong></span>
                        <span><span style={{ color: 'var(--neutral-5)' }}>Pending: </span><strong style={{ color: '#d97706' }}>₹{fmt(feeTotals.total_due - feeTotals.total_collected)}</strong></span>
                        <strong style={{ color: collectionPct >= 70 ? '#16a34a' : '#dc2626', fontSize: 15 }}>{collectionPct}%</strong>
                      </div>
                    </div>
                    <div className="progress-bar" style={{ height: 10, borderRadius: 99 }}>
                      <div className="progress-fill" style={{
                        width: `${collectionPct}%`, borderRadius: 99,
                        background: collectionPct >= 70 ? '#16a34a' : collectionPct >= 40 ? '#d97706' : '#dc2626', transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                </div>
              )}

              <UpcomingExams darkMode={darkMode} />

              {/* Attendance Charts */}
              <div className="card" style={{ marginBottom: 24, ...cardBg }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {[
                      { key: 'student', label: 'Student Attendance', icon: 'ti-backpack' },
                      { key: 'teacher', label: 'Teacher Attendance', icon: 'ti-chalkboard' },
                    ].map(t => (
                      <button key={t.key} onClick={() => setChartTab(t.key)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '8px 18px', fontSize: 13, fontWeight: 700,
                        color: chartTab === t.key ? '#4f46e5' : 'var(--neutral-5)',
                        borderBottom: chartTab === t.key ? '2px solid #4f46e5' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} aria-hidden="true" /> {t.label}
                      </button>
                    ))}
                  </div>
                  {chartTab === 'student' && (
                    <select className="form-select" style={{ width: 160, fontSize: 12 }} value={attFilter} onChange={e => setAttFilter(e.target.value)}>
                      <option value="">All Classes</option>
                      {(weeklyData?.class_today || []).map(c => (
                        <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-7)', marginBottom: 12 }}>
                      {chartTab === 'student' ? 'Today — Class-wise' : 'Today — Teacher Status'}
                    </div>
                    {chartTab === 'student' ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={attFilter ? (weeklyData?.class_today || []).filter(c => String(c.class_id) === String(attFilter)) : (weeklyData?.class_today || [])} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="class_name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="total" name="Total" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="present" name="Present" fill="#4ade80" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="late" name="Late" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={[{
                          name: 'Today', Total: teacherAtt?.total ?? 0, Present: teacherAtt?.present ?? 0,
                          Absent: (teacherAtt?.absent ?? 0) + (teacherAtt?.on_leave ?? 0), 'Half Day': teacherAtt?.half_day ?? 0,
                        }]} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Total" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Present" fill="#4ade80" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Half Day" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neutral-7)', marginBottom: 12 }}>Last 7 Days — Daily Comparison</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartTab === 'student' ? (weeklyData?.student_weekly || []) : (weeklyData?.teacher_weekly || [])} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="total" name="Total" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="present" name="Present" fill="#4ade80" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {chartTab === 'student' && (
                  <div style={{ display: 'flex', gap: 12, padding: '0 20px 16px', flexWrap: 'wrap' }}>
                    {(() => {
                      const rows = attFilter ? (weeklyData?.class_today || []).filter(c => String(c.class_id) === String(attFilter)) : (weeklyData?.class_today || []);
                      const t = rows.reduce((a, c) => ({ total: a.total + c.total, present: a.present + c.present, absent: a.absent + c.absent, late: a.late + c.late }), { total: 0, present: 0, absent: 0, late: 0 });
                      return [
                        { label: 'Total', value: t.total, bg: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#0f172a' },
                        { label: 'Present', value: t.present, bg: darkMode ? 'rgba(22,163,74,0.15)' : '#dcfce7', color: '#16a34a' },
                        { label: 'Absent', value: t.absent, bg: darkMode ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626' },
                        { label: 'Late', value: t.late, bg: darkMode ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: '#d97706' },
                        { label: 'Attendance', value: t.total > 0 ? `${Math.round(t.present / t.total * 100)}%` : '0%', bg: darkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff', color: '#2563eb' },
                      ].map(p => (
                        <div key={p.label} style={{ background: p.bg, borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: p.color }}>{p.value}</div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{p.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Teacher Attendance History */}
              <div className="card" style={{ marginBottom: 24, ...cardBg }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-chalkboard" style={{ color: '#7c3aed', fontSize: 17 }} aria-hidden="true" /> Teacher Attendance — Today Detail
                  </h4>
                  <button className="btn btn-neutral btn-sm" onClick={() => navigate('/teachers')}>View All Teachers</button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Teacher</th><th>Designation</th><th>Status</th><th>Check In</th><th>Check Out</th></tr>
                    </thead>
                    <tbody>
                      {teacherAtt?.absent_list?.length === 0 && !teacherAtt?.not_marked ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--neutral-4)' }}>
                          <i className="ti ti-circle-check" style={{ fontSize: 15, marginRight: 6 }} aria-hidden="true" />Sab teachers present hain aaj
                        </td></tr>
                      ) : (
                        <>
                          {(teacherAtt?.absent_list || []).map((t, i) => (
                            <tr key={i}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: t.on_leave ? (darkMode ? 'rgba(217,119,6,0.2)' : '#fef3c7') : (darkMode ? 'rgba(220,38,38,0.2)' : '#fee2e2'),
                                    color: t.on_leave ? '#d97706' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                                  }}>{t.name?.charAt(0).toUpperCase()}</div>
                                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--neutral-6)' }}>{t.designation}</td>
                              <td>
                                <span style={{
                                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                  background: t.on_leave ? (darkMode ? 'rgba(217,119,6,0.2)' : '#fef3c7') : (darkMode ? 'rgba(220,38,38,0.2)' : '#fee2e2'),
                                  color: t.on_leave ? '#d97706' : '#dc2626',
                                }}>{t.on_leave ? 'On Leave' : 'Absent'}</span>
                              </td>
                              <td style={{ fontSize: 12 }}>—</td>
                              <td style={{ fontSize: 12 }}>—</td>
                            </tr>
                          ))}
                          {teacherAtt?.not_marked > 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '10px', background: darkMode ? 'rgba(217,119,6,0.1)' : '#fffbeb', fontSize: 12, color: '#92400e' }}>
                              <i className="ti ti-alert-triangle" style={{ fontSize: 13, marginRight: 6 }} aria-hidden="true" />{teacherAtt.not_marked} teachers ki attendance abhi mark nahi hui
                            </td></tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* ─────────────────────────── RIGHT: NEW sidebar widgets ─────────────────────────── */}
            <div style={{ minWidth: 0 }}>
              <AnnouncementsCard announcements={announcements} darkMode={darkMode} navigate={navigate} />
              <UpcomingEventsCard events={upcomingEvents} darkMode={darkMode} navigate={navigate} />
              <TasksApprovalsCard
                leaveCount={pendingReqs.length}
                feeConcessions={feeConcessions}
                admissions={admissionsRecent}
                docRequests={docRequestsPending}
                darkMode={darkMode}
                onLeaveClick={scrollToLeaveSection}
                navigate={navigate}
              />
            </div>

          </div>

        </div>
      </div>

      {/* Dark-mode color overrides — sirf colors override karte hai, layout/padding tumhari global CSS se hi aa rahi hai */}
      <style>{`
        .theme-dark { background: #0b1220; }
        .theme-dark .main-content { background: #0b1220; }
        .theme-dark .card, .theme-dark .stat-card { background: #141b2d !important; border-color: #1e293b !important; }
        .theme-dark .card-header { border-color: #1e293b !important; }
        .theme-dark h2, .theme-dark h4, .theme-dark .page-title, .theme-dark .stat-value { color: #f1f5f9 !important; }
        .theme-dark .page-subtitle, .theme-dark .stat-label, .theme-dark .stat-sub { color: #94a3b8 !important; }
        .theme-dark .table-container, .theme-dark table { background: #141b2d !important; }
        .theme-dark th { background: #1c2436 !important; color: #94a3b8 !important; border-color: #1e293b !important; }
        .theme-dark td { border-color: #1e293b !important; color: #cbd5e1 !important; }
        .theme-dark .btn-neutral { background: #1e293b !important; color: #cbd5e1 !important; border-color: #334155 !important; }
        .theme-dark .form-select { background: #0f172a !important; color: #e2e8f0 !important; border-color: #334155 !important; }
        .theme-dark .progress-bar { background: #1e293b !important; }

        /* Stack the right sidebar under the main column on narrower screens */
        @media (max-width: 1180px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
