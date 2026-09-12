import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { resolveTenantPath } from '../utils/routeBuilder';

const GENDERS = ['Male', 'Female', 'Other'];
const SESSIONS = ['2026-27', '2025-26', '2027-28'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'UPI / Online', 'Net Banking', 'Demand Draft'];
const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'DUE'];
const WAIVER_REASONS = [
  'Merit / High Academic Performance',
  'Sibling / Multi-Child Concession',
  'Staff Child Concession',
  'Economically Weaker Section (EWS)',
  'Sports / Co-curricular Excellence',
  'Principal Special Relief',
  'Other'
];

const STEPS = [
  { id: 1, label: 'Student Details' },
  { id: 2, label: 'Parent / Guardian' },
  { id: 3, label: 'Previous School' },
  { id: 4, label: 'Academic Admission' },
  { id: 5, label: 'Services' },
  { id: 6, label: 'Documents' },
  { id: 7, label: 'Fee & Charges' },
  { id: 8, label: 'Review & Submit' },
];

export const getIndianDateISO = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

export const formatIndianDate = (d) => {
  if (!d) return '—';
  try {
    const s = String(d).split('T')[0];
    const parts = s.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  } catch {
    return d;
  }
};

export default function NewAdmissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [classes, setClasses] = useState([]);
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [transportStops, setTransportStops] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [hostelPlans, setHostelPlans] = useState([]);
  const [customFeeList, setCustomFeeList] = useState([]);
  const [showAddCustomFee, setShowAddCustomFee] = useState(false);
  const [newCustomItem, setNewCustomItem] = useState({ name: '', category: 'ACADEMIC', amount: '', is_recurring: false });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // admitted student data
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [schoolSlug, setSchoolSlug] = useState('school');
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);

  // Real-time duplicate check states
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Optional admission KYC documents
  const [studentAadharFile, setStudentAadharFile] = useState(null);
  const [parentAadharFile, setParentAadharFile] = useState(null);
  const [tcFile, setTcFile] = useState(null);
  const [birthCertFile, setBirthCertFile] = useState(null);
  const [medicalCertFile, setMedicalCertFile] = useState(null);

  // Admission Modes: 'quick' (⚡ Quick Fast-Track) vs 'full' (📋 8 Steps Comprehensive)
  const [admissionMode, setAdmissionMode] = useState('quick');
  const [quickStep, setQuickStep] = useState(1); // 1: Login & Essential Credentials, 2: Fee & Confirmation
  const [showPassword, setShowPassword] = useState(true);

  // Dynamic Fee Plan States (Zero hardcoded numbers)
  const [admissionFeeData, setAdmissionFeeData] = useState(null);
  const [loadingFeePlan, setLoadingFeePlan] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState(null);
  const [manualWaiver, setManualWaiver] = useState(0);
  const [waiverReason, setWaiverReason] = useState('Merit / High Academic Performance');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const [form, setForm] = useState({
    // Step 1: Student Details
    name: '',
    dob: '2012-05-15',
    gender: 'Male',
    category: 'General',
    nationality: 'Indian',
    religion: 'Hinduism',
    aadhar_no: '',
    blood_group: 'B+',

    // Step 2: Parent & Address Details
    father_name: '',
    father_occupation: '',
    parent_phone: '',
    parent_email: '',
    parent_aadhar_no: '',
    mother_name: '',
    mother_occupation: '',
    mother_phone: '',
    guardian_name: '',
    guardian_relation: '',
    guardian_phone: '',
    parent_name: '',
    address: '',
    city: '',
    state: 'Uttar Pradesh',
    pincode: '',
    emergency_contact: '',
    emergency_phone: '',
    emergency_relation: '',

    // Step 3: Previous School
    is_first_school: false,
    previous_school_name: '',
    previous_class: '',
    previous_tc_no: '',
    previous_tc_date: '',
    previous_reason: '',

    // Step 4: Academic Admission
    class_id: '',
    roll_number: '',
    manual_admission_no: '',
    session: '2026-27',
    admission_date: getIndianDateISO(),

    // Step 5: Services (Transport, Hostel & Library)
    transport_required: 'No',
    transport_route_id: '',
    transport_stop_id: '',
    hostel_required: 'No',
    hostel_id: '',
    hostel_fee_structure_id: '',
    hostel_monthly_fee: '',
    hostel_deposit: '',
    hostel_room_type: '',
    hostel_remarks: '',
    library_required: 'No',
    library_fee: '',

    // Step 7: Fee particulars
    payment_plan_id: '',
    payment_mode: 'Cash',
    payment_status: 'PAID',
    password: '12345',
  });

  const [customFeeAmounts, setCustomFeeAmounts] = useState({});
  const [isCustomizingFees, setIsCustomizingFees] = useState(false);

  // Auto-fetch candidate sequential admission number for student login credentials
  const fetchNextAdmissionNo = useCallback(async (session) => {
    try {
      const res = await api.get(`/principal/students/next-admission-no?session=${session || '2026-27'}`);
      if (res.data?.next_admission_no) {
        setForm(f => {
          if (!f.manual_admission_no) {
            return { ...f, manual_admission_no: res.data.next_admission_no };
          }
          return f;
        });
      }
    } catch (err) {
      console.warn('Could not auto-fetch next admission no:', err);
    }
  }, []);

  useEffect(() => {
    fetchNextAdmissionNo(form.session);
  }, [form.session, fetchNextAdmissionNo]);

  useEffect(() => {
    // 1. Fetch Classes
    api.get('/principal/classes')
      .then(r => {
        const clsList = r.data || [];
        setClasses(clsList);
        if (clsList.length > 0 && !form.class_id) {
          setForm(f => ({ ...f, class_id: clsList[0].id }));
        }
      })
      .catch(() => {});

    // 2. Fetch School Settings
    api.get('/principal/school/settings')
      .then(r => {
        setSchoolSettings(r.data || null);
        const name = (r.data?.name || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');
        setSchoolSlug(name || 'school');
      })
      .catch(() => {});

    // 3. Fetch Transport Routes (with stops & fares)
    api.get('/transport/routes?include_stops=true')
      .then(r => {
        const raw = r.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.routes) ? raw.routes : [];
        setTransportRoutes(arr);
      })
      .catch(() => {});

    // 4. Fetch Transport Stops
    api.get('/transport/stops')
      .then(r => {
        const raw = r.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.stops) ? raw.stops : [];
        setTransportStops(arr);
      })
      .catch(() => {});

    // 5. Fetch Hostels (optional addon)
    api.get('/hostel/hostels')
      .then(r => {
        const raw = r.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.hostels) ? raw.hostels : [];
        setHostels(arr);
      })
      .catch(() => {});

    // Fetch Hostel Fee Slabs
    api.get('/hostel/fee-structures')
      .then(r => {
        const raw = r.data;
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        if (arr.length > 0) setHostelPlans(arr);
      })
      .catch(() => {});
  }, []);

  // Fetch published fee structure & payment plans whenever Class or Session changes
  const fetchAdmissionFeePlan = useCallback(async (classId, session) => {
    if (!classId) return;
    try {
      setLoadingFeePlan(true);
      const res = await api.get(`/fees-finance/admission-fee-plan?class_id=${classId}&session=${session || '2026-27'}`);
      const data = res.data;
      setAdmissionFeeData(data);
      if (data?.transport_routes?.length > 0) {
        setTransportRoutes(data.transport_routes);
      }
      if (data?.hostels?.length > 0) {
        setHostels(data.hostels);
      }
      if (data?.hostel_plans?.length > 0) {
        setHostelPlans(data.hostel_plans);
      }
      if (data?.payment_plans?.length > 0) {
        const def = data.payment_plans.find(p => p.code === 'QUARTERLY') || data.payment_plans[0];
        setSelectedPaymentPlan(def);
        setForm(f => ({ ...f, payment_plan_id: def.id }));
      }
    } catch (err) {
      console.warn('Failed to fetch admission fee plan:', err);
    } finally {
      setLoadingFeePlan(false);
    }
  }, []);

  useEffect(() => {
    if (form.class_id) {
      fetchAdmissionFeePlan(form.class_id, form.session);
    }
  }, [form.class_id, form.session, fetchAdmissionFeePlan]);

  // Real-time duplicate check debounced effect
  useEffect(() => {
    const hasSearchQuery = (form.name && form.name.trim().length >= 3) ||
                           (form.parent_phone && form.parent_phone.trim().length >= 8) ||
                           (form.aadhar_no && form.aadhar_no.trim().length >= 10);
    if (!hasSearchQuery) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingDuplicates(true);
      const params = {};
      if (form.name && form.name.trim().length >= 3) params.name = form.name.trim();
      if (form.dob) params.dob = form.dob;
      if (form.parent_phone && form.parent_phone.trim().length >= 8) params.parent_phone = form.parent_phone.trim();
      if (form.aadhar_no && form.aadhar_no.trim().length >= 10) params.aadhar_no = form.aadhar_no.trim();

      api.get('/principal/students/check-duplicate', { params })
        .then(res => {
          if (res.data && res.data.has_duplicates) {
            setDuplicates(res.data.duplicates || []);
          } else {
            setDuplicates([]);
          }
        })
        .catch(() => {
          setDuplicates([]);
        })
        .finally(() => {
          setCheckingDuplicates(false);
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [form.name, form.dob, form.parent_phone, form.aadhar_no]);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setPendingPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  function handleDocFile(setter) {
    return (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Document file size must be less than 10MB');
          return;
        }
        setter(file);
        toast.success(`File selected: ${file.name}`);
      }
    };
  }

  function validateCurrentStep() {
    if (currentStep === 1) {
      if (!form.name.trim()) {
        toast.error('Student full name is required');
        return false;
      }
      if (!form.dob) {
        toast.error('Date of birth is required');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!form.father_name.trim() && !form.guardian_name.trim()) {
        toast.error("Father's name or Guardian's name is required");
        return false;
      }
      if (!form.parent_phone.trim() || form.parent_phone.replace(/\D/g, '').length < 10) {
        toast.error('A valid 10-digit primary mobile number is required');
        return false;
      }
      if (!form.address.trim() || !form.city.trim()) {
        toast.error('Residential address and city are required');
        return false;
      }
    }
    if (currentStep === 3) {
      if (!form.is_first_school && form.previous_school_name && !form.previous_class) {
        toast.warning('Please indicate the last class passed at previous school');
      }
    }
    if (currentStep === 4) {
      if (!form.class_id) {
        toast.error('Please select an admission class');
        return false;
      }
      if (!form.session) {
        toast.error('Academic session is required');
        return false;
      }
      if (!form.admission_date) {
        toast.error('Admission date is required');
        return false;
      }
    }
    return true;
  }

  function nextStep() {
    if (validateCurrentStep()) {
      setCurrentStep(s => Math.min(s + 1, STEPS.length));
    }
  }

  function skipStep() {
    if (currentStep === 1) {
      if (!form.name.trim()) {
        toast.error('Please enter at least Student Name before skipping');
        return;
      }
      toast.info('Student personal details skipped — can be updated later');
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      toast.info('Parent & Address details skipped — can be updated later');
      setCurrentStep(3);
      return;
    }
    if (currentStep === 3) {
      toast.info('Previous school details skipped');
      setCurrentStep(4);
      return;
    }
    if (currentStep === 4) {
      if (!form.class_id) {
        toast.error('Please select an admission class before skipping');
        return;
      }
      toast.info('Academic details saved — moving to next step');
      setCurrentStep(5);
      return;
    }
    if (currentStep === 5) {
      toast.info('Optional services skipped');
      setCurrentStep(6);
      return;
    }
    if (currentStep === 6) {
      toast.info('KYC documents skipped — can be uploaded later from student profile');
      setCurrentStep(7);
      return;
    }
    if (currentStep === 7) {
      toast.info('Fee setup skipped — standard plan applied');
      setCurrentStep(8);
      return;
    }
  }

  function quickSkipToReview() {
    if (!form.name.trim()) {
      toast.error('Please enter Student Name in Step 1 first');
      setCurrentStep(1);
      return;
    }
    if (!form.class_id) {
      toast.error('Please select an Admission Class in Step 4 first');
      setCurrentStep(4);
      return;
    }
    toast.success('⚡ Quick Admission: Proceeding directly to Review & Payment!');
    setCurrentStep(8);
  }

  function prevStep() {
    setCurrentStep(s => Math.max(s - 1, 1));
  }

  const selectedClass = Array.isArray(classes) ? classes.find(c => String(c.id) === String(form.class_id)) : undefined;
  const selectedRoute = Array.isArray(transportRoutes) ? transportRoutes.find(r => String(r.id) === String(form.transport_route_id)) : undefined;
  const selectedStop  = Array.isArray(transportStops) ? transportStops.find(s => String(s.id) === String(form.transport_stop_id)) : undefined;
  const selectedHostel = Array.isArray(hostels) ? hostels.find(h => String(h.id) === String(form.hostel_id)) : undefined;
  const selectedHostelPlan = Array.isArray(hostelPlans) ? hostelPlans.find(p => String(p.id) === String(form.hostel_fee_structure_id)) : undefined;

  // Dynamic fee calculation from published structure & payment cadence plan
  const publishedStructure = admissionFeeData?.class_fee_structure || admissionFeeData?.published_structure;
  const paymentPlans = admissionFeeData?.payment_plans || [];
  const monthsCount = selectedPaymentPlan?.months_count || 1;

  const isQuick = admissionMode === 'quick';

  const transportMonthlyRate = !isQuick && form.transport_required === 'Yes' ? Number(selectedRoute?.fare || selectedRoute?.fee_amount || selectedStop?.pickup_charge || 0) : 0;
  const transportRecurringTotal = transportMonthlyRate * monthsCount;
  const transportCharge = transportMonthlyRate;

  const hostelMonthlyRate = !isQuick && form.hostel_required === 'Yes'
    ? (selectedHostelPlan ? Number(selectedHostelPlan.total_monthly || selectedHostelPlan.monthly_fee || 0) : Number(form.hostel_monthly_fee || 0))
    : 0;
  const hostelDeposit = !isQuick && form.hostel_required === 'Yes'
    ? (selectedHostelPlan ? Number(selectedHostelPlan.security_deposit || 0) : Number(form.hostel_deposit || 0))
    : 0;
  const hostelRecurringTotal = hostelMonthlyRate * monthsCount;
  const hostelTotalCharge = hostelRecurringTotal + hostelDeposit;
  const hostelCharge = hostelTotalCharge;

  const defaultLibRate = admissionFeeData?.fee_heads?.find(h => h.code === 'LIBRARY' || h.category === 'LIBRARY')?.default_amount || 150;
  const libraryCharge = !isQuick && form.library_required === 'Yes' ? Number(form.library_fee || defaultLibRate || 150) : 0;

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
    const headCode = it.fee_head?.code || it.fee_head_code || '';
    const headCategory = it.fee_head?.category || it.department || 'ACADEMIC';
    const isOneTime = it.fee_head?.default_frequency === 'ONE_TIME' ||
      it.fee_head?.is_recurring === false ||
      /admission|registration|caution|deposit|security/i.test(headName) ||
      /admission|registration|caution|deposit|security/i.test(headCode);
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
  const computedCustomItems = isQuick ? [] : customFeeList.map(item => {
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

  if (!publishedStructure && form.admission_fee) {
    const legacyAmt = Number(form.admission_fee || 0);
    baseGross = legacyAmt;
    eligibleBase = legacyAmt;
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
  const totalFee = netPayable;

  async function submit(opts = {}) {
    if (opts && opts.preventDefault) opts.preventDefault();
    const isSkipPayment = Boolean(opts?.isSkipPayment);

    if (!form.name || !form.class_id) {
      toast.error('Please fill in Student Name and select an Admission Class');
      return;
    }

    if (admissionMode === 'quick') {
      if (!form.manual_admission_no?.trim()) {
        toast.error('Registration / Admission Number is mandatory for student login');
        return;
      }
      if (!form.father_name?.trim()) {
        toast.error("Father's Name is mandatory for student login and verification");
        return;
      }
      const cleanP = (form.parent_phone || '').replace(/\D/g, '');
      if (!cleanP || cleanP.length < 10) {
        toast.error('A valid 10-digit primary mobile number is mandatory');
        return;
      }
      if (!form.password?.trim()) {
        toast.error('Student portal password is required (default is 12345)');
        return;
      }
    }

    if (saving) return; // Double-click protection

    setSaving(true);
    try {
      const firstName = (form.name || 'student').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const autoEmail = form.parent_email || `${firstName || 'student'}@${schoolSlug}.com`;
      const cleanPhone = (form.parent_phone || '').trim();

      const payAmount = isSkipPayment ? 0 : (paymentAmount !== '' ? (parseFloat(paymentAmount) || 0) : netPayable);
      const payStatus = isSkipPayment ? 'DUE' : (payAmount >= netPayable && netPayable > 0 ? 'PAID' : (payAmount > 0 ? 'PARTIAL' : 'DUE'));
      const isProvisional = isSkipPayment || payAmount <= 0;

      const fee_setup = {
        fee_structure_id: publishedStructure?.id || null,
        payment_plan_id: selectedPaymentPlan?.id || null,
        payment_plan_code: selectedPaymentPlan?.code || null,
        months_count: monthsCount,
        transport_fee: isQuick ? 0 : transportMonthlyRate,
        transport_multiplier: isQuick ? 0 : monthsCount,
        transport_fee_name: isQuick ? null : `Transport Fee (${selectedRoute?.route_name || 'Assigned Route'})`,
        hostel_fee: isQuick ? 0 : hostelMonthlyRate,
        hostel_deposit: isQuick ? 0 : hostelDeposit,
        hostel_multiplier: isQuick ? 0 : monthsCount,
        hostel_fee_name: isQuick ? null : `Hostel Accommodation (${selectedHostel?.name || 'Hostel'})`,
        library_fee: isQuick ? 0 : libraryCharge,
        library_required: isQuick ? 'No' : form.library_required,
        custom_items: (!isQuick && Object.keys(customFeeAmounts).length > 0) ? computedItems.map(it => ({
          fee_head_id: it.fee_head_id,
          name: it.headName,
          code: it.fee_head?.code || it.fee_head_code || 'ACADEMIC',
          category: it.headCategory,
          rate: it.rate,
          multiplier: it.mult,
          amount: it.lineAmt,
        })) : null,
        additional_items: isQuick ? [] : computedCustomItems.map(cit => ({
          name: cit.name,
          category: cit.category || 'ACADEMIC',
          rate: cit.rate,
          multiplier: cit.mult,
          amount: cit.lineAmt,
        })),
        manual_waiver: waiverNum,
        waiver_reason: waiverNum > 0 ? (waiverReason || 'Principal Authorized Special Waiver') : '',
        net_payable: netPayable,
        initial_payment_amount: payAmount,
        payment_mode: form.payment_mode || 'Cash',
        payment_status: payStatus,
        payment_reference: paymentReference || '',
        is_provisional: isProvisional,
      };

      const payload = {
        ...form,
        transport_required: isQuick ? 'No' : form.transport_required,
        hostel_required: isQuick ? 'No' : form.hostel_required,
        library_required: isQuick ? 'No' : form.library_required,
        password: form.password || '12345',
        father_name: form.father_name?.trim(),
        parent_phone: cleanPhone,
        email: autoEmail,
        parent_name: form.father_name?.trim() || form.guardian_name || form.parent_name || 'Parent / Guardian',
        admission_no: form.manual_admission_no ? form.manual_admission_no.trim() : undefined,
        status: isProvisional ? 'PROVISIONAL' : 'ACTIVE',
        fee_setup,
      };

      const res = await api.post('/principal/students', payload);
      const studentId = res.data.id;

      if (pendingPhoto) {
        await uploadPhoto(studentId, pendingPhoto);
      }

      // Upload optional KYC docs if attached
      const uploadPromises = [];
      if (studentAadharFile) {
        const fd = new FormData();
        fd.append('file', studentAadharFile);
        fd.append('doc_type', 'AADHAR_STUDENT');
        uploadPromises.push(api.post(`/principal/students/${studentId}/documents/student`, fd));
      }
      if (parentAadharFile) {
        const fd = new FormData();
        fd.append('file', parentAadharFile);
        fd.append('doc_type', 'AADHAR_PARENT');
        uploadPromises.push(api.post(`/principal/students/${studentId}/documents/student`, fd));
      }
      if (birthCertFile) {
        const fd = new FormData();
        fd.append('file', birthCertFile);
        fd.append('doc_type', 'BIRTH_CERTIFICATE');
        uploadPromises.push(api.post(`/principal/students/${studentId}/documents/student`, fd));
      }
      if (tcFile) {
        const fd = new FormData();
        fd.append('file', tcFile);
        fd.append('doc_type', 'TRANSFER_CERTIFICATE');
        uploadPromises.push(api.post(`/principal/students/${studentId}/documents/student`, fd));
      }
      if (medicalCertFile) {
        const fd = new FormData();
        fd.append('file', medicalCertFile);
        fd.append('doc_type', 'MEDICAL_CERTIFICATE');
        uploadPromises.push(api.post(`/principal/students/${studentId}/documents/student`, fd));
      }

      if (uploadPromises.length > 0) {
        await Promise.allSettled(uploadPromises);
      }

      setDone(res.data);
      if (isProvisional || res.data.status === 'PROVISIONAL') {
        toast.success(`⏳ Provisional admission recorded! Admission No: ${res.data.admission_no || 'Generated'}`);
      } else {
        toast.success(`🎉 Student admitted & confirmed! Admission No: ${res.data.admission_no || 'Generated'}`);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error occurred while admitting student';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(studentId, file) {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post(`/principal/students/${studentId}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoPreview(res.data.photo_url);
    } catch {
      toast.error('Photo could not be uploaded');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function downloadPDF(studentId, studentName) {
    try {
      const res = await api.get(
        `/principal/admission-card/${studentId}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `New_Admission_Form_${(studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('2-Page Admission Form Downloaded!');
    } catch {
      toast.error('Admission PDF download failed');
    }
  }

  function handlePrintDirect() {
    window.print();
  }

  function validateQuickStep1() {
    if (!form.name?.trim()) {
      toast.error('Student Full Name is required');
      return false;
    }
    if (!form.manual_admission_no?.trim()) {
      toast.error('Registration / Admission Number is mandatory for student login');
      return false;
    }
    if (!form.father_name?.trim()) {
      toast.error("Father's Name is mandatory for student login and verification");
      return false;
    }
    if (!form.class_id) {
      toast.error('Please select an Admission Class');
      return false;
    }
    const cleanPhone = (form.parent_phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('A valid 10-digit primary mobile number is mandatory');
      return false;
    }
    if (!form.password?.trim()) {
      toast.error('Student portal password is required (default 12345)');
      return false;
    }
    return true;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="New Student Admission" />
        <div className="page-body">

          {/* PRINT-ONLY CSS FOR CLEAN 2-PAGE ADMISSION FORM */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #printable-admission-form, #printable-admission-form * { visibility: visible !important; }
              #printable-admission-form {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10px !important;
                border: none !important;
                box-shadow: none !important;
                background: #fff !important;
              }
              .page-break-print {
                page-break-before: always !important;
                break-before: page !important;
                padding-top: 20px !important;
              }
            }
          `}</style>

          {/* PAGE HEADER */}
          <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>📝</span> New Student Admission
              </h2>
              <p className="page-subtitle">
                8-Step SaaS Workflow: KYC, Dynamic 1st School Logic, Services, Fee Ledger &amp; 2-Page Admission Form
              </p>
            </div>
            {schoolSettings && (
              <div style={{ background: '#f1f5f9', padding: '6px 14px', borderRadius: 8, fontSize: 12, color: '#334155', fontWeight: 600 }}>
                🏫 {schoolSettings.name} ({schoolSettings.code || 'ACTIVE'})
              </div>
            )}
          </div>

          {/* ADMISSION MODE SWITCHER (Segmented Toggle) */}
          <div style={{
            display: 'inline-flex',
            background: '#e2e8f0',
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)'
          }}>
            <button
              type="button"
              onClick={() => setAdmissionMode('quick')}
              style={{
                padding: '9px 22px',
                borderRadius: 9,
                border: 'none',
                background: admissionMode === 'quick' ? '#0B3B7B' : 'transparent',
                color: admissionMode === 'quick' ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: 13.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: admissionMode === 'quick' ? '0 2px 8px rgba(11,59,123,0.3)' : 'none'
              }}
            >
              <span>⚡</span> Quick Admission (Fast Track)
            </button>
            <button
              type="button"
              onClick={() => setAdmissionMode('full')}
              style={{
                padding: '9px 22px',
                borderRadius: 9,
                border: 'none',
                background: admissionMode === 'full' ? '#0B3B7B' : 'transparent',
                color: admissionMode === 'full' ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: 13.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: admissionMode === 'full' ? '0 2px 8px rgba(11,59,123,0.3)' : 'none'
              }}
            >
              <span>📋</span> Full Admission (8 Steps Comprehensive)
            </button>
          </div>

          {!done ? (
            admissionMode === 'quick' ? (
              /* ═══════════════════════════════════════════════════════════
                 ⚡ QUICK ADMISSION WORKFLOW (2 STEPS: LOGIN & PAY/CONFIRM)
                 ═══════════════════════════════════════════════════════════ */
              <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                
                {/* QUICK STEPPER PROGRESS BAR */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setQuickStep(1)}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      textAlign: 'center',
                      borderBottom: quickStep === 1 ? '3px solid #0B3B7B' : '3px solid transparent',
                      background: quickStep === 1 ? '#ffffff' : 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: quickStep === 1 ? '#0B3B7B' : '#16a34a',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 700,
                      marginRight: 8
                    }}>
                      {quickStep > 1 ? '✓' : '1'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: quickStep === 1 ? 800 : 600, color: quickStep === 1 ? '#0B3B7B' : '#64748b' }}>
                      Step 1: Essential Student &amp; Login Credentials (Mandatory)
                    </span>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (validateQuickStep1()) setQuickStep(2);
                    }}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      textAlign: 'center',
                      borderBottom: quickStep === 2 ? '3px solid #0B3B7B' : '3px solid transparent',
                      background: quickStep === 2 ? '#ffffff' : 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: quickStep === 2 ? '#0B3B7B' : '#cbd5e1',
                      color: quickStep === 2 ? '#ffffff' : '#334155',
                      fontSize: 11,
                      fontWeight: 700,
                      marginRight: 8
                    }}>
                      2
                    </div>
                    <span style={{ fontSize: 13, fontWeight: quickStep === 2 ? 800 : 600, color: quickStep === 2 ? '#0B3B7B' : '#64748b' }}>
                      Step 2: Fee Payment &amp; Admission Confirmation (Pay vs Skip)
                    </span>
                  </div>
                </div>

                {/* QUICK STEP BODY */}
                <div style={{ padding: '28px 36px' }}>
                  {quickStep === 1 ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>⚡</span> Quick Admission: Mandatory Login &amp; Academic Credentials
                          </h3>
                          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                            Registration Number, Father's Name, Primary Mobile and Password are required for student portal login. All optional addons (Transport, Hostel, Library) remain zero and unselected.
                          </p>
                        </div>
                        {checkingDuplicates && (
                          <div style={{ fontSize: 12, color: '#0284c7' }}>🔍 Checking existing student records...</div>
                        )}
                      </div>

                      {/* DUPLICATE WARNING */}
                      {duplicates.length > 0 && (
                        <div style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fcd34d',
                          borderRadius: 10,
                          padding: '12px 16px',
                          marginBottom: 20,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12
                        }}>
                          <span style={{ fontSize: 22 }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: '#b45309', fontSize: 13, display: 'block', marginBottom: 2 }}>
                              Possible Duplicate Student Record Found ({duplicates.length})
                            </strong>
                            <p style={{ margin: '0 0 6px', fontSize: 12, color: '#92400e' }}>
                              A student with similar identity details already exists in this school.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {duplicates.map(d => (
                                <div key={d.id} style={{ fontSize: 11.5, background: '#fef3c7', padding: '4px 10px', borderRadius: 6, color: '#78350f' }}>
                                  • <strong>{d.name}</strong> ({d.admission_no}) | Class: {d.class_name || 'N/A'} | Phone: {d.parent_phone}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FORM GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px 24px' }}>
                        
                        {/* Student Name */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                            Student Full Name <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Aarav Sharma"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        {/* Registration / Admission Number */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#0B3B7B' }}>
                              Registration / Admission No (Login ID) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <span style={{ fontSize: 10.5, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Mandatory
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              placeholder="e.g. ADM-2026-0001"
                              value={form.manual_admission_no}
                              onChange={e => set('manual_admission_no', e.target.value)}
                              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #0B3B7B', fontSize: 13, fontWeight: 700, background: '#f8fafc', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => fetchNextAdmissionNo(form.session)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                              title="Auto-fetch next candidate sequence"
                            >
                              🔄 Auto
                            </button>
                          </div>
                        </div>

                        {/* Father's Name */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                              Father's Name (Login Verification) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <span style={{ fontSize: 10.5, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Mandatory
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. Rajesh Sharma"
                            value={form.father_name}
                            onChange={e => set('father_name', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        {/* Admission Class */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                            Admission Class &amp; Section <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={form.class_id}
                            onChange={e => set('class_id', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff', fontWeight: 600 }}
                          >
                            <option value="">— Select Class —</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.section ? `(Sec ${c.section})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Primary Mobile */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                              Primary Mobile No (10 Digits) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <span style={{ fontSize: 10.5, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Mandatory / Login
                            </span>
                          </div>
                          <input
                            type="tel"
                            maxLength="10"
                            placeholder="e.g. 9876543210"
                            value={form.parent_phone}
                            onChange={e => set('parent_phone', e.target.value.replace(/\D/g, ''))}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, outline: 'none', fontWeight: 600 }}
                          />
                        </div>

                        {/* Student Portal Password */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#0B3B7B' }}>
                              Portal Password <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <span style={{ fontSize: 10.5, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Default: 12345 (Editable)
                            </span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Default 12345"
                              value={form.password}
                              onChange={e => set('password', e.target.value)}
                              style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: 8, border: '1.5px solid #0B3B7B', fontSize: 13, fontWeight: 700, background: '#f8fafc', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(p => !p)}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b' }}
                              title={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? '👁️' : '🙈'}
                            </button>
                          </div>
                        </div>

                        {/* Date of Birth */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={form.dob}
                            onChange={e => set('dob', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        {/* Gender */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Gender
                          </label>
                          <select
                            value={form.gender}
                            onChange={e => set('gender', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>

                      </div>

                      {/* CREDENTIAL LIVE PREVIEW CARD */}
                      <div style={{
                        marginTop: 24,
                        background: '#eff6ff',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 12,
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>🔐</span> Generated Student Login Credentials Preview
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 4 }}>
                          <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #dbeafe' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Login ID / Admission No:</span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{form.manual_admission_no || 'Auto-generated'}</div>
                          </div>
                          <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #dbeafe' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Father's Name:</span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{form.father_name || '—'}</div>
                          </div>
                          <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #dbeafe' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Primary Mobile (Alt ID):</span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{form.parent_phone || '—'}</div>
                          </div>
                          <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #dbeafe' }}>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Student Portal Password:</span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#0B3B7B', fontFamily: 'monospace' }}>{form.password || '12345'}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4, lineHeight: 1.5 }}>
                          ℹ️ Student or parent can log in to the portal using either <strong>Admission No ({form.manual_admission_no || 'ADM-...'})</strong> or <strong>Mobile Number ({form.parent_phone || '...'})</strong> with password <strong>{form.password || '12345'}</strong>.
                        </div>
                      </div>

                      {/* ZERO ADDONS BADGE */}
                      <div style={{
                        marginTop: 14,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 10,
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}>
                        <span style={{ fontSize: 18 }}>🛡️</span>
                        <div style={{ fontSize: 12, color: '#166534' }}>
                          <strong>Zero Auto-Selected Addons:</strong> Transport (₹0), Hostel (₹0) and Library (₹0) are strictly <strong>NOT</strong> selected. Only standard class academic fee is charged.
                        </div>
                      </div>

                      {/* QUICK STEP 1 FOOTER NAVIGATION */}
                      <div style={{
                        marginTop: 28,
                        paddingTop: 18,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12
                      }}>
                        <button
                          type="button"
                          onClick={() => setAdmissionMode('full')}
                          style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Switch to Full 8-Step Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (validateQuickStep1()) setQuickStep(2);
                          }}
                          style={{
                            background: '#0B3B7B',
                            color: '#ffffff',
                            border: 'none',
                            padding: '11px 26px',
                            borderRadius: 8,
                            fontSize: 13.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 12px rgba(11,59,123,0.25)'
                          }}
                        >
                          Continue to Fee &amp; Confirmation (Step 2) ⏭️
                        </button>
                      </div>

                    </div>
                  ) : (
                    /* QUICK STEP 2: FEE PAYMENT & CONFIRMATION */
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>💳</span> Step 2: Fee Payment &amp; Admission Confirmation
                          </h3>
                          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                            Pay the admission fee now to confirm admission, or skip payment for provisional (temporary) admission.
                          </p>
                        </div>
                        <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '8px 18px', borderRadius: 10, textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Total Net Admission Fee:</span>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d' }}>
                            ₹ {netPayable.toLocaleString('en-IN')}.00
                          </div>
                        </div>
                      </div>

                      {/* CREDENTIAL RECAP CHIP */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '12px 18px',
                        marginBottom: 20,
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                        fontSize: 12.5,
                        color: '#334155'
                      }}>
                        <div>👤 <strong>{form.name}</strong></div>
                        <div>🆔 <strong>{form.manual_admission_no}</strong></div>
                        <div>👨 <strong>{form.father_name}</strong></div>
                        <div>🎓 <strong>{selectedClass?.name || 'Class'}</strong></div>
                        <div>📱 <strong>{form.parent_phone}</strong></div>
                        <div>🔑 <strong>{form.password}</strong></div>
                      </div>

                      {/* FEE BREAKDOWN & PAYMENT COLLECTION */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 20 }}>
                        
                        {/* Fee Particulars */}
                        <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 800, color: '#0B3B7B' }}>
                            📋 Academic Fee Breakdown
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            {computedItems.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
                                <span style={{ color: '#475569' }}>{it.headName}</span>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>₹ {it.lineAmt.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                            {computedItems.length === 0 && (
                              <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: 12 }}>
                                {form.admission_fee ? `Admission Fee: ₹ ${Number(form.admission_fee).toLocaleString('en-IN')}` : 'Standard class published academic fee'}
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: 12, paddingTop: 4 }}>
                              <span>🛡️ Transport, Hostel &amp; Library Addons:</span>
                              <span style={{ fontWeight: 700 }}>₹ 0.00 (Unselected)</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #cbd5e1', paddingTop: 8, marginTop: 4 }}>
                              <strong style={{ color: '#0B3B7B' }}>Net Payable:</strong>
                              <strong style={{ color: '#15803d', fontSize: 15 }}>₹ {netPayable.toLocaleString('en-IN')}.00</strong>
                            </div>
                          </div>
                        </div>

                        {/* Payment Collection Inputs */}
                        <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#0B3B7B' }}>
                            💳 Payment Collection (To Confirm Now)
                          </h4>

                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                              Payment Mode
                            </label>
                            <select
                              value={form.payment_mode}
                              onChange={e => set('payment_mode', e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                            >
                              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                              Amount Collected Now (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={netPayable}
                              value={paymentAmount !== '' ? paymentAmount : netPayable}
                              onChange={e => setPaymentAmount(e.target.value)}
                              placeholder={`₹ ${netPayable}`}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                              Transaction Ref / Cheque No / UPI ID
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. UPI-928410 / Cash Counter"
                              value={paymentReference}
                              onChange={e => setPaymentReference(e.target.value)}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                            />
                          </div>
                        </div>

                      </div>

                      {/* CONFIRMATION vs SKIP RULE INFO */}
                      <div style={{
                        background: '#fffbeb',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 12,
                        padding: '14px 18px',
                        marginBottom: 24,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start'
                      }}>
                        <span style={{ fontSize: 22 }}>💡</span>
                        <div style={{ flex: 1, fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>
                          <strong style={{ display: 'block', marginBottom: 2 }}>Admission Confirmation &amp; Skip Rule:</strong>
                          • <strong>Pay &amp; Confirm Admission:</strong> Confirms admission immediately with <strong>ACTIVE</strong> status and generates an official fee receipt.<br/>
                          • <strong>Skip Payment (Provisional Admission):</strong> Skips fee collection for now. The student is enrolled as <strong>PROVISIONAL (Temporary)</strong>. It will <u>NOT</u> show as confirmed until the fee is deposited. Once paid later through Fees &amp; Finance, Quick Counter, or Student Profile, status automatically turns to <strong>CONFIRMED (ACTIVE)</strong> in real time.
                        </div>
                      </div>

                      {/* QUICK STEP 2 ACTION BUTTONS */}
                      <div style={{
                        paddingTop: 18,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12
                      }}>
                        <button
                          type="button"
                          onClick={() => setQuickStep(1)}
                          style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          ← Back to Credentials (Step 1)
                        </button>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => submit({ isSkipPayment: true })}
                            disabled={saving}
                            style={{
                              background: saving ? '#cbd5e1' : '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              padding: '11px 22px',
                              borderRadius: 8,
                              fontSize: 13.5,
                              fontWeight: 800,
                              cursor: saving ? 'wait' : 'pointer',
                              boxShadow: '0 4px 12px rgba(245,158,11,0.25)'
                            }}
                          >
                            {saving ? '⏳ Submitting...' : '⏭️ Skip Payment (Provisional Admission)'}
                          </button>

                          <button
                            type="button"
                            onClick={() => submit({ isSkipPayment: false })}
                            disabled={saving}
                            style={{
                              background: saving ? '#94a3b8' : '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '11px 26px',
                              borderRadius: 8,
                              fontSize: 13.5,
                              fontWeight: 800,
                              cursor: saving ? 'wait' : 'pointer',
                              boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
                            }}
                          >
                            {saving ? '⏳ Submitting...' : `💳 Pay ₹${netPayable.toLocaleString('en-IN')} & Confirm Admission`}
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* ═══════════════════════════════════════════════════════════
                 📋 FULL ADMISSION WORKFLOW (8 STEPS COMPREHENSIVE)
                 ═══════════════════════════════════════════════════════════ */
              <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              {/* STEP PROGRESS BAR */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto' }}>
                {STEPS.map((s) => {
                  const isActive = s.id === currentStep;
                  const isPassed = s.id < currentStep;
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (s.id === currentStep) return;
                        if (s.id > 1 && !form.name.trim()) {
                          toast.error('Please enter Student Name in Step 1 first');
                          setCurrentStep(1);
                          return;
                        }
                        if (s.id > 4 && !form.class_id) {
                          toast.error('Please select an admission class in Step 4 first');
                          setCurrentStep(4);
                          return;
                        }
                        setCurrentStep(s.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (s.id === currentStep) return;
                          if (s.id > 1 && !form.name.trim()) {
                            toast.error('Please enter Student Name in Step 1 first');
                            setCurrentStep(1);
                            return;
                          }
                          if (s.id > 4 && !form.class_id) {
                            toast.error('Please select an admission class in Step 4 first');
                            setCurrentStep(4);
                            return;
                          }
                          setCurrentStep(s.id);
                        }
                      }}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        padding: '14px 8px',
                        textAlign: 'center',
                        borderBottom: isActive ? '3px solid #0B3B7B' : '3px solid transparent',
                        background: isActive ? '#ffffff' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                      }}
                      title={`Go directly to Step ${s.id}: ${s.label}`}
                    >
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: isActive ? '#0B3B7B' : isPassed ? '#16A34A' : '#cbd5e1',
                        color: isActive || isPassed ? '#ffffff' : '#334155',
                        fontSize: 11,
                        fontWeight: 700,
                        marginRight: 6
                      }}>
                        {isPassed ? '✓' : s.id}
                      </div>
                      <span style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#0B3B7B' : isPassed ? '#0f172a' : '#64748b',
                        whiteSpace: 'nowrap',
                      }}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* TOP ACTION & QUICK SKIP BAR (Always visible at top of card) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 28px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: '#0B3B7B',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 12,
                    fontWeight: 800
                  }}>
                    Step {currentStep} of {STEPS.length}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b' }}>
                    {STEPS[currentStep - 1]?.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    (Quick Admission: Only Name &amp; Class required)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {form.name && form.class_id && currentStep > 1 && currentStep < 8 && (
                    <button
                      type="button"
                      onClick={quickSkipToReview}
                      style={{
                        background: '#e0f2fe',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        padding: '7px 15px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title="Jump directly to final review & admission"
                    >
                      ⚡ Quick Admission (Review)
                    </button>
                  )}

                  {currentStep < STEPS.length ? (
                    <button
                      type="button"
                      onClick={skipStep}
                      style={{
                        background: '#ffffff',
                        color: '#0B3B7B',
                        border: '1.5px solid #0B3B7B',
                        padding: '7px 18px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(11,59,123,0.12)'
                      }}
                      title="Skip this step and proceed to next step"
                    >
                      Skip Step ⏭️
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                      Final Confirmation &amp; Payment
                    </span>
                  )}
                </div>
              </div>

              {/* STEP CONTENT BODY */}
              <div style={{ padding: '28px 36px' }}>

                {/* STEP 1: Student Details */}
                {currentStep === 1 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                          Step 1: Student Personal Details
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                          Enter the student's legal name, date of birth, Aadhaar identity, and upload passport photo.
                        </p>
                      </div>
                      {checkingDuplicates && (
                        <div style={{ fontSize: 12, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🔍 Checking existing student records...</span>
                        </div>
                      )}
                    </div>

                    {/* DUPLICATE STUDENT WARNING ALERT */}
                    {duplicates.length > 0 && (
                      <div style={{
                        background: '#fffbeb',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 10,
                        padding: '12px 16px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12
                      }}>
                        <span style={{ fontSize: 22 }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: '#b45309', fontSize: 13, display: 'block', marginBottom: 2 }}>
                            Possible Duplicate Student Found ({duplicates.length} match{duplicates.length > 1 ? 'es' : ''})
                          </strong>
                          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#92400e' }}>
                            A student with similar identity details is already enrolled in this school. Please verify before proceeding to prevent duplicate roll numbers or fee ledgers.
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {duplicates.map(d => (
                              <div key={d.id} style={{ fontSize: 11.5, background: '#fef3c7', padding: '4px 10px', borderRadius: 6, color: '#78350f' }}>
                                • <strong>{d.name}</strong> ({d.admission_no}) | Class: {d.class_name || 'N/A'} | Parent Phone: {d.parent_phone} — <span style={{ fontStyle: 'italic' }}>{d.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                        
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Student Full Name (As per Aadhaar / Birth Certificate) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Aarav Sharma"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#0B3B7B' }}>
                              Registration / Admission No (Login ID)
                            </label>
                            <span style={{ fontSize: 10.5, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Auto-Candidate
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              placeholder="e.g. ADM-2026-0001"
                              value={form.manual_admission_no}
                              onChange={e => set('manual_admission_no', e.target.value)}
                              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#f8fafc', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => fetchNextAdmissionNo(form.session)}
                              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                              title="Auto-fetch next candidate sequence"
                            >
                              🔄
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#0B3B7B' }}>
                              Student Portal Password
                            </label>
                            <span style={{ fontSize: 10.5, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Default: 12345
                            </span>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Default 12345"
                              value={form.password}
                              onChange={e => set('password', e.target.value)}
                              style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, background: '#f8fafc', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(p => !p)}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b' }}
                              title={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? '👁️' : '🙈'}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Date of Birth <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="date"
                            value={form.dob}
                            onChange={e => set('dob', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Gender <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={form.gender}
                            onChange={e => set('gender', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Category / Social Reservation
                          </label>
                          <select
                            value={form.category}
                            onChange={e => set('category', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Blood Group
                          </label>
                          <select
                            value={form.blood_group}
                            onChange={e => set('blood_group', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Student Aadhaar Card No. (12 Digits)
                          </label>
                          <input
                            type="text"
                            placeholder="1234 5678 9012"
                            value={form.aadhar_no}
                            onChange={e => set('aadhar_no', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Nationality
                          </label>
                          <input
                            type="text"
                            placeholder="Indian"
                            value={form.nationality}
                            onChange={e => set('nationality', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Religion
                          </label>
                          <select
                            value={form.religion}
                            onChange={e => set('religion', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>

                      </div>

                      {/* Photo Upload Box */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f8fafc',
                        border: '2px dashed #cbd5e1',
                        borderRadius: 12,
                        padding: 20
                      }}>
                        <div style={{
                          width: 130,
                          height: 150,
                          borderRadius: 8,
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          marginBottom: 12
                        }}>
                          {photoPreview ? (
                            <img src={photoPreview} alt="Student Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                              <span style={{ fontSize: 44, display: 'block', marginBottom: 4 }}>👤</span>
                              <span style={{ fontSize: 11 }}>Passport Photo</span>
                            </div>
                          )}
                        </div>

                        <label style={{
                          background: '#0B3B7B',
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: 6,
                        }}>
                          📸 Choose Photo
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                        </label>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>JPG, PNG (Max 5MB)</span>
                        {pendingPhoto && <span style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✓ {pendingPhoto.name}</span>}
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 2: Parent / Guardian & Address Details */}
                {currentStep === 2 && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 2: Parent / Guardian &amp; Address Details
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Primary parent phone is also used for SMS alerts, ERP notifications, and duplicate student validation.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Father's Full Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rajesh Sharma"
                          value={form.father_name}
                          onChange={e => set('father_name', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Father's Occupation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Business / Government Service"
                          value={form.father_occupation}
                          onChange={e => set('father_occupation', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Primary Mobile Number (SMS &amp; Login) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9876543210"
                          value={form.parent_phone}
                          onChange={e => set('parent_phone', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Parent Aadhaar Number (12 Digits)
                        </label>
                        <input
                          type="text"
                          placeholder="9876 5432 1098"
                          value={form.parent_aadhar_no}
                          onChange={e => set('parent_aadhar_no', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Parent Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. rajesh.sharma@gmail.com"
                          value={form.parent_email}
                          onChange={e => set('parent_email', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mother's Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sunita Sharma"
                          value={form.mother_name}
                          onChange={e => set('mother_name', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mother's Occupation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Teacher / Homemaker"
                          value={form.mother_occupation}
                          onChange={e => set('mother_occupation', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Guardian Details (If living with local guardian)
                        </label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            placeholder="Name & Relationship (e.g. Uncle)"
                            value={form.guardian_name}
                            onChange={e => set('guardian_name', e.target.value)}
                            style={{ width: '60%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                          <input
                            type="text"
                            placeholder="Guardian Phone"
                            value={form.guardian_phone}
                            onChange={e => set('guardian_phone', e.target.value)}
                            style={{ width: '40%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>
                      </div>

                      {/* Residential Address Section */}
                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 8 }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0B3B7B' }}>📍 Residential Address</h4>
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          House No., Street &amp; Colony <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. House No. 44B, Sector 21"
                          value={form.address}
                          onChange={e => set('address', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          City / District <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Lucknow / Noida"
                          value={form.city}
                          onChange={e => set('city', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          State
                        </label>
                        <input
                          type="text"
                          placeholder="Uttar Pradesh"
                          value={form.state}
                          onChange={e => set('state', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Postal PIN Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 201301"
                          value={form.pincode}
                          onChange={e => set('pincode', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Emergency Contact Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 9811223344"
                          value={form.emergency_phone}
                          onChange={e => set('emergency_phone', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 3: Previous School Details (Dynamic 1st School Condition) */}
                {currentStep === 3 && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 3: Previous School &amp; Transfer Record
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Indicate whether this is the student's very first school enrollment or a transfer from an earlier institution.
                    </p>

                    {/* DYNAMIC 1ST SCHOOL CONDITION TOGGLE */}
                    <div style={{
                      background: form.is_first_school ? '#f0fdf4' : '#eff6ff',
                      border: form.is_first_school ? '1.5px solid #86efac' : '1.5px solid #93c5fd',
                      borderRadius: 12,
                      padding: '18px 24px',
                      marginBottom: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <strong style={{ fontSize: 14, color: form.is_first_school ? '#166534' : '#0B3B7B', display: 'block', marginBottom: 3 }}>
                          Is this the student's 1st School? (Kya yeh student ka pehla school hai?)
                        </strong>
                        <span style={{ fontSize: 12, color: '#475569' }}>
                          If Yes, previous school details and TC will be completely omitted from records and the 2-page admission form.
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: form.is_first_school ? '#16a34a' : '#ffffff',
                          color: form.is_first_school ? '#ffffff' : '#334155',
                          padding: '8px 18px',
                          borderRadius: 8,
                          border: form.is_first_school ? '1px solid #16a34a' : '1px solid #cbd5e1',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          boxShadow: form.is_first_school ? '0 2px 8px rgba(22,163,74,0.25)' : 'none'
                        }}>
                          <input
                            type="radio"
                            name="is_first_school"
                            checked={form.is_first_school}
                            onChange={() => {
                              setForm(f => ({
                                ...f,
                                is_first_school: true,
                                previous_school_name: '',
                                previous_class: '',
                                previous_tc_no: '',
                                previous_tc_date: '',
                                previous_reason: '',
                              }));
                            }}
                            style={{ display: 'none' }}
                          />
                          ✓ Yes (1st School)
                        </label>

                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: !form.is_first_school ? '#0B3B7B' : '#ffffff',
                          color: !form.is_first_school ? '#ffffff' : '#334155',
                          padding: '8px 18px',
                          borderRadius: 8,
                          border: !form.is_first_school ? '1px solid #0B3B7B' : '1px solid #cbd5e1',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          boxShadow: !form.is_first_school ? '0 2px 8px rgba(11,59,123,0.25)' : 'none'
                        }}>
                          <input
                            type="radio"
                            name="is_first_school"
                            checked={!form.is_first_school}
                            onChange={() => set('is_first_school', false)}
                            style={{ display: 'none' }}
                          />
                          No (Transferred from Previous School)
                        </label>
                      </div>
                    </div>

                    {form.is_first_school ? (
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '36px 20px',
                        textAlign: 'center',
                        color: '#64748b'
                      }}>
                        <div style={{ fontSize: 42, marginBottom: 8 }}>🎒</div>
                        <h4 style={{ margin: '0 0 6px', color: '#166534', fontSize: 16, fontWeight: 800 }}>First School Admission Confirmed</h4>
                        <p style={{ margin: 0, fontSize: 13, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
                          Student is entering formal education for the first time. No previous school name, mark sheets, or Transfer Certificate (TC) details are needed.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Previous School Name <span style={{ color: '#94a3b8' }}>(Optional / Skippable)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Delhi Public School, Noida"
                            value={form.previous_school_name}
                            onChange={e => set('previous_school_name', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Last Class Passed
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 5th Standard"
                            value={form.previous_class}
                            onChange={e => set('previous_class', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Transfer Certificate (TC) No.
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TC-2024-884"
                            value={form.previous_tc_no}
                            onChange={e => set('previous_tc_no', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            TC Issuing Date
                          </label>
                          <input
                            type="date"
                            value={form.previous_tc_date}
                            onChange={e => set('previous_tc_date', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Reason for Leaving Previous School
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Parent Relocation / Better Facilities"
                            value={form.previous_reason}
                            onChange={e => set('previous_reason', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4: Academic Admission */}
                {currentStep === 4 && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 4: Academic Admission &amp; Enrolment
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Configure the academic session, grade/class allocation, roll number and admission sequence.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Admission Class &amp; Section <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={form.class_id}
                          onChange={e => set('class_id', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                        >
                          <option value="">-- Select Class --</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.section ? `(Section ${c.section})` : ''}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Academic Session <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={form.session}
                          onChange={e => set('session', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                        >
                          {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Date of Admission <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="date"
                          value={form.admission_date}
                          onChange={e => set('admission_date', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Class Roll Number (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 15 (auto-assigned if blank)"
                          value={form.roll_number}
                          onChange={e => set('roll_number', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '16px 20px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <strong style={{ fontSize: 13, color: '#0B3B7B' }}>Admission Number Generation</strong>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                              Leave blank to generate a monotonic sequential number (e.g. <code>ADM-{form.session}-0001</code>) automatically.
                            </p>
                          </div>
                          <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                            Monotonic Auto-Sequence
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Leave blank for automatic monotonic number, or enter legacy/manual admission no."
                          value={form.manual_admission_no}
                          onChange={e => set('manual_admission_no', e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none' }}
                        />
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 5: Services (Transport, Hostel & Library) */}
                {currentStep === 5 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                          Step 5: Optional School &amp; Campus Services
                        </h3>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                          Opt-in to daily bus transport routes, boarding hostel accommodations, or library membership.
                        </p>
                      </div>
                    </div>

                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: 10,
                      padding: '12px 16px',
                      marginBottom: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <span style={{ fontSize: 22 }}>💡</span>
                      <div style={{ fontSize: 12.5, color: '#166534', lineHeight: 1.45 }}>
                        <strong>Centralized Architecture:</strong> Services can be selected now OR enrolled at any time later from their respective module windows (Transport, Hostel, or Library). All charges automatically synchronize directly into the student's central financial ledger.
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                      
                      {/* Transport Box */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🚌</span> Transport Service
                          </h4>
                          <select
                            value={form.transport_required}
                            onChange={e => {
                              const val = e.target.value;
                              set('transport_required', val);
                              if (val === 'No') {
                                set('transport_route_id', '');
                                set('transport_stop_id', '');
                              }
                            }}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No Transport (Day Scholar)</option>
                            <option value="Yes">Yes, Opt-In for Bus</option>
                          </select>
                        </div>

                        {form.transport_required === 'Yes' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>
                                  Select Bus Route *
                                </label>
                                {selectedRoute && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>
                                    Fee: ₹{selectedRoute.fare || selectedRoute.fee_amount || 0}/mo
                                  </span>
                                )}
                              </div>
                              <select
                                value={form.transport_route_id}
                                onChange={e => {
                                  const rId = e.target.value;
                                  set('transport_route_id', rId);
                                  set('transport_stop_id', '');
                                }}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                              >
                                <option value="">-- Choose Route (e.g. Chakhabibullah to Zero Mile) --</option>
                                {Array.isArray(transportRoutes) && transportRoutes.map(r => {
                                  const fare = r.fare || r.fee_amount || 0;
                                  const fareStr = fare > 0 ? ` (₹${fare}/mo)` : '';
                                  const vehStr = r.vehicle_number ? ` • Bus: ${r.vehicle_number}` : '';
                                  return (
                                    <option key={r.id} value={r.id}>
                                      {r.route_name || r.name || `Route #${r.id}`}{fareStr}{vehStr}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {form.transport_route_id && (
                              <div>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                  Pickup / Drop Bus Stop (Optional)
                                </label>
                                <select
                                  value={form.transport_stop_id}
                                  onChange={e => set('transport_stop_id', e.target.value)}
                                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                                >
                                  <option value="">-- Select Stop (or assign later in Transport) --</option>
                                  {(selectedRoute?.stops && selectedRoute.stops.length > 0 ? selectedRoute.stops : transportStops).map((s, idx) => {
                                    const sId = s.stop_id || s.id;
                                    const sName = s.stop_name || s.name || `Stop #${sId}`;
                                    const eta = s.estimated_time ? ` (${s.estimated_time})` : '';
                                    return (
                                      <option key={sId || idx} value={sId}>
                                        {s.sequence ? `#${s.sequence} ` : ''}{sName}{eta}
                                      </option>
                                    );
                                  })}
                                </select>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                                  Stop abhi select karein ya Transport Manager baad me Transport module se set/change karega.
                                </div>
                              </div>
                            )}

                            <div style={{ fontSize: 11.5, color: '#0369a1', background: '#e0f2fe', padding: '9px 12px', borderRadius: 8, lineHeight: 1.4 }}>
                              ⚡ <strong>Centralized Sync:</strong> Student automatically Transport roster me enroll hoga, aur ₹{selectedRoute?.fare || selectedRoute?.fee_amount || 0} Step 7 (Fee Schedule) me add ho gaya hai.
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                            Student does not require school bus transport (Day Scholar). No transport charges applied.
                          </div>
                        )}
                      </div>

                      {/* Hostel Box */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🏢</span> Hostel Facility
                          </h4>
                          <select
                            value={form.hostel_required}
                            onChange={e => set('hostel_required', e.target.value)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">Day Scholar</option>
                            <option value="Yes">Hostel Boarder</option>
                          </select>
                        </div>

                        {form.hostel_required === 'Yes' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>
                                  Select Hostel Building / Wing *
                                </label>
                                {hostelMonthlyRate > 0 && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 8px', borderRadius: 4 }}>
                                    Fee: ₹{hostelMonthlyRate.toLocaleString('en-IN')}/mo
                                  </span>
                                )}
                              </div>
                              <select
                                value={form.hostel_id}
                                onChange={e => {
                                  const hId = e.target.value;
                                  setForm(f => ({
                                    ...f,
                                    hostel_id: hId,
                                    hostel_fee_structure_id: '',
                                    hostel_monthly_fee: '',
                                    hostel_deposit: ''
                                  }));
                                }}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                              >
                                <option value="">-- Select Hostel --</option>
                                {Array.isArray(hostels) && hostels.map(h => (
                                  <option key={h.id} value={h.id}>{h.name} ({h.hostel_type || h.gender_type || h.gender || 'Co-Ed'})</option>
                                ))}
                              </select>
                            </div>

                            {/* Dynamic Room Category / Fee Plan from Hostel Setup */}
                            {form.hostel_id && (
                              <div>
                                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                  Select Room Type &amp; Accommodation Fee Plan *
                                </label>
                                <select
                                  value={form.hostel_fee_structure_id}
                                  onChange={e => {
                                    const fsId = e.target.value;
                                    if (fsId === 'CUSTOM') {
                                      setForm(f => ({ ...f, hostel_fee_structure_id: 'CUSTOM' }));
                                    } else {
                                      const plan = hostelPlans.find(p => String(p.id) === String(fsId));
                                      setForm(f => ({
                                        ...f,
                                        hostel_fee_structure_id: fsId,
                                        hostel_monthly_fee: plan ? (plan.total_monthly || plan.monthly_fee || 0) : '',
                                        hostel_deposit: plan ? (plan.security_deposit || 0) : '',
                                        hostel_room_type: plan ? `${plan.sharing_type} ${plan.is_ac ? 'AC' : 'Non-AC'}` : ''
                                      }));
                                    }
                                  }}
                                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                                >
                                  <option value="">-- Choose Room Category &amp; Pricing --</option>
                                  {hostelPlans
                                    .filter(p => !form.hostel_id || String(p.hostel_id) === String(form.hostel_id) || !p.hostel_id)
                                    .map(p => (
                                      <option key={p.id} value={p.id}>
                                        {p.sharing_type} {p.is_ac ? '(AC)' : '(Non-AC)'} — ₹{(p.total_monthly || p.monthly_fee || 0).toLocaleString('en-IN')}/mo {p.security_deposit ? `(+ ₹${Number(p.security_deposit).toLocaleString('en-IN')} Deposit)` : ''} {p.mess_charges ? '(Mess Incl.)' : ''}
                                      </option>
                                    ))}
                                  <option value="CUSTOM">Custom Room / Direct Rate Entry</option>
                                </select>
                              </div>
                            )}

                            {/* Custom Fee Entry if selected or if no slabs configured */}
                            {(form.hostel_fee_structure_id === 'CUSTOM' || (form.hostel_id && hostelPlans.filter(p => String(p.hostel_id) === String(form.hostel_id)).length === 0)) && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#fff', padding: 10, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                                    Monthly Rent (₹/mo) *
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 4500"
                                    value={form.hostel_monthly_fee}
                                    onChange={e => set('hostel_monthly_fee', e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                                    Security Deposit (₹ One-Time)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 1000"
                                    value={form.hostel_deposit}
                                    onChange={e => set('hostel_deposit', e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                                  />
                                </div>
                              </div>
                            )}

                            {hostelMonthlyRate > 0 && (
                              <div style={{ fontSize: 11.5, color: '#0369a1', background: '#e0f2fe', padding: '9px 12px', borderRadius: 8, lineHeight: 1.4 }}>
                                ⚡ <strong>Centralized Hostel Sync:</strong> Monthly Accommodation ₹{hostelMonthlyRate.toLocaleString('en-IN')}/mo {hostelDeposit > 0 ? `+ Security Deposit ₹${hostelDeposit.toLocaleString('en-IN')} (One-time)` : ''} Step 7 (Fee Schedule) me auto-add ho gaya hai.
                              </div>
                            )}

                            <div>
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Special Requests / Remarks
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Ground floor preferred, vegetarian mess"
                                value={form.hostel_remarks}
                                onChange={e => set('hostel_remarks', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>

                            <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '8px 12px', borderRadius: 6 }}>
                              ℹ️ Room/Bed allocation can also be finalized by the Hostel Warden via Hostel Management.
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                            Student is registered as a Day Scholar (no hostel boarding).
                          </div>
                        )}
                      </div>

                      {/* Library Box */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📚</span> Library Membership
                          </h4>
                          <select
                            value={form.library_required}
                            onChange={e => set('library_required', e.target.value)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No Library Card</option>
                            <option value="Yes">Yes, Issue Card</option>
                          </select>
                        </div>

                        {form.library_required === 'Yes' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Library Admission / Membership Fee (₹)
                              </label>
                              <input
                                type="number"
                                placeholder={String(defaultLibRate)}
                                value={form.library_fee || ''}
                                onChange={e => set('library_fee', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', background: '#fff' }}
                              />
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                Default Rate: ₹{defaultLibRate} (configurable in Fee Setup)
                              </div>
                            </div>

                            <div style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: 6 }}>
                              ℹ️ Automatically creates a Library Member profile and activates book borrowing privileges.
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                            Student does not require library membership card initially. Can be registered later in Library section.
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 6: Documents */}
                {currentStep === 6 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                          Step 6: Optional KYC &amp; Verification Documents
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                          Upload verification documents now or proceed directly. Documents can be uploaded anytime later from the Student Profile.
                        </p>
                      </div>
                      <span style={{ fontSize: 11, background: '#ecfdf5', color: '#047857', padding: '4px 12px', borderRadius: 6, fontWeight: 700 }}>
                        Upload Later Enabled (Skippable)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      
                      {/* Student Aadhaar */}
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>1. Student Aadhaar Card</span>
                          {studentAadharFile && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Attached</span>}
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748b' }}>PDF or clear front/back photo (Max 10MB)</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label style={{ flex: 1, textAlign: 'center', background: '#fff', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                            📁 Browse File
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setStudentAadharFile)} />
                          </label>
                          <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                            📸 Camera / Scan
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setStudentAadharFile)} />
                          </label>
                        </div>
                      </div>

                      {/* Parent Aadhaar */}
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>2. Parent / Guardian Aadhaar</span>
                          {parentAadharFile && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Attached</span>}
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748b' }}>Father, Mother, or Legal Guardian identity proof</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label style={{ flex: 1, textAlign: 'center', background: '#fff', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                            📁 Browse File
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setParentAadharFile)} />
                          </label>
                          <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                            📸 Camera / Scan
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setParentAadharFile)} />
                          </label>
                        </div>
                      </div>

                      {/* Birth Certificate */}
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>3. Birth Certificate</span>
                          {birthCertFile && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Attached</span>}
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748b' }}>Municipal or Gram Panchayat birth document</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label style={{ flex: 1, textAlign: 'center', background: '#fff', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                            📁 Browse File
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setBirthCertFile)} />
                          </label>
                          <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                            📸 Camera / Scan
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setBirthCertFile)} />
                          </label>
                        </div>
                      </div>

                      {/* Transfer Certificate (TC) - Skipped if 1st School */}
                      {!form.is_first_school ? (
                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>4. Transfer Certificate (TC)</span>
                            {tcFile && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Attached</span>}
                          </div>
                          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748b' }}>Issued and signed by previous school head</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <label style={{ flex: 1, textAlign: 'center', background: '#fff', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                              📁 Browse File
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setTcFile)} />
                            </label>
                            <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '7px 10px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                              📸 Camera / Scan
                              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setTcFile)} />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 10, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>🎒</span>
                          <div style={{ fontSize: 11.5, color: '#166534' }}>
                            <strong>Transfer Certificate Not Required:</strong> Student is in their 1st school enrollment.
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* STEP 7: Fee & Charges */}
                {currentStep === 7 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                          Step 7: Admission Fee Setup &amp; Payment Ledger
                        </h3>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                          Auto-configured from the published academic fee structure for <strong>{selectedClass?.name || 'Class'}</strong> (Session {form.session}).
                        </p>
                      </div>
                      <span style={{
                        background: '#eff6ff',
                        color: '#0284c7',
                        border: '1px solid #bfdbfe',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        📅 Session: {form.session}
                      </span>
                    </div>

                    {loadingFeePlan ? (
                      <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>🔄</div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Fetching Published Rate Card &amp; Payment Cadences...</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Loading fee heads mapped for {selectedClass?.name || 'Selected Class'}</div>
                      </div>
                    ) : !publishedStructure ? (
                      /* WARNING & ACTIONABLE REDIRECT IF NO PUBLISHED PLAN */
                      <div style={{
                        background: '#fffbeb',
                        border: '1.5px solid #fde68a',
                        borderRadius: 12,
                        padding: '24px 28px',
                        boxShadow: '0 2px 8px rgba(245,158,11,0.08)'
                      }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 36, lineHeight: 1 }}>⚠️</span>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#92400e' }}>
                              No Published Fee Plan Found for {selectedClass?.name || 'Selected Class'} in Session {form.session}
                            </h4>
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                              Before admitting students, a fee rate card should be published for this class so that fee schedules, accounting ledgers, and receipt numbers are generated accurately and transparently.
                            </p>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => navigate(resolveTenantPath(`/finance/setup?class_id=${form.class_id}&session=${form.session}`, user))}
                                style={{
                                  background: '#0B3B7B',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '10px 18px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  boxShadow: '0 2px 6px rgba(11,59,123,0.25)'
                                }}
                              >
                                ⚙️ Configure &amp; Publish Fee Plan for {selectedClass?.name || 'Class'} →
                              </button>
                              <button
                                type="button"
                                onClick={() => fetchAdmissionFeePlan(form.class_id, form.session)}
                                style={{
                                  background: '#fff',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  padding: '10px 16px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🔄 Check Again
                              </button>
                            </div>

                            {/* Emergency Fallback */}
                            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed #fcd34d' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                                🚨 Emergency Admission Fee (Legacy Override):
                              </div>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <span style={{ fontSize: 12.5, color: '#78350f' }}>Initial Charge (₹):</span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={form.admission_fee || ''}
                                  onChange={e => set('admission_fee', e.target.value)}
                                  style={{ width: 140, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}
                                />
                                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>*Will record as legacy admission charge</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* PUBLISHED FEE PLAN CONFIGURATION */
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
                        
                        {/* Left: Dynamic Breakdown & Payment Cadence */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          
                          {/* Active Rate Card Header */}
                          <div style={{
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: 10,
                            padding: '12px 18px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Active Rate Card
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>
                                {publishedStructure.name} <span style={{ fontSize: 11.5, color: '#166534', fontWeight: 600 }}>v{publishedStructure.version || 1}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 4 }}>
                                ✓ PUBLISHED
                              </span>
                              <div style={{ fontSize: 12, color: '#166534', marginTop: 3, fontWeight: 600 }}>
                                ₹ {Number(publishedStructure.total_amount || 0).toLocaleString('en-IN')}/mo base
                              </div>
                            </div>
                          </div>

                          {/* Payment Cadence Selector */}
                          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#0B3B7B' }}>
                                📅 Payment Cadence &amp; Duration:
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
                                    onClick={() => {
                                      setSelectedPaymentPlan(plan);
                                      set('payment_plan_id', plan.id);
                                    }}
                                    style={{
                                      padding: '10px 8px',
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
                                      <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                                        {plan.discount_type === 'PERCENTAGE' ? `${plan.discount_value}% Off` : `₹${plan.discount_value} Off`}
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Itemized Fee Breakdown Table */}
                          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>Itemized Particulars ({monthsCount} Month{monthsCount > 1 ? 's' : ''})</span>
                                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>Frequency Multipliers Applied</span>
                              </div>
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
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddCustomFee(s => !s)}
                                    style={{
                                      background: '#10b98115',
                                      color: '#059669',
                                      border: '1px solid #10b98150',
                                      padding: '3px 10px',
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                  >
                                    <i className="ti ti-plus" /> Add Fee Item
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
                                    {isCustomizingFees ? '✓ Done Editing' : '✏️ Edit Rates'}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div style={{ padding: '8px 16px', fontSize: 12 }}>
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
                                      <td colSpan={5} style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <input
                                            type="text"
                                            placeholder="Fee Item Name (e.g. Uniform, Books, Registration, Caution)"
                                            value={newCustomItem.name}
                                            onChange={e => setNewCustomItem(prev => ({ ...prev, name: e.target.value }))}
                                            style={{ flex: 2, minWidth: 200, padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 12 }}
                                          />
                                          <select
                                            value={newCustomItem.category}
                                            onChange={e => setNewCustomItem(prev => ({ ...prev, category: e.target.value }))}
                                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 12, background: '#fff' }}
                                          >
                                            <option value="ACADEMIC">ACADEMIC</option>
                                            <option value="AUXILIARY">AUXILIARY</option>
                                            <option value="ONE_TIME">ONE_TIME</option>
                                            <option value="ACTIVITY">ACTIVITY</option>
                                          </select>
                                          <select
                                            value={newCustomItem.is_recurring ? 'RECURRING' : 'ONE_TIME'}
                                            onChange={e => setNewCustomItem(prev => ({ ...prev, is_recurring: e.target.value === 'RECURRING' }))}
                                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 12, background: '#fff' }}
                                          >
                                            <option value="ONE_TIME">One-Time (Fixed)</option>
                                            <option value="RECURRING">Monthly Recurring</option>
                                          </select>
                                          <input
                                            type="number"
                                            min="0"
                                            placeholder="Rate (₹)"
                                            value={newCustomItem.amount}
                                            onChange={e => setNewCustomItem(prev => ({ ...prev, amount: e.target.value }))}
                                            style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 12 }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!newCustomItem.name.trim() || !newCustomItem.amount) {
                                                toast.error('Item name aur amount enter karein');
                                                return;
                                              }
                                              setCustomFeeList(prev => [...prev, { ...newCustomItem, id: Date.now() }]);
                                              setNewCustomItem({ name: '', category: 'ACADEMIC', amount: '', is_recurring: false });
                                              setShowAddCustomFee(false);
                                              toast.success('Fee item added');
                                            }}
                                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                          >
                                            ✓ Add
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setShowAddCustomFee(false)}
                                            style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}
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

                                  {/* Transport Service Addon if opted in */}
                                  {form.transport_required === 'Yes' && (
                                    <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
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

                                  {/* Hostel Accommodation Addon if opted in */}
                                  {form.hostel_required === 'Yes' && (
                                    <>
                                      <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
                                        <td style={{ padding: '7px 0', fontWeight: 600, color: '#0284c7' }}>
                                          🛏️ Hostel Accommodation ({selectedHostel?.name || 'Hostel'}{selectedHostelPlan ? ` - ${selectedHostelPlan.sharing_type} ${selectedHostelPlan.is_ac ? '(AC)' : '(Non-AC)'}` : ''})
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
                                        <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
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

                                  {/* Library Membership Addon if opted in */}
                                  {form.library_required === 'Yes' && (
                                    <tr style={{ borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
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

                                  {/* Gross Total Subtotal */}
                                  <tr style={{ borderTop: '2px solid #cbd5e1' }}>
                                    <td colSpan={4} style={{ padding: '10px 0', fontWeight: 700, color: '#475569' }}>
                                      Gross Admission Demand:
                                    </td>
                                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: 13 }}>
                                      ₹ {grossTotal.toLocaleString('en-IN')}.00
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Concession / Discounts / Special Waiver */}
                          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0B3B7B', marginBottom: 10 }}>
                              🏷️ Discounts &amp; Authorized Concession / Waiver
                            </div>

                            {advanceDiscount > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 12px', background: '#dcfce7', borderRadius: 6, border: '1px solid #86efac' }}>
                                <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                                  🎁 {selectedPaymentPlan?.name} Advance Discount:
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>
                                  - ₹ {advanceDiscount.toLocaleString('en-IN')}.00
                                </span>
                              </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'center' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                                  Special Waiver (₹)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={grossTotal}
                                  value={manualWaiver}
                                  onChange={e => setManualWaiver(Math.max(0, parseFloat(e.target.value) || 0))}
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, textAlign: 'right' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                                  Authorization / Waiver Reason {waiverNum > 0 && <span style={{ color: '#ef4444' }}>*</span>}
                                </label>
                                <select
                                  value={waiverReason}
                                  onChange={e => setWaiverReason(e.target.value)}
                                  disabled={waiverNum <= 0}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    border: '1px solid #cbd5e1',
                                    fontSize: 12.5,
                                    background: waiverNum <= 0 ? '#f1f5f9' : '#fff'
                                  }}
                                >
                                  {WAIVER_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Net Payable Highlights Card */}
                          <div style={{
                            background: 'linear-gradient(135deg, #0B3B7B 0%, #1e40af 100%)',
                            color: '#fff',
                            padding: '16px 20px',
                            borderRadius: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 4px 12px rgba(11,59,123,0.2)'
                          }}>
                            <div>
                              <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Total Net Admission Payable</div>
                              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                                Gross ₹ {grossTotal.toLocaleString('en-IN')} {totalDeductions > 0 ? `— Deductions ₹ ${totalDeductions.toLocaleString('en-IN')}` : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: '#4ade80' }}>
                              ₹ {netPayable.toLocaleString('en-IN')}.00
                            </div>
                          </div>

                        </div>

                        {/* Right: Payment Setup & Official Ledger Synchronisation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', fontWeight: 800 }}>
                              💳 Admission Payment Collection
                            </h4>

                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                Initial Payment Status
                              </label>
                              <select
                                value={form.payment_status}
                                onChange={e => {
                                  const st = e.target.value;
                                  set('payment_status', st);
                                  if (st === 'PAID') {
                                    setPaymentAmount(netPayable);
                                  } else if (st === 'DUE') {
                                    setPaymentAmount(0);
                                  }
                                }}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', fontWeight: 700 }}
                              >
                                <option value="PAID">PAID (Full Payment Received: ₹ {netPayable.toLocaleString('en-IN')})</option>
                                <option value="PARTIAL">PARTIAL (Partially Paid Now)</option>
                                <option value="DUE">DUE / PENDING (Pay Later / No Payment Now)</option>
                              </select>
                            </div>

                            {form.payment_status !== 'DUE' && (
                              <>
                                <div>
                                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                    Payment Mode
                                  </label>
                                  <select
                                    value={form.payment_mode}
                                    onChange={e => set('payment_mode', e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                                  >
                                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </div>

                                {form.payment_status === 'PARTIAL' && (
                                  <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                      Amount Collected Now (₹)
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={netPayable}
                                      value={paymentAmount}
                                      placeholder={`Max ₹ ${netPayable}`}
                                      onChange={e => setPaymentAmount(e.target.value)}
                                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                                    />
                                  </div>
                                )}

                                <div>
                                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                    Transaction Ref / Cheque No / UPI ID
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. UPI-984214 / CHQ-10492"
                                    value={paymentReference}
                                    onChange={e => setPaymentReference(e.target.value)}
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                                  />
                                </div>
                              </>
                            )}

                            <div style={{ background: '#e0f2fe', padding: 12, borderRadius: 8, border: '1px solid #bae6fd', fontSize: 11.5, color: '#0369a1', lineHeight: 1.5 }}>
                              <strong>Accounting &amp; Ledger Synchronization:</strong>
                              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                                <li>Official student ledger credit entry automatically generated.</li>
                                <li>Sequential receipt (<code>REC-{new Date().getFullYear()}-XXXXXX</code>) issued instantly.</li>
                                <li>Fee demands categorized by fee head in school accounting.</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* STEP 8: Review & Submit */}
                {currentStep === 8 && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 8: Final Review &amp; Submit
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Review the student profile and configuration before generating the official admission record.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      
                      {/* Card 1: Student Identity */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <strong style={{ color: '#0B3B7B', fontSize: 13.5 }}>👤 Student Identity</strong>
                          <button onClick={() => setCurrentStep(1)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                        </div>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
                          {photoPreview ? (
                            <img src={photoPreview} alt="Student" style={{ width: 50, height: 60, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                          ) : (
                            <div style={{ width: 50, height: 60, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>{form.name}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>DOB: {form.dob} | Gender: {form.gender}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Category: {form.category} | Blood: {form.blood_group}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: '#475569' }}>Aadhaar: <strong>{form.aadhar_no || 'Not provided'}</strong></div>
                      </div>

                      {/* Card 2: Academic Enrolment */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <strong style={{ color: '#0B3B7B', fontSize: 13.5 }}>🎓 Academic Enrolment</strong>
                          <button onClick={() => setCurrentStep(4)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                          <div>Class: <strong>{selectedClass?.name || 'Class'}</strong> {selectedClass?.section ? `(Sec ${selectedClass.section})` : ''}</div>
                          <div>Session: <strong>{form.session}</strong></div>
                          <div>Admission Date: <strong>{form.admission_date}</strong></div>
                          <div>Admission No: <strong>{form.manual_admission_no || 'Monotonic Auto-Generated'}</strong></div>
                        </div>
                      </div>

                      {/* Card 3: Parent & Contact */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <strong style={{ color: '#0B3B7B', fontSize: 13.5 }}>👨‍👩‍👧 Parent &amp; Contact</strong>
                          <button onClick={() => setCurrentStep(2)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                          <div>Father: <strong>{form.father_name || '—'}</strong> ({form.father_occupation || 'Occupation N/A'})</div>
                          <div>Primary Phone: <strong>{form.parent_phone}</strong></div>
                          <div>Mother: <strong>{form.mother_name || '—'}</strong></div>
                          <div>Address: <strong>{form.address}, {form.city}</strong></div>
                        </div>
                      </div>

                      {/* Card 4: Services & Previous School */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <strong style={{ color: '#0B3B7B', fontSize: 13.5 }}>🏫 School Record &amp; Services</strong>
                          <button onClick={() => setCurrentStep(3)} style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                        </div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                          <div>1st School Enrollment: <strong>{form.is_first_school ? 'Yes (1st School)' : 'No (Transfer)'}</strong></div>
                          {!form.is_first_school && <div>Previous School: <strong>{form.previous_school_name || 'Not specified'}</strong></div>}
                          <div>Transport Service: <strong>{form.transport_required === 'Yes' ? (selectedRoute?.route_name || 'Opted In') : 'No'}</strong></div>
                          <div>Hostel Accommodation: <strong>{form.hostel_required === 'Yes' ? `${selectedHostel?.name || 'Opted In'}${selectedHostelPlan ? ` (${selectedHostelPlan.sharing_type} ${selectedHostelPlan.is_ac ? 'AC' : 'Non-AC'})` : ''}` : 'Day Scholar'}</strong></div>
                          <div>Fee Cadence: <strong>{selectedPaymentPlan?.name || 'Monthly'} ({monthsCount} Month{monthsCount > 1 ? 's' : ''})</strong></div>
                          {advanceDiscount > 0 && <div style={{ color: '#16a34a' }}>Advance Discount: <strong>- ₹ {advanceDiscount.toLocaleString('en-IN')}</strong></div>}
                          {waiverNum > 0 && <div style={{ color: '#0284c7' }}>Special Waiver: <strong>- ₹ {waiverNum.toLocaleString('en-IN')}</strong> ({waiverReason})</div>}
                          <div>Total Net Fee: <strong style={{ color: '#16a34a', fontSize: 13.5 }}>₹ {totalFee.toLocaleString('en-IN')}</strong> ({form.payment_status})</div>
                        </div>
                      </div>

                    </div>

                    {/* Step 8: Fee Payment Collection & Confirmation Panel */}
                    <div style={{
                      marginTop: 20,
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 12,
                      padding: 20,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                            💳 Admission Fee Payment &amp; Confirmation
                          </h4>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                            You can pay fees immediately to confirm admission, or skip payment for temporary (provisional) admission.
                          </p>
                        </div>
                        <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '6px 14px', borderRadius: 8, textAlign: 'right' }}>
                          <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Total Net Admission Fee:</span>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
                            ₹ {totalFee.toLocaleString('en-IN')}.00
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'center' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Payment Mode
                          </label>
                          <select
                            value={form.payment_mode}
                            onChange={e => set('payment_mode', e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                          >
                            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Amount to Collect (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={totalFee}
                            value={paymentAmount !== '' ? paymentAmount : totalFee}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder={`₹ ${totalFee}`}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                            Transaction Ref / Cheque No / UPI ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. UPI-728192 / Cash Counter"
                            value={paymentReference}
                            onChange={e => setPaymentReference(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                        <span style={{ fontSize: 18 }}>💡</span>
                        <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                          <strong>Skip vs Direct Payment Rule:</strong> If you choose <em>"Skip Payment (Provisional Admission)"</em>, the student is admitted immediately with <strong>PROVISIONAL (Temporary)</strong> status. As soon as fees are deposited through Fees &amp; Finance, Quick Counter, or Student Profile, status automatically turns to <strong>CONFIRMED (ACTIVE)</strong> everywhere in real time.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* FOOTER NAVIGATION (Sticky to bottom so always visible) */}
              <div style={{
                padding: '16px 36px',
                borderTop: '1.5px solid #cbd5e1',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                position: 'sticky',
                bottom: 0,
                zIndex: 30,
                boxShadow: '0 -4px 16px rgba(0,0,0,0.08)'
              }}>
                {currentStep > 1 ? (
                  <button
                    onClick={prevStep}
                    style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', color: '#475569', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ← Previous
                  </button>
                ) : <div />}

                {currentStep < STEPS.length ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {form.name && form.class_id && currentStep > 1 && currentStep < 7 && (
                      <button
                        type="button"
                        onClick={quickSkipToReview}
                        style={{
                          background: '#e0f2fe',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          padding: '10px 18px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Fast track: jump directly to final review & admission"
                      >
                        ⚡ Quick Admission (Review)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={skipStep}
                      style={{
                        background: '#f8fafc',
                        color: '#0B3B7B',
                        border: '1.5px solid #0B3B7B',
                        padding: '10px 22px',
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(11,59,123,0.1)'
                      }}
                      title="Skip this step and fill details later"
                    >
                      Skip Step ⏭️
                    </button>

                    <button
                      onClick={nextStep}
                      style={{ background: '#0B3B7B', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Save &amp; Next →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => submit({ isSkipPayment: true })}
                      disabled={saving}
                      style={{
                        background: saving ? '#cbd5e1' : '#f59e0b',
                        color: '#ffffff',
                        border: 'none',
                        padding: '11px 22px',
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontWeight: 800,
                        cursor: saving ? 'wait' : 'pointer',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.25)'
                      }}
                    >
                      {saving ? '⏳ Submitting...' : '⏭️ Skip Payment (Provisional Admission)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => submit({ isSkipPayment: false })}
                      disabled={saving}
                      style={{
                        background: saving ? '#94a3b8' : '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '11px 26px',
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontWeight: 800,
                        cursor: saving ? 'wait' : 'pointer',
                        boxShadow: '0 4px 12px rgba(22,163,74,0.3)'
                      }}
                    >
                      {saving ? '⏳ Submitting...' : `💳 Pay ₹${totalFee.toLocaleString('en-IN')} & Confirm Admission`}
                    </button>
                  </div>
                )}
              </div>

            </div>
            )
          ) : (
            /* SUCCESS VIEW & 2-PAGE ADMISSION PREVIEW */
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              
              {/* Success Banner */}
              <div style={{
                background: done.status === 'PROVISIONAL' ? '#fffbeb' : '#dcfce7',
                border: `1px solid ${done.status === 'PROVISIONAL' ? '#fcd34d' : '#86efac'}`,
                borderRadius: 12,
                padding: '18px 24px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 32 }}>{done.status === 'PROVISIONAL' ? '⏳' : '🎉'}</span>
                  <div>
                    <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: done.status === 'PROVISIONAL' ? '#b45309' : '#15803d' }}>
                      {done.status === 'PROVISIONAL' ? 'Provisional Admission Generated (Fee Pending)' : 'Admission Confirmed Successfully!'}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: done.status === 'PROVISIONAL' ? '#92400e' : '#166534' }}>
                      {done.name} has been enrolled in {selectedClass?.name || 'Class'}. Admission No: <strong>{done.admission_no}</strong>
                      {done.status === 'PROVISIONAL' && (
                        <span style={{ display: 'block', marginTop: 4, fontWeight: 600, color: '#b45309' }}>
                          ℹ️ Temporary Admission: Fee payment is currently pending. Status will automatically update to CONFIRMED (ACTIVE) once fees are deposited.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {done.status === 'PROVISIONAL' && (
                    <button
                      onClick={() => navigate(resolveTenantPath(user, '/fees-finance/fee-collection'))}
                      style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      💳 Pay Admission Fee Now
                    </button>
                  )}
                  <button
                    onClick={handlePrintDirect}
                    style={{ background: '#0B3B7B', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    🖨️ Print Direct
                  </button>
                  <button
                    onClick={() => downloadPDF(done.id, done.name)}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📥 Download PDF (2 Pages)
                  </button>
                  <button
                    onClick={() => {
                      setDone(null);
                      setCurrentStep(1);
                      setQuickStep(1);
                      setPendingPhoto(null);
                      setPhotoPreview(null);
                      setStudentAadharFile(null);
                      setParentAadharFile(null);
                      setTcFile(null);
                      setBirthCertFile(null);
                      setForm(f => ({
                        ...f,
                        name: '',
                        parent_phone: '',
                        father_name: '',
                        aadhar_no: '',
                        manual_admission_no: '',
                        password: '12345',
                        transport_required: 'No',
                        hostel_required: 'No',
                        library_required: 'No',
                      }));
                      fetchNextAdmissionNo(form.session);
                    }}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Admit Another
                  </button>
                </div>
              </div>

              {/* STUDENT LOGIN CREDENTIALS CARD */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #0B3B7B',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 20,
                boxShadow: '0 4px 12px rgba(11,59,123,0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔐 Student Portal Login Credentials
                  </span>
                  <span style={{
                    fontSize: 11.5,
                    background: done.status === 'PROVISIONAL' ? '#fef3c7' : '#dcfce7',
                    color: done.status === 'PROVISIONAL' ? '#92400e' : '#15803d',
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontWeight: 800,
                    border: `1px solid ${done.status === 'PROVISIONAL' ? '#fde68a' : '#86efac'}`
                  }}>
                    {done.status === 'PROVISIONAL' ? '⏳ Provisional Admission (Fee Pending)' : '✅ Confirmed (ACTIVE)'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Login ID (Admission No):</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0B3B7B' }}>{done.admission_no}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Father's Name:</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{done.father_name || form.father_name || '—'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Primary Mobile:</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{done.parent_phone || form.parent_phone || '—'}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Default Password:</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', fontFamily: 'monospace' }}>{form.password || '12345'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 10 }}>
                  💡 The student or parent can immediately log into the student portal using <strong>{done.admission_no}</strong> or <strong>{done.parent_phone || form.parent_phone}</strong> with password <strong>{form.password || '12345'}</strong>.
                </div>
              </div>

              {/* Fee Receipt Card */}
              {done.fee_summary && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0B3B7B' }}>🧾 Admission Fee Receipt:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', padding: '2px 8px', borderRadius: 4 }}>
                        {done.fee_summary.receipt_no || 'REC-GENERATED'}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
                        (Status: {done.fee_summary.payment_status || 'PAID'})
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Net Demand: <strong>₹ {Number(done.fee_summary.net_payable || 0).toLocaleString('en-IN')}</strong> | 
                      Amount Collected: <strong>₹ {Number(done.fee_summary.initial_payment_amount || 0).toLocaleString('en-IN')}</strong> via {done.fee_summary.payment_mode || 'Cash'}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(resolveTenantPath('/finance/payment-logs', user))}
                    style={{
                      background: '#fff',
                      border: '1px solid #0B3B7B',
                      color: '#0B3B7B',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    View in Accounting Ledger →
                  </button>
                </div>
              )}

              {/* Printable 2-Page Admission Form Preview Container */}
              <div id="printable-admission-form" style={{ background: '#ffffff', border: '2px solid #0B3B7B', borderRadius: 12, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
                
                {/* ══ PAGE 1 PREVIEW ══ */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0B3B7B', paddingBottom: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {schoolSettings?.logo_url ? (
                        <img src={schoolSettings.logo_url} alt="Logo" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 50, height: 50, borderRadius: 6, background: '#0B3B7B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                          ★
                        </div>
                      )}
                      <div>
                        <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900, color: '#0B3B7B', textTransform: 'uppercase' }}>
                          {schoolSettings?.name || 'School Name'}
                        </h2>
                        <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 600 }}>
                          {schoolSettings?.affiliation || 'AFFILIATED TO CBSE, NEW DELHI'} | SCHOOL CODE: {schoolSettings?.code || schoolSettings?.school_code || 'SCH101'}
                        </div>
                        {(schoolSettings?.address || schoolSettings?.phone) && (
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            📍 {schoolSettings?.address || ''} | 📞 {schoolSettings?.phone || ''}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ background: '#0B3B7B', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                      Page 1 of 2
                    </div>
                  </div>

                  <div style={{ background: '#0B3B7B', color: '#fff', textAlign: 'center', padding: '5px 0', fontWeight: 800, fontSize: 12, marginBottom: 4 }}>
                    NEW ADMISSION FORM
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#0B3B7B', marginBottom: 10 }}>
                    ACADEMIC SESSION: {form.session}
                  </div>

                  {/* Admission Details */}
                  <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                      ADMISSION DETAILS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', padding: 8, gap: 8, fontSize: 11 }}>
                      <div>
                        <div><span style={{ color: '#64748b' }}>Admission No.:</span> <strong>{done.admission_no || form.manual_admission_no || 'ADM-AUTO'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Admission Date:</span> <strong>{formatIndianDate(form.admission_date)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Class Applying For:</span> <strong>{selectedClass?.name || '—'}</strong></div>
                      </div>
                      <div>
                        <div><span style={{ color: '#64748b' }}>Date of Birth:</span> <strong>{formatIndianDate(form.dob)}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Gender:</span> <strong>{form.gender}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Blood Group:</span> <strong>{form.blood_group}</strong></div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {photoPreview ? (
                          <img src={photoPreview} alt="Student" style={{ width: 70, height: 80, borderRadius: 4, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ) : (
                          <div style={{ width: 70, height: 80, borderRadius: 4, background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }}>
                            PHOTO
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student Details */}
                  <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                      STUDENT DETAILS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', padding: 8, gap: 8, fontSize: 11 }}>
                      <div>
                        <div><span style={{ color: '#64748b' }}>Student Name:</span> <strong>{form.name}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Aadhaar No.:</span> <strong>{form.aadhar_no || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Address:</span> <strong>{form.address}, {form.city}</strong></div>
                      </div>
                      <div>
                        <div><span style={{ color: '#64748b' }}>Nationality:</span> <strong>{form.nationality}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Religion:</span> <strong>{form.religion}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Mobile No.:</span> <strong>{form.parent_phone}</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Lower Side-by-Side: Parent Details & Previous School */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                        PARENT / GUARDIAN DETAILS
                      </div>
                      <div style={{ padding: 8, fontSize: 10.5, lineHeight: 1.6 }}>
                        <div><span style={{ color: '#64748b' }}>Father's Name:</span> <strong>{form.father_name}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Occupation:</span> <strong>{form.father_occupation || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Mobile No.:</span> <strong>{form.parent_phone}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Mother's Name:</span> <strong>{form.mother_name || '—'}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Mother's Occupation:</span> <strong>{form.mother_occupation || '—'}</strong></div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 10px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                        PREVIOUS SCHOOL DETAILS
                      </div>
                      <div style={{ padding: 8, fontSize: 10.5, lineHeight: 1.6 }}>
                        {form.is_first_school ? (
                          <div style={{ textAlign: 'center', padding: '16px 8px', color: '#0B3B7B' }}>
                            <strong>First School Admission</strong><br />
                            <span style={{ fontSize: 10, color: '#64748b' }}>This is the student's 1st school; no previous school or TC details applicable.</span>
                          </div>
                        ) : (
                          <>
                            <div><span style={{ color: '#64748b' }}>School Name:</span> <strong>{form.previous_school_name || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Last Class:</span> <strong>{form.previous_class || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>TC No.:</span> <strong>{form.previous_tc_no || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>TC Date:</span> <strong>{formatIndianDate(form.previous_tc_date)}</strong></div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ══ PAGE 2 PREVIEW (With Page-Break for Print) ══ */}
                <div className="page-break-print" style={{ marginTop: 24, paddingTop: 20, borderTop: '2px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0B3B7B', paddingBottom: 12, marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0B3B7B', textTransform: 'uppercase' }}>
                      {schoolSettings?.name || 'School Name'}
                    </h3>
                    <div style={{ background: '#0B3B7B', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                      Page 2 of 2
                    </div>
                  </div>

                  <div style={{ background: '#0B3B7B', color: '#fff', textAlign: 'center', padding: '5px 0', fontWeight: 800, fontSize: 12, marginBottom: 14 }}>
                    NEW ADMISSION FORM (CONTINUED)
                  </div>

                  {/* Documents Checklist & Fee Table Side-by-Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 12, marginBottom: 16 }}>
                    
                    {/* Documents Checklist */}
                    <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 8px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                        DOCUMENTS SUBMITTED
                      </div>
                      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                        <tbody>
                          {[
                            ['1. Birth Certificate', birthCertFile ? '✓' : '—'],
                            ['2. Aadhaar Card (Student)', (studentAadharFile || form.aadhar_no) ? '✓' : '—'],
                            ['3. Aadhaar Card (Parents)', (parentAadharFile || form.parent_aadhar_no) ? '✓' : '—'],
                            ['4. Passport Photographs', (photoPreview || pendingPhoto) ? '✓' : '—'],
                            ['5. Transfer Certificate (TC)', (!form.is_first_school && (tcFile || form.previous_tc_no)) ? '✓' : '—'],
                            ['6. Address Proof', form.address ? '✓' : '—'],
                            ['7. Category / Caste Certificate', form.category !== 'General' ? '✓' : '—'],
                            ['8. Transport / Hostel Enrolment', (form.transport_required === 'Yes' || form.hostel_required === 'Yes') ? '✓' : '—'],
                          ].map(([item, status], idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '4px 6px' }}>{item}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: status === '✓' ? '#16a34a' : '#94a3b8' }}>
                                {status === '✓' ? '[✓] Yes' : '[  ] No'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Fee Details Table */}
                    <div style={{ border: '1px solid #93c5fd', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ background: '#0B3B7B', color: '#fff', padding: '4px 8px', fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
                        FEE DETAILS AT ADMISSION
                      </div>
                      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: 9.5 }}>
                            <th scope="col" style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>Fee Component</th>
                            <th scope="col" style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Admission &amp; Registration Fee</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {(Number(form.admission_fee || 0) + Number(form.registration_fee || 0)).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Tuition Fee (Quarterly)</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {Number(form.tuition_fee || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Caution Money (Refundable)</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {Number(form.caution_money || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Development &amp; Smart Class</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {(Number(form.development_fee || 0) + Number(form.smart_class_fee || 0)).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ background: '#eff6ff', fontWeight: 800, color: '#0B3B7B' }}>
                            <td style={{ padding: '6px 6px' }}>TOTAL ADMISSION AMOUNT</td>
                            <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹ {totalFee.toLocaleString('en-IN')}.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>

                  {/* Declaration & School Seal Block */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 10, alignItems: 'center', border: '1px solid #93c5fd', borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 9.5, color: '#334155', lineHeight: 1.4 }}>
                      <strong>DECLARATION:</strong><br />
                      I/We declare that all information provided in this admission form is true and verified. I/We agree to abide by all school and board rules.
                      <div style={{ marginTop: 12 }}>
                        ________________________<br />
                        <strong>Signature of Parent / Guardian</strong>
                      </div>
                    </div>

                    <div style={{
                      width: 75, height: 75, borderRadius: '50%',
                      border: '2px dashed #0B3B7B',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#0B3B7B', fontWeight: 800, fontSize: 8.5,
                      textAlign: 'center', margin: '0 auto'
                    }}>
                      <span>SCHOOL</span>
                      <span style={{ fontSize: 9.5 }}>SEAL</span>
                    </div>

                    <div style={{ fontSize: 9.5, lineHeight: 1.6, borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
                      <strong style={{ color: '#0B3B7B' }}>FOR SCHOOL OFFICE USE:</strong><br />
                      Verified By: ____________________<br />
                      Approved By: ____________________<br />
                      Admission Date: {formatIndianDate(form.admission_date)}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
