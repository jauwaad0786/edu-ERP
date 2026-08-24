import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import AnnouncementTicker from '../../components/AnnouncementTicker';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, ComposedChart, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
//  Role Meta: dynamic greeting, role badge & executive quote
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_META = {
  PRINCIPAL:      { label: 'Principal',         icon: 'ti-crown',           tagline: 'Leading with vision, inspiring academic excellence.' },
  DIRECTOR:       { label: 'Director',          icon: 'ti-building-estate', tagline: 'Steering institutional vision and sustainable growth.' },
  VICE_PRINCIPAL: { label: 'Vice Principal',    icon: 'ti-award',           tagline: 'Empowering teachers, supporting student potential.' },
  ACCOUNTANT:     { label: 'Accountant',        icon: 'ti-calculator',      tagline: 'Financial integrity, precision and sustainable operations.' },
  LIBRARIAN:      { label: 'Librarian',         icon: 'ti-books',           tagline: 'Curating knowledge, cultivating lifelong learners.' },
  HOSTEL:         { label: 'Hostel Warden',     icon: 'ti-home-shield',     tagline: 'Creating a safe, caring and disciplined residence.' },
  TRANSPORT:      { label: 'Transport Manager', icon: 'ti-bus',             tagline: 'Ensuring safe transit and punctual routes every day.' },
  RECEPTIONIST:   { label: 'Front Desk',        icon: 'ti-headset',         tagline: 'The welcoming gateway to our institution.' },
  HR:             { label: 'HR Manager',        icon: 'ti-users',           tagline: 'Fostering talent, culture and faculty development.' },
};

