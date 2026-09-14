import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function FeeCollectionAnalyticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState(null);
  const [classes, setClasses] = useState([]);

  // URL / Initial state filters
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') || currentMonthStr);
  const [selectedSession, setSelectedSession] = useState(searchParams.get('session') || '2026-27');
  const [selectedClass, setSelectedClass] = useState(searchParams.get('class_id') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'ALL');
  const [selectedService, setSelectedService] = useState(searchParams.get('service') || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Collect Modal State
  const [collectModal, setCollectModal] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [txnRef, setTxnRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Load Classes
  useEffect(() => {
    api.get('/principal/classes')
      .then(res => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch Matrix & Charts Data
  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedSession) params.append('session', selectedSession);
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedService && selectedService !== 'ALL') params.append('service_code', selectedService);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await api.get(`/fees-finance/services/collection-matrix?${params.toString()}`);
      setMatrixData(res.data || null);
    } catch (err) {
      toast.error('Failed to load collection analytics matrix');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedSession, selectedClass, selectedStatus, selectedService, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMatrix();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchMatrix]);

  // Handle Quick Collection
  const handleQuickCollect = async (e) => {
    e.preventDefault();
    if (!activeStudent || !payAmount || parseFloat(payAmount) <= 0) {
      toast.error('Please enter a valid collection amount');
      return;
    }
    try {
      setCollecting(true);
      const payload = {
        student_id: activeStudent.student_id,
        amount_paid: parseFloat(payAmount),
        payment_mode: payMode,
        transaction_ref: txnRef,
        remarks: payRemarks || `Collected from Principal Collection Hub`,
        session: selectedSession,
      };

      const res = await api.post('/fees-finance/payments/collect', payload);
      toast.success(`Collected ₹${payAmount} from ${activeStudent.name}! Receipt: ${res.data?.receipt_no || ''}`);
      setCollectModal(false);
      setActiveStudent(null);
      setPayAmount('');
      setTxnRef('');
      fetchMatrix();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to collect payment');
    } finally {
      setCollecting(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  const summary = matrixData?.summary || {};
  const serviceBreakdown = matrixData?.service_breakdown || [];
  const classBreakdown = matrixData?.class_breakdown || [];
  const students = matrixData?.students || [];

  // Pie chart data for student realization
  const studentPieData = useMemo(() => {
    const fullyPaid = summary.fully_paid_count || 0;
    const partial = summary.partial_count || 0;
    const pending = summary.pending_count || 0;
    if (fullyPaid === 0 && partial === 0 && pending === 0) {
      return [{ name: 'No Billed Students', value: 1, color: '#e2e8f0' }];
    }
    return [
      { name: 'Fully Paid', value: fullyPaid, color: '#10b981' },
      { name: 'Partially Paid', value: partial, color: '#f59e0b' },
      { name: 'Pending / Unpaid', value: pending, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [summary]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Fee Collection & Realization Intelligence" />
        <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px' }}>

          {/* ══ 1. HEADER & TOP BANNER ══ */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '16px', marginBottom: '24px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    background: '#f1f5f9', border: 'none', borderRadius: '8px',
                    padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 700, color: '#475569'
                  }}
                >
                  <i className="ti ti-arrow-left" /> Back
                </button>
                <span style={{
                  background: '#ecfdf5', color: '#059669', fontSize: '12px',
                  fontWeight: 800, padding: '4px 10px', borderRadius: '100px'
                }}>
                  ● Live Collection Hub
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{selectedSession}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                Fee Collection Analytics &amp; Student Matrix
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Comprehensive revenue realization for <strong>{matrixData?.month_label || selectedMonth}</strong> with service-by-service student dues breakdown, interactive graphs, and instant payment counter.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate(resolveTenantPath('/finance/payments/collect', user))}
                className="btn btn-primary"
                style={{
                  borderRadius: '10px', padding: '10px 18px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                }}
              >
                <i className="ti ti-cash" style={{ fontSize: '18px' }} />
                Open Cash / Counter Desk
              </button>

              <button
                onClick={() => navigate(resolveTenantPath('/finance/service-generation', user))}
                className="btn btn-neutral"
                style={{ borderRadius: '10px', padding: '10px 16px', fontWeight: 700 }}
              >
                <i className="ti ti-receipt-2" />
                Service Generation Status
              </button>
            </div>
          </div>

          {/* ══ 2. TOP KPI CARDS ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px', marginBottom: '24px'
          }}>
            {/* Card 1: Total Realized */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #bbf7d0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                  COLLECTED REVENUE
                </span>
                <span style={{ background: '#ecfdf5', color: '#16a34a', borderRadius: '8px', padding: '2px 6px', fontSize: '11px', fontWeight: 800 }}>
                  Realized
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#16a34a' }}>
                ₹{fmt(summary.total_collected)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Recovery Rate: <strong>{summary.recovery_rate || 0}%</strong>
              </div>
            </div>

            {/* Card 2: Pending Outstanding */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #fecaca', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                  PENDING DUES
                </span>
                <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '8px', padding: '2px 6px', fontSize: '11px', fontWeight: 800 }}>
                  Outstanding
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#dc2626' }}>
                ₹{fmt(summary.total_pending)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Of ₹{fmt(summary.total_due)} total billed
              </div>
            </div>

            {/* Card 3: Fully Paid Students */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  FULLY PAID STUDENTS
                </span>
                <span style={{ background: '#ecfdf5', color: '#059669', borderRadius: '8px', padding: '2px 6px', fontSize: '11px', fontWeight: 800 }}>
                  {summary.total_students_billed > 0 ? Math.round((summary.fully_paid_count / summary.total_students_billed) * 100) : 0}%
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>
                {summary.fully_paid_count || 0} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {summary.total_students_billed || 0}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Zero pending balance
              </div>
            </div>

            {/* Card 4: Students with Pending Dues */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  STUDENTS WITH DUES
                </span>
                <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '8px', padding: '2px 6px', fontSize: '11px', fontWeight: 800 }}>
                  Dues Action
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#e11d48' }}>
                {(summary.partial_count || 0) + (summary.pending_count || 0)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {summary.partial_count || 0} partial, {summary.pending_count || 0} unpaid
              </div>
            </div>
          </div>

          {/* ══ 3. VISUAL ANALYTICS CHARTS (RECHARTS) ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '18px', marginBottom: '24px'
          }}>
            {/* Chart 1: Service-Wise Collection Breakdown (Grouped Bar Chart) */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                    Service Revenue Realization (₹) 📊
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Billed vs Collected revenue across Tuition, Transport, Hostel, Library &amp; Exams
                  </p>
                </div>
              </div>

              {serviceBreakdown.length === 0 ? (
                <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No service collection data recorded for this month yet.
                </div>
              ) : (
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip
                        formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                        contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="collected" name="Collected Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending Dues" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Student Realization Donut & Class Progress */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                    Student Realization Ratio 🎯
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Proportion of students who completed fee payment vs pending
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                {/* Donut Chart */}
                <div style={{ height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={studentPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {studentPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => [`${v} Students`, name]}
                        contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend & Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#ecfdf5', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#065f46' }}>Fully Paid:</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#065f46' }}>
                      {summary.fully_paid_count || 0}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fef3c7', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400e' }}>Partially Paid:</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#92400e' }}>
                      {summary.partial_count || 0}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fef2f2', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b' }}>Pending Dues:</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: '#991b1b' }}>
                      {summary.pending_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ 4. FILTER TOOLBAR ══ */}
          <div style={{
            background: '#ffffff', borderRadius: '16px', padding: '16px 20px',
            border: '1px solid #e2e8f0', marginBottom: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Month Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 700, color: '#0f172a'
                  }}
                />
              </div>

              {/* Status Tabs */}
              <div style={{ background: '#f1f5f9', padding: '3px', borderRadius: '10px', display: 'inline-flex', gap: '4px' }}>
                {[
                  { key: 'ALL', label: 'All Students' },
                  { key: 'PAID', label: '✅ Fully Paid' },
                  { key: 'PARTIAL', label: '🔄 Partial' },
                  { key: 'PENDING', label: '⚠️ Pending Dues' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedStatus(tab.key)}
                    style={{
                      padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 800,
                      border: 'none', cursor: 'pointer',
                      background: selectedStatus === tab.key ? '#2563eb' : 'transparent',
                      color: selectedStatus === tab.key ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Class Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 700, color: '#0f172a'
                  }}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Service Dues:</span>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 700, color: '#0f172a'
                  }}
                >
                  <option value="ALL">All Services</option>
                  {serviceBreakdown.map(s => (
                    <option key={s.code} value={s.code}>
                      Pending in {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Search */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search student or admission no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 32px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', fontSize: '12.5px'
                }}
              />
              <i className="ti ti-search" style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
            </div>
          </div>

          {/* ══ 5. STUDENT COLLECTION MATRIX TABLE ══ */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px' }}>
              <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 14px' }}></div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Loading collection records...
              </h3>
            </div>
          ) : students.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px', background: '#ffffff',
              borderRadius: '16px', border: '1px dashed #cbd5e1'
            }}>
              <i className="ti ti-users" style={{ fontSize: '42px', color: '#94a3b8' }} />
              <h3 style={{ margin: '12px 0 4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                No students match current filter criteria
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Try switching the month or resetting your status/class filters.
              </p>
            </div>
          ) : (
            <div style={{
              background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
              overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>
                  Showing <strong>{students.length}</strong> Students
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Click <strong>Collect</strong> to record fee or view ledger
                </span>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>STUDENT</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>CLASS</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>SERVICE STATUS BREAKDOWN</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>TOTAL DUE</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>PAID</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>BALANCE</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>STATUS</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(st => {
                      const isPaid = st.status === 'PAID';
                      const isPart = st.status === 'PARTIALLY_PAID';
                      const isPending = st.status === 'PENDING' || st.status === 'OVERDUE';
                      const svcKeys = Object.keys(st.services || {});

                      return (
                        <tr key={st.student_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Student Info */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                              {st.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Adm: {st.admission_no || 'N/A'} {st.roll_no ? `• Roll: ${st.roll_no}` : ''}
                            </div>
                          </td>

                          {/* Class */}
                          <td style={{ padding: '14px 18px', fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                            {st.class_name}
                          </td>

                          {/* Service-Wise Pills */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {svcKeys.length === 0 ? (
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>No bill generated</span>
                              ) : (
                                svcKeys.map(k => {
                                  const svc = st.services[k];
                                  const sPaid = svc.status === 'PAID';
                                  return (
                                    <span
                                      key={k}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                                        background: sPaid ? '#ecfdf5' : '#fef2f2',
                                        color: sPaid ? '#059669' : '#dc2626',
                                        border: `1px solid ${sPaid ? '#a7f3d0' : '#fecaca'}`
                                      }}
                                    >
                                      <span>{svc.name || k}:</span>
                                      <strong>₹{fmt(svc.billed)}</strong>
                                      <span>{sPaid ? '✓' : `(due: ₹${fmt(svc.balance)})`}</span>
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>

                          {/* Financials */}
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            ₹{fmt(st.total_due)}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: '#16a34a' }}>
                            ₹{fmt(st.amount_paid)}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: isPaid ? '#94a3b8' : '#dc2626' }}>
                            ₹{fmt(st.balance_due)}
                          </td>

                          {/* Overall Status */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 800,
                              background: isPaid ? '#ecfdf5' : isPart ? '#fef3c7' : '#fef2f2',
                              color: isPaid ? '#059669' : isPart ? '#d97706' : '#dc2626',
                            }}>
                              {isPaid ? '● PAID' : isPart ? '● PARTIAL' : '○ PENDING'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {!isPaid && (
                                <button
                                  onClick={() => {
                                    setActiveStudent(st);
                                    setPayAmount(st.balance_due || '');
                                    setCollectModal(true);
                                  }}
                                  className="btn btn-sm btn-primary"
                                  style={{ borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}
                                >
                                  Collect
                                </button>
                              )}
                              <button
                                onClick={() => navigate(resolveTenantPath(`/finance/students/${st.student_id}/ledger`, user))}
                                className="btn btn-sm btn-neutral"
                                style={{ borderRadius: '6px', fontSize: '11.5px' }}
                                title="View Student Ledger"
                              >
                                Ledger
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ MODAL: QUICK COLLECT PAYMENT ══ */}
          {collectModal && activeStudent && (
            <div className="modal-backdrop" style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px',
                padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      <i className="ti ti-cash" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                        Collect Student Payment
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {activeStudent.name} • {activeStudent.class_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCollectModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>TOTAL DUE:</span>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>₹{fmt(activeStudent.total_due)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>ALREADY PAID:</span>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>₹{fmt(activeStudent.amount_paid)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>OUTSTANDING:</span>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626' }}>₹{fmt(activeStudent.balance_due)}</div>
                  </div>
                </div>

                <form onSubmit={handleQuickCollect}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Payment Amount to Collect (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={activeStudent.balance_due || 999999}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: 900, color: '#0f172a' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                          Payment Mode *
                        </label>
                        <select
                          value={payMode}
                          onChange={(e) => setPayMode(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        >
                          <option value="UPI">UPI / QR Code</option>
                          <option value="CASH">Cash Counter</option>
                          <option value="ONLINE">Bank Transfer / NetBanking</option>
                          <option value="CHEQUE">Cheque / DD</option>
                          <option value="CARD">Debit / Credit Card</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                          Txn Ref / UTR No (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UPI Ref / Cheque No"
                          value={txnRef}
                          onChange={(e) => setTxnRef(e.target.value)}
                          className="form-control"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Remarks / Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Receipt remarks..."
                        value={payRemarks}
                        onChange={(e) => setPayRemarks(e.target.value)}
                        className="form-control"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setCollectModal(false)}
                      className="btn btn-neutral"
                      style={{ borderRadius: '10px', padding: '8px 16px', fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={collecting}
                      className="btn btn-primary"
                      style={{ borderRadius: '10px', padding: '8px 20px', fontWeight: 800 }}
                    >
                      {collecting ? 'Processing Payment...' : 'Record Payment & Generate Receipt'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
