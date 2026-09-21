import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resolveTenantPath } from '../../utils/routeBuilder';

export default function FeeServiceGenerationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const queryParams = new URLSearchParams(location.search);
  const initialMonth = queryParams.get('month') || currentMonthStr;
  const initialSession = queryParams.get('session') || '2026-27';
  const initialCategory = queryParams.get('category') || 'ALL';
  const initialClass = queryParams.get('class_id') || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedSession, setSelectedSession] = useState(initialSession);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // ALL, GENERATED, NOT_GENERATED, PARTIALLY_GENERATED
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [viewMode, setViewMode] = useState('GRID'); // GRID or TABLE

  // Modals
  const [genModal, setGenModal] = useState(false);
  const [activeService, setActiveService] = useState(null);
  const [genMonth, setGenMonth] = useState(initialMonth);
  const [genDueDate, setGenDueDate] = useState(`${initialMonth}-10`);
  const [genClassId, setGenClassId] = useState('');
  const [forceRegen, setForceRegen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Edit Rate Modal
  const [editRateModal, setEditRateModal] = useState(false);
  const [editHead, setEditHead] = useState(null);
  const [newRate, setNewRate] = useState('');
  const [updatingRate, setUpdatingRate] = useState(false);

  // Breakdown Modal (Class-wise, Route-wise, Room-type-wise)
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownService, setBreakdownService] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [generatingUnitKey, setGeneratingUnitKey] = useState(null);

  // Load Classes
  useEffect(() => {
    api.get('/principal/classes')
      .then(res => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch Services Generation Status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedSession) params.append('session', selectedSession);
      if (selectedClass) params.append('class_id', selectedClass);
      if (selectedCategory && selectedCategory !== 'ALL') params.append('category', selectedCategory);

      const res = await api.get(`/fees-finance/services/generation-status?${params.toString()}`);
      setData(res.data || null);
    } catch (err) {
      toast.error('Failed to load service fee generation status');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedSession, selectedClass, selectedCategory]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Open Service Breakdown Modal
  const openBreakdown = async (svc) => {
    setBreakdownService(svc);
    setBreakdownModalOpen(true);
    setBreakdownLoading(true);
    try {
      const res = await api.get(`/fees-finance/services/${svc.code}/breakdown`, {
        params: { month: selectedMonth, session: selectedSession }
      });
      setBreakdownData(res.data);
    } catch (err) {
      if (svc.breakdown) {
        setBreakdownData({ service_code: svc.code, ...svc.breakdown });
      } else {
        toast.error('Failed to load detailed service breakdown');
      }
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Generate Unit Fee (specific class, route, or room type)
  const handleGenerateUnit = async (unit) => {
    const unitKey = unit.class_id || unit.route_id || `${unit.room_type}_${unit.is_ac}` || 'unit';
    try {
      setGeneratingUnitKey(unitKey);
      const payload = {
        bill_month: selectedMonth,
        due_date: `${selectedMonth}-10`,
        session: selectedSession,
        class_id: unit.class_id || null,
        route_id: unit.route_id || null,
        room_type: unit.room_type || null,
        is_ac: unit.is_ac !== undefined ? unit.is_ac : null,
        force_regenerate: false,
      };

      const res = await api.post(`/fees-finance/services/${breakdownService?.code || 'TUITION'}/generate`, payload);
      toast.success(res.data?.message || `Fee generated for ${unit.class_name || unit.route_name || unit.room_category || 'unit'}`);
      
      // Refresh status & breakdown
      fetchStatus();
      if (breakdownService) {
        const updated = await api.get(`/fees-finance/services/${breakdownService.code}/breakdown`, {
          params: { month: selectedMonth, session: selectedSession }
        });
        setBreakdownData(updated.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate fee for unit');
    } finally {
      setGeneratingUnitKey(null);
    }
  };

  // Generate All Pending for Active Breakdown Service
  const handleGenerateAllPendingInBreakdown = async () => {
    if (!breakdownService) return;
    try {
      setGenerating(true);
      const payload = {
        bill_month: selectedMonth,
        due_date: `${selectedMonth}-10`,
        session: selectedSession,
        force_regenerate: false,
      };
      const res = await api.post(`/fees-finance/services/${breakdownService.code}/generate`, payload);
      toast.success(res.data?.message || `All pending bills generated for ${breakdownService.name}`);
      fetchStatus();
      const updated = await api.get(`/fees-finance/services/${breakdownService.code}/breakdown`, {
        params: { month: selectedMonth, session: selectedSession }
      });
      setBreakdownData(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate pending bills');
    } finally {
      setGenerating(false);
    }
  };

  // Handle Quick Fee Generation
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genMonth || !genDueDate) {
      toast.error('Please specify both bill month and due date');
      return;
    }
    try {
      setGenerating(true);
      const code = activeService?.code || 'TUITION';
      const payload = {
        bill_month: genMonth,
        due_date: genDueDate,
        session: selectedSession,
        class_id: genClassId ? parseInt(genClassId) : null,
        force_regenerate: forceRegen,
      };

      const res = await api.post(`/fees-finance/services/${code}/generate`, payload);
      toast.success(res.data?.message || `Fees generated for ${activeService?.name || 'Service'}`);
      setGenModal(false);
      setActiveService(null);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate fees');
    } finally {
      setGenerating(false);
    }
  };

  // Filter services by status locally if needed
  const rawServices = data?.services || [];
  const filteredServices = rawServices.filter(svc => {
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'GENERATED' && svc.status !== 'GENERATED') return false;
      if (selectedStatus === 'NOT_GENERATED' && svc.status !== 'NOT_GENERATED') return false;
      if (selectedStatus === 'PARTIALLY_GENERATED' && svc.status !== 'PARTIALLY_GENERATED') return false;
    }
    return true;
  });

  const getServiceIcon = (category, code) => {
    const c = (category || '').toUpperCase();
    const cd = (code || '').toUpperCase();
    if (cd.includes('TRANSPORT') || c === 'TRANSPORT') return 'ti ti-bus';
    if (cd.includes('HOSTEL') || c === 'HOSTEL') return 'ti ti-building-community';
    if (cd.includes('LIBRARY') || c === 'LIBRARY') return 'ti ti-books';
    if (cd.includes('EXAM') || c === 'EXAM') return 'ti ti-certificate';
    if (cd.includes('ADMISSION')) return 'ti ti-user-plus';
    if (cd.includes('LAB') || cd.includes('COMPUTER')) return 'ti ti-device-laptop';
    return 'ti ti-school';
  };

  const getCategoryColor = (category) => {
    switch ((category || '').toUpperCase()) {
      case 'TRANSPORT': return { bg: '#e0f2fe', color: '#0284c7' };
      case 'HOSTEL':    return { bg: '#f3e8ff', color: '#9333ea' };
      case 'LIBRARY':   return { bg: '#fef3c7', color: '#d97706' };
      case 'EXAM':      return { bg: '#ffedd5', color: '#ea580c' };
      default:          return { bg: '#eff6ff', color: '#2563eb' };
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  const summary = data?.summary || {};

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Service Fee Generation Intelligence" />
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
                  ● Live Backend Engine
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{selectedSession}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                Service-Wise Fee Generation &amp; Demand Status
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Track which school services (Tuition, Transport, Hostel, Library, Exams) have been billed for <strong>{data?.month_label || selectedMonth}</strong> and generate pending dues with 1 click.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setActiveService({ code: 'TUITION', name: 'All Configured Services' });
                  setGenMonth(selectedMonth);
                  setGenDueDate(`${selectedMonth}-10`);
                  setGenModal(true);
                }}
                className="btn btn-primary"
                style={{
                  borderRadius: '10px', padding: '10px 18px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                }}
              >
                <i className="ti ti-bolt" style={{ fontSize: '17px' }} />
                Generate All Monthly Bills
              </button>

              <button
                onClick={() => navigate(resolveTenantPath('/finance/setup', user))}
                className="btn btn-neutral"
                style={{ borderRadius: '10px', padding: '10px 16px', fontWeight: 700 }}
              >
                <i className="ti ti-settings" />
                Fee Structures &amp; Heads
              </button>
            </div>
          </div>

          {/* ══ NON-TECH FRIENDLY EXPLAINER BANNER ══ */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            boxShadow: '0 2px 8px rgba(37,99,235,0.04)'
          }}>
            <div style={{
              background: '#2563eb', color: '#fff', borderRadius: '10px',
              width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '18px'
            }}>
              <i className="ti ti-info-circle" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e3a8a' }}>
                  Fees Generate Kya Hai Aur Kyu Jaruri Hai? (Monthly Student Billing Engine)
                </h4>
                <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                  Non-Tech Guide
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                School me har mahine (jaise <strong>{data?.month_label || selectedMonth}</strong>) students ke naam par Tuition, Transport (Bus), aur Hostel fees ka <strong>Monthly Bill (Demand)</strong> create kiya jata hai.
                Jab tak yahan se <strong>"Generate"</strong> nahi hota, tab tak student par koi due amount count nahi hota aur na hi parent portal par pending bill dikhta hai.
                <br />
                <span style={{ display: 'inline-block', marginTop: '4px', fontWeight: 600, color: '#0369a1' }}>
                  👉 <strong>Kaise use karein?</strong> Pure school ke sabhi students ka bill 1-click me banane ke liye upar <strong>"Generate All Monthly Bills"</strong> dabayein, ya neeche kisi specific Service/Class ke aage <strong>"Generate"</strong> par click karein.
                </span>
              </p>
            </div>
          </div>

          {/* ══ 2. TOP METRICS SUMMARY STRIP (Clean & Non-Tech Friendly) ══ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px', marginBottom: '24px'
          }}>
            {/* Metric 1: Total Demand Billed */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #dbeafe', boxShadow: '0 2px 10px rgba(37, 99, 235, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  TOTAL DEMAND BILLED
                </span>
                <span style={{
                  background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px',
                  padding: '3px 8px', fontSize: '11px', fontWeight: 800
                }}>
                  {data?.month_label || 'Month'}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a' }}>
                ₹{fmt(summary.total_billed)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Total amount billed to students
              </div>
            </div>

            {/* Metric 2: Collected Revenue */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #dcfce7', boxShadow: '0 2px 10px rgba(22, 163, 74, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  COLLECTED REVENUE
                </span>
                <span style={{
                  background: '#ecfdf5', color: '#15803d', borderRadius: '8px',
                  padding: '3px 8px', fontSize: '11px', fontWeight: 800
                }}>
                  {summary.collection_percentage || 0}% Realized
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#15803d' }}>
                ₹{fmt(summary.total_collected)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Realized at counter &amp; online
              </div>
            </div>

            {/* Metric 3: Outstanding / Pending Balance */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: (summary.total_pending || 0) > 0 ? '1px solid #fee2e2' : '1px solid #e2e8f0',
              boxShadow: '0 2px 10px rgba(220, 38, 38, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: (summary.total_pending || 0) > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PENDING BALANCE
                </span>
                <span style={{
                  background: (summary.total_pending || 0) > 0 ? '#fef2f2' : '#f8fafc',
                  color: (summary.total_pending || 0) > 0 ? '#b91c1c' : '#64748b',
                  borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 800
                }}>
                  {(summary.total_pending || 0) > 0 ? 'Awaiting Payment' : 'All Clear ✅'}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: (summary.total_pending || 0) > 0 ? '#b91c1c' : '#0f172a' }}>
                ₹{fmt(summary.total_pending)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Due across remaining students
              </div>
            </div>

            {/* Metric 4: Services Status */}
            <div style={{
              background: '#ffffff', borderRadius: '16px', padding: '18px 20px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  FEE SERVICES ACTIVE
                </span>
                <span style={{
                  background: '#f1f5f9', color: '#475569',
                  borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 800
                }}>
                  {summary.generated_services_count || 0} of {summary.total_services || 0}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>
                {summary.generated_services_count || 0} <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 600 }}>Active Heads</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {summary.not_generated_count || 0} optional / unbilled services
              </div>
            </div>
          </div>

          {/* ══ 3. INTERACTIVE FILTERS BAR ══ */}
          <div style={{
            background: '#ffffff', borderRadius: '16px', padding: '16px 20px',
            border: '1px solid #e2e8f0', marginBottom: '22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Month Picker */}
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
                  { key: 'ALL', label: 'All Services' },
                  { key: 'GENERATED', label: '✅ Generated' },
                  { key: 'NOT_GENERATED', label: '⚠️ Not Generated' },
                  { key: 'PARTIALLY_GENERATED', label: '🔄 Partial' },
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

              {/* Category Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    fontSize: '13px', fontWeight: 700, color: '#0f172a'
                  }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="ACADEMIC">Academic / Tuition</option>
                  <option value="TRANSPORT">Transport Service</option>
                  <option value="HOSTEL">Hostel &amp; Mess</option>
                  <option value="LIBRARY">Library</option>
                  <option value="EXAM">Exams</option>
                  <option value="OTHER">Other / Activities</option>
                </select>
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
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setViewMode('GRID')}
                style={{
                  padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: viewMode === 'GRID' ? '#e2e8f0' : '#ffffff', cursor: 'pointer'
                }}
                title="Grid View"
              >
                <i className="ti ti-layout-grid" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                style={{
                  padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: viewMode === 'TABLE' ? '#e2e8f0' : '#ffffff', cursor: 'pointer'
                }}
                title="Table View"
              >
                <i className="ti ti-list" />
              </button>
            </div>
          </div>

          {/* ══ 4. SERVICES CONTENT DISPLAY ══ */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px' }}>
              <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto 14px' }}></div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Loading service fee generation status...
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Aggregating live data from school accounts, transport, hostel &amp; library ledgers
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px', background: '#ffffff',
              borderRadius: '16px', border: '1px dashed #cbd5e1'
            }}>
              <i className="ti ti-file-search" style={{ fontSize: '42px', color: '#94a3b8' }} />
              <h3 style={{ margin: '12px 0 4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                No services found matching current filters
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Try resetting your status or category filters above.
              </p>
            </div>
          ) : viewMode === 'GRID' ? (
            /* ── GRID VIEW ── */
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '18px'
            }}>
              {filteredServices.map(svc => {
                const catStyle = getCategoryColor(svc.category);
                const isGen = svc.status === 'GENERATED';
                const isPart = svc.status === 'PARTIALLY_GENERATED';
                const isNotGen = svc.status === 'NOT_GENERATED';

                // Robust percentage calculation (no division by zero)
                const hasZeroEligible = (svc.eligible_students_count || 0) === 0;
                const hasStudentsBilled = (svc.generated_students_count || 0) > 0;
                const pct = hasZeroEligible
                  ? (hasStudentsBilled ? 100 : 0)
                  : Math.min(100, Math.max(0, Math.round(((svc.generated_students_count || 0) / svc.eligible_students_count) * 100)));

                const bsum = svc.breakdown?.summary;

                return (
                  <div
                    key={svc.head_id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      border: `1px solid ${isNotGen ? '#e2e8f0' : isPart ? '#fef08a' : '#dbeafe'}`,
                      padding: '20px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    {/* Header */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: catStyle.bg, color: catStyle.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                          }}>
                            <i className={getServiceIcon(svc.category, svc.code)} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                              {svc.name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: catStyle.color, background: catStyle.bg, padding: '1px 6px', borderRadius: '4px' }}>
                                {svc.category}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Code: {svc.code}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span style={{
                          padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 800,
                          background: isGen ? '#ecfdf5' : isPart ? '#fef3c7' : '#f8fafc',
                          color: isGen ? '#15803d' : isPart ? '#b45309' : '#64748b',
                          border: `1px solid ${isGen ? '#bbf7d0' : isPart ? '#fde68a' : '#e2e8f0'}`
                        }}>
                          {isGen ? '● FULLY BILLED' : isPart ? '● PARTIAL' : '○ NOT BILLED'}
                        </span>
                      </div>

                      {/* Coverage Progress (Non-Tech Friendly & Zero Division Safe) */}
                      <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                          <span style={{ color: '#475569', fontWeight: 700 }}>Students Covered:</span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {hasZeroEligible && !hasStudentsBilled ? (
                              <span style={{ color: '#94a3b8' }}>0 Enrolled (Optional)</span>
                            ) : hasZeroEligible && hasStudentsBilled ? (
                              <span>{svc.generated_students_count} Active (100%)</span>
                            ) : (
                              <span>{svc.generated_students_count} / {svc.eligible_students_count} ({pct}%)</span>
                            )}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '100px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`,
                            background: isGen ? '#10b981' : isPart ? '#f59e0b' : hasStudentsBilled ? '#10b981' : '#cbd5e1',
                            height: '100%', borderRadius: '100px', transition: 'width 0.3s ease'
                          }} />
                        </div>
                        {svc.missing_students_count > 0 && (
                          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700, marginTop: '6px' }}>
                            ⚠️ {svc.missing_students_count} student bills awaiting generation
                          </div>
                        )}
                      </div>

                      {/* Breakdown Status Badge (Class-wise / Route-wise / Room-type-wise) */}
                      {bsum && (
                        <div
                          onClick={() => openBreakdown(svc)}
                          style={{
                            marginBottom: '14px', padding: '9px 12px', borderRadius: '10px',
                            background: (bsum.pending_units || 0) > 0 ? '#fffbeb' : '#f0fdf4',
                            border: `1px solid ${(bsum.pending_units || 0) > 0 ? '#fef08a' : '#bbf7d0'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px',
                            cursor: 'pointer', transition: 'transform 0.1s ease'
                          }}
                          title="Click to view detailed breakdown"
                        >
                          <span style={{ fontWeight: 800, color: (bsum.pending_units || 0) > 0 ? '#b45309' : '#15803d', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <i className="ti ti-list-details" />
                            {svc.breakdown.breakdown_type === 'CLASS_WISE' && 'Class Coverage:'}
                            {svc.breakdown.breakdown_type === 'ROUTE_WISE' && 'Route Coverage:'}
                            {svc.breakdown.breakdown_type === 'HOSTEL_ROOM_TYPE_WISE' && 'Room Type Coverage:'}
                            {svc.breakdown.breakdown_type === 'GENERIC' && 'Unit Coverage:'}
                          </span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {bsum.total_units === 0 ? (
                              <span style={{ color: '#64748b' }}>No active units</span>
                            ) : bsum.generated_units >= bsum.total_units ? (
                              <span style={{ color: '#15803d' }}>{bsum.total_units} of {bsum.total_units} Active ✅</span>
                            ) : (
                              <span style={{ color: '#b45309' }}>
                                {bsum.generated_units} / {bsum.total_units} Active
                                <span style={{ color: '#b91c1c', marginLeft: '4px' }}>({bsum.pending_units} pending)</span>
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Financial Amounts Breakdown */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px', marginBottom: '16px', textAlign: 'center'
                      }}>
                        <div style={{ background: '#f8fafc', padding: '9px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b' }}>BILLED</div>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                            ₹{fmt(svc.total_billed)}
                          </div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '9px 8px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#15803d' }}>COLLECTED</div>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                            ₹{fmt(svc.total_collected)}
                          </div>
                        </div>
                        <div style={{ background: (svc.total_pending || 0) > 0 ? '#fef2f2' : '#f8fafc', padding: '9px 8px', borderRadius: '10px', border: `1px solid ${(svc.total_pending || 0) > 0 ? '#fecaca' : '#e2e8f0'}` }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: (svc.total_pending || 0) > 0 ? '#b91c1c' : '#64748b' }}>PENDING</div>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: (svc.total_pending || 0) > 0 ? '#b91c1c' : '#64748b', marginTop: '2px' }}>
                            ₹{fmt(svc.total_pending)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{
                      display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9',
                      flexWrap: 'wrap'
                    }}>
                      {/* Breakdown Drill-Down Action */}
                      <button
                        onClick={() => openBreakdown(svc)}
                        className="btn btn-sm btn-outline-primary"
                        style={{
                          borderRadius: '8px', fontSize: '12px', fontWeight: 800,
                          padding: '7px 11px', display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                        title="View Class-wise, Route-wise, or Room-type breakdown"
                      >
                        <i className="ti ti-layout-list" /> Breakdown
                      </button>

                      {/* Generate Action */}
                      <button
                        onClick={() => {
                          setActiveService(svc);
                          setGenMonth(selectedMonth);
                          setGenDueDate(`${selectedMonth}-10`);
                          setGenModal(true);
                        }}
                        className={isNotGen ? "btn btn-sm btn-primary" : "btn btn-sm btn-outline-primary"}
                        style={{
                          flex: 1, borderRadius: '8px', fontSize: '12px', fontWeight: 800,
                          padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        <i className="ti ti-plus" />
                        {isNotGen ? 'Generate' : isPart ? 'Complete' : 'Re-Gen'}
                      </button>

                      {/* View Bills Action */}
                      <button
                        onClick={() => navigate(resolveTenantPath(`/finance/bills?month=${selectedMonth}&department=${svc.department}`, user))}
                        className="btn btn-sm btn-neutral"
                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, padding: '7px 11px' }}
                        title="View Generated Bills"
                      >
                        <i className="ti ti-file-invoice" /> Bills
                      </button>

                      {/* Edit Rate Action */}
                      <button
                        onClick={() => {
                          setEditHead(svc);
                          setNewRate(svc.total_billed ? Math.round(svc.total_billed / (svc.generated_students_count || 1)) : 2000);
                          setEditRateModal(true);
                        }}
                        className="btn btn-sm btn-neutral"
                        style={{ borderRadius: '8px', fontSize: '12px', fontWeight: 700, padding: '7px 10px' }}
                        title="Edit Service Rate Card"
                      >
                        <i className="ti ti-edit" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div style={{
              background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
              overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>SERVICE NAME</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>CATEGORY</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>STATUS</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>UNITS / BREAKDOWN</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>STUDENTS BILLED</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>TOTAL BILLED</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>COLLECTED</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569' }}>PENDING</th>
                      <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map(svc => {
                      const isGen = svc.status === 'GENERATED';
                      const isPart = svc.status === 'PARTIALLY_GENERATED';
                      return (
                        <tr key={svc.head_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <i className={getServiceIcon(svc.category, svc.code)} style={{ fontSize: '18px', color: '#2563eb' }} />
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>{svc.name}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{svc.code} • {svc.frequency}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                              {svc.category}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 800,
                              background: isGen ? '#ecfdf5' : isPart ? '#fef3c7' : '#fef2f2',
                              color: isGen ? '#059669' : isPart ? '#d97706' : '#dc2626',
                            }}>
                              {isGen ? 'GENERATED' : isPart ? 'PARTIAL' : 'NOT GENERATED'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            {svc.breakdown?.summary ? (
                              <button
                                onClick={() => openBreakdown(svc)}
                                className="btn btn-sm btn-outline-primary"
                                style={{ borderRadius: '6px', fontSize: '11px', fontWeight: 800, padding: '3px 8px' }}
                              >
                                {svc.breakdown.summary.generated_units}/{svc.breakdown.summary.total_units} Done
                                {svc.breakdown.summary.pending_units > 0 && ` (${svc.breakdown.summary.pending_units} pending)`}
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: 800 }}>
                            {svc.generated_students_count} / {svc.eligible_students_count}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            ₹{fmt(svc.total_billed)}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: '#16a34a' }}>
                            ₹{fmt(svc.total_collected)}
                          </td>
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', fontWeight: 800, color: '#dc2626' }}>
                            ₹{fmt(svc.total_pending)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => openBreakdown(svc)}
                                className="btn btn-sm btn-outline-primary"
                                style={{ borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}
                                title="View granular breakdown"
                              >
                                Breakdown
                              </button>
                              <button
                                onClick={() => {
                                  setActiveService(svc);
                                  setGenMonth(selectedMonth);
                                  setGenDueDate(`${selectedMonth}-10`);
                                  setGenModal(true);
                                }}
                                className="btn btn-sm btn-primary"
                                style={{ borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}
                              >
                                {isGen ? 'Re-Gen' : 'Generate'}
                              </button>
                              <button
                                onClick={() => navigate(resolveTenantPath(`/finance/bills?month=${selectedMonth}&department=${svc.department}`, user))}
                                className="btn btn-sm btn-neutral"
                                style={{ borderRadius: '6px', fontSize: '11.5px' }}
                              >
                                Bills
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

          {/* ══ MODAL: DETAILED SERVICE BREAKDOWN (CLASS-WISE, ROUTE-WISE, ROOM-WISE) ══ */}
          {breakdownModalOpen && (
            <div className="modal-backdrop" style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '960px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px',
                      background: '#eff6ff', color: '#2563eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                    }}>
                      <i className={getServiceIcon(breakdownService?.category, breakdownService?.code)} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                        {breakdownService?.name} – Detailed Breakdown
                      </h2>
                      <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                        {breakdownData?.breakdown_type === 'CLASS_WISE' && '📚 Class-Wise Tuition Fee Demand & Coverage'}
                        {breakdownData?.breakdown_type === 'ROUTE_WISE' && '🚌 Route-Wise Transport Fee Demand & Allocation'}
                        {breakdownData?.breakdown_type === 'HOSTEL_ROOM_TYPE_WISE' && '🏢 Room Category & AC/Non-AC Fee Status'}
                        {!['CLASS_WISE', 'ROUTE_WISE', 'HOSTEL_ROOM_TYPE_WISE'].includes(breakdownData?.breakdown_type) && '⚡ Unit-Wise Fee Generation & Collection Status'}
                        {' '}• Month: <strong>{data?.month_label || selectedMonth}</strong> • Session <strong>{selectedSession}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setBreakdownModalOpen(false);
                      setBreakdownService(null);
                      setBreakdownData(null);
                    }}
                    style={{
                      background: '#f1f5f9', border: 'none', borderRadius: '8px',
                      width: '32px', height: '32px', cursor: 'pointer', color: '#64748b',
                      fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                  {breakdownLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                      <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }}></div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        Loading real-time fee breakdown from database...
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Summary Banner */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px', marginBottom: '20px'
                      }}>
                        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                            {breakdownData?.breakdown_type === 'CLASS_WISE' ? 'Total Classes' : breakdownData?.breakdown_type === 'ROUTE_WISE' ? 'Total Routes' : 'Total Categories'}
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                            {breakdownData?.summary?.total_units || 0}
                          </div>
                        </div>

                        <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>
                            Fully Generated
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
                            {breakdownData?.summary?.generated_units || 0}
                          </div>
                        </div>

                        <div style={{ background: '#fef2f2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                            Pending / Incomplete
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                            {breakdownData?.summary?.pending_units || 0}
                          </div>
                        </div>

                        <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <button
                            disabled={generating || (breakdownData?.summary?.pending_units || 0) === 0}
                            onClick={handleGenerateAllPendingInBreakdown}
                            className="btn btn-primary"
                            style={{
                              width: '100%', borderRadius: '10px', fontSize: '12.5px', fontWeight: 800,
                              padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                          >
                            <i className="ti ti-bolt" />
                            {generating ? 'Generating...' : `Generate All Pending (${breakdownData?.summary?.pending_units || 0})`}
                          </button>
                        </div>
                      </div>

                      {/* Granular Table */}
                      <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <table className="table" style={{ width: '100%', margin: 0 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>
                                {breakdownData?.breakdown_type === 'CLASS_WISE' && 'CLASS & SECTION'}
                                {breakdownData?.breakdown_type === 'ROUTE_WISE' && 'ROUTE / VEHICLE'}
                                {breakdownData?.breakdown_type === 'HOSTEL_ROOM_TYPE_WISE' && 'ROOM TYPE & AC STATUS'}
                                {!['CLASS_WISE', 'ROUTE_WISE', 'HOSTEL_ROOM_TYPE_WISE'].includes(breakdownData?.breakdown_type) && 'UNIT'}
                              </th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>RATE (₹)</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>ELIGIBLE</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>BILLED</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>PENDING</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>TOTAL BILLED</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569' }}>STATUS</th>
                              <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(breakdownData?.breakdown || []).map((row, idx) => {
                              const isRowGen = row.generation_status === 'GENERATED';
                              const isRowPart = row.generation_status === 'PARTIALLY_GENERATED';
                              const isRowNotGen = row.generation_status === 'NOT_GENERATED';
                              const rowKey = row.class_id || row.route_id || `${row.room_type}_${row.is_ac}` || idx;
                              const isRowBusy = generatingUnitKey === rowKey;

                              return (
                                <tr key={rowKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                                      {row.class_name || row.route_name || row.room_category || row.name || 'Standard'}
                                    </div>
                                    {row.vehicle_number && (
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        Vehicle: {row.vehicle_number}
                                      </div>
                                    )}
                                    {row.route_code && (
                                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                        Code: {row.route_code}
                                      </div>
                                    )}
                                  </td>

                                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                    ₹{fmt(row.rate ?? row.monthly_fee ?? row.monthly_tuition_rate ?? 0)}
                                  </td>

                                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700 }}>
                                    {row.active_students ?? row.allocated_students ?? row.boarders_count ?? row.eligible_students ?? 0}
                                  </td>

                                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 800, color: '#16a34a' }}>
                                    {row.generated_students ?? row.billed_students ?? 0}
                                  </td>

                                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 800, color: (row.pending_students || 0) > 0 ? '#dc2626' : '#64748b' }}>
                                    {row.pending_students ?? 0}
                                  </td>

                                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                                    ₹{fmt(row.total_billed)}
                                  </td>

                                  <td style={{ padding: '12px 16px' }}>
                                    <span style={{
                                      padding: '3px 8px', borderRadius: '100px', fontSize: '10.5px', fontWeight: 800,
                                      background: isRowGen ? '#ecfdf5' : isRowPart ? '#fef3c7' : '#fef2f2',
                                      color: isRowGen ? '#059669' : isRowPart ? '#d97706' : '#dc2626',
                                    }}>
                                      {isRowGen ? 'GENERATED' : isRowPart ? 'PARTIAL' : 'NOT GENERATED'}
                                    </span>
                                  </td>

                                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    {(row.pending_students || 0) > 0 || isRowNotGen ? (
                                      <button
                                        disabled={isRowBusy || generating}
                                        onClick={() => handleGenerateUnit(row)}
                                        className="btn btn-sm btn-primary"
                                        style={{ borderRadius: '7px', fontSize: '11.5px', fontWeight: 800, padding: '5px 12px' }}
                                      >
                                        {isRowBusy ? 'Generating...' : '+ Generate Fee'}
                                      </button>
                                    ) : (
                                      <span style={{
                                        fontSize: '11.5px', fontWeight: 800, color: '#059669',
                                        background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px'
                                      }}>
                                        ✓ Complete
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    💡 Real-time synchronization active. Generating fees creates pending demand in student ledgers safely.
                  </div>
                  <button
                    onClick={() => {
                      setBreakdownModalOpen(false);
                      setBreakdownService(null);
                      setBreakdownData(null);
                    }}
                    className="btn btn-neutral"
                    style={{ borderRadius: '8px', padding: '8px 18px', fontWeight: 700 }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ MODAL: GENERATE FEES ══ */}
          {genModal && (
            <div className="modal-backdrop" style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '520px',
                padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      <i className="ti ti-bolt" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                        Generate Service Fees
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {activeService?.name || 'All Services'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGenModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleGenerate}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Target Bill Month (YYYY-MM) *
                      </label>
                      <input
                        type="month"
                        value={genMonth}
                        onChange={(e) => {
                          setGenMonth(e.target.value);
                          setGenDueDate(`${e.target.value}-10`);
                        }}
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Fee Payment Due Date *
                      </label>
                      <input
                        type="date"
                        value={genDueDate}
                        onChange={(e) => setGenDueDate(e.target.value)}
                        required
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Scope / Target Class (Optional)
                      </label>
                      <select
                        value={genClassId}
                        onChange={(e) => setGenClassId(e.target.value)}
                        className="form-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                      >
                        <option value="">All Classes &amp; Active Students</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section ? `(${c.section})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={forceRegen}
                          onChange={(e) => setForceRegen(e.target.checked)}
                        />
                        Force re-calculate / regenerate existing bills
                      </label>
                      <p style={{ margin: '4px 0 0 24px', fontSize: '11.5px', color: '#64748b' }}>
                        Updates amounts for students who already have a draft or issued bill for this month.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setGenModal(false)}
                      className="btn btn-neutral"
                      style={{ borderRadius: '10px', padding: '8px 16px', fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={generating}
                      className="btn btn-primary"
                      style={{ borderRadius: '10px', padding: '8px 20px', fontWeight: 800 }}
                    >
                      {generating ? 'Generating Bills...' : 'Start Fee Generation'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══ MODAL: EDIT SERVICE RATE CARD ══ */}
          {editRateModal && (
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
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      <i className="ti ti-edit" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                        Edit Service Rate / Structure
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {editHead?.name} ({editHead?.code})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditRateModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '12px', marginBottom: '16px', fontSize: '12.5px', color: '#475569' }}>
                  <p style={{ margin: '0 0 6px' }}>
                    Service head belongs to <strong>{editHead?.department}</strong> department and applies with <strong>{editHead?.frequency}</strong> cadence.
                  </p>
                  <p style={{ margin: 0 }}>
                    To configure class-by-class tiered rates, slabs, or payment plans, you can open the master Fee Structure Setup.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditRateModal(false)}
                    className="btn btn-neutral"
                    style={{ borderRadius: '10px', padding: '8px 16px', fontWeight: 700 }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditRateModal(false);
                      navigate(resolveTenantPath('/finance/setup', user));
                    }}
                    className="btn btn-primary"
                    style={{ borderRadius: '10px', padding: '8px 18px', fontWeight: 800 }}
                  >
                    Go to Full Rate Card Setup <i className="ti ti-arrow-right" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
