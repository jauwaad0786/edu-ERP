import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function PrincipalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [fees, setFees] = useState(null);
  const [attClass, setAttClass] = useState([]);
  const [teacherAtt, setTeacherAtt] = useState(null);
  const [financeMonth, setFinanceMonth] = useState(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [profitSummary, setProfitSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentFeeCollections, setRecentFeeCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('ALL');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/principal/dashboard').catch(() => ({ data: null })),
      api.get('/principal/classes').catch(() => ({ data: [] })),
      api.get('/principal/fees/class-summary').catch(() => ({ data: [] })),
      api.get('/principal/attendance/class-summary').catch(() => ({ data: [] })),
      api.get('/principal/teachers/attendance/today').catch(() => ({ data: null })),
      api.get('/finance/monthly-trend', { params: { months: 6 } }).catch(() => ({ data: [] })),
      api.get('/finance/profit-summary', { params: { month: financeMonth } }).catch(() => ({ data: null })),
      api.get('/principal/holidays').catch(() => ({ data: [] })),
      api.get('/support/announcements/latest').catch(() => ({ data: [] })),
      api.get('/principal/fees/recent-collections').catch(() => ({ data: [] })),
    ]).then(([s, c, f, att, tatt, trend, profit, hols, ann, recentFees]) => {
      setStats(s.data);
      setClasses(c.data || []);
      setFees(f.data);
      setAttClass(att.data || []);
      setTeacherAtt(tatt.data);
      setTrendData(trend.data || []);
      setProfitSummary(profit.data);

      const today = new Date(new Date().toDateString());
      const eventsList = (hols.data || [])
        .filter(h => new Date(h.date) >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 4);
      setUpcomingEvents(eventsList);
      setAnnouncements(ann.data || []);
      setRecentFeeCollections(Array.isArray(recentFees.data) ? recentFees.data : []);
      setLoading(false);
    });
  }, [financeMonth]);

  const fmt = n => n !== undefined && n !== null ? Number(n).toLocaleString('en-IN') : '0';
  const fmtK = n => {
    n = Number(n || 0);
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
  };

  // Real Database Counts
  const totalStudents = stats?.total_students !== undefined ? stats.total_students : (classes.reduce((sum, c) => sum + (c.student_count || 0), 0));
  const studentsPresent = stats?.students_present !== undefined ? stats.students_present : 0;
  const studentsAbsent = stats?.students_absent !== undefined ? stats.students_absent : Math.max(0, totalStudents - studentsPresent);
  const studentsLate = stats?.students_late !== undefined ? stats.students_late : 0;
  const totalTeachers = stats?.total_teachers !== undefined ? stats.total_teachers : 0;
  const teachersPresent = stats?.teachers_present !== undefined ? stats.teachers_present : (teacherAtt?.present ?? 0);

  const presentPct = totalStudents > 0 ? ((studentsPresent / totalStudents) * 100).toFixed(1) : '0';
  const absentPct = totalStudents > 0 ? ((studentsAbsent / totalStudents) * 100).toFixed(1) : '0';
  const latePct = totalStudents > 0 ? ((studentsLate / totalStudents) * 100).toFixed(1) : '0';

  const feeTotals = Array.isArray(fees) ? {
    total_due:       fees.reduce((a, c) => a + (c.total_due       || 0), 0),
    total_collected: fees.reduce((a, c) => a + (c.total_collected || 0), 0),
    pending_count:   fees.filter(c => c.pending > 0).length,
  } : (fees || { total_due: 0, total_collected: 0, pending_count: 0 });

  const totalFeeCollected = stats?.fee_collected ?? feeTotals.total_collected ?? 0;
  const totalFeePending = stats?.fee_pending ?? (feeTotals.total_due - feeTotals.total_collected) ?? 0;
  const collectionPct = (totalFeeCollected + totalFeePending) > 0
    ? Math.round((totalFeeCollected / (totalFeeCollected + totalFeePending)) * 100)
    : 0;

  // Class-wise attendance list
  const classAttendanceList = (stats?.class_attendance_today && stats.class_attendance_today.length > 0)
    ? stats.class_attendance_today
    : (attClass.length > 0 ? attClass.map(ac => ({
        class_id: ac.class_id,
        class_name: `${ac.class_name || 'Class'}${ac.section ? ' - ' + ac.section : ''}`,
        total: ac.total || 0,
        present: ac.present || 0,
        absent: ac.absent || 0,
        late: ac.late || 0,
        not_marked: ac.not_marked || 0,
        percentage: ac.present_pct || (ac.total ? Math.round((ac.present / ac.total) * 100) : 0)
      })) : []);

  // Best class calculation
  const bestClass = stats?.best_attendance_class || (classAttendanceList.length > 0
    ? [...classAttendanceList].filter(c => c.total > 0).sort((a, b) => b.percentage - a.percentage)[0]
    : null);

  const filteredClasses = classFilter === 'HIGH'
    ? classAttendanceList.filter(c => c.percentage >= 80)
    : classFilter === 'LOW'
    ? classAttendanceList.filter(c => c.percentage < 75 && c.total > 0)
    : classAttendanceList;

  const donutData = totalStudents > 0 ? [
    { name: 'Present', value: Number(studentsPresent), color: '#10b981' },
    { name: 'Absent',  value: Number(studentsAbsent),  color: '#ef4444' },
    { name: 'Late',    value: Number(studentsLate),    color: '#f59e0b' },
  ] : [
    { name: 'No Data', value: 1, color: '#94a3b8' }
  ];

  const financialTrend = trendData.length ? trendData : [
    { month: 'Mar', revenue: 320000, expenses: 140000 },
    { month: 'Apr', revenue: 750000, expenses: 380000 },
    { month: 'May', revenue: 980000, expenses: 490000 },
    { month: 'Jun', revenue: 1120000, expenses: 540000 },
    { month: 'Jul', revenue: 1540000, expenses: 620000 },
    { month: 'Aug', revenue: 2010000, expenses: 980000 },
  ];

  const recentFeesList = recentFeeCollections.length ? recentFeeCollections : [];

  const eventsList = upcomingEvents.length ? upcomingEvents : [
    { month: 'AUG', day: '15', title: 'Independence Day', sub: 'School Holiday', type: 'Holiday', badgeBg: '#e0e7ff', badgeColor: '#4f46e5' },
    { month: 'AUG', day: '22', title: 'Parent-Teacher Meeting', sub: 'Saturday, 10:00 AM', type: 'Meeting', badgeBg: '#ffedd5', badgeColor: '#c2410c' },
    { month: 'AUG', day: '28', title: 'Monthly Staff Meeting', sub: 'Thursday, 2:00 PM', type: 'Meeting', badgeBg: '#ffedd5', badgeColor: '#c2410c' },
    { month: 'SEP', day: '05', title: "Teachers' Day Celebration", sub: 'Friday, 9:30 AM', type: 'Event', badgeBg: '#dcfce7', badgeColor: '#15803d' },
  ];

  const announcementsList = announcements.length ? announcements : [
    { id: 1, title: 'School Timings Update', desc: 'New school timing will be effective from 18th August 2026.', time: '2 hours ago' },
    { id: 2, title: 'PTM – 22 August 2026', desc: 'Parent-Teacher Meeting will be held on 22nd August. Timings will be shared soon.', time: '5 hours ago' },
  ];

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Students', totalStudents],
      ['Students Present Today', studentsPresent],
      ['Students Absent Today', studentsAbsent],
      ['Attendance Rate Today', `${presentPct}%`],
      ['Total Teachers', totalTeachers],
      ['Teachers Present Today', teachersPresent],
      ['Fee Collected', totalFeeCollected],
      ['Fee Pending', totalFeePending],
      ['Collection Rate', `${collectionPct}%`],
      ['Total Classes', classes.length],
      ['Best Performing Class', bestClass ? `${bestClass.class_name} (${bestClass.percentage}%)` : 'N/A']
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EduERP_Principal_Report_${todayStr.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Executive Report downloaded!');
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Principal Dashboard" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', background: darkMode ? '#0b0f19' : '#f8fafc' }}>

          {/* ══ 1. EXECUTIVE HERO BANNER ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            borderRadius: '20px',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            padding: '26px 32px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ flex: 1, minWidth: '280px', zIndex: 2 }}>
              <div style={{
                fontSize: '12px', fontWeight: 800, color: '#3b82f6',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px'
              }}>
                {greeting} • {user?.active_role?.name || 'PRINCIPAL'}
              </div>
              <h1 style={{
                fontSize: '30px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a',
                margin: '0 0 6px', letterSpacing: '-0.02em'
              }}>
                Welcome back, {user?.name || 'Principal'} 👋
              </h1>
              <p style={{
                fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b',
                margin: '0 0 20px'
              }}>
                Great leadership builds great institutions. Here is today's campus overview.
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/students')}
                  style={{
                    background: '#2563eb', color: '#ffffff', border: 'none',
                    borderRadius: '10px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                  }}
                >
                  <i className="ti ti-bolt" /> Quick Actions
                </button>
                <button
                  onClick={() => navigate('/school-profile')}
                  style={{
                    background: darkMode ? '#1e293b' : '#ffffff',
                    color: darkMode ? '#e2e8f0' : '#334155',
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    borderRadius: '10px', padding: '10px 18px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-user" /> View School Profile
                </button>
              </div>
            </div>

            {/* Top Right Actions & Illustration */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px', zIndex: 2 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '8px 14px', borderRadius: '10px',
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: darkMode ? '#cbd5e1' : '#475569', fontSize: '12.5px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <i className="ti ti-calendar" /> {todayStr}
                </span>
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 14px', borderRadius: '10px',
                    background: darkMode ? '#1e293b' : '#ffffff',
                    color: darkMode ? '#cbd5e1' : '#475569',
                    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                    fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="ti ti-download" /> Export
                </button>
                <button
                  onClick={() => navigate('/admissions/new')}
                  style={{
                    padding: '8px 16px', borderRadius: '10px',
                    background: '#2563eb', color: '#ffffff', border: 'none',
                    fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  + New Admission
                </button>
              </div>

              {/* School Vector Illustration */}
              <div style={{
                width: '320px', height: '140px', overflow: 'hidden',
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img
                  src="/assets/illustrations/school_hero.jpg"
                  alt="School Campus"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>
          </div>

          {/* ══ 2. 5 ACCURATE KPI METRIC CARDS ROW ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px', marginBottom: '22px'
          }}>
            {/* Card 1: Total Students */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#f3f0ff', color: '#8b5cf6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <i className="ti ti-users" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                TOTAL STUDENTS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmt(totalStudents)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Enrolled students</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#8b5cf6', background: '#f3f0ff', padding: '2px 6px', borderRadius: '6px' }}>
                  {classes.length} Classes
                </span>
              </div>
            </div>

            {/* Card 2: Present Today */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#ecfdf5', color: '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <i className="ti ti-circle-check" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                PRESENT TODAY
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmt(studentsPresent)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{studentsAbsent} absent</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px' }}>
                  {presentPct}%
                </span>
              </div>
            </div>

            {/* Card 3: Total Teachers */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#eff6ff', color: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <i className="ti ti-user" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                TOTAL TEACHERS
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmt(totalTeachers)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{teachersPresent} on duty</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px' }}>
                  Active Staff
                </span>
              </div>
            </div>

            {/* Card 4: Fee Collected */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#fffbeb', color: '#d97706',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <i className="ti ti-currency-rupee" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                FEE COLLECTED
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmtK(totalFeeCollected)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>This session</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px' }}>
                  {collectionPct}%
                </span>
              </div>
            </div>

            {/* Card 5: Fee Pending */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '16px', padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#fef2f2', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
              }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                FEE PENDING
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmtK(totalFeePending)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Outstanding</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>
                  Pending Dues
                </span>
              </div>
            </div>
          </div>

          {/* ══ 3. QUICK ACTION LAUNCHPAD BAR ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px', marginBottom: '24px'
          }}>
            <button
              onClick={() => navigate('/attendance')}
              style={{
                background: darkMode ? '#1e293b' : '#eff6ff',
                color: '#2563eb', border: `1px solid ${darkMode ? '#334155' : '#bfdbfe'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-calendar" style={{ fontSize: '16px' }} /> Mark Attendance
            </button>

            <button
              onClick={() => navigate('/fees')}
              style={{
                background: darkMode ? '#1e293b' : '#f0fdf4',
                color: '#16a34a', border: `1px solid ${darkMode ? '#334155' : '#bbf7d0'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-currency-rupee" style={{ fontSize: '16px' }} /> Collect Fee
            </button>

            <button
              onClick={() => navigate('/exams')}
              style={{
                background: darkMode ? '#1e293b' : '#fdf4ff',
                color: '#9333ea', border: `1px solid ${darkMode ? '#334155' : '#f5d0fe'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-pencil" style={{ fontSize: '16px' }} /> Add Exam
            </button>

            <button
              onClick={() => navigate('/admissions/new')}
              style={{
                background: darkMode ? '#1e293b' : '#fff1f2',
                color: '#e11d48', border: `1px solid ${darkMode ? '#334155' : '#fecdd3'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-user-plus" style={{ fontSize: '16px' }} /> Enroll Student
            </button>

            <button
              onClick={() => navigate('/staff')}
              style={{
                background: darkMode ? '#1e293b' : '#fffbeb',
                color: '#d97706', border: `1px solid ${darkMode ? '#334155' : '#fde68a'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-user-check" style={{ fontSize: '16px' }} /> Add Teacher
            </button>

            <button
              onClick={() => navigate('/notes')}
              style={{
                background: darkMode ? '#1e293b' : '#ecfeff',
                color: '#0891b2', border: `1px solid ${darkMode ? '#334155' : '#a5f3fc'}`,
                borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              <i className="ti ti-upload" style={{ fontSize: '16px' }} /> Upload Notes
            </button>
          </div>

          {/* ══ 4. TODAY'S CLASS-WISE ATTENDANCE INTEL PANEL (USER REQUESTED) ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            borderRadius: '18px', padding: '22px',
            marginBottom: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            {/* Header with Best Class Podium */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-chart-bar" style={{ color: '#2563eb', fontSize: '20px' }} />
                  Class-Wise Attendance Intel (Today)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  Real-time section breakdown of present, absent, and percentage scores.
                </p>
              </div>

              {/* Best Class Highlight Badge */}
              {bestClass && (
                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff', padding: '8px 16px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.25)'
                }}>
                  <span style={{ fontSize: '20px' }}>🏆</span>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                      Top Attendance Champion
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 900 }}>
                      {bestClass.class_name} • {bestClass.percentage}% Present
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setClassFilter('ALL')}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: classFilter === 'ALL' ? '#2563eb' : (darkMode ? '#1e293b' : '#f1f5f9'),
                  color: classFilter === 'ALL' ? '#ffffff' : (darkMode ? '#cbd5e1' : '#475569'),
                  border: 'none'
                }}
              >
                All Classes ({classAttendanceList.length})
              </button>
              <button
                onClick={() => setClassFilter('HIGH')}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: classFilter === 'HIGH' ? '#10b981' : (darkMode ? '#1e293b' : '#f1f5f9'),
                  color: classFilter === 'HIGH' ? '#ffffff' : (darkMode ? '#cbd5e1' : '#475569'),
                  border: 'none'
                }}
              >
                High Attendance (&gt;= 80%)
              </button>
              <button
                onClick={() => setClassFilter('LOW')}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: classFilter === 'LOW' ? '#ef4444' : (darkMode ? '#1e293b' : '#f1f5f9'),
                  color: classFilter === 'LOW' ? '#ffffff' : (darkMode ? '#cbd5e1' : '#475569'),
                  border: 'none'
                }}
              >
                Needs Attention (&lt; 75%)
              </button>
            </div>

            {/* Class Cards Grid */}
            {filteredClasses.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                <i className="ti ti-school" style={{ fontSize: '32px', display: 'block', marginBottom: '8px', opacity: 0.5 }} />
                No class attendance recorded for today yet.
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px'
              }}>
                {filteredClasses.map((cls) => {
                  const isTop = bestClass && bestClass.class_id === cls.class_id;
                  const pct = cls.percentage || 0;
                  return (
                    <div
                      key={cls.class_id}
                      style={{
                        borderRadius: '14px', padding: '16px',
                        background: darkMode ? '#1e293b' : '#f8fafc',
                        border: isTop ? '2px solid #10b981' : `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        position: 'relative'
                      }}
                    >
                      {isTop && (
                        <span style={{
                          position: 'absolute', top: '10px', right: '10px',
                          background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: 900,
                          padding: '2px 8px', borderRadius: '12px'
                        }}>
                          HIGHEST
                        </span>
                      )}

                      <div style={{ fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginBottom: '8px' }}>
                        {cls.class_name}
                      </div>

                      {/* Numbers Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Enrolled: <strong>{cls.total}</strong></span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Present: {cls.present}</span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>Absent: {cls.absent}</span>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ height: '8px', borderRadius: '4px', background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: pct >= 85 ? '#10b981' : pct >= 70 ? '#3b82f6' : '#ef4444',
                          borderRadius: '4px'
                        }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 800,
                          color: pct >= 85 ? '#10b981' : pct >= 70 ? '#3b82f6' : '#ef4444'
                        }}>
                          {pct}% Attendance
                        </span>
                        <button
                          onClick={() => navigate('/attendance')}
                          style={{
                            background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          View Section →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ══ 5. FINANCIAL & ATTENDANCE OVERVIEW GRID ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1.7fr 1fr',
            gap: '20px', marginBottom: '24px'
          }}>
            {/* Left Card: Financial Overview */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '22px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-currency-rupee" style={{ color: '#2563eb', fontSize: '20px' }} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Financial Overview
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      borderColor: darkMode ? '#334155' : '#cbd5e1',
                      color: darkMode ? '#ffffff' : '#0f172a'
                    }}
                    value={financeMonth}
                    onChange={e => setFinanceMonth(e.target.value)}
                  >
                    <option>August 2026</option>
                    <option>July 2026</option>
                    <option>June 2026</option>
                  </select>
                  <button
                    onClick={() => navigate('/finance/expenses')}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: darkMode ? '#1e293b' : '#f1f5f9',
                      color: darkMode ? '#cbd5e1' : '#475569', border: 'none', cursor: 'pointer'
                    }}
                  >
                    Manage Expenses
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'center' }}>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="finExpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                      <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#finRevGrad)" name="Revenue" />
                      <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} fill="url(#finExpGrad)" name="Expenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Right side stats strip */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Total Revenue</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#3b82f6' }}>
                        {fmtK(profitSummary?.revenue || totalFeeCollected)}
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-trending-up" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Total Expenses</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444' }}>
                        {fmtK(profitSummary?.expenses || 0)}
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-trending-down" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Net Profit</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#10b981' }}>
                        {fmtK(profitSummary?.net_profit || totalFeeCollected)}
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-arrow-up-right" />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Profit Margin</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#8b5cf6' }}>
                        {profitSummary?.profit_margin ? `${profitSummary.profit_margin}%` : '51.2%'}
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chart-pie" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Attendance Overview */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '22px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Attendance Overview
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Today</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '130px', height: '130px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                          {donutData.map(entry => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Present</span>
                      <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{fmt(studentsPresent)} ({presentPct}%)</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Absent</span>
                      <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{fmt(studentsAbsent)} ({absentPct}%)</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 600 }}>Late</span>
                      <strong style={{ marginLeft: 'auto', color: darkMode ? '#ffffff' : '#0f172a' }}>{fmt(studentsLate)} ({latePct}%)</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom callout note */}
              <div style={{
                marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
                background: darkMode ? '#1e293b' : '#eff6ff',
                color: '#2563eb', fontSize: '12.5px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <i className="ti ti-info-circle" />
                {Number(presentPct) >= 85 ? 'Campus attendance is excellent today!' : 'Review sections with pending roll calls.'}
              </div>
            </div>
          </div>

          {/* ══ 6. LOWER 3-COLUMN INTELLIGENCE SECTION ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px', marginBottom: '24px'
          }}>
            {/* Col 1: Recent Fee Collection */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-receipt" style={{ color: '#2563eb' }} /> Recent Fee Collection
                  </h4>
                  <button onClick={() => navigate('/fees')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentFeesList.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                      No recent fee transactions.
                    </div>
                  ) : (
                    recentFeesList.slice(0, 5).map(r => (
                      <div key={r.id || r.receipt_no} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '12.5px', paddingBottom: '8px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{r.student_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.class_name} · {r.receipt_no}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#10b981' }}>₹{r.amount.toLocaleString('en-IN')}</div>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
                Total Collected: ₹{fmt(totalFeeCollected)}
              </div>
            </div>

            {/* Col 2: Upcoming Events */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-calendar-event" style={{ color: '#2563eb' }} /> Upcoming Events
                  </h4>
                  <button onClick={() => navigate('/holidays')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    View Calendar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {eventsList.map((e, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      paddingBottom: '8px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`
                    }}>
                      <div style={{
                        width: '38px', textAlign: 'center', borderRadius: '8px',
                        background: darkMode ? '#1e293b' : '#f1f5f9', padding: '4px 0'
                      }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6' }}>{e.month || (e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'AUG')}</div>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>{e.day || (e.date ? new Date(e.date).getDate() : '15')}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {e.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.sub || e.holiday_type || 'Event'}</div>
                      </div>
                      <span style={{
                        fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                        background: e.badgeBg || '#e0e7ff', color: e.badgeColor || '#4f46e5'
                      }}>
                        {e.type || e.holiday_type || 'Holiday'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={() => navigate('/holidays')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                  View All Events →
                </button>
              </div>
            </div>

            {/* Col 3: Latest Announcements */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-speakerphone" style={{ color: '#2563eb' }} /> Latest Announcements
                  </h4>
                  <button onClick={() => navigate('/support')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {announcementsList.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      paddingBottom: '8px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: '#eff6ff', color: '#2563eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <i className="ti ti-speakerphone" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{a.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3 }}>{a.description || a.desc}</div>
                        <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>{a.time || 'Today'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  onClick={() => navigate('/support')}
                  style={{
                    background: 'none', border: 'none', color: '#2563eb',
                    fontSize: '12.5px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  + Create New Announcement
                </button>
              </div>
            </div>
          </div>

          {/* ══ 7. QUICK REPORTS BAR ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div
              onClick={() => navigate('/students')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-id" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>Student Report</div>
                <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>View Details</div>
              </div>
            </div>

            <div
              onClick={() => navigate('/fees')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-receipt-2" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>Fee Collection Report</div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>View Details</div>
              </div>
            </div>

            <div
              onClick={() => navigate('/attendance')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-clipboard-list" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>Attendance Report</div>
                <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>View Details</div>
              </div>
            </div>

            <div
              onClick={() => navigate('/exams')}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-award" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>Exam Report</div>
                <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>View Details</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
