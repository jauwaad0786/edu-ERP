import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import OneP360BotDrawer from '../../AI/components/OneP360BotDrawer';

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
  const [feesSummary, setFeesSummary] = useState(null);
  const [teacherRequests, setTeacherRequests] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classViewMode, setClassViewMode] = useState('GRAPH'); // 'GRAPH' or 'GRID'
  const [feePeriod, setFeePeriod] = useState('MONTH'); // 'MONTH', 'YEAR', 'ALL'
  const [downloadingFeeReport, setDownloadingFeeReport] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/principal/dashboard').catch(() => ({ data: null })),
      api.get('/principal/classes').catch(() => ({ data: [] })),
      api.get('/principal/fees/class-summary').catch(() => ({ data: [] })),
      api.get('/finance/monthly-trend', { params: { months: 6 } }).catch(() => ({ data: [] })),
      api.get('/finance/profit-summary', { params: { month: financeMonth } }).catch(() => ({ data: null })),
      api.get('/principal/holidays').catch(() => ({ data: [] })),
      api.get('/support/announcements/latest').catch(() => ({ data: [] })),
      api.get('/principal/fees/recent-collections').catch(() => ({ data: [] })),
      api.get('/principal/fees/summary').catch(() => ({ data: null })),
      api.get('/hrms/leaves/requests', { params: { status: 'PENDING' } }).catch(() => ({ data: [] })),
    ]).then(([s, c, f, trend, profit, hols, ann, recentFees, fSum, tReqs]) => {
      setStats(s.data);
      setClasses(c.data || []);
      setFees(f.data);
      setAttClass(s.data?.class_attendance_today || []);
      setTeacherAtt(s.data ? { present: s.data.teachers_present, absent: s.data.teachers_absent } : null);
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
      setFeesSummary(fSum?.data || null);
      setTeacherRequests(Array.isArray(tReqs.data) ? tReqs.data : []);
      setLoading(false);
    });
  }, [financeMonth]);

  const handleReviewRequest = async (requestId, approve) => {
    setReviewingId(requestId);
    try {
      await api.post(`/hrms/leaves/requests/${requestId}/review`, {
        approve,
        remarks: approve ? 'Approved from Executive Dashboard' : 'Rejected from Executive Dashboard'
      });
      toast.success(approve ? 'Teacher request approved' : 'Teacher request rejected');
      setTeacherRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update request');
    } finally {
      setReviewingId(null);
    }
  };

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
  
  // Teacher Telemetry
  const totalTeachers = stats?.total_teachers !== undefined ? stats.total_teachers : 0;
  const teachersPresent = stats?.teachers_present !== undefined ? stats.teachers_present : (teacherAtt?.present ?? 0);
  const teachersAbsent = stats?.teachers_absent !== undefined ? stats.teachers_absent : (teacherAtt?.absent ?? Math.max(0, totalTeachers - teachersPresent));
  const teachersPct = totalTeachers > 0 ? ((teachersPresent / totalTeachers) * 100).toFixed(1) : '0';

  const presentPct = totalStudents > 0 ? ((studentsPresent / totalStudents) * 100).toFixed(1) : '0';
  const absentPct = totalStudents > 0 ? ((studentsAbsent / totalStudents) * 100).toFixed(1) : '0';
  const latePct = totalStudents > 0 ? ((studentsLate / totalStudents) * 100).toFixed(1) : '0';

  const feeTotals = Array.isArray(fees) ? {
    total_due:       fees.reduce((a, c) => a + (c.total_due       || 0), 0),
    total_collected: fees.reduce((a, c) => a + (c.total_collected || 0), 0),
    pending_count:   fees.filter(c => c.pending > 0).length,
  } : (fees || { total_due: 0, total_collected: 0, pending_count: 0 });

  const totalFeeCollected = stats?.fee_collected ?? feeTotals.total_collected ?? 0;
  const totalFeePending = stats?.fee_pending ?? (feeTotals.total_due - feeTotals.total_collected);
  const collectionPct = (totalFeeCollected + totalFeePending) > 0
    ? Math.round((totalFeeCollected / (totalFeeCollected + totalFeePending)) * 100)
    : 0;

  // Fee Intelligence (Month / Year / All Time)
  const feeIntel = stats?.fee_intelligence || {};
  const activeFeeGenerated = feePeriod === 'MONTH'
    ? (feeIntel.month_generated ?? (totalFeeCollected + totalFeePending))
    : feePeriod === 'YEAR'
    ? (feeIntel.year_generated ?? (totalFeeCollected + totalFeePending))
    : (feeIntel.all_time_generated ?? (totalFeeCollected + totalFeePending));

  const activeFeeCollected = feePeriod === 'MONTH'
    ? (feeIntel.month_collected ?? totalFeeCollected)
    : feePeriod === 'YEAR'
    ? (feeIntel.year_collected ?? totalFeeCollected)
    : (feeIntel.all_time_collected ?? totalFeeCollected);

  const activeFeePending = feePeriod === 'MONTH'
    ? (feeIntel.month_pending ?? totalFeePending)
    : feePeriod === 'YEAR'
    ? (feeIntel.year_pending ?? totalFeePending)
    : (feeIntel.all_time_pending ?? totalFeePending);

  const activeCollectionPct = feePeriod === 'MONTH'
    ? (feeIntel.month_percentage ?? (activeFeeGenerated > 0 ? Math.round((activeFeeCollected / activeFeeGenerated) * 100) : 0))
    : feePeriod === 'YEAR'
    ? (feeIntel.year_percentage ?? (activeFeeGenerated > 0 ? Math.round((activeFeeCollected / activeFeeGenerated) * 100) : 0))
    : (feeIntel.all_time_percentage ?? collectionPct);

  const activePeriodLabel = feePeriod === 'MONTH'
    ? `This Month (${feeIntel.current_month_label || 'Current'})`
    : feePeriod === 'YEAR'
    ? `This Academic Year (Session ${feeIntel.current_session || user?.school?.current_session || user?.current_session || '2026-27'})`
    : 'All Time (Total History)';

  const handleDownloadFeeReport = async () => {
    setDownloadingFeeReport(true);
    try {
      const params = new URLSearchParams();
      if (feePeriod === 'MONTH') {
        params.append('month', new Date().toISOString().slice(0, 7));
      } else if (feePeriod === 'YEAR') {
        params.append('session', feeIntel.current_session || user?.school?.current_session || user?.current_session || '2026-27');
      }
      const res = await api.get('/principal/fees/collection-report/pdf?' + params.toString(), { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      link.download = `Fee_Collection_Report_${feePeriod}.pdf`;
      link.click();
      toast.success('Fee Collection Report PDF downloaded!');
    } catch (e) {
      toast.error('Failed to download fee collection PDF report');
    } finally {
      setDownloadingFeeReport(false);
    }
  };

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

  // Celebrations & Leaves (Birthdays, Anniversaries, Staff on Leave)
  const birthdays = stats?.today_birthdays || [];
  const anniversaries = stats?.today_anniversaries || [];
  const staffOnLeave = stats?.staff_on_leave_today || [];

  const handleSendWish = (name, type) => {
    toast.success(`Wishes sent to ${name}! 🎉`, {
      icon: type === 'BIRTHDAY' ? '🎂' : '🌟',
      style: {
        borderRadius: '10px',
        background: darkMode ? '#1e293b' : '#333',
        color: '#fff',
      }
    });
  };

  const donutData = totalStudents > 0 ? [
    { name: 'Present', value: Number(studentsPresent), color: '#10b981' },
    { name: 'Absent',  value: Number(studentsAbsent),  color: '#ef4444' },
    { name: 'Late',    value: Number(studentsLate),    color: '#f59e0b' },
  ] : [
    { name: 'No Data', value: 1, color: '#94a3b8' }
  ];

  const financialTrend = trendData.length ? trendData : [];

  const recentFeesList = recentFeeCollections.length ? recentFeeCollections : [];

  const eventsList = upcomingEvents;

  const announcementsList = announcements;

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Students', totalStudents],
      ['Students Present Today', studentsPresent],
      ['Students Absent Today', studentsAbsent],
      ['Student Attendance Rate', `${presentPct}%`],
      ['Total Teachers', totalTeachers],
      ['Teachers Present Today', teachersPresent],
      ['Teachers Absent Today', teachersAbsent],
      ['Teacher Attendance Rate', `${teachersPct}%`],
      ['Fee Collected', totalFeeCollected],
      ['Fee Pending', totalFeePending],
      ['Collection Rate', `${collectionPct}%`],
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
        <Navbar title="Principal Executive Command" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body" style={{ padding: '24px', background: darkMode ? '#0b0f19' : '#f8fafc' }}>

          {/* ══ 1. EXECUTIVE HERO BANNER ══ */}
          <div style={{
            background: darkMode
              ? 'radial-gradient(circle at 85% 20%, rgba(2,132,199,0.3) 0%, transparent 60%), linear-gradient(135deg, #0b1528 0%, #0f172a 45%, #1e293b 100%)'
              : 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.18) 0%, transparent 50%), linear-gradient(135deg, #0b254a 0%, #014486 35%, #0284c7 75%, #38bdf8 100%)',
            borderRadius: '24px',
            border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
            padding: '28px 34px',
            marginBottom: '24px',
            boxShadow: darkMode
              ? '0 12px 35px -5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 15px 35px -5px rgba(2,132,199,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            flexWrap: 'wrap',
            gap: '24px'
          }}>
            {/* Background Decorative Rings */}
            <div style={{
              position: 'absolute', top: '-60px', right: '280px', width: '220px', height: '220px',
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none', filter: 'blur(30px)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '20%', width: '180px', height: '180px',
              borderRadius: '50%', background: 'rgba(56,189,248,0.12)', pointerEvents: 'none', filter: 'blur(40px)'
            }} />

            <div style={{ flex: 1, minWidth: '300px', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff', fontSize: '11.5px', fontWeight: 800,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <i className="ti ti-crown" /> {greeting} • {user?.active_role?.name || 'PRINCIPAL'}
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(255,255,255,0.12)', color: '#e0f2fe',
                  fontSize: '11.5px', fontWeight: 700, backdropFilter: 'blur(6px)'
                }}>
                  🏫 Academic Session {user?.school?.current_session || user?.current_session || feeIntel.current_session || '2026-27'}
                </span>
              </div>

              <h1 style={{
                fontSize: '32px', fontWeight: 900, color: '#ffffff',
                margin: '0 0 8px', letterSpacing: '-0.02em',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)'
              }}>
                Welcome back, {user?.name || 'Principal'} 👋
              </h1>

              <p style={{
                fontSize: '14.5px', color: 'rgba(255,255,255,0.92)',
                margin: '0 0 20px', maxWidth: '560px', lineHeight: 1.5,
                fontWeight: 500
              }}>
                Great leadership builds a great school. Here is today's real-time school overview, class attendance, and academic progress.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => navigate('/students')}
                  style={{
                    background: '#ffffff', color: '#014486', border: 'none',
                    borderRadius: '12px', padding: '11px 20px', fontSize: '13.5px',
                    fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(0,0,0,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.15)'; }}
                >
                  <i className="ti ti-bolt" style={{ color: '#0284c7' }} /> Quick Actions
                </button>
                <button
                  onClick={() => navigate('/school-profile')}
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.35)',
                    borderRadius: '12px', padding: '11px 20px', fontSize: '13.5px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                >
                  <i className="ti ti-building" /> School Profile
                </button>
              </div>
            </div>

            {/* Top Right Actions & 3D Isometric Illustration */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '14px', zIndex: 2 }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  padding: '8px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff', fontSize: '12.5px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  <i className="ti ti-calendar" /> {todayStr}
                </span>
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <i className="ti ti-download" /> Export
                </button>
                <button
                  onClick={() => navigate('/admissions/new')}
                  style={{
                    padding: '9px 18px', borderRadius: '10px',
                    background: '#ffffff', color: '#014486', border: 'none',
                    fontSize: '12.5px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  + New Admission
                </button>
              </div>

              {/* 3D Isometric School Building Card */}
              <div style={{
                width: '320px', height: '140px', overflow: 'hidden',
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: '6px',
                position: 'relative'
              }}>
                <img
                  src="/assets/illustrations/school_hero.jpg"
                  alt="School Building"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{
                  position: 'absolute', bottom: '10px', right: '12px',
                  background: 'rgba(15,23,42,0.75)', color: '#ffffff',
                  padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px',
                  fontWeight: 800, backdropFilter: 'blur(6px)', letterSpacing: '0.04em'
                }}>
                  🏫 SCHOOL HQ
                </div>
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

            {/* Card 2: Student Attendance Today */}
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
                STUDENTS PRESENT
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

            {/* Card 3: Teacher Attendance Today (USER REQUESTED) */}
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
                <i className="ti ti-user-check" style={{ fontSize: '18px' }} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.04em' }}>
                TEACHERS PRESENT
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmt(teachersPresent)} / {fmt(totalTeachers)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{teachersAbsent} absent</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '6px' }}>
                  {teachersPct}% Staff
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
                FEE COLLECTED ({feePeriod === 'MONTH' ? 'MONTH' : feePeriod === 'YEAR' ? 'SESSION' : 'ALL'})
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmtK(activeFeeCollected)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Of {fmtK(activeFeeGenerated)} generated</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px' }}>
                  {activeCollectionPct}%
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
                FEE PENDING ({feePeriod === 'MONTH' ? 'MONTH' : feePeriod === 'YEAR' ? 'SESSION' : 'ALL'})
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                {fmtK(activeFeePending)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Outstanding</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>
                  Pending Dues
                </span>
              </div>
            </div>
          </div>

          {/* ══ TODAY'S COLLECTION BY SERVICE (CENTRAL FINANCE) ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            borderRadius: '18px', padding: '20px', marginBottom: '22px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-cash" style={{ fontSize: '20px' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Today's Collection by Service (Central Finance Sync) 💰
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                    Unified real-time inflows across School, Hostel, Transport, Library &amp; Admission counters
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Total Today:</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#10b981' }}>
                  ₹{Number(feesSummary?.today_breakdown?.total || feesSummary?.today_collection || 0).toLocaleString('en-IN')}
                </span>
                <button
                  onClick={() => navigate('/finance/payments/collect')}
                  className="btn btn-sm btn-primary"
                  style={{ borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
                >
                  Collect Payment
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>SCHOOL / TUITION</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                  ₹{Number(feesSummary?.today_breakdown?.academic || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>HOSTEL FEES</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                  ₹{Number(feesSummary?.today_breakdown?.hostel || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #06b6d4' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>TRANSPORT FLEET</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                  ₹{Number(feesSummary?.today_breakdown?.transport || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>LIBRARY FINES</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                  ₹{Number(feesSummary?.today_breakdown?.library || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: darkMode ? '#1e293b' : '#f8fafc', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>NEW ADMISSIONS</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginTop: '2px' }}>
                  ₹{Number(feesSummary?.today_breakdown?.admission || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* ══ 3. FACULTY CELEBRATIONS BANNER (BIRTHDAYS & ANNIVERSARIES) ══ */}
          {(birthdays.length > 0 || anniversaries.length > 0) && (
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
              borderRadius: '18px', padding: '18px 24px', marginBottom: '22px',
              color: '#ffffff', boxShadow: '0 8px 24px rgba(124,58,237,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', backdropFilter: 'blur(4px)'
                }}>
                  🎉
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                    Campus Celebrations Today
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 900 }}>
                    {birthdays.length > 0 && `🎂 Happy Birthday: ${birthdays.map(b => b.name).join(', ')}! `}
                    {anniversaries.length > 0 && `🌟 Work Anniversary: ${anniversaries.map(a => `${a.name} (${a.years} yrs)`).join(', ')}!`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {birthdays.map(b => (
                  <button
                    key={b.id}
                    onClick={() => toast.success(`Birthday greeting card sent to ${b.name}! 🎂`)}
                    style={{
                      background: '#ffffff', color: '#4f46e5', border: 'none',
                      borderRadius: '10px', padding: '8px 14px', fontSize: '12px',
                      fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    🎉 Wish {b.name}
                  </button>
                ))}
                {anniversaries.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toast.success(`Congratulation note sent to ${a.name}! 🌟`)}
                    style={{
                      background: '#ffffff', color: '#db2777', border: 'none',
                      borderRadius: '10px', padding: '8px 14px', fontSize: '12px',
                      fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    🌟 Congratulate {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ 4. FEE INTELLIGENCE & REVENUE TRACKER (USER REQUESTED) ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            borderRadius: '20px', padding: '22px 24px', marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}>
            {/* Header with Title and Filter Switcher */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '14px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: '#eff6ff', color: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                }}>
                  <i className="ti ti-receipt-2" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a' }}>
                    Fee Generation &amp; Collection Intelligence
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Track billed school dues vs actual collected revenue for <strong>{activePeriodLabel}</strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Filter Pills */}
                <div style={{
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  padding: '4px', borderRadius: '10px', display: 'inline-flex', gap: '4px'
                }}>
                  {[
                    { key: 'MONTH', label: '📅 This Month' },
                    { key: 'YEAR', label: '🎓 Academic Year' },
                    { key: 'ALL', label: '🏛️ All Time' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFeePeriod(tab.key)}
                      style={{
                        padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 800,
                        border: 'none', cursor: 'pointer',
                        background: feePeriod === tab.key ? '#2563eb' : 'transparent',
                        color: feePeriod === tab.key ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* PDF Export Button */}
                <button
                  onClick={handleDownloadFeeReport}
                  disabled={downloadingFeeReport}
                  style={{
                    background: '#dc2626', color: '#ffffff', border: 'none',
                    borderRadius: '10px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 800,
                    cursor: downloadingFeeReport ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                  }}
                >
                  <i className="ti ti-file-type-pdf" style={{ fontSize: '16px' }} />
                  {downloadingFeeReport ? 'Exporting PDF...' : 'Download PDF Report'}
                </button>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {/* Metric 1: Generated Fees */}
              <div style={{
                background: darkMode ? '#1e293b' : '#f8fafc',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '16px 18px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TOTAL FEES GENERATED
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: darkMode ? '#ffffff' : '#0f172a', margin: '4px 0 2px' }}>
                  ₹{fmt(activeFeeGenerated)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Total billed ({feePeriod === 'MONTH' ? 'Month' : feePeriod === 'YEAR' ? 'Session' : 'All-time'})
                </div>
              </div>

              {/* Metric 2: Collected Fees */}
              <div style={{
                background: darkMode ? '#064e3b22' : '#f0fdf4',
                border: `1px solid ${darkMode ? '#065f46' : '#bbf7d0'}`,
                borderRadius: '14px', padding: '16px 18px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  COLLECTED REVENUE
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#16a34a', margin: '4px 0 2px' }}>
                  ₹{fmt(activeFeeCollected)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600 }}>
                  Realized in bank / counter
                </div>
              </div>

              {/* Metric 3: Pending Dues */}
              <div style={{
                background: darkMode ? '#7f1d1d22' : '#fef2f2',
                border: `1px solid ${darkMode ? '#991b1b' : '#fecaca'}`,
                borderRadius: '14px', padding: '16px 18px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  OUTSTANDING DUES
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626', margin: '4px 0 2px' }}>
                  ₹{fmt(activeFeePending)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                  Pending from students
                </div>
              </div>

              {/* Metric 4: Recovery / Collection Rate */}
              <div style={{
                background: darkMode ? '#1e293b' : '#f8fafc',
                border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    COLLECTION RATE
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0891b2', margin: '4px 0 2px' }}>
                    {activeCollectionPct}%
                  </div>
                </div>
                <div style={{ width: '100%', background: darkMode ? '#334155' : '#e2e8f0', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, activeCollectionPct))}%`, background: '#0891b2', height: '100%', borderRadius: '100px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ══ 4. QUICK ACTION LAUNCHPAD BAR ══ */}
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
              <i className="ti ti-user-check" style={{ fontSize: '16px' }} /> Onboard Teacher
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

          {/* ══ 5. CLASS-WISE ATTENDANCE INTEL VIA INTERACTIVE BAR GRAPH & CARDS ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            borderRadius: '18px', padding: '22px',
            marginBottom: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            {/* Header with Best Class Podium & View Mode Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-chart-bar" style={{ color: '#2563eb', fontSize: '20px' }} />
                  Class-Wise Attendance Intel (Today)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                  Real-time section breakdown comparing present vs absent students across grades.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Best Class Highlight Badge */}
                {bestClass && (
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff', padding: '7px 14px', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.25)'
                  }}>
                    <span style={{ fontSize: '18px' }}>🏆</span>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                        Highest Attendance
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 900 }}>
                        {bestClass.class_name} • {bestClass.percentage}%
                      </div>
                    </div>
                  </div>
                )}

                {/* View Switcher: Graph vs Grid */}
                <div style={{
                  display: 'flex', background: darkMode ? '#1e293b' : '#f1f5f9',
                  borderRadius: '10px', padding: '3px'
                }}>
                  <button
                    onClick={() => setClassViewMode('GRAPH')}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: classViewMode === 'GRAPH' ? '#2563eb' : 'transparent',
                      color: classViewMode === 'GRAPH' ? '#ffffff' : (darkMode ? '#cbd5e1' : '#64748b'),
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <i className="ti ti-chart-bar" /> Graph
                  </button>
                  <button
                    onClick={() => setClassViewMode('GRID')}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: classViewMode === 'GRID' ? '#2563eb' : 'transparent',
                      color: classViewMode === 'GRID' ? '#ffffff' : (darkMode ? '#cbd5e1' : '#64748b'),
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <i className="ti ti-layout-grid" /> Cards
                  </button>
                </div>
              </div>
            </div>

            {/* View Mode: Interactive Recharts Bar Chart */}
            {classViewMode === 'GRAPH' && (
              <div style={{ width: '100%', height: '280px', marginTop: '10px' }}>
                {classAttendanceList.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="ti ti-chart-bar" style={{ fontSize: '32px', display: 'block', marginBottom: '8px', opacity: 0.5 }} />
                    No class attendance marked for today yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classAttendanceList} margin={{ top: 15, right: 15, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1f2937' : '#f1f5f9'} />
                      <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: '#94a3b8' }} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                          borderColor: darkMode ? '#334155' : '#e2e8f0',
                          borderRadius: '10px',
                          color: darkMode ? '#ffffff' : '#0f172a',
                          fontWeight: 600
                        }}
                        formatter={(val, name) => [`${val} Students`, name]}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                      <Bar dataKey="present" name="Present Today" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="Absent Today" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" name="Total Enrolled" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.3} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* View Mode: Cards Grid */}
            {classViewMode === 'GRID' && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '14px', marginTop: '10px'
              }}>
                {classAttendanceList.map((cls) => {
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
                          TOP
                        </span>
                      )}

                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', marginBottom: '8px' }}>
                        {cls.class_name}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Total: <strong>{cls.total}</strong></span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>Present: {cls.present}</span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>Absent: {cls.absent}</span>
                      </div>

                      <div style={{ height: '7px', borderRadius: '4px', background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden', marginBottom: '8px' }}>
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
                          Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ══ 6. FINANCIAL & ATTENDANCE OVERVIEW GRID ══ */}
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
                  {financialTrend.length > 0 ? (
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
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '8px' }}>
                      <i className="ti ti-chart-area-line" style={{ fontSize: '36px', opacity: 0.4 }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>No financial transactions recorded for this session yet.</div>
                    </div>
                  )}
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
                        {fmtK(profitSummary?.profit ?? profitSummary?.net_profit ?? 0)}
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
                        {`${profitSummary?.profit_margin_pct ?? profitSummary?.profit_margin ?? 0}%`}
                      </div>
                    </div>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f3f0ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-chart-pie" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Student Attendance Donut */}
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
                    Student Attendance
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

          {/* ══ 6.5 CAMPUS PULSE: LEAVES & CELEBRATIONS ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px', marginBottom: '24px'
          }}>
            {/* Card 1: Faculty & Staff On Leave Today */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '22px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: staffOnLeave.length > 0 ? (darkMode ? '#372025' : '#fef2f2') : (darkMode ? '#132e27' : '#ecfdf5'),
                      color: staffOnLeave.length > 0 ? '#ef4444' : '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px'
                    }}>
                      <i className={staffOnLeave.length > 0 ? "ti ti-user-off" : "ti ti-user-check"} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                          Teachers & Staff On Leave
                        </h3>
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                          background: staffOnLeave.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: staffOnLeave.length > 0 ? '#ef4444' : '#10b981',
                        }}>
                          {staffOnLeave.length} ON LEAVE
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Faculty and staff members absent or on approved leave today
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/hrms/leaves')}
                    style={{
                      background: 'none', border: 'none', color: '#2563eb', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <span>Leave Desk</span>
                    <i className="ti ti-arrow-right" />
                  </button>
                </div>

                {staffOnLeave.length === 0 ? (
                  <div style={{
                    padding: '32px 16px', textAlign: 'center', borderRadius: '14px',
                    background: darkMode ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4',
                    border: `1px dashed ${darkMode ? 'rgba(16, 185, 129, 0.25)' : '#bbf7d0'}`
                  }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', margin: '0 auto 10px',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                      <i className="ti ti-shield-check" />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      All Teachers & Staff Are On Duty Today!
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
                      Full faculty attendance recorded with no active approved leaves for today.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '290px', overflowY: 'auto' }}>
                    {staffOnLeave.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', borderRadius: '12px',
                          background: darkMode ? '#1e293b' : '#f8fafc',
                          border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            background: darkMode ? '#0f172a' : '#ffffff',
                            border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                            color: '#6366f1', fontWeight: 800, fontSize: '14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {item.name ? item.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
                              <span style={{
                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                background: item.role === 'TEACHER' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                                color: item.role === 'TEACHER' ? '#2563eb' : '#7c3aed'
                              }}>
                                {item.role === 'TEACHER' ? 'Teacher' : (item.role || 'Staff')}
                              </span>
                              <span>·</span>
                              <span>{item.department || 'Academic'}</span>
                            </div>
                            {item.reason && (
                              <div style={{ fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                "{item.reason}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                            background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444'
                          }}>
                            {item.leave_type || 'Leave'}
                          </span>
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px', fontWeight: 600 }}>
                            {item.is_half_day ? 'Half Day' : (item.days_count ? `${item.days_count} Day${item.days_count > 1 ? 's' : ''}` : 'Today')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  Total on Leave: <strong style={{ color: staffOnLeave.length > 0 ? '#ef4444' : '#10b981' }}>{staffOnLeave.length}</strong>
                </div>
                <button
                  onClick={() => navigate('/hrms/attendance')}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View Staff Attendance →
                </button>
              </div>
            </div>

            {/* Card 2: Today's Celebrations (Birthdays & Work Anniversaries) */}
            <div style={{
              background: darkMode ? '#111827' : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
              borderRadius: '18px', padding: '22px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: (birthdays.length + anniversaries.length > 0) ? (darkMode ? '#382512' : '#fef3c7') : (darkMode ? '#1e293b' : '#f1f5f9'),
                      color: (birthdays.length + anniversaries.length > 0) ? '#d97706' : '#94a3b8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                      {(birthdays.length + anniversaries.length > 0) ? '🎉' : '🎂'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                          Today's Celebrations
                        </h3>
                        <span style={{
                          fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                          background: (birthdays.length + anniversaries.length > 0) ? 'rgba(245, 158, 11, 0.15)' : (darkMode ? '#1e293b' : '#f1f5f9'),
                          color: (birthdays.length + anniversaries.length > 0) ? '#f59e0b' : '#94a3b8',
                        }}>
                          {birthdays.length + anniversaries.length} CELEBRATING
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Birthdays & Work Anniversaries for teachers and staff
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/teachers')}
                    style={{
                      background: 'none', border: 'none', color: '#2563eb', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <span>Staff Directory</span>
                    <i className="ti ti-arrow-right" />
                  </button>
                </div>

                {(birthdays.length === 0 && anniversaries.length === 0) ? (
                  <div style={{
                    padding: '32px 16px', textAlign: 'center', borderRadius: '14px',
                    background: darkMode ? 'rgba(245, 158, 11, 0.04)' : '#fffbeb',
                    border: `1px dashed ${darkMode ? 'rgba(245, 158, 11, 0.25)' : '#fde68a'}`
                  }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', margin: '0 auto 10px',
                      background: 'rgba(245, 158, 11, 0.15)', color: '#d97706',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                    }}>
                      ✨
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      No Celebrations Scheduled For Today
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
                      Birthdays and work milestones of teachers and staff will be prominently highlighted here every day.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '290px', overflowY: 'auto' }}>
                    {/* Birthdays */}
                    {birthdays.map((b, idx) => (
                      <div
                        key={`bday_${b.id || idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', borderRadius: '12px',
                          background: darkMode ? 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(139,92,246,0.08))' : 'linear-gradient(135deg, #fdf2f8, #f5f3ff)',
                          border: `1px solid ${darkMode ? 'rgba(236,72,153,0.3)' : '#fbcfe8'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                            color: '#ffffff', fontSize: '20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            🎂
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.name}
                              </span>
                              <span style={{
                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                                background: '#ec4899', color: '#ffffff'
                              }}>
                                Birthday!
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                              {b.designation || (b.role === 'TEACHER' ? 'Teacher' : 'Staff')} · {b.department || 'Faculty'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#ec4899', fontWeight: 600, marginTop: '2px' }}>
                              Happy Birthday! Wishing them great joy 🥳
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSendWish(b.name, 'BIRTHDAY')}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            background: '#ec4899', color: '#ffffff',
                            border: 'none', fontSize: '11.5px', fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(236, 72, 153, 0.3)'
                          }}
                        >
                          <span>Wish</span> 🎉
                        </button>
                      </div>
                    ))}

                    {/* Work Anniversaries */}
                    {anniversaries.map((a, idx) => (
                      <div
                        key={`anniv_${a.id || idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', borderRadius: '12px',
                          background: darkMode ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,179,8,0.08))' : 'linear-gradient(135deg, #fffbeb, #fef9c3)',
                          border: `1px solid ${darkMode ? 'rgba(245,158,11,0.3)' : '#fde68a'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #f59e0b, #eab308)',
                            color: '#ffffff', fontSize: '20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            🌟
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.name}
                              </span>
                              <span style={{
                                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                                background: '#d97706', color: '#ffffff'
                              }}>
                                {a.years} {a.years === 1 ? 'Year' : 'Years'} Service!
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                              {a.designation || (a.role === 'TEACHER' ? 'Teacher' : 'Staff')} · {a.department || 'Faculty'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
                              Celebrating {a.years} glorious {a.years === 1 ? 'year' : 'years'} at school 🏆
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSendWish(a.name, 'ANNIVERSARY')}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            background: '#d97706', color: '#ffffff',
                            border: 'none', fontSize: '11.5px', fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                          }}
                        >
                          <span>Congratulate</span> 🌟
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  🎂 {birthdays.length} Birthday{birthdays.length === 1 ? '' : 's'} · 🌟 {anniversaries.length} Work Anniversar{anniversaries.length === 1 ? 'y' : 'ies'}
                </div>
                <button
                  onClick={() => navigate('/support/announcements')}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Post Campus Announcement →
                </button>
              </div>
            </div>
          </div>

          {/* ══ 7. LOWER 3-COLUMN INTELLIGENCE SECTION ══ */}
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
                    recentFeesList.slice(0, 6).map(r => (
                      <div key={r.id || r.receipt_no} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '12.5px', paddingBottom: '8px', borderBottom: `1px solid ${darkMode ? '#1f2937' : '#f1f5f9'}`
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: darkMode ? '#ffffff' : '#0f172a' }}>{r.student_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {r.service ? <span style={{ fontWeight: 700, color: '#3b82f6' }}>{r.service} · </span> : ''}
                            {r.class_name} · {r.receipt_no}
                          </div>
                          {r.collector_role && (
                            <div style={{ fontSize: '10.5px', color: '#6366f1', fontWeight: 600 }}>
                              Collected by {r.collector_role} {r.time_ago ? `(${r.time_ago})` : ''}
                            </div>
                          )}
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
                  {eventsList.length === 0 ? (
                    <div style={{ padding: '28px 12px', textAlign: 'center', color: '#94a3b8' }}>
                      <i className="ti ti-calendar-event" style={{ fontSize: '28px', opacity: 0.4, display: 'block', marginBottom: '8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>No upcoming events scheduled</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Holidays and school functions will appear here.</div>
                    </div>
                  ) : (
                    eventsList.map((e, idx) => (
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
                    ))
                  )}
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
                  <button onClick={() => navigate('/support/announcements')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {announcementsList.length === 0 ? (
                    <div style={{ padding: '28px 12px', textAlign: 'center', color: '#94a3b8' }}>
                      <i className="ti ti-speakerphone" style={{ fontSize: '28px', opacity: 0.4, display: 'block', marginBottom: '8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>No active announcements</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Broadcast notices to staff, students, and parents.</div>
                    </div>
                  ) : (
                    announcementsList.map(a => (
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
                    ))
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  onClick={() => navigate('/announcements/create')}
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

          {/* ══ 7. TEACHER REQUESTS & PENDING APPROVALS ══ */}
          <div style={{
            background: darkMode ? '#111827' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            borderRadius: '18px', padding: '22px', marginBottom: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: darkMode ? '#1e293b' : '#eff6ff',
                  color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="ti ti-user-check" style={{ fontSize: '20px' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                      Teacher Requests & Approvals
                    </h3>
                    <span style={{
                      fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                      background: teacherRequests.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: teacherRequests.length > 0 ? '#ef4444' : '#10b981',
                    }}>
                      {teacherRequests.length} {teacherRequests.length === 1 ? 'REQUEST' : 'REQUESTS'} PENDING
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Review leave applications, official duty permissions, and requests submitted by teachers.
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/hrms/leaves')}
                style={{
                  padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                  background: darkMode ? '#1e293b' : '#f1f5f9',
                  color: darkMode ? '#93c5fd' : '#2563eb', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>HRMS Leave Dashboard</span>
                <i className="ti ti-arrow-right" />
              </button>
            </div>

            {teacherRequests.length === 0 ? (
              <div style={{
                padding: '36px 20px', textAlign: 'center', borderRadius: '14px',
                background: darkMode ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
                border: `1px dashed ${darkMode ? '#334155' : '#cbd5e1'}`
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 12px',
                  background: 'rgba(16, 185, 129, 0.12)', color: '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                }}>
                  <i className="ti ti-circle-check" />
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                  All Teacher Requests Are Up to Date!
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', maxWidth: '480px', margin: '4px auto 0', lineHeight: 1.4 }}>
                  No pending teacher leave requests or duty applications. When faculty members submit requests from their portal, they appear here for one-click approval.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '14px'
              }}>
                {teacherRequests.map(req => (
                  <div
                    key={req.id}
                    style={{
                      borderRadius: '14px', padding: '16px',
                      background: darkMode ? '#1e293b' : '#f8fafc',
                      border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>
                            {req.employee_name || 'Faculty Member'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {req.employee_id ? `ID: ${req.employee_id} · ` : ''}{req.department || req.role || 'Teacher'}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                          background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6'
                        }}>
                          {req.leave_type_name || 'Leave Request'}
                        </span>
                      </div>

                      <div style={{
                        padding: '8px 10px', borderRadius: '8px',
                        background: darkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                        fontSize: '12px', color: darkMode ? '#cbd5e1' : '#475569',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 600 }}>
                          <span>Duration: <strong>{req.days_count || 1} {req.days_count === 1 ? 'Day' : 'Days'}</strong></span>
                          <span style={{ color: '#2563eb' }}>{req.from_date}{req.to_date && req.to_date !== req.from_date ? ` to ${req.to_date}` : ''}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: darkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>
                          "{req.reason || 'No reason provided'}"
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => handleReviewRequest(req.id, true)}
                        disabled={reviewingId === req.id}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: '8px',
                          background: '#10b981', color: '#ffffff',
                          border: 'none', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          opacity: reviewingId === req.id ? 0.7 : 1
                        }}
                      >
                        <i className="ti ti-check" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleReviewRequest(req.id, false)}
                        disabled={reviewingId === req.id}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: '8px',
                          background: darkMode ? '#334155' : '#fee2e2',
                          color: '#ef4444',
                          border: 'none', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          opacity: reviewingId === req.id ? 0.7 : 1
                        }}
                      >
                        <i className="ti ti-x" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ 8. QUICK REPORTS BAR ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/students')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/students'); } }}
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
              role="button"
              tabIndex={0}
              onClick={() => navigate('/fees')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/fees'); } }}
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
              role="button"
              tabIndex={0}
              onClick={() => navigate('/attendance')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/attendance'); } }}
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
              role="button"
              tabIndex={0}
              onClick={() => navigate('/transport/reports')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/transport/reports'); } }}
              style={{
                background: darkMode ? '#111827' : '#ffffff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                borderRadius: '14px', padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-bus" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: darkMode ? '#ffffff' : '#0f172a' }}>Transport Travel Report</div>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>View Details</div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/exams')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/exams'); } }}
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
      <OneP360BotDrawer />
    </div>
  );
}

