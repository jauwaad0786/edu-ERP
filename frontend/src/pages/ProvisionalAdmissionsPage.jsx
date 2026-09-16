import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { resolveTenantPath } from '../utils/routeBuilder';

const PAYMENT_MODES = ['Cash', 'Cheque', 'UPI / Online', 'Net Banking', 'Demand Draft'];
const WAIVER_REASONS = [
  'Merit / High Academic Performance',
  'Sibling / Multi-Child Concession',
  'Staff Child Concession',
  'Economically Weaker Section (EWS)',
  'Sports / Co-curricular Excellence',
  'Principal Special Relief',
  'Other'
];

export default function ProvisionalAdmissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Collect Fee & Confirm Modal State
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [loadingFeePlan, setLoadingFeePlan] = useState(false);
  const [admissionFeeData, setAdmissionFeeData] = useState(null);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState(null);
  const [customFeeAmounts, setCustomFeeAmounts] = useState({});
  const [isCustomizingFees, setIsCustomizingFees] = useState(false);
  const [customFeeList, setCustomFeeList] = useState([]);
  const [showAddCustomFee, setShowAddCustomFee] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({ name: '', category: 'ACADEMIC', amount: '', is_recurring: false });

  // Optional Services
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [transportStops, setTransportStops] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [hostelPlans, setHostelPlans] = useState([]);

  const [serviceForm, setServiceForm] = useState({
    transport_required: 'No',
    transport_route_id: '',
    transport_stop_id: '',
    hostel_required: 'No',
    hostel_id: '',
    hostel_fee_structure_id: '',
    hostel_monthly_fee: '',
    hostel_deposit: '',
    library_required: 'No',
    library_fee: '',
  });

  // Concessions & Payment Collection
  const [manualWaiver, setManualWaiver] = useState(0);
  const [waiverReason, setWaiverReason] = useState('Principal Special Relief');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payRemarks, setPayRemarks] = useState('Admission fee clearance & confirmation');
  const [processingPay, setProcessingPay] = useState(false);
  const [existingPendingRecord, setExistingPendingRecord] = useState(null);

  // Cancel / Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resStudents, resClasses] = await Promise.all([
        api.get('/principal/students?status=PROVISIONAL'),
        api.get('/principal/classes')
      ]);
      const stList = Array.isArray(resStudents.data) ? resStudents.data : (resStudents.data.data || []);
      setStudents(stList);
      setClasses(resClasses.data || []);
    } catch (err) {
      toast.error('Failed to load provisional admissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter students
  const filtered = students.filter(s => {
    const sName = (s.name || '').toLowerCase();
    const pNo = (s.provisional_no || s.admission_no || '').toLowerCase();
    const phone = (s.parent_phone || '').toLowerCase();
    const fName = (s.father_name || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = !query || sName.includes(query) || pNo.includes(query) || phone.includes(query) || fName.includes(query);
    const matchesClass = !classFilter || String(s.class_id) === String(classFilter);

    return matchesSearch && matchesClass;
  });

  // Open Full Admission Fee & Services Modal
  const openConfirmModal = async (student) => {
    setConfirmTarget(student);
    setLoadingFeePlan(true);
    setCustomFeeAmounts({});
    setIsCustomizingFees(false);
    setCustomFeeList([]);
    setShowAddCustomFee(false);
    setManualWaiver(0);
    setWaiverReason('Principal Special Relief');
    setPayMode('Cash');
    setPayRef('');
    setPayRemarks('Admission fee clearance & confirmation');
    setExistingPendingRecord(null);

    setServiceForm({
      transport_required: student.transport_required || 'No',
      transport_route_id: student.transport_route_id || '',
      transport_stop_id: student.transport_stop_id || '',
      hostel_required: student.hostel_required || 'No',
      hostel_id: student.hostel_id || '',
      hostel_fee_structure_id: '',
      hostel_monthly_fee: '',
      hostel_deposit: '',
      library_required: student.library_required || 'No',
      library_fee: '',
    });

    try {
      const classId = student.class_id;
      const session = student.session || '2026-27';

      // 1. Fetch Official Fee Plan for Class & Session
      const feePlanPromise = api.get(`/fees-finance/admission-fee-plan?class_id=${classId}&session=${session}`).catch(() => null);

      // 2. Fetch Transport Routes
      const transPromise = api.get('/transport/routes?include_stops=true').catch(() => null);

      // 3. Fetch Hostels
      const hostelPromise = api.get('/hostel/hostels').catch(() => null);
      const hostelPlansPromise = api.get('/hostel/fee-structures').catch(() => null);

      // 4. Check for any existing fee records using reliable endpoints
      const recordsPromise = api.get(`/principal/fees/records?student_id=${student.id}`).catch(() => null);

      const [feePlanRes, transRes, hostelRes, hPlansRes, recsRes] = await Promise.all([
        feePlanPromise,
        transPromise,
        hostelPromise,
        hostelPlansPromise,
        recordsPromise
      ]);

      if (feePlanRes?.data) {
        setAdmissionFeeData(feePlanRes.data);
        if (feePlanRes.data.transport_routes?.length > 0) {
          setTransportRoutes(feePlanRes.data.transport_routes);
        }
        if (feePlanRes.data.hostels?.length > 0) {
          setHostels(feePlanRes.data.hostels);
        }
        if (feePlanRes.data.hostel_plans?.length > 0) {
          setHostelPlans(feePlanRes.data.hostel_plans);
        }
        if (feePlanRes.data.payment_plans?.length > 0) {
          const def = feePlanRes.data.payment_plans.find(p => p.code === 'MONTHLY' || p.months_count === 1) || feePlanRes.data.payment_plans[0];
          setSelectedPaymentPlan(def);
        }
      }

      if (transRes?.data) {
        const raw = transRes.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.routes) ? raw.routes : [];
        if (arr.length > 0) setTransportRoutes(arr);
      }

      if (hostelRes?.data) {
        const raw = hostelRes.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.hostels) ? raw.hostels : [];
        if (arr.length > 0) setHostels(arr);
      }

      if (hPlansRes?.data) {
        const raw = hPlansRes.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        if (arr.length > 0) setHostelPlans(arr);
      }

      if (recsRes?.data) {
        const recList = recsRes.data?.records || recsRes.data?.data || (Array.isArray(recsRes.data) ? recsRes.data : []);
        const pending = recList.find(r => r.status !== 'PAID' && (r.due_amount > 0 || r.amount > (r.amount_paid || 0)));
        if (pending) setExistingPendingRecord(pending);
      }

    } catch (err) {
      console.warn('Error preparing confirmation modal:', err);
    } finally {
      setLoadingFeePlan(false);
    }
  };

  // Fee calculation engine matching NewAdmissionPage
  const publishedStructure = admissionFeeData?.class_fee_structure || admissionFeeData?.published_structure;
  const paymentPlans = admissionFeeData?.payment_plans || [];
  const monthsCount = selectedPaymentPlan?.months_count || 1;

  const selectedRoute = Array.isArray(transportRoutes) ? transportRoutes.find(r => String(r.id) === String(serviceForm.transport_route_id)) : undefined;
  const selectedStop = Array.isArray(transportStops) ? transportStops.find(s => String(s.id) === String(serviceForm.transport_stop_id)) : undefined;
  const selectedHostel = Array.isArray(hostels) ? hostels.find(h => String(h.id) === String(serviceForm.hostel_id)) : undefined;
  const selectedHostelPlan = Array.isArray(hostelPlans) ? hostelPlans.find(p => String(p.id) === String(serviceForm.hostel_fee_structure_id)) : undefined;

  const transportMonthlyRate = serviceForm.transport_required === 'Yes'
    ? Number(selectedRoute?.fare || selectedRoute?.fee_amount || selectedStop?.pickup_charge || 0)
    : 0;
  const transportRecurringTotal = transportMonthlyRate * monthsCount;

  const hostelMonthlyRate = serviceForm.hostel_required === 'Yes'
    ? (selectedHostelPlan ? Number(selectedHostelPlan.total_monthly || selectedHostelPlan.monthly_fee || 0) : Number(serviceForm.hostel_monthly_fee || 0))
    : 0;
  const hostelDeposit = serviceForm.hostel_required === 'Yes'
    ? (selectedHostelPlan ? Number(selectedHostelPlan.security_deposit || 0) : Number(serviceForm.hostel_deposit || 0))
    : 0;
  const hostelRecurringTotal = hostelMonthlyRate * monthsCount;
  const hostelTotalCharge = hostelRecurringTotal + hostelDeposit;

  const defaultLibRate = admissionFeeData?.fee_heads?.find(h => h.code === 'LIBRARY' || h.category === 'LIBRARY')?.default_amount || 150;
  const libraryCharge = serviceForm.library_required === 'Yes' ? Number(serviceForm.library_fee || defaultLibRate) : 0;

  let baseGross = 0;
  let eligibleBase = 0;
  let eligibleCats = ['ACADEMIC'];
  try {
    if (selectedPaymentPlan?.eligible_categories) {
      eligibleCats = typeof selectedPaymentPlan.eligible_categories === 'string'
        ? JSON.parse(selectedPaymentPlan.eligible_categories)
        : selectedPaymentPlan.eligible_categories;
    }
  } catch {
    eligibleCats = ['ACADEMIC'];
  }

  const computedItems = (publishedStructure?.items || []).map(it => {
    const headName = it.fee_head?.name || it.fee_head_name || it.name || 'Tuition Fee';
    const headCategory = it.fee_head?.category || it.department || 'ACADEMIC';
    const isOneTime = it.fee_head?.default_frequency === 'ONE_TIME' ||
      it.fee_head?.is_recurring === false ||
      /admission|registration|caution|deposit|security/i.test(headName);
    const mult = isOneTime ? 1 : monthsCount;
    const rate = customFeeAmounts[it.id] !== undefined ? Number(customFeeAmounts[it.id] || 0) : Number(it.amount || 0);
    const lineAmt = rate * mult;
    baseGross += lineAmt;
    if (eligibleCats.includes(headCategory)) {
      eligibleBase += lineAmt;
    }
    return {
      ...it,
      headName,
      headCategory,
      isOneTime,
      rate,
      mult,
      lineAmt,
    };
  });

  let customItemsGross = 0;
  const computedCustomItems = customFeeList.map(item => {
    const isOneTime = !item.is_recurring;
    const mult = isOneTime ? 1 : monthsCount;
    const rate = Number(item.amount || 0);
    const lineAmt = rate * mult;
    customItemsGross += lineAmt;
    if (eligibleCats.includes(item.category || 'ACADEMIC')) {
      eligibleBase += lineAmt;
    }
    return {
      ...item,
      isOneTime,
      rate,
      mult,
      lineAmt,
    };
  });

  if ((!publishedStructure || computedItems.length === 0) && confirmTarget?.admission_fee) {
    const legacyAmt = Number(confirmTarget.admission_fee || 0);
    baseGross = legacyAmt;
    eligibleBase = legacyAmt;
  } else if (!publishedStructure && computedItems.length === 0) {
    // Fallback default tuition fee if no published structure configured yet
    baseGross = 5000;
    eligibleBase = 5000;
  }

  const grossTotal = baseGross + customItemsGross + transportRecurringTotal + hostelTotalCharge + libraryCharge;

  let advanceDiscount = 0;
  if (selectedPaymentPlan && Number(selectedPaymentPlan.discount_value) > 0 && eligibleBase > 0) {
    if (selectedPaymentPlan.discount_type === 'PERCENTAGE') {
      advanceDiscount = Math.round((eligibleBase * Number(selectedPaymentPlan.discount_value)) / 100);
    } else {
      advanceDiscount = Math.min(eligibleBase, Number(selectedPaymentPlan.discount_value));
    }
  }

  const waiverNum = Math.max(0, parseFloat(manualWaiver) || 0);
  const totalDeductions = advanceDiscount + waiverNum;
  const netPayable = Math.max(0, grossTotal - totalDeductions);

  // Sync default payAmount when netPayable calculates
  useEffect(() => {
    if (confirmTarget) {
      setPayAmount(String(netPayable));
    }
  }, [confirmTarget, netPayable]);

  // Submit Collect & Confirm Admission
  const handleConfirmAdmission = async (e) => {
    e.preventDefault();
    if (!confirmTarget) return;

    setProcessingPay(true);
    const collectedAmount = payAmount !== '' ? (parseFloat(payAmount) || 0) : netPayable;

    const payload = {
      student_id: confirmTarget.id,
      transport_required: serviceForm.transport_required,
      transport_route_id: serviceForm.transport_route_id || null,
      transport_stop_id: serviceForm.transport_stop_id || null,
      hostel_required: serviceForm.hostel_required,
      hostel_id: serviceForm.hostel_id || null,
      library_required: serviceForm.library_required,
      amount_paid: collectedAmount,
      payment_mode: payMode,
      remarks: payRemarks,
      reference: payRef,
      fee_setup: {
        fee_structure_id: publishedStructure?.id || null,
        payment_plan_id: selectedPaymentPlan?.id || null,
        months_count: monthsCount,
        transport_fee: serviceForm.transport_required === 'Yes' ? transportMonthlyRate : 0,
        hostel_fee: serviceForm.hostel_required === 'Yes' ? hostelMonthlyRate : 0,
        hostel_deposit: serviceForm.hostel_required === 'Yes' ? hostelDeposit : 0,
        library_fee: serviceForm.library_required === 'Yes' ? libraryCharge : 0,
        manual_waiver: waiverNum,
        waiver_reason: waiverNum > 0 ? waiverReason : '',
        net_payable: netPayable,
        initial_payment_amount: collectedAmount,
        payment_mode: payMode,
        payment_status: collectedAmount >= netPayable ? 'PAID' : (collectedAmount > 0 ? 'PARTIAL' : 'DUE'),
        payment_reference: payRef,
      }
    };

    try {
      let officialAdmNo = null;

      // 1. Try dedicated confirm-admission endpoint first
      try {
        const res = await api.post(`/principal/students/${confirmTarget.id}/confirm-admission`, payload);
        officialAdmNo = res.data?.admission_no || res.data?.student?.admission_no;
      } catch (endpointErr) {
        // If endpoint returned 404 (prior to Render deployment), gracefully fall back to collect/fee APIs
        if (endpointErr.response?.status === 404) {
          // Optional transport enrollment fallback
          if (serviceForm.transport_required === 'Yes' && serviceForm.transport_route_id) {
            await api.patch(`/principal/students/${confirmTarget.id}`, {
              transport_required: 'Yes',
              transport_route_id: serviceForm.transport_route_id,
              transport_stop_id: serviceForm.transport_stop_id || null
            }).catch(() => {});
          }

          // Settle payment on existing record or create payment
          if (existingPendingRecord && existingPendingRecord.id) {
            const payRes = await api.post('/principal/fees/collect', {
              record_id: existingPendingRecord.id,
              amount_paid: collectedAmount,
              payment_mode: payMode,
              remarks: payRemarks,
              reference: payRef
            });
            officialAdmNo = payRes.data?.student_admission_no;
          } else {
            const payRes = await api.post('/principal/fees', {
              student_id: confirmTarget.id,
              fee_type: 'ADMISSION',
              amount: netPayable > 0 ? netPayable : collectedAmount,
              amount_paid: collectedAmount,
              payment_mode: payMode,
              remarks: payRemarks,
              status: collectedAmount >= netPayable && netPayable > 0 ? 'PAID' : 'PARTIAL'
            });
            officialAdmNo = payRes.data?.student_admission_no;
          }
        } else {
          throw endpointErr;
        }
      }

      toast.success(
        `🎉 Admission Confirmed! ${officialAdmNo ? `Permanent Admission No: ${officialAdmNo}` : 'Status updated to ACTIVE'}`,
        { duration: 6000 }
      );

      setConfirmTarget(null);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Payment collection and confirmation failed';
      toast.error(msg);
    } finally {
      setProcessingPay(false);
    }
  };

  // Cancel / Delete unconfirmed application
  const handleDeleteProvisional = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/principal/students/${deleteTarget.id}`, {
        data: { reason: 'Provisional application cancelled / applicant withdrew' }
      });
      toast.success('Provisional application removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove application');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Provisional Admissions & Confirmation" />

        <div className="page-body" style={{ maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: 16,
            padding: '24px 28px',
            color: '#fff',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.15)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 26 }}>⏳</span>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                  Provisional Admissions (Unconfirmed)
                </h1>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 12px',
                  borderRadius: 20,
                  border: '1px solid #fde68a'
                }}>
                  {students.length} Pending Clearance
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 740, lineHeight: 1.5 }}>
                These applicants registered with admission fees skipped or pending. They hold a temporary <strong>PROV-</strong> identifier and are strictly isolated from regular student rosters, attendance, and official school counts until confirmed.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate(resolveTenantPath('/students', user))}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
              >
                <i className="ti ti-arrow-left" /> Back to Confirmed Students
              </button>
              <button
                type="button"
                onClick={() => navigate(resolveTenantPath('/admission', user))}
                style={{
                  background: 'linear-gradient(135deg, #0176d3 0%, #0B3B7B 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(11, 59, 123, 0.3)'
                }}
              >
                <i className="ti ti-plus" /> + New Admission
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Provisional</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{students.length}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Awaiting initial admission fee</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permanent Admission No</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>Locked 🔒</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Assigned upon fee clearance</div>
            </div>

            <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Billing Status</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>Excluded ✅</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Safe from monthly fee runs</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            border: '1px solid #e2e8f0',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by student, provisional no, father, phone..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Applied Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadData}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <i className="ti ti-refresh" /> Refresh
            </button>
          </div>

          {/* Provisional Students Table */}
          <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                <i className="ti ti-loader animate-spin" style={{ fontSize: 28, color: '#0176d3' }} />
                <p style={{ marginTop: 12, fontSize: 14 }}>Loading provisional applicants...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 44 }}>🎉</span>
                <h3 style={{ margin: '12px 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>No Provisional Admissions Pending</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440, marginInline: 'auto' }}>
                  {search || classFilter ? 'No applicants match the filter criteria.' : 'All enrolled students have confirmed admissions and fees paid! No pending provisional applications.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Provisional No</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Student Details</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Applied Class</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Parent Contact</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, idx) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            onClick={() => navigate(`/students/${s.id}`)}
                            title="Click to view student profile"
                            style={{
                              display: 'inline-block',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: 12,
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: '1px solid #fde68a',
                              cursor: 'pointer'
                            }}
                          >
                            {s.provisional_no || s.admission_no}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div
                            style={{ fontWeight: 700, color: '#0176d3', cursor: 'pointer' }}
                            onClick={() => navigate(`/students/${s.id}`)}
                            title="Click to view student profile"
                          >
                            {s.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Father: {s.father_name || '—'}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                            {s.class_name ? `${s.class_name}${s.section ? ' - ' + s.section : ''}` : (s.class_display || '—')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#334155' }}>{s.parent_phone || '—'}</div>
                          {s.parent_email && <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.parent_email}</div>}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontWeight: 600,
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 12,
                            border: '1px solid #fecaca'
                          }}>
                            <i className="ti ti-alert-circle" /> Fee Due (Unconfirmed)
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => openConfirmModal(s)}
                              title="Collect Admission Fee & Confirm Admission"
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 14px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 1px 4px rgba(5, 150, 105, 0.25)'
                              }}
                            >
                              <i className="ti ti-cash" /> Collect &amp; Confirm
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(resolveTenantPath(`/students/${s.id}`, user))}
                              title="Open Full Student Profile"
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '6px 11px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <i className="ti ti-user" /> Profile
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              title="Cancel Provisional Application"
                              style={{
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                padding: '6px 9px',
                                fontSize: 12,
                                cursor: 'pointer'
                              }}
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
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          COMPREHENSIVE ADMISSION FEE & SERVICES CONFIRMATION MODAL
          Matching NewAdmissionPage Fee & Services Layout Exactly
         ═══════════════════════════════════════════════════════════════════════ */}
      {confirmTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 1040,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #cbd5e1',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0B3B7B 0%, #1e40af 100%)',
              color: '#ffffff',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                    Fee Payment, Services &amp; Admission Confirmation
                  </h3>
                </div>
                <div style={{ fontSize: 12, opacity: 0.88, marginTop: 3 }}>
                  Configure fee particulars, transport/hostel services, and collect payment to promote student to <strong>ACTIVE</strong> with official <strong>ADM-</strong> number.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              
              {/* Student Recap Chip */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 18px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: '#334155' }}>
                  <div>👤 <strong>{confirmTarget.name}</strong></div>
                  <div>👨 Father: <strong>{confirmTarget.father_name || '—'}</strong></div>
                  <div>🎓 Applied Class: <strong>{confirmTarget.class_name ? `${confirmTarget.class_name}${confirmTarget.section ? ' - ' + confirmTarget.section : ''}` : (confirmTarget.class_display || 'Class')}</strong></div>
                  <div>📱 <strong>{confirmTarget.parent_phone || '—'}</strong></div>
                </div>
                <span style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #fde68a'
                }}>
                  {confirmTarget.provisional_no || confirmTarget.admission_no}
                </span>
              </div>

              {/* Payment Cadence Selector */}
              {paymentPlans.length > 0 && (
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#0B3B7B' }}>
                      📅 Payment Cadence &amp; Duration (Default: 1 Month):
                    </label>
                    {selectedPaymentPlan && Number(selectedPaymentPlan.discount_value) > 0 && (
                      <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                        🎁 {selectedPaymentPlan.discount_type === 'PERCENTAGE' ? `${selectedPaymentPlan.discount_value}% Discount` : `₹${selectedPaymentPlan.discount_value} Discount`} on Academic Heads
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(paymentPlans.length || 1, 4)}, 1fr)`, gap: 8 }}>
                    {paymentPlans.map(plan => {
                      const isSelected = selectedPaymentPlan?.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPaymentPlan(plan)}
                          style={{
                            padding: '9px 8px',
                            borderRadius: 8,
                            border: isSelected ? '2px solid #0B3B7B' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#fff',
                            color: isSelected ? '#0B3B7B' : '#334155',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: 12,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>{plan.name}</div>
                          <div style={{ fontSize: 10.5, color: isSelected ? '#0284c7' : '#64748b', marginTop: 2 }}>
                            {plan.months_count} Month{plan.months_count > 1 ? 's' : ''}
                          </div>
                          {Number(plan.discount_value) > 0 && (
                            <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 3 }}>
                              {plan.discount_type === 'PERCENTAGE' ? `${plan.discount_value}% Off` : `₹${plan.discount_value} Off`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2-COLUMN LAYOUT: Left (Itemized Particulars) vs Right (Services & Payment) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 20, marginBottom: 18 }}>
                
                {/* ── LEFT COLUMN: Itemized Breakdown Table & Concessions ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                        Itemized Particulars ({monthsCount} Month{monthsCount > 1 ? 's' : ''})
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {Object.keys(customFeeAmounts).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCustomFeeAmounts({})}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Reset Rates
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAddCustomFee(s => !s)}
                          style={{
                            background: '#10b98115',
                            color: '#059669',
                            border: '1px solid #10b98150',
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          + Add Fee Item
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomizingFees(v => !v)}
                          style={{
                            background: isCustomizingFees ? '#0B3B7B' : '#fff',
                            color: isCustomizingFees ? '#fff' : '#0B3B7B',
                            border: '1px solid #0B3B7B',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isCustomizingFees ? '✓ Done' : '✏️ Edit Rates'}
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: '8px 14px', fontSize: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', fontSize: 11, borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                            <th style={{ padding: '6px 0' }}>Fee Head</th>
                            <th style={{ padding: '6px 0' }}>Category</th>
                            <th style={{ padding: '6px 0', textAlign: 'center' }}>Rate (₹)</th>
                            <th style={{ padding: '6px 0', textAlign: 'center' }}>Mult</th>
                            <th style={{ padding: '6px 0', textAlign: 'right' }}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Inline Add Fee Item Form */}
                          {showAddCustomFee && (
                            <tr style={{ background: '#ecfdf5', borderBottom: '2px solid #a7f3d0' }}>
                              <td colSpan={5} style={{ padding: '10px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <input
                                    type="text"
                                    placeholder="Fee Item Name (e.g. Uniform, Books)"
                                    value={newCustomItem.name}
                                    onChange={e => setNewCustomItem(prev => ({ ...prev, name: e.target.value }))}
                                    style={{ flex: 2, minWidth: 140, padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 11.5 }}
                                  />
                                  <select
                                    value={newCustomItem.category}
                                    onChange={e => setNewCustomItem(prev => ({ ...prev, category: e.target.value }))}
                                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 11.5, background: '#fff' }}
                                  >
                                    <option value="ACADEMIC">ACADEMIC</option>
                                    <option value="AUXILIARY">AUXILIARY</option>
                                    <option value="ONE_TIME">ONE_TIME</option>
                                    <option value="ACTIVITY">ACTIVITY</option>
                                  </select>
                                  <select
                                    value={newCustomItem.is_recurring ? 'RECURRING' : 'ONE_TIME'}
                                    onChange={e => setNewCustomItem(prev => ({ ...prev, is_recurring: e.target.value === 'RECURRING' }))}
                                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 11.5, background: '#fff' }}
                                  >
                                    <option value="ONE_TIME">One-Time</option>
                                    <option value="RECURRING">Monthly</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="Rate (₹)"
                                    value={newCustomItem.amount}
                                    onChange={e => setNewCustomItem(prev => ({ ...prev, amount: e.target.value }))}
                                    style={{ width: 75, padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 11.5 }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!newCustomItem.name.trim() || !newCustomItem.amount) {
                                        toast.error('Enter item name and amount');
                                        return;
                                      }
                                      setCustomFeeList(prev => [...prev, { ...newCustomItem, id: Date.now() }]);
                                      setNewCustomItem({ name: '', category: 'ACADEMIC', amount: '', is_recurring: false });
                                      setShowAddCustomFee(false);
                                      toast.success('Fee item added');
                                    }}
                                    style={{ background: '#059669', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    ✓ Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddCustomFee(false)}
                                    style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '5px 6px', fontSize: 11.5, cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}

                          {computedItems.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '7px 0', fontWeight: 600, color: '#1e293b' }}>
                                {it.headName}
                                <span style={{
                                  fontSize: 9.5, padding: '1px 5px', borderRadius: 4,
                                  background: it.isOneTime ? '#fef3c7' : '#e0f2fe',
                                  color: it.isOneTime ? '#92400e' : '#0369a1',
                                  fontWeight: 700, marginLeft: 6
                                }}>
                                  {it.isOneTime ? 'ONE-TIME' : 'MONTHLY'}
                                </span>
                              </td>
                              <td style={{ padding: '7px 0', color: '#64748b', fontSize: 11 }}>
                                {it.headCategory}
                              </td>
                              <td style={{ padding: '7px 0', textAlign: 'center' }}>
                                {isCustomizingFees ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={customFeeAmounts[it.id] !== undefined ? customFeeAmounts[it.id] : (it.amount || 0)}
                                    onChange={e => {
                                      const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                                      setCustomFeeAmounts(prev => ({ ...prev, [it.id]: v }));
                                    }}
                                    style={{
                                      width: 75,
                                      padding: '3px 6px',
                                      borderRadius: 4,
                                      border: '1.5px solid #0284c7',
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      background: '#f0f9ff'
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: customFeeAmounts[it.id] !== undefined ? '#0284c7' : '#64748b', fontWeight: customFeeAmounts[it.id] !== undefined ? 700 : 500 }}>
                                    ₹ {it.rate.toLocaleString('en-IN')}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: it.isOneTime ? '#64748b' : '#0284c7', fontWeight: 700 }}>
                                × {it.mult} {it.isOneTime ? '(Fixed)' : ''}
                              </td>
                              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                ₹ {it.lineAmt.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}

                          {/* Custom Added Fee Items */}
                          {computedCustomItems.map(cit => (
                            <tr key={cit.id} style={{ borderBottom: '1px solid #ecfdf5', background: '#f0fdf4' }}>
                              <td style={{ padding: '7px 0', fontWeight: 600, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>✦ {cit.name}</span>
                                <span style={{
                                  fontSize: 9.5, padding: '1px 5px', borderRadius: 4,
                                  background: cit.isOneTime ? '#fef3c7' : '#e0f2fe',
                                  color: cit.isOneTime ? '#92400e' : '#0369a1',
                                  fontWeight: 700
                                }}>
                                  {cit.isOneTime ? 'ONE-TIME' : 'MONTHLY'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCustomFeeList(prev => prev.filter(x => x.id !== cit.id))}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                                  title="Remove Item"
                                >
                                  ✕
                                </button>
                              </td>
                              <td style={{ padding: '7px 0', color: '#059669', fontSize: 11 }}>{cit.category}</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: '#065f46' }}>₹ {cit.rate.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: cit.isOneTime ? '#64748b' : '#0284c7', fontWeight: 700 }}>
                                × {cit.mult} {cit.isOneTime ? '(Fixed)' : ''}
                              </td>
                              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#065f46' }}>
                                ₹ {cit.lineAmt.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}

                          {/* Transport Add-On Item */}
                          {serviceForm.transport_required === 'Yes' && (
                            <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f0f9ff' }}>
                              <td style={{ padding: '7px 0', fontWeight: 600, color: '#0284c7' }}>
                                🚌 Transport Fee ({selectedRoute?.route_name || 'Assigned Route'})
                                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, marginLeft: 6 }}>MONTHLY</span>
                              </td>
                              <td style={{ padding: '7px 0', color: '#0284c7', fontSize: 11 }}>TRANSPORT</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b' }}>₹ {transportMonthlyRate.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: '#0284c7', fontWeight: 700 }}>× {monthsCount}</td>
                              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                                ₹ {transportRecurringTotal.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          )}

                          {/* Hostel Add-On Item */}
                          {serviceForm.hostel_required === 'Yes' && (
                            <>
                              <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f0f9ff' }}>
                                <td style={{ padding: '7px 0', fontWeight: 600, color: '#0284c7' }}>
                                  🛏️ Hostel Rent ({selectedHostel?.name || 'Hostel'})
                                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, marginLeft: 6 }}>MONTHLY</span>
                                </td>
                                <td style={{ padding: '7px 0', color: '#0284c7', fontSize: 11 }}>HOSTEL</td>
                                <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b' }}>₹ {hostelMonthlyRate.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '7px 0', textAlign: 'center', color: '#0284c7', fontWeight: 700 }}>× {monthsCount}</td>
                                <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                                  ₹ {hostelRecurringTotal.toLocaleString('en-IN')}
                                </td>
                              </tr>
                              {hostelDeposit > 0 && (
                                <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f0f9ff' }}>
                                  <td style={{ padding: '7px 0', fontWeight: 600, color: '#0284c7' }}>
                                    🛡️ Hostel Security Deposit ({selectedHostel?.name || 'Hostel'})
                                    <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700, marginLeft: 6 }}>ONE-TIME</span>
                                  </td>
                                  <td style={{ padding: '7px 0', color: '#0284c7', fontSize: 11 }}>HOSTEL</td>
                                  <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b' }}>₹ {hostelDeposit.toLocaleString('en-IN')}</td>
                                  <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>× 1 (Fixed)</td>
                                  <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                                    ₹ {hostelDeposit.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              )}
                            </>
                          )}

                          {/* Library Add-On Item */}
                          {serviceForm.library_required === 'Yes' && (
                            <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f0f9ff' }}>
                              <td style={{ padding: '7px 0', fontWeight: 600, color: '#0284c7' }}>
                                📚 Library Membership Fee
                              </td>
                              <td style={{ padding: '7px 0', color: '#0284c7', fontSize: 11 }}>LIBRARY</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b' }}>₹ {libraryCharge}</td>
                              <td style={{ padding: '7px 0', textAlign: 'center', color: '#64748b' }}>× 1</td>
                              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                                ₹ {libraryCharge.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          )}

                          {/* Gross Demand Subtotal */}
                          <tr style={{ borderTop: '2px solid #cbd5e1' }}>
                            <td colSpan={4} style={{ padding: '8px 0', fontWeight: 700, color: '#475569' }}>
                              Gross Admission Demand:
                            </td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: 13 }}>
                              ₹ {grossTotal.toLocaleString('en-IN')}.00
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Concession / Special Waiver */}
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0B3B7B', marginBottom: 8 }}>
                      🏷️ Concession / Special Waiver
                    </div>

                    {advanceDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '6px 10px', background: '#dcfce7', borderRadius: 6, border: '1px solid #86efac' }}>
                        <span style={{ fontSize: 11.5, color: '#166534', fontWeight: 600 }}>
                          🎁 {selectedPaymentPlan?.name} Advance Discount:
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d' }}>
                          - ₹ {advanceDiscount.toLocaleString('en-IN')}.00
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                          Waiver (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={grossTotal}
                          value={manualWaiver}
                          onChange={e => setManualWaiver(Math.max(0, parseFloat(e.target.value) || 0))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, textAlign: 'right', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                          Waiver Reason {waiverNum > 0 && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>
                        <select
                          value={waiverReason}
                          onChange={e => setWaiverReason(e.target.value)}
                          disabled={waiverNum <= 0}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: 11.5,
                            background: waiverNum <= 0 ? '#f1f5f9' : '#fff',
                            boxSizing: 'border-box'
                          }}
                        >
                          {WAIVER_REASONS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN: Optional Services + Payment Collection ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* OPTIONAL SERVICES SECTION */}
                  <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🛡️</span> Optional Services (Transport / Hostel / Library)
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      
                      {/* Transport Box */}
                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: serviceForm.transport_required === 'Yes' ? '1.5px solid #0284c7' : '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: serviceForm.transport_required === 'Yes' ? 8 : 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🚌</span> School Bus Transport
                          </div>
                          <select
                            value={serviceForm.transport_required}
                            onChange={e => {
                              const val = e.target.value;
                              setServiceForm(prev => ({
                                ...prev,
                                transport_required: val,
                                transport_route_id: val === 'No' ? '' : prev.transport_route_id,
                                transport_stop_id: val === 'No' ? '' : prev.transport_stop_id,
                              }));
                            }}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No (Day Scholar)</option>
                            <option value="Yes">Yes, Opt-In for Bus</option>
                          </select>
                        </div>

                        {serviceForm.transport_required === 'Yes' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                                Select Bus Route *
                              </label>
                              <select
                                value={serviceForm.transport_route_id}
                                onChange={e => {
                                  const rId = e.target.value;
                                  setServiceForm(prev => ({
                                    ...prev,
                                    transport_route_id: rId,
                                    transport_stop_id: ''
                                  }));
                                }}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, background: '#fff' }}
                              >
                                <option value="">-- Choose Bus Route --</option>
                                {Array.isArray(transportRoutes) && transportRoutes.map(r => {
                                  const fare = r.fare || r.fee_amount || 0;
                                  return (
                                    <option key={r.id} value={r.id}>
                                      {r.route_name || r.name || `Route #${r.id}`}{fare > 0 ? ` (₹${fare}/mo)` : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {serviceForm.transport_route_id && (
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                                  Pickup / Drop Bus Stop (Optional)
                                </label>
                                <select
                                  value={serviceForm.transport_stop_id}
                                  onChange={e => setServiceForm(prev => ({ ...prev, transport_stop_id: e.target.value }))}
                                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, background: '#fff' }}
                                >
                                  <option value="">-- Select Stop (or assign later) --</option>
                                  {(selectedRoute?.stops && selectedRoute.stops.length > 0 ? selectedRoute.stops : transportStops).map((s, idx) => {
                                    const sId = s.stop_id || s.id;
                                    const sName = s.stop_name || s.name || `Stop #${sId}`;
                                    return <option key={sId || idx} value={sId}>{sName}</option>;
                                  })}
                                </select>
                              </div>
                            )}

                            {transportMonthlyRate > 0 && (
                              <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>
                                ✓ Added: ₹{transportMonthlyRate}/mo (₹{transportRecurringTotal} for {monthsCount} mo)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Hostel Box */}
                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: serviceForm.hostel_required === 'Yes' ? '1.5px solid #0284c7' : '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: serviceForm.hostel_required === 'Yes' ? 8 : 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🏢</span> Hostel Facility
                          </div>
                          <select
                            value={serviceForm.hostel_required}
                            onChange={e => {
                              const val = e.target.value;
                              setServiceForm(prev => ({
                                ...prev,
                                hostel_required: val,
                                hostel_id: val === 'No' ? '' : prev.hostel_id,
                                hostel_fee_structure_id: val === 'No' ? '' : prev.hostel_fee_structure_id,
                                hostel_monthly_fee: val === 'No' ? '' : prev.hostel_monthly_fee,
                                hostel_deposit: val === 'No' ? '' : prev.hostel_deposit,
                              }));
                            }}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No (Day Scholar)</option>
                            <option value="Yes">Yes, Hostel Boarder</option>
                          </select>
                        </div>

                        {serviceForm.hostel_required === 'Yes' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                                Hostel Building / Wing *
                              </label>
                              <select
                                value={serviceForm.hostel_id}
                                onChange={e => {
                                  const hId = e.target.value;
                                  setServiceForm(prev => ({
                                    ...prev,
                                    hostel_id: hId,
                                    hostel_fee_structure_id: '',
                                    hostel_monthly_fee: '',
                                    hostel_deposit: ''
                                  }));
                                }}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, background: '#fff' }}
                              >
                                <option value="">-- Select Hostel --</option>
                                {Array.isArray(hostels) && hostels.map(h => (
                                  <option key={h.id} value={h.id}>{h.name} ({h.hostel_type || h.gender_type || 'Co-Ed'})</option>
                                ))}
                              </select>
                            </div>

                            {serviceForm.hostel_id && (
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                                  Room Type &amp; Pricing Plan *
                                </label>
                                <select
                                  value={serviceForm.hostel_fee_structure_id}
                                  onChange={e => {
                                    const fsId = e.target.value;
                                    const plan = hostelPlans.find(p => String(p.id) === String(fsId));
                                    setServiceForm(prev => ({
                                      ...prev,
                                      hostel_fee_structure_id: fsId,
                                      hostel_monthly_fee: plan ? (plan.total_monthly || plan.monthly_fee || 0) : '',
                                      hostel_deposit: plan ? (plan.security_deposit || 0) : '',
                                    }));
                                  }}
                                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, background: '#fff' }}
                                >
                                  <option value="">-- Choose Room Type --</option>
                                  {hostelPlans
                                    .filter(p => !serviceForm.hostel_id || String(p.hostel_id) === String(serviceForm.hostel_id) || !p.hostel_id)
                                    .map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.sharing_type} {p.is_ac ? '(AC)' : '(Non-AC)'} — ₹{(p.total_monthly || p.monthly_fee || 0).toLocaleString('en-IN')}/mo
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}

                            {hostelMonthlyRate > 0 && (
                              <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>
                                ✓ Added: ₹{hostelMonthlyRate}/mo {hostelDeposit > 0 ? `+ ₹${hostelDeposit} deposit` : ''}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Library Box */}
                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: serviceForm.library_required === 'Yes' ? '1.5px solid #0284c7' : '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📚</span> Library Card
                          </div>
                          <select
                            value={serviceForm.library_required}
                            onChange={e => setServiceForm(prev => ({ ...prev, library_required: e.target.value }))}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No Library Card</option>
                            <option value="Yes">Yes, Issue Card</option>
                          </select>
                        </div>
                        {serviceForm.library_required === 'Yes' && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 11, color: '#475569' }}>Card Fee (₹):</label>
                            <input
                              type="number"
                              value={serviceForm.library_fee || defaultLibRate}
                              onChange={e => setServiceForm(prev => ({ ...prev, library_fee: e.target.value }))}
                              style={{ width: 80, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5 }}
                            />
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* NET PAYABLE BANNER */}
                  <div style={{
                    background: 'linear-gradient(135deg, #0B3B7B 0%, #1e40af 100%)',
                    color: '#fff',
                    padding: '14px 18px',
                    borderRadius: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 12px rgba(11,59,123,0.2)'
                  }}>
                    <div>
                      <div style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 600 }}>Total Net Admission Payable</div>
                      <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>
                        Gross ₹ {grossTotal.toLocaleString('en-IN')} {totalDeductions > 0 ? `— Deductions ₹ ${totalDeductions.toLocaleString('en-IN')}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>
                      ₹ {netPayable.toLocaleString('en-IN')}.00
                    </div>
                  </div>

                  {/* Payment Collection Inputs */}
                  <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0B3B7B' }}>
                      💳 Payment Collection
                    </h4>

                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Payment Mode
                      </label>
                      <select
                        value={payMode}
                        onChange={e => setPayMode(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff', boxSizing: 'border-box' }}
                      >
                        {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Amount Collected Now (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder={`₹ ${netPayable}`}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 800, color: '#0B3B7B', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Transaction Ref / Cheque No / UPI ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UPI-928410 / Cash Counter"
                        value={payRef}
                        onChange={e => setPayRef(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                        Receipt Remarks
                      </label>
                      <input
                        type="text"
                        value={payRemarks}
                        onChange={e => setPayRemarks(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                </div>

              </div>

              {/* Confirmation Action Rule Banner */}
              <div style={{
                background: '#ecfdf5',
                border: '1.5px solid #a7f3d0',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 12.5,
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div>
                  <strong>Automatic Confirmation:</strong> Upon collecting the fee, the student's status automatically turns to <strong>ACTIVE (Confirmed)</strong> and an official permanent <strong>ADM-</strong> number is issued and printed on the receipt.
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAdmission}
                disabled={processingPay}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: processingPay ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: processingPay ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                {processingPay ? (
                  <>
                    <i className="ti ti-loader animate-spin" /> Confirming Admission...
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" /> Pay ₹{parseFloat(payAmount || netPayable || 0).toLocaleString('en-IN')} &amp; Confirm Admission
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Cancel / Delete Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 44 }}>⚠️</span>
              <h3 style={{ margin: '10px 0 6px', fontSize: 17, color: '#0f172a' }}>Cancel Provisional Application?</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Are you sure you want to cancel the provisional admission for <strong>{deleteTarget.name}</strong> ({deleteTarget.provisional_no || deleteTarget.admission_no})?
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                No, Keep
              </button>
              <button
                type="button"
                onClick={handleDeleteProvisional}
                disabled={deleting}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Cancelling...' : 'Yes, Cancel Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
