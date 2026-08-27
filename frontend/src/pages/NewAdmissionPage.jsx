import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const GENDERS = ['Male', 'Female', 'Other'];
const SESSIONS = ['2024-25', '2025-26', '2026-27'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELIGIONS = ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'];

const STEPS = [
  { id: 1, label: 'Student Details' },
  { id: 2, label: 'Parent / Guardian' },
  { id: 3, label: 'Address' },
  { id: 4, label: 'Previous School' },
  { id: 5, label: 'Fee & Documents' },
  { id: 6, label: 'Review & Submit' },
];

export default function NewAdmissionPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [classes, setClasses] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(null); // admitted student data
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview,   setPhotoPreview]   = useState(null);
  const [schoolSlug,     setSchoolSlug]     = useState('school');
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [pendingPhoto,   setPendingPhoto]   = useState(null);

  // Optional admission KYC documents
  const [studentAadharFile, setStudentAadharFile] = useState(null);
  const [parentAadharFile, setParentAadharFile]   = useState(null);
  const [tcFile, setTcFile]                       = useState(null);
  const [birthCertFile, setBirthCertFile]         = useState(null);

  const [form, setForm] = useState({
    name:                 '',
    dob:                  '2011-06-12',
    gender:               'Male',
    class_id:             '',
    category:             'General',
    nationality:          'Indian',
    religion:             'Hinduism',
    aadhar_no:            '',
    parent_aadhar_no:     '',
    blood_group:          'B+',
    roll_number:          '',
    admission_no:         '',
    session:              '2024-25',
    admission_date:       new Date().toISOString().split('T')[0],
    
    // Parent Details
    father_name:          '',
    father_occupation:    '',
    parent_phone:         '',
    parent_email:         '',
    mother_name:          '',
    mother_occupation:    '',
    mother_phone:         '',
    guardian_name:        '',
    guardian_relation:    '',
    guardian_phone:       '',
    parent_name:          '',
    
    // Address Details
    address:              '',
    city:                 '',
    state:                'Uttar Pradesh',
    pincode:              '',
    emergency_contact:    '',
    emergency_phone:      '',
    emergency_relation:   '',
    
    // Previous School
    is_first_school:      false,
    previous_school_name: '',
    previous_class:       '',
    previous_tc_no:       '',
    previous_tc_date:     '',
    previous_reason:      '',
    transport_required:   'No',
    
    // Fee particulars
    admission_fee:        5000,
    caution_money:        3000,
    tuition_fee:          12000,
    development_fee:      2000,
    activity_fee:         1000,
    registration_fee:     1000,
    smart_class_fee:      1500,
    library_fee:          800,
    examination_fee:      1200,
    other_fee:            500,
    payment_mode:         'Online',
    payment_status:       'PAID',
    password:             'Student@123',
  });

  useEffect(() => {
    api.get('/principal/classes')
      .then(r => {
        const clsList = r.data || [];
        setClasses(clsList);
        if (clsList.length > 0 && !form.class_id) {
          setForm(f => ({ ...f, class_id: clsList[0].id }));
        }
      })
      .catch(() => {});

    api.get('/principal/school/settings')
      .then(r => {
        setSchoolSettings(r.data || null);
        const name = (r.data?.name || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');
        setSchoolSlug(name || 'school');
      })
      .catch(() => {});
  }, []);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo 5MB se kam honi chahiye');
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
          toast.error('Document size 10MB se kam hona chahiye');
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
        toast.error('Student name zaroori hai');
        return false;
      }
      if (!form.class_id) {
        toast.error('Class select karein');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!form.father_name.trim() || !form.parent_phone.trim()) {
        toast.error("Father's name aur Mobile number zaroori hai");
        return false;
      }
    }
    if (currentStep === 3) {
      if (!form.address.trim() || !form.city.trim()) {
        toast.error('Address aur City zaroori hai');
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
    if (!form.name || !form.parent_phone) {
      toast.error('Student name aur parent phone zaroori hai');
      return;
    }
    setSaving(true);
    try {
      const firstName = (form.name || 'student').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const autoEmail = form.parent_email || `${firstName || 'student'}@${schoolSlug}.com`;

      const res = await api.post('/principal/students', {
        ...form,
        email: autoEmail,
        parent_name: form.father_name || form.parent_name,
      });

      const studentId = res.data.id;

      if (pendingPhoto) {
        await uploadPhoto(studentId, pendingPhoto);
      }

      // Upload optional KYC docs if selected
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

      if (uploadPromises.length > 0) {
        await Promise.allSettled(uploadPromises);
      }

      setDone(res.data);
      toast.success('🎉 Student successfully admitted!');
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error occurred while admitting student';
      toast.error(errMsg);
    }
    setSaving(false);
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
      toast.error('Photo upload nahi ho saki');
    }
    setPhotoUploading(false);
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
      toast.error('PDF download nahi ho saka');
    }
  }

  function handlePrintDirect() {
    window.print();
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.class_id));
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
        <Navbar title="New Admission" />
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
          <div className="page-header" style={{ marginBottom: 24 }}>
            <h2 className="page-title">📝 New Student Admission</h2>
            <p className="page-subtitle">Dynamic 2-Page Admission Form, Fee Setup &amp; Permanent Student KYC Documents</p>
          </div>

          {!done ? (
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              {/* STEP PROGRESS BAR */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {STEPS.map((s) => {
                  const isActive = s.id === currentStep;
                  const isPassed = s.id < currentStep;
                  return (
                    <div
                      key={s.id}
                      onClick={() => { if (isPassed) setCurrentStep(s.id); }}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        textAlign: 'center',
                        borderBottom: isActive ? '3px solid #0B3B7B' : '3px solid transparent',
                        background: isActive ? '#ffffff' : 'transparent',
                        cursor: isPassed ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: isActive ? '#0B3B7B' : isPassed ? '#16A34A' : '#e2e8f0',
                        color: isActive || isPassed ? '#ffffff' : '#64748b',
                        fontSize: 12,
                        fontWeight: 700,
                        marginRight: 6
                      }}>
                        {isPassed ? '✓' : s.id}
                      </div>
                      <span style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#0B3B7B' : isPassed ? '#0f172a' : '#64748b'
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
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      🎓 Basic Student Details
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
                        
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Student Full Name (As per Aadhar) <span style={{ color: '#ef4444' }}>*</span>
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
                            Class Applying For <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={form.class_id}
                            onChange={e => set('class_id', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            <option value="">-- Select Class --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Academic Session
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

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Category
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
                            Student Aadhaar Card No.
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

                        <div>
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

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Date of Admission
                          </label>
                          <input
                            type="date"
                            value={form.admission_date}
                            onChange={e => set('admission_date', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
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
                          width: 120,
                          height: 140,
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
                              <i className="ti ti-user" style={{ fontSize: 44, display: 'block', marginBottom: 4 }} />
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
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 2: Parent / Guardian Details */}
                {currentStep === 2 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      👨‍👩‍👧 Parent &amp; Guardian Details
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Father's Name <span style={{ color: '#ef4444' }}>*</span>
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
                          Primary Mobile Number <span style={{ color: '#ef4444' }}>*</span>
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
                          Parent Aadhaar Number
                        </label>
                        <input
                          type="text"
                          placeholder="9876 5432 1098"
                          value={form.parent_aadhar_no}
                          onChange={e => set('parent_aadhar_no', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e2e8f0', margin: '4px 0' }} />

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mother's Name
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
                          placeholder="e.g. Homemaker / Teacher"
                          value={form.mother_occupation}
                          onChange={e => set('mother_occupation', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e2e8f0', margin: '4px 0' }} />

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Guardian Name (If Applicable)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Amit Sharma"
                          value={form.guardian_name}
                          onChange={e => set('guardian_name', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Guardian Relationship &amp; Mobile No.
                        </label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            placeholder="Uncle"
                            value={form.guardian_relation}
                            onChange={e => set('guardian_relation', e.target.value)}
                            style={{ width: '40%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                          <input
                            type="text"
                            placeholder="Phone Number"
                            value={form.guardian_phone}
                            onChange={e => set('guardian_phone', e.target.value)}
                            style={{ width: '60%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 3: Address Details */}
                {currentStep === 3 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      📍 Address Details
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Residential Address <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. H-123, Sector 45"
                          value={form.address}
                          onChange={e => set('address', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          City <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Noida"
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
                          Pincode
                        </label>
                        <input
                          type="text"
                          placeholder="201301"
                          value={form.pincode}
                          onChange={e => set('pincode', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Previous School Details (Dynamic 1st School Condition) */}
                {currentStep === 4 && (
                  <div>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      🏫 Previous School Details (If Applicable)
                    </h3>

                    {/* 1st School Condition Toggle */}
                    <div style={{
                      background: '#eff6ff',
                      border: '1.5px solid #93c5fd',
                      borderRadius: 12,
                      padding: '16px 20px',
                      marginBottom: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <strong style={{ fontSize: 14, color: '#0B3B7B', display: 'block', marginBottom: 2 }}>
                          Is this the student's 1st School? (Kya yeh student ka pehla school hai?)
                        </strong>
                        <span style={{ fontSize: 12, color: '#475569' }}>
                          If Yes, previous school details will be omitted automatically in the form and PDF.
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: form.is_first_school ? '#0B3B7B' : '#ffffff',
                          color: form.is_first_school ? '#ffffff' : '#334155',
                          padding: '6px 16px',
                          borderRadius: 8,
                          border: '1px solid #93c5fd',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}>
                          <input
                            type="radio"
                            name="is_first_school"
                            checked={form.is_first_school}
                            onChange={() => set('is_first_school', true)}
                            style={{ display: 'none' }}
                          />
                          Yes (1st School)
                        </label>

                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: !form.is_first_school ? '#0B3B7B' : '#ffffff',
                          color: !form.is_first_school ? '#ffffff' : '#334155',
                          padding: '6px 16px',
                          borderRadius: 8,
                          border: '1px solid #93c5fd',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
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
                        padding: 30,
                        textAlign: 'center',
                        color: '#64748b'
                      }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🎒</div>
                        <h4 style={{ margin: '0 0 4px', color: '#0B3B7B', fontSize: 15 }}>First School Admission</h4>
                        <p style={{ margin: 0, fontSize: 13 }}>
                          Student is entering school for the first time. No previous school or transfer certificate details required.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Previous School Name <span style={{ color: '#94a3b8' }}>(Optional)</span>
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
                            Reason for Leaving
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Relocation / Better Opportunity"
                            value={form.previous_reason}
                            onChange={e => set('previous_reason', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 5: Fee & Optional Documents */}
                {currentStep === 5 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      💰 Admission Fee &amp; Optional Document Upload
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                      {/* Left: Fee Breakdown */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: 14, color: '#0B3B7B' }}>Fee Particulars (₹)</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Admission Fee:</span>
                            <input type="number" value={form.admission_fee} onChange={e => set('admission_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Registration Fee:</span>
                            <input type="number" value={form.registration_fee} onChange={e => set('registration_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Tuition Fee (Quarterly):</span>
                            <input type="number" value={form.tuition_fee} onChange={e => set('tuition_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Development Fee:</span>
                            <input type="number" value={form.development_fee} onChange={e => set('development_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Activity Fee:</span>
                            <input type="number" value={form.activity_fee} onChange={e => set('activity_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Smart Class Fee:</span>
                            <input type="number" value={form.smart_class_fee} onChange={e => set('smart_class_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Caution Money:</span>
                            <input type="number" value={form.caution_money} onChange={e => set('caution_money', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Exam &amp; Library Fee:</span>
                            <input type="number" value={form.examination_fee} onChange={e => set('examination_fee', e.target.value)} style={{ width: 85, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '2px solid #cbd5e1', fontSize: 14, fontWeight: 800, color: '#0B3B7B' }}>
                          <span>Total Amount at Admission:</span>
                          <span>₹ {totalFee.toLocaleString('en-IN')}.00</span>
                        </div>
                      </div>

                      {/* Right: Optional Document Uploads */}
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 14, color: '#0B3B7B' }}>📄 KYC Documents (Optional)</h4>
                          <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            Max 10MB each
                          </span>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#64748b' }}>
                          Upload now or later via the sidebar Documents section.
                        </p>

                        {/* Student Aadhar */}
                        <div style={{ marginBottom: 10, background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Student Aadhar Card</span>
                            {studentAadharFile && <span style={{ fontSize: 10, color: '#16a34a' }}>✓ Selected</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <label style={{ flex: 1, textAlign: 'center', background: '#f1f5f9', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                              📁 Browse File
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setStudentAadharFile)} />
                            </label>
                            <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                              📸 Camera / Scan
                              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setStudentAadharFile)} />
                            </label>
                          </div>
                        </div>

                        {/* Parent Aadhar */}
                        <div style={{ marginBottom: 10, background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600 }}>Parent / Guardian Aadhar</span>
                            {parentAadharFile && <span style={{ fontSize: 10, color: '#16a34a' }}>✓ Selected</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <label style={{ flex: 1, textAlign: 'center', background: '#f1f5f9', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #cbd5e1' }}>
                              📁 Browse File
                              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleDocFile(setParentAadharFile)} />
                            </label>
                            <label style={{ flex: 1, textAlign: 'center', background: '#eff6ff', color: '#0B3B7B', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #93c5fd', fontWeight: 600 }}>
                              📸 Camera / Scan
                              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleDocFile(setParentAadharFile)} />
                            </label>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: Review & Submit */}
                {currentStep === 6 && (
                  <div>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0B3B7B' }}>
                      📋 Review Admission Details
                    </h3>

                    <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
                      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
                        {photoPreview ? (
                          <img src={photoPreview} alt="Student" style={{ width: 64, height: 74, borderRadius: 8, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ) : (
                          <div style={{ width: 64, height: 74, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#64748b' }}>
                            👤
                          </div>
                        )}
                        <div>
                          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0B3B7B' }}>{form.name}</h2>
                          <div style={{ fontSize: 13, color: '#64748b' }}>
                            Class: <strong>{selectedClass?.name || 'Class'}</strong> | Session: <strong>{form.session}</strong> | Gender: <strong>{form.gender}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: 12.5 }}>
                        <div><span style={{ color: '#64748b' }}>Father's Name:</span> <strong>{form.father_name}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Parent Mobile:</span> <strong>{form.parent_phone}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Address:</span> <strong>{form.address}, {form.city}</strong></div>
                        <div><span style={{ color: '#64748b' }}>First School:</span> <strong>{form.is_first_school ? 'Yes (1st School)' : (form.previous_school_name || 'No')}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Total Fee:</span> <strong style={{ color: '#16a34a' }}>₹ {totalFee.toLocaleString('en-IN')}</strong></div>
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
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '11px 26px', borderRadius: 8, fontSize: 13.5, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}
                  >
                    {saving ? 'Processing...' : '🎓 Submit & Generate 2-Page Admission Form'}
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
                      {done.name} has been enrolled in {selectedClass?.name || 'Class'}.
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
                    }}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + New Admission
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
                        <div><span style={{ color: '#64748b' }}>Admission No.:</span> <strong>{done.admission_no || form.admission_no}</strong></div>
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
                        <div><span style={{ color: '#64748b' }}>Aadhar No.:</span> <strong>{form.aadhar_no || '—'}</strong></div>
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
                            <span style={{ fontSize: 10, color: '#64748b' }}>This is the student's 1st school; no previous details applicable.</span>
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
                            ['2. Aadhar Card (Student)', (studentAadharFile || form.aadhar_no) ? '✓' : '—'],
                            ['3. Aadhar Card (Parents)', (parentAadharFile || form.parent_aadhar_no) ? '✓' : '—'],
                            ['4. Passport Photographs', photoPreview ? '✓' : '—'],
                            ['5. Transfer Certificate (TC)', tcFile ? '✓' : '—'],
                            ['6. Address Proof', form.address ? '✓' : '—'],
                            ['7. Caste Certificate', form.category !== 'General' ? '✓' : '—'],
                            ['8. Medical Certificate', '—'],
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
                            <td style={{ padding: '4px 6px' }}>Admission Fee</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {Number(form.admission_fee || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Tuition Fee (1st Qtr)</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {Number(form.tuition_fee || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Caution Money (Refundable)</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {Number(form.caution_money || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 6px' }}>Development &amp; Activity</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹ {(Number(form.development_fee || 0) + Number(form.activity_fee || 0)).toLocaleString('en-IN')}</td>
                          </tr>
                          <tr style={{ background: '#eff6ff', fontWeight: 800, color: '#0B3B7B' }}>
                            <td style={{ padding: '6px 6px' }}>TOTAL AMOUNT</td>
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
                      I/We declare that the information provided is true and correct. I/We agree to abide by all school rules.
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
                      <strong style={{ color: '#0B3B7B' }}>FOR SCHOOL USE ONLY:</strong><br />
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
