import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FeeSetupPage() {
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState('2026-27');
  const [activeTab, setActiveTab] = useState('structures'); // structures | plans | heads | concessions | services
  const [heads, setHeads] = useState([]);
  const [structures, setStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [concessions, setConcessions] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fee Head Modal
  const [headModal, setHeadModal] = useState(false);
  const [editingHead, setEditingHead] = useState(null);
  const [headForm, setHeadForm] = useState({
    name: '', code: '', category: 'ACADEMIC', department: 'ACCOUNTS',
    income_account: 'General School Income', is_recurring: true,
    default_frequency: 'MONTHLY', is_refundable: false, description: ''
  });

  // Structure Modal
  const [structModal, setStructModal] = useState(false);
  const [editingStruct, setEditingStruct] = useState(null);
  const [safeguardModal, setSafeguardModal] = useState(null);
  const [structForm, setStructForm] = useState({
    name: '', class_id: '', frequency: 'MONTHLY', due_date_day: 10,
    publish_status: 'PUBLISHED', items: []
  });

  // Clone Structure Modal
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneSourceStruct, setCloneSourceStruct] = useState(null);
  const [cloneTargetClassIds, setCloneTargetClassIds] = useState([]);
  const [clonePublishNow, setClonePublishNow] = useState(true);
  const [cloning, setCloning] = useState(false);

  // Copy Session Modal
  const [copySessionModal, setCopySessionModal] = useState(false);
  const [copyFromSession, setCopyFromSession] = useState('2025-26');
  const [copyToSession, setCopyToSession] = useState('2026-27');
  const [copyAsDraft, setCopyAsDraft] = useState(true);
  const [copyingSession, setCopyingSession] = useState(false);

  // Payment Plan Modal
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '', code: '', months_count: 1, discount_type: 'PERCENTAGE',
    discount_value: 0.0, eligible_categories: ['ACADEMIC'],
    description: '', is_active: true
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Concession / Scholarship Modal
  const [concModal, setConcModal] = useState(false);
  const [concStudents, setConcStudents] = useState([]);
  const [concClassId, setConcClassId] = useState('');
  const [concForm, setConcForm] = useState({
    student_id: '',
    fee_head_id: '',
    concession_type: 'SCHOLARSHIP',
    discount_type: 'FIXED',
    discount_value: '',
    reason: '',
    session: '2026-27'
  });
  const [savingConc, setSavingConc] = useState(false);

  // Optional Services Subtabs & Modals
  const [optSubTab, setOptSubTab] = useState('transport'); // 'transport' | 'hostel' | 'library'
  const [transModal, setTransModal] = useState(false);
  const [transForm, setTransForm] = useState({
    name: '',
    route_id: '',
    amount: '',
    frequency: 'MONTHLY',
    academic_year: '2026-27'
  });
  const [savingTrans, setSavingTrans] = useState(false);

  const [hostelModal, setHostelModal] = useState(false);
  const [hostelForm, setHostelForm] = useState({
    hostel_id: '',
    sharing_type: 'DOUBLE',
    is_ac: false,
    monthly_fee: '',
    mess_charges: '',
    electricity_charges: ''
  });
  const [savingHostel, setSavingHostel] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [headsRes, structRes, classRes, concRes, plansRes, readRes] = await Promise.all([
        api.get('/fees-finance/heads').catch(() => ({ data: [] })),
        api.get(`/fees-finance/structures?session=${selectedSession}`).catch(() => ({ data: [] })),
        api.get('/principal/classes').catch(() => ({ data: [] })),
        api.get('/fees-finance/concessions').catch(() => ({ data: [] })),
        api.get(`/fees-finance/payment-plans?session=${selectedSession}`).catch(() => ({ data: [] })),
        api.get(`/fees-finance/readiness?session=${selectedSession}`).catch(() => ({ data: null })),
      ]);
      setHeads(headsRes.data || []);
      setStructures(structRes.data || []);
      setClasses(classRes.data || []);
      setConcessions(concRes.data || []);
      setPaymentPlans(plansRes.data || []);
      setReadiness(readRes.data || null);
    } catch {
      toast.error('Failed to load fee configuration');
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch students for concession modal when class changes
  useEffect(() => {
    if (concModal) {
      const params = concClassId ? `?class_id=${concClassId}` : '';
      api.get(`/fees-finance/students/search${params}`)
        .then((res) => setConcStudents(res.data?.students || []))
        .catch(() => setConcStudents([]));
    }
  }, [concClassId, concModal]);

  const fmt = (v) => `₹ ${(Number(v) || 0).toLocaleString('en-IN')}`;

  // ─── Fee Heads Handlers ──────────────────────────────────────────────────
  const openAddHead = () => {
    setEditingHead(null);
    setHeadForm({
      name: '', code: '', category: 'ACADEMIC', department: 'ACCOUNTS',
      income_account: 'General School Income', is_recurring: true,
      default_frequency: 'MONTHLY', is_refundable: false, description: ''
    });
    setHeadModal(true);
  };

  const handleHeadSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHead) {
        await api.patch(`/fees-finance/heads/${editingHead.id}`, headForm);
        toast.success('Fee Head updated');
      } else {
        await api.post('/fees-finance/heads', headForm);
        toast.success('Fee Head created');
      }
      setHeadModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee head');
    }
  };

  const handleDeleteHead = async (head) => {
    if (!window.confirm(`Are you sure you want to delete Fee Head "${head.name}"?`)) return;
    try {
      await api.delete(`/fees-finance/heads/${head.id}`);
      toast.success(`Fee Head "${head.name}" removed`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete fee head');
    }
  };

  // ─── Fee Structure Handlers ──────────────────────────────────────────────
  const openAddStructure = (prefillClassId = null) => {
    setEditingStruct(null);
    const initialItems = heads.map((h) => ({
      fee_head_id: h.id,
      fee_head_name: h.name,
      amount: h.code === 'TUITION' ? 3000 : 0,
    }));
    setStructForm({
      name: '', class_id: prefillClassId || '', frequency: 'MONTHLY', due_date_day: 10,
      publish_status: 'PUBLISHED', items: initialItems,
    });
    setStructModal(true);
  };

  const openEditStructure = (struct) => {
    setEditingStruct(struct);
    const itemMap = {};
    (struct.items || []).forEach((it) => {
      itemMap[it.fee_head_id] = it.amount;
    });

    const structItems = heads.map((h) => ({
      fee_head_id: h.id,
      fee_head_name: h.name,
      amount: itemMap[h.id] !== undefined ? itemMap[h.id] : 0,
    }));

    setStructForm({
      name: struct.name,
      class_id: struct.class_id || '',
      frequency: struct.frequency || 'MONTHLY',
      due_date_day: struct.due_date_day || 10,
      publish_status: struct.publish_status || 'PUBLISHED',
      items: structItems,
    });
    setStructModal(true);
  };

  const handleTogglePublish = async (struct) => {
    const nextStatus = struct.publish_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await api.patch(`/fees-finance/structures/${struct.id}/publish`, {
        publish_status: nextStatus,
      });
      toast.success(`Rate Card is now ${nextStatus}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle publish status');
    }
  };

  const openCloneModal = (struct) => {
    setCloneSourceStruct(struct);
    // Exclude source class from default selection
    const availableClasses = classes.filter((c) => c.id !== struct.class_id);
    setCloneTargetClassIds(availableClasses.map((c) => c.id));
    setClonePublishNow(true);
    setCloneModal(true);
  };

  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!cloneTargetClassIds.length) {
      toast.error('Please select at least one class to clone to.');
      return;
    }
    try {
      setCloning(true);
      await api.post(`/fees-finance/structures/${cloneSourceStruct.id}/clone-to-classes`, {
        target_class_ids: cloneTargetClassIds,
        session: selectedSession,
        publish_now: clonePublishNow,
      });
      toast.success(`Cloned fee structure to ${cloneTargetClassIds.length} classes!`);
      setCloneModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clone structure');
    } finally {
      setCloning(false);
    }
  };

  const handleCopySessionSubmit = async (e) => {
    e.preventDefault();
    if (copyFromSession === copyToSession) {
      toast.error('Target session must be different from source session.');
      return;
    }
    try {
      setCopyingSession(true);
      const res = await api.post('/fees-finance/structures/copy-session', {
        from_session: copyFromSession,
        to_session: copyToSession,
        as_draft: copyAsDraft,
      });
      toast.success(res.data?.message || 'Session fee structures copied!');
      setCopySessionModal(false);
      setSelectedSession(copyToSession);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to copy session structures');
    } finally {
      setCopyingSession(false);
    }
  };

  const handleStructureSubmit = async (e) => {
    e.preventDefault();
    if (!structForm.name) {
      toast.error('Structure name is required');
      return;
    }
    try {
      const payload = {
        name: structForm.name,
        session: selectedSession,
        class_id: structForm.class_id ? parseInt(structForm.class_id) : null,
        frequency: structForm.frequency,
        due_date_day: parseInt(structForm.due_date_day),
        publish_status: structForm.publish_status,
        items: structForm.items.filter((it) => it.amount > 0),
      };
      if (editingStruct) {
        await api.put(`/fees-finance/structures/${editingStruct.id}`, payload);
        toast.success('Fee Structure updated');
      } else {
        await api.post('/fees-finance/structures', payload);
        toast.success('Fee Structure created');
      }
      setStructModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save fee structure');
    }
  };

  const handleDeleteStructure = async (struct) => {
    if (struct.is_used) {
      setSafeguardModal(struct);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Rate Card "${struct.name}"?`)) return;
    try {
      await api.delete(`/fees-finance/structures/${struct.id}`);
      toast.success(`Rate card "${struct.name}" deleted`);
      fetchData();
    } catch (err) {
      if (err.response?.status === 409) {
        setSafeguardModal(struct);
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete rate card');
      }
    }
  };

  const handleArchiveStructure = async (struct) => {
    try {
      await api.patch(`/fees-finance/structures/${struct.id}/archive`);
      toast.success(`Rate card "${struct.name}" archived successfully`);
      setSafeguardModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to archive rate card');
    }
  };

  // ─── Payment Plans Handlers ──────────────────────────────────────────────
  const openAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '', code: '', months_count: 1, discount_type: 'PERCENTAGE',
      discount_value: 0.0, eligible_categories: ['ACADEMIC'],
      description: '', is_active: true
    });
    setPlanModal(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      code: plan.code,
      months_count: plan.months_count,
      discount_type: plan.discount_type,
      discount_value: plan.discount_value,
      eligible_categories: plan.eligible_categories || ['ACADEMIC'],
      description: plan.description || '',
      is_active: plan.is_active
    });
    setPlanModal(true);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingPlan(true);
      const payload = {
        ...planForm,
        session: selectedSession,
      };
      if (editingPlan) {
        await api.patch(`/fees-finance/payment-plans/${editingPlan.id}`, payload);
        toast.success('Payment plan updated');
      } else {
        await api.post('/fees-finance/payment-plans', payload);
        toast.success('Payment plan created');
      }
      setPlanModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save payment plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // ─── Concessions Handlers ────────────────────────────────────────────────
  const openAddConcession = () => {
    setConcForm({
      student_id: '',
      fee_head_id: heads[0]?.id || '',
      concession_type: 'SCHOLARSHIP',
      discount_type: 'FIXED',
      discount_value: '',
      reason: '',
      session: selectedSession,
    });
    setConcModal(true);
  };

  const handleConcessionSubmit = async (e) => {
    e.preventDefault();
    if (!concForm.student_id) {
      toast.error('Please select a student');
      return;
    }
    if (!concForm.discount_value || Number(concForm.discount_value) <= 0) {
      toast.error('Please enter a valid discount value');
      return;
    }
    try {
      setSavingConc(true);
      await api.post('/fees-finance/concessions', {
        student_id: parseInt(concForm.student_id),
        fee_head_id: concForm.fee_head_id ? parseInt(concForm.fee_head_id) : null,
        concession_type: concForm.concession_type,
        discount_type: concForm.discount_type,
        discount_value: parseFloat(concForm.discount_value),
        reason: concForm.reason,
        session: selectedSession,
      });
      toast.success('Concession rule added successfully');
      setConcModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create concession');
    } finally {
      setSavingConc(false);
    }
  };

  const handleDeleteConcession = async (conc) => {
    if (!window.confirm(`Are you sure you want to remove concession for student "${conc.student_name}"?`)) return;
    try {
      await api.delete(`/fees-finance/concessions/${conc.id}`);
      toast.success('Concession rule deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete concession');
    }
  };

  // ─── Optional Services Handlers ──────────────────────────────────────────
  const handleCreateTransportSlab = async (e) => {
    e.preventDefault();
    if (!transForm.name || !transForm.amount) {
      toast.error('Please enter a slab name and fee amount');
      return;
    }
    try {
      setSavingTrans(true);
      await api.post('/fees-finance/optional-services/transport-fee', {
        name: transForm.name,
        route_id: transForm.route_id ? parseInt(transForm.route_id) : null,
        amount: parseFloat(transForm.amount),
        frequency: transForm.frequency,
        academic_year: transForm.academic_year || selectedSession,
      });
      toast.success('Transport fee slab created & synchronized');
      setTransModal(false);
      setTransForm({ name: '', route_id: '', amount: '', frequency: 'MONTHLY', academic_year: selectedSession });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create transport fee slab');
    } finally {
      setSavingTrans(false);
    }
  };

  const handleDeleteTransportSlab = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove transport fee slab "${name}"?`)) return;
    try {
      await api.delete(`/fees-finance/optional-services/transport-fee/${id}`);
      toast.success('Transport fee slab removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove transport fee slab');
    }
  };

  const handleCreateHostelSlab = async (e) => {
    e.preventDefault();
    if (!hostelForm.hostel_id || !hostelForm.monthly_fee) {
      toast.error('Please select a hostel and enter monthly fee');
      return;
    }
    try {
      setSavingHostel(true);
      await api.post('/fees-finance/optional-services/hostel-fee', {
        hostel_id: parseInt(hostelForm.hostel_id),
        sharing_type: hostelForm.sharing_type,
        is_ac: Boolean(hostelForm.is_ac),
        monthly_fee: parseFloat(hostelForm.monthly_fee || 0),
        mess_charges: parseFloat(hostelForm.mess_charges || 0),
        electricity_charges: parseFloat(hostelForm.electricity_charges || 0),
      });
      toast.success('Hostel fee slab created & synchronized');
      setHostelModal(false);
      setHostelForm({ hostel_id: '', sharing_type: 'DOUBLE', is_ac: false, monthly_fee: '', mess_charges: '', electricity_charges: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create hostel fee slab');
    } finally {
      setSavingHostel(false);
    }
  };

  const handleDeleteHostelSlab = async (id) => {
    if (!window.confirm('Are you sure you want to remove this hostel fee slab?')) return;
    try {
      await api.delete(`/fees-finance/optional-services/hostel-fee/${id}`);
      toast.success('Hostel fee slab removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove hostel fee slab');
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Academic Fee Setup & Admission Mapping" />

        <div className="page-body">

          {/* Page Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-info" style={{ fontSize: 11, fontWeight: 700 }}>Fee Architecture 2026-27</span>
                <span className="text-xs text-muted">Preparation, Mapping, Advance Discounts &amp; Lifecycle</span>
              </div>
              <h2 className="page-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0B3B7B' }}>
                Academic Fee Setup &amp; Admission Mapping
              </h2>
              <p className="page-subtitle" style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Configure class rate cards, advance payment cadences (Monthly, Quarterly, Annual), discounts, and service heads.
              </p>
            </div>

            {/* Session Switcher & Primary Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '6px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                <i className="ti ti-calendar" style={{ color: '#0B3B7B' }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Session:</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  style={{ background: 'white', border: '1px solid #94a3b8', borderRadius: 6, padding: '4px 8px', fontSize: 12.5, fontWeight: 800, color: '#0B3B7B' }}
                >
                  <option value="2026-27">2026-27 (Upcoming)</option>
                  <option value="2025-26">2025-26 (Previous)</option>
                  <option value="2027-28">2027-28 (Future)</option>
                </select>
              </div>

              {activeTab === 'structures' && (
                <>
                  <button
                    onClick={() => setCopySessionModal(true)}
                    className="btn btn-neutral"
                    style={{ fontWeight: 600, fontSize: 12.5 }}
                  >
                    <i className="ti ti-copy" /> Copy from 2025-26
                  </button>
                  <button onClick={() => openAddStructure()} className="btn btn-primary" style={{ fontWeight: 700, fontSize: 12.5 }}>
                    <i className="ti ti-plus" /> Create Fee Plan
                  </button>
                </>
              )}

              {activeTab === 'plans' && (
                <button onClick={openAddPlan} className="btn btn-primary" style={{ fontWeight: 700, fontSize: 12.5 }}>
                  <i className="ti ti-plus" /> Add Payment Plan
                </button>
              )}

              {activeTab === 'heads' && (
                <button onClick={openAddHead} className="btn btn-primary" style={{ fontWeight: 700, fontSize: 12.5 }}>
                  <i className="ti ti-plus" /> Add Fee Head
                </button>
              )}

              {activeTab === 'concessions' && (
                <button onClick={openAddConcession} className="btn btn-primary" style={{ fontWeight: 700, fontSize: 12.5 }}>
                  <i className="ti ti-plus" /> Add Concession
                </button>
              )}
            </div>
          </div>

          {/* ACADEMIC SESSION READINESS SCORECARD BANNER */}
          {readiness && (
            <div style={{
              background: readiness.is_ready_for_admissions ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1px solid ${readiness.is_ready_for_admissions ? '#a7f3d0' : '#fde68a'}`,
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: readiness.is_ready_for_admissions ? '#10b981' : '#f59e0b',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22
                }}>
                  <i className={`ti ${readiness.is_ready_for_admissions ? 'ti-circle-check' : 'ti-alert-triangle'}`} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 15, color: readiness.is_ready_for_admissions ? '#065f46' : '#92400e' }}>
                      {readiness.is_ready_for_admissions
                        ? `✅ Academic Session ${selectedSession} is Ready for Admissions!`
                        : `⚠️ Admission Setup Incomplete for ${selectedSession}`}
                    </strong>
                    <span className={`badge ${readiness.is_ready_for_admissions ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>
                      {readiness.published_classes_count} of {readiness.total_classes} Classes Configured
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#475569' }}>
                    {readiness.is_ready_for_admissions
                      ? 'All classes have an active published fee plan. New admission entries will automatically fetch the correct rate cards and advance payment discounts.'
                      : `${readiness.missing_classes_count} classes do not have a published fee plan. Students cannot be admitted into unmapped classes.`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!readiness.is_ready_for_admissions && structures.length > 0 && (
                  <button
                    onClick={() => openCloneModal(structures[0])}
                    className="btn btn-sm"
                    style={{ background: '#f59e0b', color: 'white', border: 'none', fontWeight: 700, padding: '6px 12px' }}
                  >
                    <i className="ti ti-copy" /> Auto-Clone to Missing Classes
                  </button>
                )}
                <button
                  onClick={() => navigate('/admissions/new')}
                  className="btn btn-sm"
                  style={{ background: '#0B3B7B', color: 'white', border: 'none', fontWeight: 700, padding: '6px 14px' }}
                >
                  <i className="ti ti-user-plus" /> Go to New Admission
                </button>
              </div>
            </div>
          )}

          {/* Missing Classes Warning Box if applicable */}
          {readiness && readiness.classes_missing_plan?.length > 0 && activeTab === 'structures' && (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9f1239', marginBottom: 6 }}>
                ⚠️ The following {readiness.classes_missing_plan.length} classes are missing published fee plans for {selectedSession}:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {readiness.classes_missing_plan.map((mc) => (
                  <button
                    key={mc.id}
                    onClick={() => openAddStructure(mc.id)}
                    style={{
                      background: '#ffe4e6', border: '1px solid #fda4af', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: '#9f1239',
                      cursor: 'pointer'
                    }}
                    title="Click to configure fee plan for this class"
                  >
                    + Setup {mc.display_name || mc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB NAVIGATION */}
          <div className="card mb-6" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div className="card-header" style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { id: 'structures', label: 'Class Fee Plans & Matrix', icon: 'ti-layers-intersect', count: structures.length },
                  { id: 'plans', label: 'Payment Plans & Cadence', icon: 'ti-calendar-time', count: paymentPlans.length },
                  { id: 'heads', label: 'Service Fee Heads', icon: 'ti-tag', count: heads.length },
                  { id: 'concessions', label: 'Scholarships & Waivers', icon: 'ti-percentage', count: concessions.length },
                  { id: 'services', label: 'Optional Services (Transport & Hostel)', icon: 'ti-bus', count: (readiness?.transport_structures?.length || 0) + (readiness?.hostel_structures?.length || 0) },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`btn ${active ? 'btn-primary' : 'btn-neutral'} btn-sm`}
                      style={{
                        borderRadius: 8,
                        fontWeight: active ? 700 : 600,
                        padding: '7px 14px',
                        fontSize: '0.85rem',
                        boxShadow: active ? '0 2px 6px rgba(37,99,235,0.25)' : 'none',
                      }}
                    >
                      <i className={`ti ${tab.icon}`} style={{ marginRight: 6 }} />
                      {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── TAB 1: CLASS FEE STRUCTURES (RATE CARDS) ────────────────── */}
            {activeTab === 'structures' && (
              <div className="card-body" style={{ padding: 20 }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading fee structures...</div>
                ) : structures.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 50, background: '#f8fafc', borderRadius: 12 }}>
                    <i className="ti ti-layers-intersect" style={{ fontSize: 40, color: '#cbd5e1' }} />
                    <h4 style={{ margin: '12px 0 6px', color: '#1e293b' }}>No Fee Plans for {selectedSession}</h4>
                    <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>
                      Prepare academic session {selectedSession} by copying last year's rate cards or creating a new master plan.
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button onClick={() => setCopySessionModal(true)} className="btn btn-neutral">
                        <i className="ti ti-copy" /> Copy from 2025-26
                      </button>
                      <button onClick={() => openAddStructure()} className="btn btn-primary">
                        <i className="ti ti-plus" /> Create New Plan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {structures.map((s) => {
                      const isPub = s.publish_status === 'PUBLISHED';
                      return (
                        <div
                          key={s.id}
                          style={{
                            background: 'white',
                            border: `1px solid ${isPub ? '#cbd5e1' : '#fde68a'}`,
                            borderRadius: 10,
                            padding: 16,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 800, fontSize: 14, color: '#0B3B7B' }}>{s.name}</span>
                                  <span
                                    style={{
                                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                      background: isPub ? '#dcfce7' : '#fef3c7',
                                      color: isPub ? '#15803d' : '#b45309',
                                    }}
                                  >
                                    {isPub ? '● PUBLISHED' : '○ DRAFT'}
                                  </span>
                                  {s.is_used && (
                                    <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 8, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                      In Use
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                  <strong>{s.class_name}</strong> • {s.session} • Due Day: {s.due_date_day}th
                                </div>
                              </div>
                              <span style={{ fontWeight: 800, color: '#0B3B7B', fontSize: 15 }}>{fmt(s.total_amount)}/mo</span>
                            </div>

                            {/* Itemized breakdown */}
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 8 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>
                                Itemized Rates:
                              </div>
                              {s.items?.map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: '#334155' }}>
                                  <span>{it.fee_head_name}</span>
                                  <span style={{ fontWeight: 700 }}>{fmt(it.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                            <button
                              onClick={() => handleTogglePublish(s)}
                              className="btn btn-neutral btn-sm"
                              style={{ fontSize: 11, fontWeight: 700, color: isPub ? '#b45309' : '#15803d' }}
                              title={isPub ? 'Switch to Draft (hide from new admissions)' : 'Publish Plan (make active for admissions)'}
                            >
                              <i className={`ti ${isPub ? 'ti-eye-off' : 'ti-check'}`} /> {isPub ? 'Unpublish' : 'Publish'}
                            </button>

                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => openCloneModal(s)}
                                className="btn btn-neutral btn-sm"
                                style={{ fontSize: 11 }}
                                title="Clone this rate card to other classes"
                              >
                                <i className="ti ti-copy" /> Clone
                              </button>
                              <button
                                onClick={() => openEditStructure(s)}
                                className="btn btn-neutral btn-sm"
                                style={{ fontSize: 11 }}
                                title="Edit Rate Card"
                              >
                                <i className="ti ti-edit" />
                              </button>
                              <button
                                onClick={() => handleDeleteStructure(s)}
                                className="btn btn-neutral btn-sm"
                                style={{ fontSize: 11, color: '#ef4444' }}
                                title="Delete Rate Card"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 2: PAYMENT PLANS & ADVANCE DISCOUNTS ─────────────────── */}
            {activeTab === 'plans' && (
              <div className="card-body" style={{ padding: 20 }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0B3B7B' }}>
                      Advance Payment Cadences &amp; Concessions ({selectedSession})
                    </h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                      Configure payment frequencies (1M, 3M, 6M, 12M) and advance payment discounts. Discounts apply only to eligible categories (e.g. Tuition &amp; Annual).
                    </p>
                  </div>
                  <button onClick={openAddPlan} className="btn btn-primary btn-sm">
                    <i className="ti ti-plus" /> New Payment Cadence
                  </button>
                </div>

                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Cadence Name</th>
                        <th>Code</th>
                        <th>Duration</th>
                        <th>Advance Concession</th>
                        <th>Eligible Heads / Categories</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center', width: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentPlans.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, color: '#0B3B7B' }}>{p.name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.code}</td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                              {p.months_count} {p.months_count === 1 ? 'Month' : 'Months'}
                            </span>
                          </td>
                          <td>
                            {p.discount_value > 0 ? (
                              <span style={{ fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: 12, fontSize: 12 }}>
                                {p.discount_type === 'PERCENTAGE' ? `${p.discount_value}% OFF` : `₹ ${p.discount_value} OFF`}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>No Discount (0%)</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(p.eligible_categories || ['ACADEMIC']).map((cat, idx) => (
                                <span key={idx} style={{ fontSize: 10.5, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>
                              {p.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => openEditPlan(p)}
                              className="btn btn-neutral btn-sm"
                              title="Edit Plan"
                            >
                              <i className="ti ti-edit" /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── TAB 3: SERVICE FEE HEADS ─────────────────────────────────── */}
            {activeTab === 'heads' && (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Fee Head Name</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Frequency</th>
                      <th>Recurring</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heads.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0B3B7B' }}>{h.code}</td>
                        <td style={{ fontWeight: 600 }}>{h.name}</td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>{h.department}</span>
                        </td>
                        <td>{h.category}</td>
                        <td>{h.default_frequency}</td>
                        <td>
                          {h.is_recurring ? (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>Yes (Per Cadence)</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>One-time</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${h.is_active ? 'badge-success' : 'badge-neutral'}`}>
                            {h.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setEditingHead(h);
                                setHeadForm({ ...h });
                                setHeadModal(true);
                              }}
                              className="btn btn-neutral btn-sm"
                              title="Edit Fee Head"
                            >
                              <i className="ti ti-edit" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteHead(h)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: '#ef4444' }}
                              title="Delete Fee Head"
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─── TAB 4: CONCESSIONS & SCHOLARSHIPS ───────────────────────── */}
            {activeTab === 'concessions' && (
              <div className="card-body" style={{ padding: 20 }}>
                {concessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    <i className="ti ti-percentage" style={{ fontSize: 36, color: '#cbd5e1' }} />
                    <h4 style={{ margin: '10px 0 4px', color: '#1e293b' }}>No Student Concessions Configured</h4>
                    <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>
                      Assign sibling discounts, merit scholarships, or staff child concessions.
                    </p>
                    <button onClick={openAddConcession} className="btn btn-primary">
                      <i className="ti ti-plus" /> Add Concession
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                    {concessions.map((c) => (
                      <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{c.student_name} ({c.admission_no})</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge badge-success">
                              {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                            </span>
                            <button
                              onClick={() => handleDeleteConcession(c)}
                              className="btn btn-neutral btn-sm"
                              style={{ color: '#ef4444', padding: '2px 6px' }}
                              title="Delete Concession"
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                          Type: <strong>{c.concession_type}</strong> • Head: <strong>{c.fee_head_name || 'All Heads'}</strong>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#475569', fontStyle: 'italic' }}>
                          "{c.reason}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 5: CENTRALIZED OPTIONAL SERVICES & AUXILIARY SLABS ──────── */}
            {activeTab === 'services' && (() => {
              const transportStructures = readiness?.transport_structures || [];
              const transportRoutes = readiness?.transport_routes || [];
              const hostelStructures = readiness?.hostel_structures || [];
              const hostelsList = readiness?.hostels || [];

              const configuredRouteIds = new Set(transportStructures.filter(s => s.route_id).map(s => s.route_id));
              const hasUniversalTransport = transportStructures.some(s => !s.route_id);
              const pendingRoutes = transportRoutes.filter(r => !configuredRouteIds.has(r.id) && !hasUniversalTransport);

              const configuredHostelIds = new Set(hostelStructures.map(s => s.hostel_id));
              const pendingHostels = hostelsList.filter(h => !configuredHostelIds.has(h.id));

              return (
                <div className="card-body" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0B3B7B' }}>
                        Centralized Optional Services &amp; Auxiliary Charges
                      </h4>
                      <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                        Manage transport route fares, hostel boarding slabs, and auxiliary heads synchronized across central Finance and respective operational modules.
                      </p>
                    </div>

                    {/* Subtabs Selector */}
                    <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
                      <button
                        type="button"
                        onClick={() => setOptSubTab('transport')}
                        className="btn btn-sm"
                        style={{
                          background: optSubTab === 'transport' ? '#fff' : 'transparent',
                          color: optSubTab === 'transport' ? '#0284c7' : '#64748b',
                          fontWeight: 700,
                          boxShadow: optSubTab === 'transport' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          border: 'none',
                        }}
                      >
                        🚌 School Bus Transport ({transportStructures.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptSubTab('hostel')}
                        className="btn btn-sm"
                        style={{
                          background: optSubTab === 'hostel' ? '#fff' : 'transparent',
                          color: optSubTab === 'hostel' ? '#d97706' : '#64748b',
                          fontWeight: 700,
                          boxShadow: optSubTab === 'hostel' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          border: 'none',
                        }}
                      >
                        🏢 Boarding &amp; Hostel ({hostelStructures.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptSubTab('library')}
                        className="btn btn-sm"
                        style={{
                          background: optSubTab === 'library' ? '#fff' : 'transparent',
                          color: optSubTab === 'library' ? '#7c3aed' : '#64748b',
                          fontWeight: 700,
                          boxShadow: optSubTab === 'library' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          border: 'none',
                        }}
                      >
                        📚 Library &amp; Caution Money
                      </button>
                    </div>
                  </div>

                  {/* ─── SUBTAB 1: TRANSPORT ROUTE FARES & SLABS ─────────────── */}
                  {optSubTab === 'transport' && (
                    <div>
                      {/* Transport KPI Stats Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Configured Bus Slabs</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{transportStructures.length}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Synchronized with Transport Module</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Active Bus Routes</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>{transportRoutes.length}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Configured in Transport Master</div>
                        </div>
                        <div style={{ background: pendingRoutes.length > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${pendingRoutes.length > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: pendingRoutes.length > 0 ? '#b45309' : '#15803d', textTransform: 'uppercase' }}>Setup Status</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: pendingRoutes.length > 0 ? '#d97706' : '#16a34a', marginTop: 8 }}>
                            {pendingRoutes.length > 0 ? `⚠️ ${pendingRoutes.length} Routes Pending Setup` : '✓ All Routes Configured'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {pendingRoutes.length > 0 ? 'Students on unconfigured routes lack billing slabs' : 'Ready for admissions & bus billing'}
                          </div>
                        </div>
                      </div>

                      {/* Pending Routes Alert */}
                      {pendingRoutes.length > 0 && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                            <i className="ti ti-alert-triangle" />
                            Pending Route Fee Slabs ({pendingRoutes.length} routes without specific fee structure)
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#78350f' }}>
                            Students admitted to these bus routes cannot be automatically billed unless a route slab or universal slab is created:
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {pendingRoutes.map(r => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #fcd34d', padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{r.name}</span>
                                {r.route_code && <span className="badge badge-neutral" style={{ fontSize: 10 }}>{r.route_code}</span>}
                                {r.fare > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>Default: ₹{r.fare}</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransForm({
                                      name: `${r.name} Bus Fee`,
                                      route_id: String(r.id),
                                      amount: r.fare ? String(r.fare) : '',
                                      frequency: 'MONTHLY',
                                      academic_year: selectedSession,
                                    });
                                    setTransModal(true);
                                  }}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                                >
                                  + Set Route Fee
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Header Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0B3B7B' }}>
                          Configured Transport Rate Slabs ({transportStructures.length})
                        </h5>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setTransForm({
                                name: '',
                                route_id: '',
                                amount: '',
                                frequency: 'MONTHLY',
                                academic_year: selectedSession,
                              });
                              setTransModal(true);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700 }}
                          >
                            + Add Transport Fee Slab
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/transport/fees')}
                            className="btn btn-outline btn-sm"
                            style={{ fontWeight: 600 }}
                          >
                            Transport Module ↗
                          </button>
                        </div>
                      </div>

                      {/* Transport Slabs Table */}
                      {transportStructures.length === 0 ? (
                        <div className="empty-state" style={{ padding: '36px 16px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
                          <span style={{ fontSize: 32 }}>🚌</span>
                          <h5 style={{ margin: '10px 0 4px', fontWeight: 700, color: '#1e293b' }}>No Transport Fee Slabs Configured</h5>
                          <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                            Click "+ Add Transport Fee Slab" to configure route fares for admissions and automated billing.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <table className="table" style={{ margin: 0 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th>Slab Name</th>
                                <th>Assigned Route</th>
                                <th>Billing Cadence</th>
                                <th style={{ textAlign: 'right' }}>Fee Amount</th>
                                <th style={{ textAlign: 'center' }}>Active Bus Users</th>
                                <th>Sync Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transportStructures.map((s) => (
                                <tr key={s.id}>
                                  <td>
                                    <div style={{ fontWeight: 700, color: '#0B3B7B' }}>{s.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Year: {s.academic_year || selectedSession}</div>
                                  </td>
                                  <td>
                                    {s.route_id ? (
                                      <span className="badge badge-info" style={{ fontWeight: 600 }}>
                                        🚌 {s.route_name || `Route #${s.route_id}`}
                                      </span>
                                    ) : (
                                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                                        🌐 All Routes / Universal
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                      {s.frequency || 'MONTHLY'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#0284c7', fontSize: 14 }}>
                                    {fmt(s.amount)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                                      {s.student_count || 0} students
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge badge-success" style={{ fontSize: 10, fontWeight: 700 }}>
                                      ✓ Synced (Finance &amp; Transport)
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTransportSlab(s.id, s.name)}
                                      className="btn btn-neutral btn-sm"
                                      style={{ color: '#ef4444', padding: '3px 8px' }}
                                      title="Remove Slab"
                                    >
                                      <i className="ti ti-trash" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── SUBTAB 2: HOSTEL & BOARDING SLABS ───────────────────── */}
                  {optSubTab === 'hostel' && (
                    <div>
                      {/* Hostel KPI Stats Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Room Fee Slabs</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{hostelStructures.length}</div>
                          <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>Boarding &amp; Mess Slabs</div>
                        </div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Hostel Buildings</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>{hostelsList.length}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Configured in Hostel Master</div>
                        </div>
                        <div style={{ background: pendingHostels.length > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${pendingHostels.length > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: pendingHostels.length > 0 ? '#b45309' : '#15803d', textTransform: 'uppercase' }}>Hostel Readiness</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: pendingHostels.length > 0 ? '#d97706' : '#16a34a', marginTop: 8 }}>
                            {pendingHostels.length > 0 ? `⚠️ ${pendingHostels.length} Hostels Pending Setup` : '✓ All Hostels Configured'}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {pendingHostels.length > 0 ? 'Room rate cards needed for resident billing' : 'Ready for hostel allocations'}
                          </div>
                        </div>
                      </div>

                      {/* Pending Hostels Alert */}
                      {pendingHostels.length > 0 && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                            <i className="ti ti-alert-triangle" />
                            Pending Hostel Pricing Slabs ({pendingHostels.length} Hostels without fee slabs)
                          </div>
                          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#78350f' }}>
                            Students allocated to these hostels will have zero fee generated unless boarding slabs are configured:
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {pendingHostels.map(h => (
                              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #fcd34d', padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{h.name}</span>
                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{h.hostel_type || 'Hostel'}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHostelForm({
                                      hostel_id: String(h.id),
                                      sharing_type: 'DOUBLE',
                                      is_ac: false,
                                      monthly_fee: '',
                                      mess_charges: '',
                                      electricity_charges: '',
                                    });
                                    setHostelModal(true);
                                  }}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                                >
                                  + Set Hostel Fee
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Header Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0B3B7B' }}>
                          Configured Boarding &amp; Room Slabs ({hostelStructures.length})
                        </h5>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setHostelForm({
                                hostel_id: hostelsList[0]?.id ? String(hostelsList[0].id) : '',
                                sharing_type: 'DOUBLE',
                                is_ac: false,
                                monthly_fee: '',
                                mess_charges: '',
                                electricity_charges: '',
                              });
                              setHostelModal(true);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700 }}
                          >
                            + Add Hostel Room Slab
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/hostel')}
                            className="btn btn-outline btn-sm"
                            style={{ fontWeight: 600 }}
                          >
                            Hostel Module ↗
                          </button>
                        </div>
                      </div>

                      {/* Hostel Slabs Table */}
                      {hostelStructures.length === 0 ? (
                        <div className="empty-state" style={{ padding: '36px 16px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
                          <span style={{ fontSize: 32 }}>🏢</span>
                          <h5 style={{ margin: '10px 0 4px', fontWeight: 700, color: '#1e293b' }}>No Hostel Fee Slabs Configured</h5>
                          <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                            Click "+ Add Hostel Room Slab" to configure boarding and mess charges.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <table className="table" style={{ margin: 0 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th>Hostel &amp; Wing</th>
                                <th>Sharing Type</th>
                                <th>Climate Type</th>
                                <th style={{ textAlign: 'right' }}>Boarding Fee</th>
                                <th style={{ textAlign: 'right' }}>Mess Charges</th>
                                <th style={{ textAlign: 'right' }}>Total Monthly</th>
                                <th>Sync Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hostelStructures.map((s) => (
                                <tr key={s.id}>
                                  <td>
                                    <div style={{ fontWeight: 700, color: '#0B3B7B' }}>{s.hostel_name || `Hostel #${s.hostel_id}`}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{s.building_name || 'All Buildings'} • {s.floor_name || 'All Floors'}</div>
                                  </td>
                                  <td>
                                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                                      {s.sharing_type}
                                    </span>
                                  </td>
                                  <td>
                                    {s.is_ac ? (
                                      <span className="badge badge-info" style={{ fontWeight: 700 }}>❄️ AC</span>
                                    ) : (
                                      <span className="badge badge-neutral">Non-AC</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                    {fmt(s.monthly_fee)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}>
                                    {fmt(s.mess_charges)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                                    {fmt(s.total_monthly || (Number(s.monthly_fee || 0) + Number(s.mess_charges || 0)))}
                                  </td>
                                  <td>
                                    <span className="badge badge-success" style={{ fontSize: 10, fontWeight: 700 }}>
                                      ✓ Synced (Finance &amp; Hostel)
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteHostelSlab(s.id)}
                                      className="btn btn-neutral btn-sm"
                                      style={{ color: '#ef4444', padding: '3px 8px' }}
                                      title="Remove Slab"
                                    >
                                      <i className="ti ti-trash" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── SUBTAB 3: LIBRARY & AUXILIARY CAUTION MONEY ─────────── */}
                  {optSubTab === 'library' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0B3B7B' }}>
                            Library &amp; Auxiliary Caution Heads in Fee Master
                          </h5>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                            Charges such as Library Deposit, Reading Pass, Caution Money, and Activity Fees itemized in student invoices.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHead(null);
                            setHeadForm({
                              code: 'CAUTION_MONEY',
                              name: 'Library & Security Caution Money',
                              category: 'LIBRARY',
                              department: 'LIBRARY',
                              income_account: 'Caution Money Deposit',
                              is_recurring: false,
                              default_frequency: 'ONE_TIME',
                              is_refundable: true,
                              description: 'Refundable security deposit collected during admission',
                            });
                            setHeadModal(true);
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ fontWeight: 700 }}
                        >
                          + Add Auxiliary Fee Head
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                        {heads.filter(h => h.category === 'LIBRARY' || h.department === 'LIBRARY' || h.code === 'CAUTION_MONEY' || h.code === 'LIB_FINE').length === 0 ? (
                          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: 28 }}>📚</span>
                            <h5 style={{ margin: '8px 0 4px', fontWeight: 700, color: '#1e293b' }}>Default Library Heads Active</h5>
                            <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                              Standard Library Fee and Fine heads are active in the system fee registry.
                            </p>
                          </div>
                        ) : (
                          heads.filter(h => h.category === 'LIBRARY' || h.department === 'LIBRARY' || h.code === 'CAUTION_MONEY' || h.code === 'LIB_FINE').map(h => (
                            <div key={h.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0B3B7B', fontSize: 13.5 }}>{h.name}</div>
                                  <span className="badge badge-info" style={{ fontSize: 10 }}>{h.code}</span>
                                </div>
                                <span className={`badge badge-${h.is_refundable ? 'warning' : 'neutral'}`} style={{ fontSize: 10 }}>
                                  {h.is_refundable ? 'Refundable' : 'Non-Refundable'}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                Frequency: <strong>{h.default_frequency}</strong> • Account: <strong>{h.income_account}</strong>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>

          {/* ─── MODAL: CLONE STRUCTURE TO CLASSES ──────────────────────────── */}
          {cloneModal && cloneSourceStruct && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                    Clone Fee Plan to Other Classes
                  </h3>
                  <button onClick={() => setCloneModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handleCloneSubmit}>
                  <div className="modal-body" style={{ padding: 20 }}>
                    <div style={{ background: '#e0f2fe', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: '#0369a1' }}>
                      <strong>Template:</strong> "{cloneSourceStruct.name}" ({fmt(cloneSourceStruct.total_amount)}/mo)
                      <br />
                      This will copy all {cloneSourceStruct.items?.length || 0} itemized rates (Tuition, Admission, Exam, etc.) to the selected target classes.
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                          Select Target Classes ({cloneTargetClassIds.length} Selected)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (cloneTargetClassIds.length === classes.length) {
                              setCloneTargetClassIds([]);
                            } else {
                              setCloneTargetClassIds(classes.map((c) => c.id));
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: '#0B3B7B', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {cloneTargetClassIds.length === classes.length ? 'Deselect All' : 'Select All Classes'}
                        </button>
                      </div>

                      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
                        {classes.map((c) => {
                          const isChecked = cloneTargetClassIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
                                background: isChecked ? '#f0fdf4' : 'transparent',
                                borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 2
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCloneTargetClassIds([...cloneTargetClassIds, c.id]);
                                  } else {
                                    setCloneTargetClassIds(cloneTargetClassIds.filter((id) => id !== c.id));
                                  }
                                }}
                              />
                              <span style={{ fontWeight: isChecked ? 700 : 500 }}>{c.name} {c.section || ''}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 14 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={clonePublishNow}
                          onChange={(e) => setClonePublishNow(e.target.checked)}
                        />
                        Publish cloned structures immediately (Ready for admissions)
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setCloneModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={cloning} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {cloning ? 'Cloning...' : `Clone to ${cloneTargetClassIds.length} Classes`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: COPY SESSION RATE CARDS ───────────────────────────── */}
          {copySessionModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                    Copy Previous Session Rate Cards
                  </h3>
                  <button onClick={() => setCopySessionModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handleCopySessionSubmit}>
                  <div className="modal-body" style={{ padding: 20 }}>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 16px' }}>
                      Duplicate all rate cards from a previous academic session to jumpstart the new academic year without modifying previous year records.
                    </p>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Source Session</label>
                        <select
                          value={copyFromSession}
                          onChange={(e) => setCopyFromSession(e.target.value)}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="2025-26">2025-26</option>
                          <option value="2024-25">2024-25</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Target Session</label>
                        <select
                          value={copyToSession}
                          onChange={(e) => setCopyToSession(e.target.value)}
                          className="form-select"
                          style={{ fontWeight: 700, color: '#0B3B7B' }}
                        >
                          <option value="2026-27">2026-27</option>
                          <option value="2027-28">2027-28</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={copyAsDraft}
                          onChange={(e) => setCopyAsDraft(e.target.checked)}
                        />
                        Import as DRAFT (Allows price review before publishing)
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setCopySessionModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={copyingSession} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {copyingSession ? 'Copying...' : 'Copy Session Rate Cards'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: PAYMENT PLAN ADD / EDIT ───────────────────────────── */}
          {planModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                    {editingPlan ? 'Edit Payment Cadence' : 'New Advance Payment Cadence'}
                  </h3>
                  <button onClick={() => setPlanModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handlePlanSubmit}>
                  <div className="modal-body" style={{ padding: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Plan Name</label>
                      <input
                        type="text"
                        value={planForm.name}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                        placeholder="e.g. Quarterly Advance (3 Months)"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Code (Unique)</label>
                        <input
                          type="text"
                          value={planForm.code}
                          onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                          placeholder="e.g. QUARTERLY"
                          required
                          disabled={!!editingPlan}
                          className="form-input"
                          style={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Duration (Months)</label>
                        <select
                          value={planForm.months_count}
                          onChange={(e) => setPlanForm({ ...planForm, months_count: parseInt(e.target.value) })}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="1">1 Month (Monthly)</option>
                          <option value="3">3 Months (Quarterly)</option>
                          <option value="6">6 Months (Half-Yearly)</option>
                          <option value="12">12 Months (Full Annual)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Discount Type</label>
                        <select
                          value={planForm.discount_type}
                          onChange={(e) => setPlanForm({ ...planForm, discount_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="PERCENTAGE">Percentage (%)</option>
                          <option value="FIXED">Fixed Amount (₹)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Discount Value ({planForm.discount_type === 'PERCENTAGE' ? '%' : '₹'})</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={planForm.discount_value}
                          onChange={(e) => setPlanForm({ ...planForm, discount_value: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 5 for 5%"
                          required
                          className="form-input"
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Eligible Categories for Advance Discount</label>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        {['ACADEMIC', 'EXAM', 'ACTIVITY', 'OTHER'].map((cat) => {
                          const isChecked = planForm.eligible_categories.includes(cat);
                          return (
                            <label
                              key={cat}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: isChecked ? '#e0f2fe' : '#f1f5f9',
                                padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                border: isChecked ? '1px solid #bae6fd' : '1px solid transparent',
                                fontWeight: isChecked ? 700 : 500
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPlanForm({ ...planForm, eligible_categories: [...planForm.eligible_categories, cat] });
                                  } else {
                                    setPlanForm({ ...planForm, eligible_categories: planForm.eligible_categories.filter((c) => c !== cat) });
                                  }
                                }}
                              />
                              {cat}
                            </label>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
                        Note: Auxiliary services (Transport &amp; Hostel) are excluded to ensure operational cost coverage.
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description / Policy Note</label>
                      <input
                        type="text"
                        value={planForm.description}
                        onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                        placeholder="e.g. Pay 3 months in advance to receive 5% concession."
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setPlanModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingPlan} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {savingPlan ? 'Saving...' : 'Save Payment Cadence'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: FEE STRUCTURE (RATE CARD) ADD/EDIT ─────────────────── */}
          {structModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 640 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                    {editingStruct ? 'Edit Rate Card' : 'Create Class Fee Plan'}
                  </h3>
                  <button onClick={() => setStructModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleStructureSubmit}>
                  <div className="modal-body" style={{ padding: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Structure / Rate Card Name</label>
                      <input
                        type="text"
                        value={structForm.name}
                        onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                        placeholder="e.g. Class 1 Standard Fee 2026-27"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Target Class</label>
                        <select
                          value={structForm.class_id}
                          onChange={(e) => {
                            const cid = e.target.value;
                            const cObj = classes.find((c) => c.id === parseInt(cid));
                            const autoName = cObj ? `${cObj.name} Standard Fee ${selectedSession}` : structForm.name;
                            setStructForm({ ...structForm, class_id: cid, name: structForm.name ? structForm.name : autoName });
                          }}
                          className="form-select"
                          style={{ fontWeight: 700 }}
                        >
                          <option value="">All Classes (School-wide Master Rate)</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.section || ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Publish Status</label>
                        <select
                          value={structForm.publish_status}
                          onChange={(e) => setStructForm({ ...structForm, publish_status: e.target.value })}
                          className="form-select"
                          style={{ fontWeight: 800, color: structForm.publish_status === 'PUBLISHED' ? '#16a34a' : '#d97706' }}
                        >
                          <option value="PUBLISHED">PUBLISHED (Active for Admissions)</option>
                          <option value="DRAFT">DRAFT (Under Review)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Default Frequency</label>
                        <select
                          value={structForm.frequency}
                          onChange={(e) => setStructForm({ ...structForm, frequency: e.target.value })}
                          className="form-select"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="ANNUAL">Annual</option>
                          <option value="ONE_TIME">One Time</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Monthly Due Date Day (1-28)</label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={structForm.due_date_day}
                          onChange={(e) => setStructForm({ ...structForm, due_date_day: e.target.value })}
                          className="form-input"
                        />
                      </div>
                    </div>

                    {/* Itemized Heads Pricing Table */}
                    <div className="form-group" style={{ marginTop: 10 }}>
                      <label className="form-label" style={{ fontWeight: 700, color: '#0B3B7B' }}>
                        Itemized Rates by Fee Head (₹)
                      </label>
                      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px' }}>
                        {structForm.items.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '6px 0', borderBottom: idx < structForm.items.length - 1 ? '1px solid #f1f5f9' : 'none'
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{item.fee_head_name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>₹</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.amount}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = [...structForm.items];
                                  updated[idx].amount = val;
                                  setStructForm({ ...structForm, items: updated });
                                }}
                                style={{ width: 110, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 700, textAlign: 'right' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '6px 12px', background: '#f8fafc', borderRadius: 8 }}>
                        <strong style={{ fontSize: 13, color: '#334155' }}>Total Monthly Demand:</strong>
                        <strong style={{ fontSize: 14, color: '#0B3B7B' }}>
                          {fmt(structForm.items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0))}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setStructModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {editingStruct ? 'Update Fee Plan' : 'Save & Publish Fee Plan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: FEE HEAD (SERVICE) ADD/EDIT ───────────────────────── */}
          {headModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                    {editingHead ? 'Edit Fee Head' : 'Add Fee Head (Service)'}
                  </h3>
                  <button onClick={() => setHeadModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleHeadSubmit}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label className="form-label">Fee Head Name</label>
                      <input
                        type="text"
                        value={headForm.name}
                        onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                        placeholder="e.g. Science Lab Fee"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Code (Identifier)</label>
                        <input
                          type="text"
                          value={headForm.code}
                          onChange={(e) => setHeadForm({ ...headForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                          placeholder="e.g. LAB_FEE"
                          required
                          className="form-input"
                          style={{ fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <select
                          value={headForm.department || 'ACCOUNTS'}
                          onChange={(e) => setHeadForm({ ...headForm, department: e.target.value })}
                          className="form-select"
                        >
                          <option value="ACCOUNTS">ACCOUNTS</option>
                          <option value="TRANSPORT">TRANSPORT</option>
                          <option value="HOSTEL">HOSTEL</option>
                          <option value="LIBRARY">LIBRARY</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select
                          value={headForm.category || 'ACADEMIC'}
                          onChange={(e) => setHeadForm({ ...headForm, category: e.target.value })}
                          className="form-select"
                        >
                          <option value="ACADEMIC">ACADEMIC</option>
                          <option value="TRANSPORT">TRANSPORT</option>
                          <option value="HOSTEL">HOSTEL</option>
                          <option value="LIBRARY">LIBRARY</option>
                          <option value="EXAM">EXAM</option>
                          <option value="ACTIVITY">ACTIVITY</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Frequency</label>
                        <select
                          value={headForm.default_frequency || 'MONTHLY'}
                          onChange={(e) => setHeadForm({ ...headForm, default_frequency: e.target.value })}
                          className="form-select"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="ANNUAL">Annual</option>
                          <option value="ONE_TIME">One Time</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={headForm.is_recurring}
                          onChange={(e) => setHeadForm({ ...headForm, is_recurring: e.target.checked })}
                        />
                        Recurring Charge (Billed every cadence period)
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        value={headForm.description || ''}
                        onChange={(e) => setHeadForm({ ...headForm, description: e.target.value })}
                        placeholder="Optional details about this charge"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setHeadModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingHead ? 'Update Fee Head' : 'Create Fee Head'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: CONCESSION ADD ────────────────────────────────────── */}
          {concModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                    Add Student Concession / Scholarship
                  </h3>
                  <button onClick={() => setConcModal(false)} className="modal-close">✕</button>
                </div>

                <form onSubmit={handleConcessionSubmit}>
                  <div className="modal-body" style={{ padding: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Filter by Class</label>
                      <select
                        value={concClassId}
                        onChange={(e) => setConcClassId(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Classes</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} {c.section || ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Select Student</label>
                      <select
                        value={concForm.student_id}
                        onChange={(e) => setConcForm({ ...concForm, student_id: e.target.value })}
                        required
                        className="form-select"
                        style={{ fontWeight: 700 }}
                      >
                        <option value="">-- Choose Student --</option>
                        {concStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.admission_no} • {s.class_name})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Applicable Fee Head</label>
                        <select
                          value={concForm.fee_head_id}
                          onChange={(e) => setConcForm({ ...concForm, fee_head_id: e.target.value })}
                          className="form-select"
                        >
                          <option value="">All Fees (Entire Bill)</option>
                          {heads.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Concession Type</label>
                        <select
                          value={concForm.concession_type}
                          onChange={(e) => setConcForm({ ...concForm, concession_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="SCHOLARSHIP">Merit Scholarship</option>
                          <option value="SIBLING">Sibling Discount</option>
                          <option value="STAFF_CHILD">Staff Child Concession</option>
                          <option value="PRINCIPAL_SPECIAL">Principal Special Concession</option>
                          <option value="FULL_WAIVER">Full Waiver</option>
                          <option value="PARTIAL_WAIVER">Partial Waiver</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Discount Type</label>
                        <select
                          value={concForm.discount_type}
                          onChange={(e) => setConcForm({ ...concForm, discount_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="FIXED">Fixed Amount (₹)</option>
                          <option value="PERCENTAGE">Percentage (%)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Discount Value ({concForm.discount_type === 'PERCENTAGE' ? '%' : '₹'})</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={concForm.discount_value}
                          onChange={(e) => setConcForm({ ...concForm, discount_value: e.target.value })}
                          placeholder={concForm.discount_type === 'PERCENTAGE' ? 'e.g. 25' : 'e.g. 500'}
                          required
                          className="form-input"
                          style={{ fontWeight: 700 }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Reason / Approval Justification</label>
                      <input
                        type="text"
                        value={concForm.reason}
                        onChange={(e) => setConcForm({ ...concForm, reason: e.target.value })}
                        placeholder="e.g. 95% in Board Exams Merit or 2nd child in school"
                        required
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={() => setConcModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingConc} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {savingConc ? 'Saving...' : 'Apply Concession'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: SAFEGUARD WHEN RATE CARD IN USE ───────────────────── */}
          {safeguardModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontWeight: 800, fontSize: 15 }}>
                    <i className="ti ti-shield-alert" style={{ fontSize: 20 }} />
                    Rate Card In Active Use — Protected 🛡️
                  </div>
                  <button onClick={() => setSafeguardModal(null)} className="modal-close">✕</button>
                </div>
                <div className="modal-body" style={{ padding: 20 }}>
                  <p style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.6, margin: '0 0 12px' }}>
                    <strong>"{safeguardModal.name}"</strong> is currently assigned to active students or has issued bills in the central financial ledger.
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 12, color: '#475569', marginBottom: 16, lineHeight: 1.5 }}>
                    Hard deletion is permanently disabled to maintain audit compliance and prevent orphaned student bills.
                    Instead, you can <strong>Archive / Deactivate</strong> this rate card so it cannot be used for any new student assignments.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setSafeguardModal(null)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleArchiveStructure(safeguardModal)}
                      className="btn btn-primary"
                      style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 700 }}
                    >
                      <i className="ti ti-archive" /> Archive Rate Card
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── MODAL: CREATE TRANSPORT FEE SLAB ──────────────────────────── */}
          {transModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>🚌</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                      Add Transport Route Fee Slab
                    </h3>
                  </div>
                  <button type="button" onClick={() => setTransModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handleCreateTransportSlab}>
                  <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Fee Slab Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Route 1 Regular Bus Pass or Chakhabibullah Monthly Fare"
                        value={transForm.name}
                        onChange={(e) => setTransForm({ ...transForm, name: e.target.value })}
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Applicable Transport Route</label>
                      <select
                        value={transForm.route_id}
                        onChange={(e) => {
                          const rid = e.target.value;
                          const selRoute = (readiness?.transport_routes || []).find(r => String(r.id) === rid);
                          setTransForm({
                            ...transForm,
                            route_id: rid,
                            amount: (!transForm.amount && selRoute?.fare) ? String(selRoute.fare) : transForm.amount,
                            name: (!transForm.name && selRoute?.name) ? `${selRoute.name} Bus Fee` : transForm.name,
                          });
                        }}
                        className="form-select"
                      >
                        <option value="">🌐 All Routes / Universal Default Slabs</option>
                        {(readiness?.transport_routes || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            🚌 {r.name} {r.route_code ? `(${r.route_code})` : ''} {r.fare ? `— ₹${r.fare}` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted" style={{ marginTop: 4, display: 'block' }}>
                        If a specific route is selected, this fare will automatically apply to students assigned to this route.
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Fee Amount (₹) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 1200"
                          value={transForm.amount}
                          onChange={(e) => setTransForm({ ...transForm, amount: e.target.value })}
                          required
                          min="0"
                          step="1"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Cadence / Frequency</label>
                        <select
                          value={transForm.frequency}
                          onChange={(e) => setTransForm({ ...transForm, frequency: e.target.value })}
                          className="form-select"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="HALF_YEARLY">Half Yearly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Academic Session</label>
                      <input
                        type="text"
                        value={transForm.academic_year}
                        onChange={(e) => setTransForm({ ...transForm, academic_year: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 16 }}>
                    <button type="button" onClick={() => setTransModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingTrans} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {savingTrans ? 'Saving...' : 'Create & Sync Fee Slab'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── MODAL: CREATE HOSTEL FEE SLAB ────────────────────────────── */}
          {hostelModal && (
            <div className="modal-backdrop">
              <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>🏢</span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0B3B7B' }}>
                      Add Boarding &amp; Hostel Room Slab
                    </h3>
                  </div>
                  <button type="button" onClick={() => setHostelModal(false)} className="modal-close">✕</button>
                </div>
                <form onSubmit={handleCreateHostelSlab}>
                  <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Select Hostel *</label>
                      <select
                        value={hostelForm.hostel_id}
                        onChange={(e) => setHostelForm({ ...hostelForm, hostel_id: e.target.value })}
                        required
                        className="form-select"
                      >
                        <option value="">-- Choose Hostel Facility --</option>
                        {(readiness?.hostels || []).map((h) => (
                          <option key={h.id} value={h.id}>
                            🏢 {h.name} {h.hostel_type ? `(${h.hostel_type})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Room Sharing Type</label>
                        <select
                          value={hostelForm.sharing_type}
                          onChange={(e) => setHostelForm({ ...hostelForm, sharing_type: e.target.value })}
                          className="form-select"
                        >
                          <option value="SINGLE">Single Occupancy</option>
                          <option value="DOUBLE">Double Sharing</option>
                          <option value="TRIPLE">Triple Sharing</option>
                          <option value="FOUR_SHARING">4 Sharing</option>
                          <option value="SIX_SHARING">6 Sharing</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Air Conditioning</label>
                        <select
                          value={hostelForm.is_ac ? 'true' : 'false'}
                          onChange={(e) => setHostelForm({ ...hostelForm, is_ac: e.target.value === 'true' })}
                          className="form-select"
                        >
                          <option value="false">Non-AC Room</option>
                          <option value="true">❄️ AC Room</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Monthly Boarding Fee (₹) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 5000"
                          value={hostelForm.monthly_fee}
                          onChange={(e) => setHostelForm({ ...hostelForm, monthly_fee: e.target.value })}
                          required
                          min="0"
                          step="1"
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700 }}>Monthly Mess Fee (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 2500"
                          value={hostelForm.mess_charges}
                          onChange={(e) => setHostelForm({ ...hostelForm, mess_charges: e.target.value })}
                          min="0"
                          step="1"
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Electricity &amp; Maintenance (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={hostelForm.electricity_charges}
                        onChange={(e) => setHostelForm({ ...hostelForm, electricity_charges: e.target.value })}
                        min="0"
                        step="1"
                        className="form-input"
                      />
                    </div>

                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0B3B7B' }}>
                        <span>Total Monthly Billed to Student:</span>
                        <span>
                          ₹{Number(hostelForm.monthly_fee || 0) + Number(hostelForm.mess_charges || 0) + Number(hostelForm.electricity_charges || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 16 }}>
                    <button type="button" onClick={() => setHostelModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingHostel} className="btn btn-primary" style={{ fontWeight: 700 }}>
                      {savingHostel ? 'Saving...' : 'Create & Sync Hostel Slab'}
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
