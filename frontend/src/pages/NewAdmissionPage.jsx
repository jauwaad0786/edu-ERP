import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const GENDERS = ['Male', 'Female', 'Other'];
const SESSIONS = ['2024-25', '2025-26', '2026-27'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'UPI / Online', 'Net Banking', 'Demand Draft'];
const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'DUE'];

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

export default function NewAdmissionPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [classes, setClasses] = useState([]);
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [transportStops, setTransportStops] = useState([]);
  const [hostels, setHostels] = useState([]);
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
    session: '2025-26',
    admission_date: new Date().toISOString().split('T')[0],

    // Step 5: Services (Transport & Hostel)
    transport_required: 'No',
    transport_route_id: '',
    transport_stop_id: '',
    hostel_required: 'No',
    hostel_id: '',
    hostel_remarks: '',

    // Step 7: Fee particulars
    admission_fee: 5000,
    caution_money: 3000,
    tuition_fee: 12000,
    development_fee: 2000,
    activity_fee: 1000,
    registration_fee: 1000,
    smart_class_fee: 1500,
    library_fee: 800,
    examination_fee: 1200,
    other_fee: 500,
    payment_mode: 'Cash',
    payment_status: 'PAID',
    password: 'Student@123',
  });

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

    // 3. Fetch Transport Routes (optional addon)
    api.get('/transport/routes')
      .then(r => setTransportRoutes(r.data?.routes || r.data || []))
      .catch(() => {});

    // 4. Fetch Transport Stops
    api.get('/transport/stops')
      .then(r => setTransportStops(r.data?.stops || r.data || []))
      .catch(() => {});

    // 5. Fetch Hostels (optional addon)
    api.get('/hostels')
      .then(r => setHostels(r.data?.hostels || r.data || []))
      .catch(() => {});
  }, []);

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

  function prevStep() {
    setCurrentStep(s => Math.max(s - 1, 1));
  }

  async function submit(e) {
    if (e) e.preventDefault();
    if (!form.name || !form.parent_phone || !form.class_id) {
      toast.error('Please fill in Student Name, Mobile Number and Class');
      return;
    }
    if (saving) return; // Double-click protection

    setSaving(true);
    try {
      const firstName = (form.name || 'student').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const autoEmail = form.parent_email || `${firstName || 'student'}@${schoolSlug}.com`;

      const payload = {
        ...form,
        email: autoEmail,
        parent_name: form.father_name || form.guardian_name || form.parent_name,
        admission_no: form.manual_admission_no ? form.manual_admission_no.trim() : undefined,
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
      toast.success('🎉 Student admitted successfully! Admission No: ' + (res.data.admission_no || 'Generated'));
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

  const selectedClass = classes.find(c => String(c.id) === String(form.class_id));
  const selectedRoute = transportRoutes.find(r => String(r.id) === String(form.transport_route_id));
  const selectedStop  = transportStops.find(s => String(s.id) === String(form.transport_stop_id));
  const selectedHostel = hostels.find(h => String(h.id) === String(form.hostel_id));

  const totalFee = Number(form.admission_fee || 0) +
    Number(form.caution_money || 0) +
    Number(form.tuition_fee || 0) +
    Number(form.development_fee || 0) +
    Number(form.activity_fee || 0) +
    Number(form.registration_fee || 0) +
    Number(form.smart_class_fee || 0) +
    Number(form.library_fee || 0) +
    Number(form.examination_fee || 0) +
    Number(form.other_fee || 0);

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

          {!done ? (
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              {/* STEP PROGRESS BAR */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', overflowX: 'auto' }}>
                {STEPS.map((s) => {
                  const isActive = s.id === currentStep;
                  const isPassed = s.id < currentStep;
                  return (
                    <div
                      key={s.id}
                      onClick={() => { if (isPassed) setCurrentStep(s.id); }}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        padding: '14px 8px',
                        textAlign: 'center',
                        borderBottom: isActive ? '3px solid #0B3B7B' : '3px solid transparent',
                        background: isActive ? '#ffffff' : 'transparent',
                        cursor: isPassed ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: isActive ? '#0B3B7B' : isPassed ? '#16A34A' : '#e2e8f0',
                        color: isActive || isPassed ? '#ffffff' : '#64748b',
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

                {/* STEP 5: Services (Transport & Hostel) */}
                {currentStep === 5 && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 5: Optional School Services
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Opt-in to daily school bus transport routes or boarding hostel accommodations.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      
                      {/* Transport Box */}
                      <div style={{ background: '#f8fafc', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🚌</span> School Transport Service
                          </h4>
                          <select
                            value={form.transport_required}
                            onChange={e => set('transport_required', e.target.value)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, background: '#fff' }}
                          >
                            <option value="No">No Transport</option>
                            <option value="Yes">Yes, Opt-In</option>
                          </select>
                        </div>

                        {form.transport_required === 'Yes' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Select Transport Route
                              </label>
                              <select
                                value={form.transport_route_id}
                                onChange={e => set('transport_route_id', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                              >
                                <option value="">-- Select Route --</option>
                                {transportRoutes.map(r => (
                                  <option key={r.id} value={r.id}>{r.route_name || r.name || `Route #${r.id}`}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Pickup / Drop Bus Stop
                              </label>
                              <select
                                value={form.transport_stop_id}
                                onChange={e => set('transport_stop_id', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                              >
                                <option value="">-- Select Stop --</option>
                                {transportStops.map(s => (
                                  <option key={s.id} value={s.id}>{s.stop_name || s.name || `Stop #${s.id}`}</option>
                                ))}
                              </select>
                            </div>

                            <div style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: 6 }}>
                              ℹ️ Transport assignment will automatically link the student to daily GPS route tracking and transport fee ledger.
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                            Student does not require school bus transport.
                          </div>
                        )}
                      </div>

                      {/* Hostel Box */}
                      <div style={{ background: '#f8fafc', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🏢</span> Boarding &amp; Hostel Facility
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
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Select Hostel Building / Wing
                              </label>
                              <select
                                value={form.hostel_id}
                                onChange={e => set('hostel_id', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, background: '#fff' }}
                              >
                                <option value="">-- Select Hostel --</option>
                                {hostels.map(h => (
                                  <option key={h.id} value={h.id}>{h.name} ({h.gender_type || 'Co-Ed'})</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                Special Room Requests / Dietary Remarks
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Ground floor preferred, vegetarian mess"
                                value={form.hostel_remarks}
                                onChange={e => set('hostel_remarks', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>

                            <div style={{ fontSize: 11, color: '#0369a1', background: '#e0f2fe', padding: '8px 12px', borderRadius: 6 }}>
                              ℹ️ Room/bed allocation can be finalized by the Hostel Warden via the Hostel Management section.
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                            Student is registered as a Day Scholar (no hostel boarding).
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
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      Step 7: Admission Fee Setup &amp; Payment Ledger
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 12.5, color: '#64748b' }}>
                      Particulars are automatically recorded in the school fee ledger upon admission confirmation.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
                      
                      {/* Left: Fee Particulars */}
                      <div style={{ background: '#f8fafc', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#0B3B7B' }}>Fee Head Breakdown (₹)</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px', fontSize: 12.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Admission Fee:</span>
                            <input type="number" value={form.admission_fee} onChange={e => set('admission_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Registration Fee:</span>
                            <input type="number" value={form.registration_fee} onChange={e => set('registration_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Tuition Fee (Q1):</span>
                            <input type="number" value={form.tuition_fee} onChange={e => set('tuition_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Development Fee:</span>
                            <input type="number" value={form.development_fee} onChange={e => set('development_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Activity Fee:</span>
                            <input type="number" value={form.activity_fee} onChange={e => set('activity_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Smart Class Fee:</span>
                            <input type="number" value={form.smart_class_fee} onChange={e => set('smart_class_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Caution Deposit:</span>
                            <input type="number" value={form.caution_money} onChange={e => set('caution_money', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Exam &amp; Library:</span>
                            <input type="number" value={form.examination_fee} onChange={e => set('examination_fee', e.target.value)} style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '2px solid #cbd5e1', fontSize: 15, fontWeight: 800, color: '#0B3B7B' }}>
                          <span>Total Admission Demand:</span>
                          <span style={{ color: '#15803d' }}>₹ {totalFee.toLocaleString('en-IN')}.00</span>
                        </div>
                      </div>

                      {/* Right: Payment Setup */}
                      <div style={{ background: '#f8fafc', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B' }}>💳 Payment Details</h4>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Payment Mode
                          </label>
                          <select
                            value={form.payment_mode}
                            onChange={e => set('payment_mode', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                          >
                            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Initial Payment Status
                          </label>
                          <select
                            value={form.payment_status}
                            onChange={e => set('payment_status', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', fontWeight: 700 }}
                          >
                            <option value="PAID">PAID (Full Payment Received)</option>
                            <option value="PARTIAL">PARTIAL (Partially Paid)</option>
                            <option value="DUE">DUE / PENDING (Pay Later)</option>
                          </select>
                        </div>

                        <div style={{ background: '#e0f2fe', padding: 12, borderRadius: 8, border: '1px solid #bae6fd', fontSize: 11.5, color: '#0369a1' }}>
                          <strong>Ledger Synchronization:</strong> An official student ledger entry and printable fee receipt will be created simultaneously with the student profile.
                        </div>
                      </div>

                    </div>
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
                          <div>Hostel Accommodation: <strong>{form.hostel_required === 'Yes' ? (selectedHostel?.name || 'Opted In') : 'Day Scholar'}</strong></div>
                          <div>Total Admission Fee: <strong style={{ color: '#16a34a' }}>₹ {totalFee.toLocaleString('en-IN')}</strong> ({form.payment_status})</div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>

              {/* FOOTER NAVIGATION */}
              <div style={{
                padding: '16px 36px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {currentStep > 1 ? (
                  <button
                    onClick={prevStep}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ← Previous
                  </button>
                ) : <div />}

                {currentStep < STEPS.length ? (
                  <button
                    onClick={nextStep}
                    style={{ background: '#0B3B7B', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Save &amp; Next →
                  </button>
                ) : (
                  <button
                    onClick={submit}
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
                    {saving ? '⏳ Submitting Admission...' : '🎓 Confirm Admission & Generate Form'}
                  </button>
                )}
              </div>

            </div>
          ) : (
            /* SUCCESS VIEW & 2-PAGE ADMISSION PREVIEW */
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              
              {/* Success Banner */}
              <div style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: 12,
                padding: '18px 24px',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 32 }}>🎉</span>
                  <div>
                    <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: '#15803d' }}>
                      Admission Confirmed Successfully!
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                      {done.name} has been enrolled in {selectedClass?.name || 'Class'}. Admission No: <strong>{done.admission_no}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
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
                      }));
                    }}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Admit Another
                  </button>
                </div>
              </div>

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
                        <div><span style={{ color: '#64748b' }}>Admission Date:</span> <strong>{form.admission_date}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Class Applying For:</span> <strong>{selectedClass?.name || '—'}</strong></div>
                      </div>
                      <div>
                        <div><span style={{ color: '#64748b' }}>Date of Birth:</span> <strong>{form.dob}</strong></div>
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
                            <div><span style={{ color: '#64748b' }}>TC Date:</span> <strong>{form.previous_tc_date || '—'}</strong></div>
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
                      Admission Date: {form.admission_date}
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