function roleMeta(role) {
  if (ROLE_META[role]) return ROLE_META[role];
  const label = (role || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'Administrator';
  return { label, icon: 'ti-user-check', tagline: 'Managing campus operations with clarity and confidence.' };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Executive Hero Banner with Mesh Glow & Live Campus Indicator
// ═══════════════════════════════════════════════════════════════════════════
function ExecutiveHero({ user, stats, feeTotals, collectionPct, darkMode, navigate, onExport }) {
  const { label, icon, tagline } = roleMeta(user?.role);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const studentAttPct = stats?.students_marked && stats?.total_students
    ? Math.round((stats.students_present / stats.students_marked) * 100)
    : (stats?.total_students ? Math.round(((stats.students_present || 0) / stats.total_students) * 100) : 0);

  return (
    <div className="exec-hero-card" style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '20px',
      marginBottom: '24px',
      padding: '30px 32px',
      background: darkMode
        ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #090d16 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 50%, #e0e7ff 100%)',
      border: `1px solid ${darkMode ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.2)'}`,
      boxShadow: darkMode
        ? '0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        : '0 10px 30px -10px rgba(79, 70, 229, 0.12), inset 0 1px 0 #ffffff',
    }}>
      {/* Decorative ambient background glows */}
      <div style={{
        position: 'absolute', top: '-60px', right: '-40px', width: '260px', height: '260px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0) 70%)',
        pointerEvents: 'none', filter: 'blur(30px)'
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', right: '220px', width: '220px', height: '220px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0) 70%)',
        pointerEvents: 'none', filter: 'blur(30px)'
      }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ flex: '1 1 450px', minWidth: 0 }}>
          {/* Top Pill Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '30px',
              background: darkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.1)',
              color: darkMode ? '#a5b4fc' : '#4f46e5',
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
              border: `1px solid ${darkMode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(79, 70, 229, 0.2)'}`
            }}>
              <i className={`ti ${icon}`} style={{ fontSize: '13px' }} aria-hidden="true" />
              {label} Command Center
            </span>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '30px',
              background: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
              color: '#10b981', fontSize: '11.5px', fontWeight: 700,
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <span className="live-pulse-dot" />
              Campus Live Pulse
            </span>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '20px',
              background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: darkMode ? '#94a3b8' : '#64748b', fontSize: '11.5px', fontWeight: 600
            }}>
              <i className="ti ti-calendar" style={{ fontSize: '12px' }} />
              Session 2024–25
            </span>
          </div>

          {/* Heading */}
          <h1 style={{
            margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800,
            color: darkMode ? '#ffffff' : '#0f172a',
            letterSpacing: '-0.02em', lineHeight: 1.2
          }}>
            {greeting}, {user?.name || 'School Leader'} <span style={{ display: 'inline-block', animation: 'wave 2s infinite' }}>👋</span>
          </h1>

          <p style={{
            margin: '0 0 20px 0', fontSize: '14px',
            color: darkMode ? '#cbd5e1' : '#475569',
            maxWidth: '560px', lineHeight: 1.5
          }}>
            {tagline}
          </p>

          {/* Action Triggers */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/admission')}
              className="exec-primary-btn"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff', border: 'none', borderRadius: '10px',
                padding: '10px 20px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="ti ti-user-plus" style={{ fontSize: '15px' }} />
              New Admission
            </button>

            <button
              onClick={() => navigate('/fees')}
              style={{
                background: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px', padding: '10px 18px',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <i className="ti ti-receipt" style={{ fontSize: '15px' }} />
              Fee Collection
            </button>

            <button
              onClick={onExport}
              style={{
                background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                color: darkMode ? '#e2e8f0' : '#334155',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
                borderRadius: '10px', padding: '10px 16px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px',
                boxShadow: darkMode ? 'none' : '0 2px 5px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <i className="ti ti-download" style={{ fontSize: '14px' }} />
              Export Report
            </button>
          </div>
        </div>

        {/* Executive Right Highlight Widgets Strip */}
        <div style={{
          display: 'flex', gap: '14px', flexWrap: 'wrap',
          background: darkMode ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.8)',
          padding: '16px 20px', borderRadius: '16px',
          border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)'}`,
          backdropFilter: 'blur(10px)',
          boxShadow: darkMode ? '0 8px 20px rgba(0,0,0,0.3)' : '0 8px 20px rgba(99,102,241,0.06)'
        }}>
          <div style={{ textAlign: 'center', minWidth: '90px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Student Present
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
              {studentAttPct}%
            </div>
            <div style={{ fontSize: '11px', color: darkMode ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
              {stats?.students_present ?? 0} on campus
            </div>
          </div>

          <div style={{ width: '1px', background: darkMode ? '#334155' : '#e2e8f0' }} />

          <div style={{ textAlign: 'center', minWidth: '90px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Faculty Duty
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#6366f1', lineHeight: 1.1 }}>
              {stats?.teachers_present ?? 0}
            </div>
            <div style={{ fontSize: '11px', color: darkMode ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
              of {stats?.total_teachers ?? 0} Staff
            </div>
          </div>

          <div style={{ width: '1px', background: darkMode ? '#334155' : '#e2e8f0' }} />

          <div style={{ textAlign: 'center', minWidth: '90px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
              Fee Realized
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: collectionPct >= 70 ? '#10b981' : '#f59e0b', lineHeight: 1.1 }}>
              {collectionPct}%
            </div>
            <div style={{ fontSize: '11px', color: darkMode ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
              Overall rate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Modern Glassmorphism KPI Card
// ═══════════════════════════════════════════════════════════════════════════
function PremiumKpiCard({ title, value, subtitle, icon, gradient, glowColor, badge, onClick, darkMode }) {
  return (
    <div
      onClick={onClick}
      className="premium-kpi-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: darkMode ? '#111827' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
        borderRadius: '16px',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: darkMode
          ? '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
          : '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = darkMode
          ? `0 12px 28px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px ${glowColor}40`
          : `0 12px 28px -4px ${glowColor}25, 0 0 0 1px ${glowColor}30`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = darkMode
          ? '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
          : '0 4px 20px -2px rgba(15, 23, 42, 0.05)';
      }}
    >
      {/* Subtle corner light flare */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '90px', height: '90px',
        background: `radial-gradient(circle at top right, ${glowColor}18, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '12px',
          background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 6px 14px -3px ${glowColor}50`, color: '#ffffff'
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: '22px' }} aria-hidden="true" />
        </div>

        {badge && (
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
            background: badge.bg, color: badge.color, border: `1px solid ${badge.border || 'transparent'}`
          }}>
            {badge.text}
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', fontWeight: 600, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
        {title}
      </div>

      <div style={{ fontSize: '26px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '6px' }}>
        {value ?? '—'}
      </div>

      {subtitle && (
        <div style={{ fontSize: '12px', color: darkMode ? '#cbd5e1' : '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Upcoming Exams & Academic Milestones
// ═══════════════════════════════════════════════════════════════════════════
function UpcomingExamsCard({ darkMode, navigate }) {
  const [exams, setExams] = useState([]);

  useEffect(() => {
    api.get('/principal/exams?status=PUBLISHED')
      .then(r => setExams((r.data || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  if (exams.length === 0) return null;

  return (
    <div className="card" style={{
      marginBottom: '24px', borderRadius: '16px',
      background: darkMode ? '#111827' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
    }}>
      <div className="card-header" style={{
        padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-clipboard-text" style={{ fontSize: '18px' }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Upcoming Exams &amp; Assessments</h4>
            <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>Published examination schedules</span>
          </div>
        </div>
        <button
          className="btn btn-neutral btn-sm"
          style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
          onClick={() => navigate('/exams')}
        >
          View All Exams
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', padding: '16px 20px' }}>
        {exams.map(e => (
          <div key={e.id} style={{
            border: `1px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`,
            borderRadius: '12px', padding: '14px 16px',
            borderLeft: '4px solid #8b5cf6',
            background: darkMode ? '#182234' : '#fafafa',
            transition: 'transform 0.15s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                {e.exam_name}
              </div>
              <span style={{
                background: darkMode ? 'rgba(124,58,237,0.2)' : '#ede9fe',
                color: '#7c3aed', fontSize: '9.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px'
              }}>PUBLISHED</span>
            </div>
            <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>
              {e.exam_type?.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '11.5px', color: darkMode ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ti ti-calendar" style={{ fontSize: '13px', color: '#8b5cf6' }} />
              <span>{e.start_date} &nbsp;→&nbsp; {e.end_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Announcements / Noticeboard Card
// ═══════════════════════════════════════════════════════════════════════════
function AnnouncementsCard({ announcements, darkMode, navigate }) {
  return (
    <div className="card" style={{
      marginBottom: '20px', borderRadius: '16px',
      background: darkMode ? '#111827' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
    }}>
      <div className="card-header" style={{
        padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-speakerphone" style={{ fontSize: '15px' }} />
          </div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Noticeboard</h4>
        </div>
        <button
          className="btn btn-neutral btn-sm"
          style={{ padding: '3px 9px', fontSize: '11.5px', borderRadius: '6px' }}
          onClick={() => navigate('/support/announcements')}
        >
          View All
        </button>
      </div>

      <div>
        {announcements.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
            <i className="ti ti-bell-off" style={{ fontSize: '20px', display: 'block', marginBottom: '4px', opacity: 0.6 }} />
            No active announcements
          </div>
        ) : announcements.slice(0, 3).map((a, i, arr) => (
          <div key={a.id ?? i} style={{
            padding: '12px 18px',
            borderBottom: i < arr.length - 1 ? `1px solid ${darkMode ? '#1f2937' : '#f8fafc'}` : 'none',
            transition: 'background 0.15s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: darkMode ? '#e2e8f0' : '#1e293b', lineHeight: 1.3 }}>
                {a.title}
              </span>
              {(a.priority === 'IMPORTANT' || a.is_important) && (
                <span style={{
                  flexShrink: 0, fontSize: '9px', fontWeight: 800,
                  background: darkMode ? 'rgba(239,68,68,0.2)' : '#fee2e2',
                  color: '#ef4444', padding: '2px 7px', borderRadius: '12px'
                }}>
                  CRITICAL
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ti ti-clock" style={{ fontSize: '11px' }} />
              {(a.date || a.created_at || '').toString().slice(0, 10)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
        <button
          onClick={() => navigate('/support/announcements')}
          style={{
            width: '100%', background: darkMode ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
            color: '#6366f1', border: 'none', borderRadius: '8px',
            padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: '13px' }} />
          Create New Notice
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Upcoming Events Card
// ═══════════════════════════════════════════════════════════════════════════
function UpcomingEventsCard({ events, darkMode, navigate }) {
  const monthShort = d => new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayNum     = d => new Date(d).getDate();

  return (
    <div className="card" style={{
      marginBottom: '20px', borderRadius: '16px',
      background: darkMode ? '#111827' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
    }}>
      <div className="card-header" style={{
        padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-calendar-event" style={{ fontSize: '15px' }} />
          </div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Upcoming Events</h4>
        </div>
        <button
          className="btn btn-neutral btn-sm"
          style={{ padding: '3px 9px', fontSize: '11.5px', borderRadius: '6px' }}
          onClick={() => navigate('/holidays')}
        >
          Calendar
        </button>
      </div>

      <div>
        {events.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
            No upcoming events scheduled
          </div>
        ) : events.map((h, i, arr) => (
          <div key={h.id ?? i} style={{
            display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? `1px solid ${darkMode ? '#1f2937' : '#f8fafc'}` : 'none',
          }}>
            <div style={{
              width: '42px', textAlign: 'center',
              background: darkMode ? '#1e293b' : '#f0fdf4',
              border: `1px solid ${darkMode ? '#334155' : '#dcfce7'}`,
              borderRadius: '10px', padding: '4px 0', flexShrink: 0
            }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#10b981' }}>{monthShort(h.date)}</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a', lineHeight: 1.1 }}>{dayNum(h.date)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#e2e8f0' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.title}
              </div>
              <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>{(h.holiday_type || 'Event').replace('_', ' ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tasks & Approvals Card
// ═══════════════════════════════════════════════════════════════════════════
function TasksApprovalsCard({ leaveCount, feeConcessions, admissions, docRequests, darkMode, onLeaveClick, navigate }) {
  const tiles = [
    { label: 'Staff Leave Applications', value: leaveCount,     icon: 'ti-calendar-time', color: '#8b5cf6', onClick: onLeaveClick },
    { label: 'Fee Concession Requests',  value: feeConcessions, icon: 'ti-receipt-2',     color: '#10b981', onClick: () => navigate('/fees') },
    { label: 'New Admission Queue',      value: admissions,     icon: 'ti-user-plus',    color: '#3b82f6', onClick: () => navigate('/admission') },
    { label: 'Document Requisitions',    value: docRequests,    icon: 'ti-file-text',    color: '#f59e0b', onClick: () => navigate('/documents') },
  ];

  return (
    <div className="card" style={{
      marginBottom: '20px', borderRadius: '16px',
      background: darkMode ? '#111827' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
    }}>
      <div className="card-header" style={{
        padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-list-check" style={{ fontSize: '15px' }} />
        </div>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Action Queue &amp; Approvals</h4>
      </div>

      <div style={{ padding: '8px 12px 12px' }}>
        {tiles.map(t => (
          <div key={t.label} onClick={t.onClick} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px',
            borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s ease',
            marginBottom: '4px'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#1e293b' : '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: t.color + '18', color: t.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: '15px' }} />
            </div>

            <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: darkMode ? '#cbd5e1' : '#334155' }}>
              {t.label}
            </span>

            <span style={{
              fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '20px', flexShrink: 0,
              color: t.value ? '#ef4444' : (darkMode ? '#64748b' : '#94a3b8'),
              background: t.value ? (darkMode ? 'rgba(239,68,68,0.18)' : '#fee2e2') : (darkMode ? '#1e293b' : '#f1f5f9'),
            }}>
              {t.value == null ? '—' : `${t.value} Pending`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT — Principal Dashboard
// ═══════════════════════════════════════════════════════════════════════════
export default function PrincipalDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [fees, setFees] = useState(null);
  const [attClass, setAttClass] = useState([]);
  const [teacherAtt, setTeacherAtt] = useState(null);
  const [attFilter, setAttFilter] = useState('');
  const [weeklyData, setWeeklyData] = useState(null);
  const [chartTab, setChartTab] = useState('student');
  const [pendingReqs, setPendingReqs] = useState([]);
  const [approving, setApproving] = useState(null);

  const [financeMonth, setFinanceMonth] = useState(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [profitSummary, setProfitSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);

  const [announcements, setAnnouncements] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [feeConcessions, setFeeConcessions] = useState(null);
  const [admissionsRecent, setAdmissionsRecent] = useState(null);
  const [docRequestsPending, setDocRequestsPending] = useState(null);
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

  useEffect(() => {
    api.get('/support/announcements/latest')
      .then(r => setAnnouncements(r.data || []))
      .catch(() => setAnnouncements([]));
  }, []);

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

  function scrollToLeaveSection() {
    leaveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const handleExportCSV = () => {
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
    a.download = `EduERP_Executive_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Executive report downloaded successfully!');
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Principal Command Center" darkMode={darkMode} onToggleDark={toggleDark} />
        <div className="page-body">

          <AnnouncementTicker />

          {/* ══ Executive Hero Header ══ */}
          <ExecutiveHero
            user={user}
            stats={stats}
            feeTotals={feeTotals}
            collectionPct={collectionPct}
            darkMode={darkMode}
            navigate={navigate}
            onExport={handleExportCSV}
          />

          {/* ══ 5 Key Executive Metric Cards (Bento Grid) ══ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <PremiumKpiCard
              title="Total Enrolled"
              value={fmt(stats?.total_students)}
              subtitle={<span><i className="ti ti-school" style={{ color: '#6366f1' }} /> {classes.length} Active Classes</span>}
              icon="ti-user-graduate"
              gradient="linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
              glowColor="#6366f1"
              badge={{ text: 'ACADEMIC', bg: darkMode ? 'rgba(99,102,241,0.2)' : '#eef2ff', color: '#6366f1' }}
              onClick={() => navigate('/students')}
              darkMode={darkMode}
            />

            <PremiumKpiCard
              title="Students Present"
              value={fmt(stats?.students_present)}
              subtitle={<span><i className="ti ti-circle-check" style={{ color: '#10b981' }} /> {stats?.students_marked ? `${Math.round(stats.students_present / stats.students_marked * 100)}% attendance rate` : 'Real-time sync'}</span>}
              icon="ti-checkbox"
              gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
              glowColor="#10b981"
              badge={{ text: 'TODAY', bg: darkMode ? 'rgba(16,185,129,0.2)' : '#ecfdf5', color: '#10b981' }}
              onClick={() => navigate('/attendance')}
              darkMode={darkMode}
            />

            <PremiumKpiCard
              title="Faculty On Duty"
              value={fmt(stats?.total_teachers)}
              subtitle={<span><i className="ti ti-chalkboard" style={{ color: '#8b5cf6' }} /> {teacherAtt?.present ?? stats?.teachers_present ?? 0} Present Today</span>}
              icon="ti-users"
              gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
              glowColor="#8b5cf6"
              badge={{ text: 'STAFF', bg: darkMode ? 'rgba(139,92,246,0.2)' : '#f5f3ff', color: '#8b5cf6' }}
              onClick={() => navigate('/teachers')}
              darkMode={darkMode}
            />

            <PremiumKpiCard
              title="Fee Realized"
              value={fmtK(feeTotals.total_collected)}
              subtitle={<span><i className="ti ti-chart-pie" style={{ color: '#10b981' }} /> {collectionPct}% Collection Rate</span>}
              icon="ti-wallet"
              gradient="linear-gradient(135deg, #059669 0%, #047857 100%)"
              glowColor="#059669"
              badge={{ text: 'COLLECTED', bg: darkMode ? 'rgba(16,185,129,0.2)' : '#ecfdf5', color: '#10b981' }}
              onClick={() => navigate('/fees')}
              darkMode={darkMode}
            />

            <PremiumKpiCard
              title="Pending Receivables"
              value={fmtK(feeTotals.total_due - feeTotals.total_collected)}
              subtitle={<span><i className="ti ti-alert-circle" style={{ color: '#f59e0b' }} /> {fmt(feeTotals.pending_count)} pending dues</span>}
              icon="ti-receipt-off"
              gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              glowColor="#f59e0b"
              badge={{ text: 'PENDING', bg: darkMode ? 'rgba(245,158,11,0.2)' : '#fffbeb', color: '#d97706' }}
              onClick={() => navigate('/fees')}
              darkMode={darkMode}
            />
          </div>

          {/* ══ Campus Quick Launchpad ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            borderRadius: '16px', padding: '14px 18px',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
            marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: darkMode ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
              <i className="ti ti-bolt" style={{ color: '#f59e0b', fontSize: '15px' }} />
              Launchpad:
            </div>

            {[
              { icon: 'ti-clipboard-check', label: 'Mark Attendance', path: '/attendance', color: '#6366f1', bg: darkMode ? 'rgba(99,102,241,0.15)' : '#eef2ff' },
              { icon: 'ti-receipt',         label: 'Collect Fee',     path: '/fees',       color: '#10b981', bg: darkMode ? 'rgba(16,185,129,0.15)' : '#ecfdf5' },
              { icon: 'ti-pencil',          label: 'Create Exam',     path: '/exams',      color: '#8b5cf6', bg: darkMode ? 'rgba(139,92,246,0.15)' : '#f5f3ff' },
              { icon: 'ti-user-plus',       label: 'New Admission',   path: '/admission',  color: '#ec4899', bg: darkMode ? 'rgba(236,72,153,0.15)' : '#fdf2f8' },
              { icon: 'ti-id-badge-2',      label: 'Staff Directory', path: '/teachers',   color: '#f59e0b', bg: darkMode ? 'rgba(245,158,11,0.15)' : '#fffbeb' },
              { icon: 'ti-notes',           label: 'Study Material',  path: '/notes',      color: '#06b6d4', bg: darkMode ? 'rgba(6,182,212,0.15)'  : '#ecfeff' },
              { icon: 'ti-settings',        label: 'School Settings', path: '/school-settings', color: '#64748b', bg: darkMode ? 'rgba(100,116,139,0.15)' : '#f1f5f9' },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px',
                  background: a.bg, color: a.color, border: `1px solid ${a.color}25`,
                  cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${a.color}25`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <i className={`ti ${a.icon}`} style={{ fontSize: '14px' }} aria-hidden="true" />
                {a.label}
              </button>
            ))}
          </div>

          {/* ══ Main Dashboard Grid: Left Content (2/3) + Right Feeds (1/3) ══ */}
          <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: '24px', alignItems: 'start' }}>

            {/* ─────────────────────────── LEFT COLUMN ─────────────────────────── */}
            <div style={{ minWidth: 0 }}>

              {/* 1. Financial Intelligence & Revenue Hub */}
              <div className="card" style={{
                marginBottom: '24px', borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
              }}>
                <div className="card-header" style={{
                  padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-report-money" style={{ fontSize: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Financial Intelligence Hub</h4>
                      <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>Revenue, expenses &amp; net profit momentum</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      style={{
                        width: '180px', fontSize: '12px', borderRadius: '8px',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#f1f5f9' : '#0f172a'
                      }}
                      value={financeMonth}
                      onChange={e => setFinanceMonth(e.target.value)}
                    >
                      {financeMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button
                      className="btn btn-neutral btn-sm"
                      style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}
                      onClick={() => navigate('/finance/expenses')}
                    >
                      Manage Expenses
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', padding: '18px 20px 10px' }}>
                  {[
                    { label: 'Total Revenue', value: profitSummary?.revenue, display: null, color: '#10b981', icon: 'ti-trending-up', bg: darkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5' },
                    { label: 'Total Expenses', value: profitSummary?.expenses, display: null, color: '#ef4444', icon: 'ti-trending-down', bg: darkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
                    { label: 'Net Profit', value: profitSummary?.profit, display: null, color: (profitSummary?.profit ?? 0) >= 0 ? '#10b981' : '#ef4444', icon: 'ti-wallet', bg: darkMode ? 'rgba(99,102,241,0.1)' : '#eef2ff' },
                    { label: 'Profit Margin', value: null, display: `${profitSummary?.profit_margin_pct ?? 0}%`, color: '#6366f1', icon: 'ti-percentage', bg: darkMode ? 'rgba(139,92,246,0.1)' : '#f5f3ff' },
                  ].map(c => (
                    <div key={c.label} style={{
                      border: `1px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`, borderRadius: '12px', padding: '12px 14px',
                      background: darkMode ? '#151e2e' : '#f8fafc',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>{c.label}</span>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`ti ${c.icon}`} style={{ fontSize: '12px' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: '19px', fontWeight: 800, color: c.color, letterSpacing: '-0.02em' }}>
                        {financeLoading ? '...' : (c.display ?? `₹${fmt(c.value)}`)}
                      </div>
                    </div>
                  ))}
                </div>

                {profitSummary && (
                  <div style={{ padding: '4px 20px 12px', fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-info-circle" style={{ color: '#6366f1' }} />
                    Payroll accounted for <strong style={{ color: darkMode ? '#f1f5f9' : '#0f172a' }}>₹{fmt(profitSummary.salary_expense)}</strong> ({profitSummary.salary_pct_of_expense}% of total operational expense)
                  </div>
                )}

                <div style={{ padding: '8px 20px 20px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>6-Month Trend: Revenue vs Expense vs Net Profit</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} tickFormatter={m => m.split(' ')[0].slice(0, 3)} />
                      <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12, borderRadius: 10,
                          background: darkMode ? '#0f172a' : '#ffffff',
                          borderColor: darkMode ? '#334155' : '#e2e8f0',
                          color: darkMode ? '#ffffff' : '#0f172a',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                        }}
                        formatter={(v) => `₹${fmt(v)}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="url(#revenueGrad)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="url(#expenseGrad)" radius={[6, 6, 0, 0]} />
                      <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. Attendance & Campus Pulse Trends */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* 7-Day Attendance Trend */}
                <div className="card" style={{
                  margin: 0, borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chart-line" style={{ fontSize: '15px' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>7-Day Student Attendance %</h4>
                  </div>
                  <div style={{ padding: '14px 16px 16px' }}>
                    <ResponsiveContainer width="100%" height={210}>
                      <LineChart data={stats?.attendance_trend || []} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} domain={[0, 100]} unit="%" />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} formatter={v => `${v}%`} />
                        <Line type="monotone" dataKey="percent" name="Present Rate" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6-Week Fee Collection Trend */}
                <div className="card" style={{
                  margin: 0, borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chart-arrows" style={{ fontSize: '15px' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>6-Week Fee Collection Velocity</h4>
                  </div>
                  <div style={{ padding: '14px 16px 16px' }}>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={stats?.fee_trend || []} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="feeWeeklyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} formatter={v => `₹${fmt(v)}`} />
                        <Bar dataKey="amount" name="Collected" fill="url(#feeWeeklyGrad)" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* 3. Class Distribution & Module Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Students by Class Donut */}
                <div className="card" style={{
                  margin: 0, borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chart-pie" style={{ fontSize: '15px' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Class Demographics</h4>
                  </div>

                  {(stats?.class_distribution || []).length === 0 ? (
                    <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>No class data available</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 18px 16px' }}>
                      <ResponsiveContainer width="52%" height={190}>
                        <PieChart>
                          <Pie data={stats.class_distribution} dataKey="count" nameKey="name" innerRadius={48} outerRadius={75} paddingAngle={3}>
                            {stats.class_distribution.map((_, i) => (
                              <Cell key={i} fill={['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#3b82f6'][i % 8]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1, maxHeight: 180, overflowY: 'auto', paddingRight: '4px' }}>
                        {stats.class_distribution.map((c, i) => (
                          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '7px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#3b82f6'][i % 8], flexShrink: 0 }} />
                            <span style={{ flex: 1, color: darkMode ? '#cbd5e1' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            <span style={{ fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Module Quick Status */}
                <div className="card" style={{
                  margin: 0, borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-apps" style={{ fontSize: '15px' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Campus Facilities &amp; Hub</h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '16px 18px' }}>
                    {[
                      { icon: 'ti-books', label: 'Library Circulation', value: stats?.library_issued, color: '#6366f1', path: '/library/issue-return' },
                      { icon: 'ti-bed',   label: 'Hostel Occupancy',     value: `${fmt(stats?.hostel_occupied)}/${fmt(stats?.hostel_total)}`, color: '#8b5cf6', path: '/hostel' },
                      { icon: 'ti-bell',  label: 'Active Circulars',     value: stats?.active_circulars, color: '#f59e0b', path: '/support/announcements' },
                    ].map(t => (
                      <div key={t.label} onClick={() => navigate(t.path)} style={{
                        border: `1px solid ${darkMode ? '#1f2937' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px 10px',
                        textAlign: 'center', cursor: 'pointer', background: darkMode ? '#151e2e' : '#f8fafc',
                        transition: 'all 0.15s ease'
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.color + '18', color: t.color, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`ti ${t.icon}`} style={{ fontSize: '16px' }} />
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: darkMode ? '#f1f5f9' : '#0f172a' }}>{t.value ?? '—'}</div>
                        <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px', lineHeight: 1.2 }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Student Attendance Today & Staff Today Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '20px', marginBottom: '24px' }}>
                {/* Student Attendance Detailed Breakdown */}
                <div className="card" style={{
                  margin: 0, borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>
                        <i className="ti ti-backpack" style={{ color: '#6366f1', fontSize: '16px' }} /> Student Attendance Today
                      </h4>
                      <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <select
                      className="form-select"
                      style={{
                        width: '150px', fontSize: '12px', borderRadius: '8px',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#f1f5f9' : '#0f172a'
                      }}
                      value={attFilter}
                      onChange={e => setAttFilter(e.target.value)}
                    >
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
                        <div style={{ display: 'flex', gap: '10px', padding: '12px 18px', flexWrap: 'wrap', background: darkMode ? 'rgba(255,255,255,0.02)' : '#fbfcfd' }}>
                          {[
                            { label: 'Total', value: totals.total, bg: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#0f172a' },
                            { label: 'Present', value: totals.present, bg: darkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7', color: '#10b981' },
                            { label: 'Absent', value: totals.absent, bg: darkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#ef4444' },
                            { label: 'Late', value: totals.late, bg: darkMode ? 'rgba(245,158,11,0.15)' : '#fef3c7', color: '#d97706' },
                            { label: 'Unmarked', value: totals.unmarked, bg: darkMode ? '#1e293b' : '#f3f4f6', color: darkMode ? '#94a3b8' : '#6b7280' },
                          ].map(p => (
                            <div key={p.label} style={{ background: p.bg, borderRadius: '8px', padding: '6px 12px', textAlign: 'center', minWidth: '60px' }}>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: p.color }}>{p.value}</div>
                              <div style={{ fontSize: '10px', color: darkMode ? '#94a3b8' : '#64748b' }}>{p.label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, maxHeight: '300px', overflowY: 'auto' }}>
                          {rows.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                              No attendance recorded for today
                            </div>
                          ) : rows.map(c => {
                            const pct = c.total > 0 ? Math.round(c.present / c.total * 100) : 0;
                            return (
                              <div key={c.class_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f8fafc'}` }}>
                                <div style={{ minWidth: '95px', fontWeight: 700, fontSize: '13px', color: darkMode ? '#f1f5f9' : '#0f172a' }}>
                                  {c.class_name} <span style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 400 }}>{c.section}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                                  <span style={{ background: darkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7', color: '#10b981', padding: '2px 7px', borderRadius: '12px', fontWeight: 700 }}>
                                    ✓ {c.present}
                                  </span>
                                  <span style={{ background: darkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#ef4444', padding: '2px 7px', borderRadius: '12px', fontWeight: 700 }}>
                                    ✗ {c.absent}
                                  </span>
                                  {c.late > 0 && (
                                    <span style={{ background: darkMode ? 'rgba(245,158,11,0.15)' : '#fef3c7', color: '#d97706', padding: '2px 7px', borderRadius: '12px', fontWeight: 700 }}>
                                      ⏱ {c.late}
                                    </span>
                                  )}
                                </div>
                                <div style={{ flex: 1, height: '6px', background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${pct}%`, height: '100%', borderRadius: '99px',
                                    background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444',
                                    transition: 'width 0.4s ease',
                                  }} />
                                </div>
                                <span style={{ fontSize: '11.5px', fontWeight: 700, minWidth: '34px', color: darkMode ? '#cbd5e1' : '#475569', textAlign: 'right' }}>
                                  {pct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Staff Today Breakdown */}
                <div className="card" style={{
                  margin: 0, display: 'flex', flexDirection: 'column', borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div className="card-header" style={{
                    padding: '14px 18px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chalkboard" style={{ fontSize: '15px' }} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Faculty On Duty</h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px 16px' }}>
                    {[
                      { label: 'Total', value: teacherAtt?.total ?? stats?.total_teachers ?? 0, bg: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#e2e8f0' : '#0f172a' },
                      { label: 'Present', value: teacherAtt?.present ?? 0, bg: darkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7', color: '#10b981' },
                      { label: 'Absent', value: (teacherAtt?.absent ?? 0) + (teacherAtt?.on_leave ?? 0), bg: darkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#ef4444' },
                    ].map(p => (
                      <div key={p.label} style={{ background: p.bg, borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: p.color }}>{p.value}</div>
                        <div style={{ fontSize: '10px', color: darkMode ? '#94a3b8' : '#64748b' }}>{p.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}` }}>
                    {!teacherAtt || teacherAtt.absent_list?.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                        <i className="ti ti-circle-check" style={{ fontSize: '24px', color: '#10b981', display: 'block', marginBottom: '6px' }} />
                        <span style={{ fontSize: '12.5px', color: '#10b981', fontWeight: 700 }}>
                          Full faculty attendance today!
                        </span>
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: '8px 16px 4px', fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                          ABSENT / ON LEAVE
                        </div>
                        {teacherAtt.absent_list.map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f8fafc'}` }}>
                            <div style={{
                              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                              background: t.on_leave ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                              color: t.on_leave ? '#f59e0b' : '#ef4444',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800,
                            }}>
                              {t.name?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '12.5px', color: darkMode ? '#e2e8f0' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#64748b' }}>{t.designation}</div>
                            </div>
                            <span style={{
                              fontSize: '9.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '12px',
                              background: t.on_leave ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                              color: t.on_leave ? '#d97706' : '#ef4444', flexShrink: 0,
                            }}>
                              {t.on_leave ? 'Leave' : 'Absent'}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {teacherAtt?.not_marked > 0 && (
                    <div style={{ padding: '8px 14px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, background: darkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb', fontSize: '11px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: '13px' }} />
                      {teacherAtt.not_marked} teachers attendance pending
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Teacher Attendance Regularization / Approval Queue */}
              {pendingReqs.length > 0 && (
                <div ref={leaveSectionRef} className="card" style={{
                  marginBottom: '24px', borderRadius: '16px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: '1px solid rgba(239,68,68,0.3)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.08)'
                }}>
                  <div className="card-header" style={{
                    padding: '16px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="ti ti-hand-stop" style={{ fontSize: '18px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>Faculty Attendance Approvals</h4>
                        <span style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b' }}>Pending check-in/out and regularization requests</span>
                      </div>
                    </div>
                    <span style={{ background: darkMode ? 'rgba(239,68,68,0.2)' : '#fee2e2', color: '#ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                      {pendingReqs.length} Action Needed
                    </span>
                  </div>

                  <div className="table-container" style={{ border: 'none' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Teacher</th><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Remarks</th><th>Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReqs.map((r, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{r.teacher_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--neutral-5)' }}>{r.designation}</div>
                            </td>
                            <td style={{ fontSize: '12px' }}>{r.date}</td>
                            <td>
                              <span style={{
                                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                background: r.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : r.status === 'ABSENT' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: r.status === 'PRESENT' ? '#10b981' : r.status === 'ABSENT' ? '#ef4444' : '#d97706',
                              }}>{r.status}</span>
                            </td>
                            <td style={{ fontSize: '12px' }}>{r.check_in || '—'}</td>
                            <td style={{ fontSize: '12px' }}>{r.check_out || '—'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--neutral-6)' }}>{r.remarks || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  disabled={approving === r.id}
                                  onClick={async () => {
                                    setApproving(r.id);
                                    try {
                                      await api.post(`/principal/teachers/attendance/requests/${r.id}/approve`);
                                      setPendingReqs(prev => prev.filter(x => x.id !== r.id));
                                      toast.success('Attendance request approved');
                                    } catch {
                                      toast.error('Approval failed. Please try again.');
                                    }
                                    setApproving(null);
                                  }}
                                  style={{
                                    background: '#10b981', color: '#ffffff', border: 'none',
                                    borderRadius: '6px', padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <i className="ti ti-check" style={{ fontSize: '13px' }} /> Approve
                                </button>
                                <button
                                  disabled={approving === r.id}
                                  onClick={async () => {
                                    setApproving(r.id);
                                    try {
                                      await api.post(`/principal/teachers/attendance/requests/${r.id}/deny`);
                                      setPendingReqs(prev => prev.filter(x => x.id !== r.id));
                                      toast.success('Attendance request denied');
                                    } catch {
                                      toast.error('Denial failed. Please try again.');
                                    }
                                    setApproving(null);
                                  }}
                                  style={{
                                    background: darkMode ? '#1e293b' : '#fee2e2', color: '#ef4444', border: 'none',
                                    borderRadius: '6px', padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <i className="ti ti-x" style={{ fontSize: '13px' }} /> Deny
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

              {/* 6. Overall Fee Progress Bar */}
              {feeTotals.total_due >= 0 && (
                <div className="card" style={{
                  marginBottom: '24px', borderRadius: '16px', padding: '18px 20px',
                  background: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-percentage" style={{ color: '#10b981', fontSize: '17px' }} />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: darkMode ? '#f1f5f9' : '#0f172a' }}>Institution Fee Recovery Rate</span>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      <span><span style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>Collected: </span><strong style={{ color: '#10b981' }}>₹{fmt(feeTotals.total_collected)}</strong></span>
                      <span><span style={{ color: darkMode ? '#94a3b8' : '#64748b' }}>Pending: </span><strong style={{ color: '#f59e0b' }}>₹{fmt(feeTotals.total_due - feeTotals.total_collected)}</strong></span>
                      <strong style={{ color: collectionPct >= 70 ? '#10b981' : '#ef4444', fontSize: '15px' }}>{collectionPct}%</strong>
                    </div>
                  </div>
                  <div style={{ height: '10px', background: darkMode ? '#1e293b' : '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${collectionPct}%`, height: '100%', borderRadius: '99px',
                      background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* 7. Upcoming Exams Timeline */}
              <UpcomingExamsCard darkMode={darkMode} navigate={navigate} />

              {/* 8. Attendance Charts & Comparative Analysis */}
              <div className="card" style={{
                marginBottom: '24px', borderRadius: '16px',
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(226,232,240,0.8)'}`,
                boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.04)'
              }}>
                <div className="card-header" style={{
                  padding: '14px 20px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { key: 'student', label: 'Student Analytics', icon: 'ti-backpack' },
                      { key: 'teacher', label: 'Faculty Analytics', icon: 'ti-chalkboard' },
                    ].map(t => (
                      <button
                        key={t.key}
                        onClick={() => setChartTab(t.key)}
                        style={{
                          background: chartTab === t.key ? (darkMode ? 'rgba(99,102,241,0.2)' : '#eef2ff') : 'none',
                          border: `1px solid ${chartTab === t.key ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                          borderRadius: '8px', cursor: 'pointer', padding: '6px 14px', fontSize: '12.5px', fontWeight: 700,
                          color: chartTab === t.key ? '#6366f1' : (darkMode ? '#94a3b8' : '#64748b'),
                          display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <i className={`ti ${t.icon}`} style={{ fontSize: '14px' }} />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {chartTab === 'student' && (
                    <select
                      className="form-select"
                      style={{
                        width: '150px', fontSize: '12px', borderRadius: '8px',
                        background: darkMode ? '#1e293b' : '#ffffff',
                        borderColor: darkMode ? '#334155' : '#cbd5e1',
                        color: darkMode ? '#f1f5f9' : '#0f172a'
                      }}
                      value={attFilter}
                      onChange={e => setAttFilter(e.target.value)}
                    >
                      <option value="">All Classes</option>
                      {(weeklyData?.class_today || []).map(c => (
                        <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', marginBottom: '12px' }}>
                      {chartTab === 'student' ? 'Today — Class Breakdown' : 'Today — Faculty Status'}
                    </div>
                    {chartTab === 'student' ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={attFilter ? (weeklyData?.class_today || []).filter(c => String(c.class_id) === String(attFilter)) : (weeklyData?.class_today || [])} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                          <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="total" name="Total" fill="#818cf8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="present" name="Present" fill="#34d399" radius={[4, 4, 0, 0]} />
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
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Total" fill="#818cf8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Present" fill="#34d399" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Half Day" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#cbd5e1' : '#475569', marginBottom: '12px' }}>Last 7 Days Comparison</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartTab === 'student' ? (weeklyData?.student_weekly || []) : (weeklyData?.teacher_weekly || [])} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: darkMode ? '#94a3b8' : '#64748b' }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: darkMode ? '#0f172a' : '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="total" name="Total" fill="#818cf8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="present" name="Present" fill="#34d399" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>

            {/* ─────────────────────────── RIGHT SIDEBAR FEED ─────────────────────────── */}
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

      {/* ══ Modern Styling & Theme Overrides ══ */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .live-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          20%, 60% { transform: rotate(14deg); }
          40%, 80% { transform: rotate(-14deg); }
        }

        .theme-dark { background: #0b0f19 !important; }
        .theme-dark .main-content { background: #0b0f19 !important; }
        .theme-dark .card { background: #111827 !important; border-color: rgba(255,255,255,0.07) !important; }
        .theme-dark .card-header { border-color: #1f2937 !important; }
        .theme-dark h1, .theme-dark h2, .theme-dark h3, .theme-dark h4, .theme-dark .page-title { color: #f8fafc !important; }
        .theme-dark .page-subtitle { color: #94a3b8 !important; }
        .theme-dark .table-container, .theme-dark table { background: #111827 !important; }
        .theme-dark th { background: #182234 !important; color: #94a3b8 !important; border-color: #1f2937 !important; }
        .theme-dark td { border-color: #1f2937 !important; color: #cbd5e1 !important; }
        .theme-dark .btn-neutral { background: #1e293b !important; color: #cbd5e1 !important; border-color: #334155 !important; }
        .theme-dark .form-select { background: #0f172a !important; color: #e2e8f0 !important; border-color: #334155 !important; }

        @media (max-width: 1180px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
