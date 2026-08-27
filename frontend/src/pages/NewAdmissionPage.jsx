import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const GENDERS = ['Male', 'Female', 'Other'];
const SESSIONS = ['2024-25', '2025-26', '2026-27'];
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const STEPS = [
  { id: 1, label: 'Student Details' },
  { id: 2, label: 'Parent / Guardian Details' },
  { id: 3, label: 'Address Details' },
  { id: 4, label: 'Previous School Details' },
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

  const [form, setForm] = useState({
    name:                 '',
    dob:                  '2011-06-12',
    gender:               'Male',
    class_id:             '',
    category:             'General',
    aadhar_no:            '1234 5678 9012',
    blood_group:          'B+',
    roll_number:          '15',
    admission_no:         'ADM-2024-001',
    session:              '2024-25',
    
    // Parent Details
    father_name:          'Rajesh Sharma',
    father_occupation:    'Business',
    parent_phone:         '9876543210',
    parent_email:         'rajeshsharma@gmail.com',
    mother_name:          'Neha Sharma',
    mother_occupation:    'Homemaker',
    mother_phone:         '9876543211',
    mother_email:         'nehasharma@gmail.com',
    parent_name:          'Rajesh Sharma',
    
    // Address Details
    address:              'H-123, Sector 45',
    city:                 'Noida',
    state:                'Uttar Pradesh',
    pincode:              '201301',
    emergency_contact:    'Amit Sharma (Uncle)',
    emergency_phone:      '9876501234',
    emergency_relation:   'Uncle',
    
    // Previous School
    previous_school:      'Delhi Public School, Noida',
    school_code:          'SPS/2024',
    date_of_joining:      new Date().toISOString().split('T')[0],
    transport_required:   'Yes',
    
    // Fee particulars
    admission_fee:        5000,
    caution_money:        3000,
    tuition_fee:          12000,
    development_fee:      2000,
    activity_fee:         1000,
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
      setPendingPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
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

      if (pendingPhoto) {
        await uploadPhoto(res.data.id, pendingPhoto);
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
      a.download = `AdmissionConfirmation_${(studentName || 'Student').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Admission PDF Downloaded!');
    } catch {
      toast.error('PDF generate nahi hua');
    }
  }

  const selectedClass = classes.find(c => String(c.id) === String(form.class_id));
  const totalFee = Number(form.admission_fee || 0) + Number(form.caution_money || 0) + Number(form.tuition_fee || 0) + Number(form.development_fee || 0) + Number(form.activity_fee || 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="New Admission" />
        <div className="page-body" style={{ padding: '24px 32px' }}>

          {/* Top Breadcrumb & Title */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Home</span> &gt; <span>Admissions</span> &gt; <strong style={{ color: '#0f172a' }}>New Admission</strong>
              </div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                New Admission
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Session:</span>
                <select
                  value={form.session}
                  onChange={e => set('session', e.target.value)}
                  style={{ border: 'none', background: 'none', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                >
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {!done ? (
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
              
              {/* ── 6-STEP HORIZONTAL STEPPER ── */}
              <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid #f1f5f9',
                background: '#f8fafc',
                overflowX: 'auto'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: 700,
                  position: 'relative'
                }}>
                  {STEPS.map((step, idx) => {
                    const isActive = step.id === currentStep;
                    const isDone = step.id < currentStep;
                    return (
                      <React.Fragment key={step.id}>
                        <div
                          onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                            cursor: step.id <= currentStep ? 'pointer' : 'default',
                            zIndex: 2,
                            position: 'relative'
                          }}
                        >
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            background: isActive ? '#0284c7' : (isDone ? '#22c55e' : '#e2e8f0'),
                            color: isActive || isDone ? '#ffffff' : '#64748b',
                            boxShadow: isActive ? '0 0 0 4px rgba(2,132,199,0.2)' : 'none',
                            transition: 'all 0.2s'
                          }}>
                            {isDone ? '✓' : step.id}
                          </div>
                          <span style={{
                            fontSize: 11.5,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? '#0284c7' : (isDone ? '#0f172a' : '#64748b'),
                            whiteSpace: 'nowrap'
                          }}>
                            {step.label}
                          </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div style={{
                            flex: 1,
                            height: 2,
                            background: isDone ? '#22c55e' : '#e2e8f0',
                            margin: '0 8px',
                            marginBottom: 22,
                            transition: 'all 0.2s'
                          }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* ── STEP CONTENT CARDS ── */}
              <div style={{ padding: '32px 36px' }}>

                {/* STEP 1: Student Details */}
                {currentStep === 1 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Student Details
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 36 }}>
                      {/* Left fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                        
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Student Name <span style={{ color: '#ef4444' }}>*</span>
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
                            Class Applying For <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={form.class_id}
                            onChange={e => set('class_id', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            <option value="">Select Class</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section || ''}</option>)}
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
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Aadhar No.
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
                            Blood Group
                          </label>
                          <select
                            value={form.blood_group}
                            onChange={e => set('blood_group', e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                          >
                            {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                          </select>
                        </div>

                      </div>

                      {/* Right Photo Upload Box */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12, textAlign: 'center', width: '100%' }}>
                          Upload Photo
                        </label>
                        
                        <div style={{
                          width: 140,
                          height: 160,
                          borderRadius: 12,
                          border: '2px dashed #cbd5e1',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          marginBottom: 14
                        }}>
                          {photoPreview ? (
                            <img src={photoPreview} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                              <i className="ti ti-user" style={{ fontSize: 42, display: 'block', marginBottom: 4 }} />
                              <span style={{ fontSize: 11 }}>No Photo</span>
                            </div>
                          )}
                        </div>

                        <label style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '7px 18px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: 6,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          Choose File
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                        </label>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>JPG, PNG (Max 2MB)</span>
                      </div>

                    </div>
                  </div>
                )}

                {/* STEP 2: Parent / Guardian Details */}
                {currentStep === 2 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Parent / Guardian Details
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Father's Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Rajesh Sharma"
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
                          placeholder="Business"
                          value={form.father_occupation}
                          onChange={e => set('father_occupation', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="9876543210"
                          value={form.parent_phone}
                          onChange={e => set('parent_phone', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Email ID
                        </label>
                        <input
                          type="email"
                          placeholder="rajeshsharma@gmail.com"
                          value={form.parent_email}
                          onChange={e => set('parent_email', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e2e8f0', margin: '6px 0' }} />

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mother's Name
                        </label>
                        <input
                          type="text"
                          placeholder="Neha Sharma"
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
                          placeholder="Homemaker"
                          value={form.mother_occupation}
                          onChange={e => set('mother_occupation', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Address Details */}
                {currentStep === 3 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Address & Emergency Contact
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Residential Address <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="H-123, Sector 45"
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
                          placeholder="Noida"
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

                      <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e2e8f0', margin: '6px 0' }} />

                      <div style={{ gridColumn: '1 / -1' }}>
                        <strong style={{ fontSize: 13, color: '#1e3a8a', display: 'block', marginBottom: 12 }}>
                          🚨 Emergency Contact Details
                        </strong>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Contact Person
                        </label>
                        <input
                          type="text"
                          placeholder="Amit Sharma (Uncle)"
                          value={form.emergency_contact}
                          onChange={e => set('emergency_contact', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Mobile Number
                        </label>
                        <input
                          type="text"
                          placeholder="9876501234"
                          value={form.emergency_phone}
                          onChange={e => set('emergency_phone', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Previous School Details */}
                {currentStep === 4 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Previous School & Transport
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Previous School Name
                        </label>
                        <input
                          type="text"
                          placeholder="Delhi Public School, Noida"
                          value={form.previous_school}
                          onChange={e => set('previous_school', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          School Code
                        </label>
                        <input
                          type="text"
                          placeholder="SPS/2024"
                          value={form.school_code}
                          onChange={e => set('school_code', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Date of Joining
                        </label>
                        <input
                          type="date"
                          value={form.date_of_joining}
                          onChange={e => set('date_of_joining', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Transport Facility Required?
                        </label>
                        <select
                          value={form.transport_required}
                          onChange={e => set('transport_required', e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' }}
                        >
                          <option value="Yes">Yes (Bus / Van Service)</option>
                          <option value="No">No (Self Conveyance)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: Fee & Documents */}
                {currentStep === 5 && (
                  <div>
                    <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Admission Fee Details & Payment Setup
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: 14, color: '#1e3a8a' }}>Fee Breakdown (₹)</h4>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                          <span>Admission Fee:</span>
                          <input type="number" value={form.admission_fee} onChange={e => set('admission_fee', e.target.value)} style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                          <span>Caution Money (Refundable):</span>
                          <input type="number" value={form.caution_money} onChange={e => set('caution_money', e.target.value)} style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                          <span>Tuition Fee (Quarterly):</span>
                          <input type="number" value={form.tuition_fee} onChange={e => set('tuition_fee', e.target.value)} style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                          <span>Development Fee:</span>
                          <input type="number" value={form.development_fee} onChange={e => set('development_fee', e.target.value)} style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 13 }}>
                          <span>Activity Fee:</span>
                          <input type="number" value={form.activity_fee} onChange={e => set('activity_fee', e.target.value)} style={{ width: 100, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', textAlign: 'right' }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid #cbd5e1', fontSize: 14, fontWeight: 800, color: '#1e3a8a' }}>
                          <span>Total Amount:</span>
                          <span>₹ {totalFee.toLocaleString('en-IN')}.00</span>
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: 14, color: '#1e3a8a' }}>Payment Collection</h4>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Payment Mode</label>
                          <select value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}>
                            <option value="Online">Online / Net Banking</option>
                            <option value="UPI">UPI / QR Code</option>
                            <option value="Cash">Cash</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Payment Status</label>
                          <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}>
                            <option value="PAID">PAID (Full Collected)</option>
                            <option value="PENDING">PENDING (Pay Later)</option>
                          </select>
                        </div>

                        <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '12px 14px', borderRadius: 8, color: '#15803d', fontSize: 12 }}>
                          ✓ Admission confirmation receipt and fee ledger will be automatically generated upon submit.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: Review & Submit */}
                {currentStep === 6 && (
                  <div>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      Review Details & Confirm Admission
                    </h3>

                    <div style={{
                      background: '#f8fafc',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: 24,
                      marginBottom: 20
                    }}>
                      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                        {photoPreview ? (
                          <img src={photoPreview} alt="Student" style={{ width: 70, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ) : (
                          <div style={{ width: 70, height: 80, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#64748b' }}>
                            👤
                          </div>
                        )}
                        <div>
                          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{form.name}</h2>
                          <div style={{ fontSize: 13, color: '#64748b' }}>
                            Class: <strong>{selectedClass?.name || 'Class'}</strong> | Session: <strong>{form.session}</strong> | Gender: <strong>{form.gender}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, fontSize: 13 }}>
                        <div><span style={{ color: '#64748b' }}>Father's Name:</span> <strong>{form.father_name}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Parent Mobile:</span> <strong>{form.parent_phone}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Address:</span> <strong>{form.address}, {form.city}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Total Fee:</span> <strong style={{ color: '#16a34a' }}>₹ {totalFee.toLocaleString('en-IN')}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Payment Mode:</span> <strong>{form.payment_mode} ({form.payment_status})</strong></div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ── FOOTER NAVIGATION ── */}
              <div style={{
                padding: '20px 36px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {currentStep > 1 ? (
                  <button
                    onClick={prevStep}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ← Previous
                  </button>
                ) : <div />}

                {currentStep < STEPS.length ? (
                  <button
                    onClick={nextStep}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(2,132,199,0.25)'
                    }}
                  >
                    Save &amp; Next →
                  </button>
                ) : (
                  <button
                    onClick={submit}
                    disabled={saving}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: saving ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(22,163,74,0.3)'
                    }}
                  >
                    {saving ? 'Processing...' : '🎓 Submit & Generate Admission Card'}
                  </button>
                )}
              </div>

            </div>
          ) : (
            /* ── SUCCESS VIEW & ADMISSION RECEIPT PREVIEW (Exact Image 1) ── */
            <div style={{ maxWidth: 880, margin: '0 auto' }}>
              
              {/* Success Banner */}
              <div style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: 12,
                padding: '18px 24px',
                marginBottom: 24,
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
                    onClick={() => downloadPDF(done.id, done.name)}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <i className="ti ti-download" /> Download Official PDF
                  </button>
                  <button
                    onClick={() => {
                      setDone(null);
                      setCurrentStep(1);
                      setPendingPhoto(null);
                      setPhotoPreview(null);
                    }}
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
                    + New Admission
                  </button>
                </div>
              </div>

              {/* Printable Admission Confirmation & Receipt Card Preview */}
              <div id="admission-confirmation-receipt" style={{
                background: '#ffffff',
                border: '2px solid #1e3a8a',
                borderRadius: 12,
                padding: 28,
                boxShadow: '0 10px 30px rgba(0,0,0,0.06)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: '#1e3a8a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                      ★
                    </div>
                    <div>
                      <h2 style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: '#0f2942', textTransform: 'uppercase' }}>
                        {schoolSettings?.name || 'SUNRISE PUBLIC SCHOOL'}
                      </h2>
                      <div style={{ fontSize: 11.5, color: '#475569' }}>
                        {schoolSettings?.address || 'Sector 15, Noida, Uttar Pradesh - 201301'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        📞 {schoolSettings?.phone || '0120-4567890'} | ✉ {schoolSettings?.email || 'info@sunrisepublicschool.edu.in'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ background: '#0f2942', color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                      ADMISSION CONFIRMATION
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      Session : {form.session}
                    </div>
                  </div>
                </div>

                {/* Subtitle */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontStyle: 'italic', color: '#1e3a8a', fontWeight: 800 }}>
                    Admission Confirmation &amp; Receipt
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    We are pleased to confirm the admission of the student as per the details below.
                  </p>
                </div>

                {/* Meta Details + Stamp + Photo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: '#f8fafc', padding: 14, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                    <div><span style={{ color: '#64748b' }}>Admission No. :</span> <strong style={{ color: '#1e3a8a' }}>{done.admission_no || form.admission_no}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Admission Date :</span> <strong>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Roll No. :</span> <strong>{done.roll_number || form.roll_number}</strong></div>
                  </div>

                  <div style={{
                    width: 90, height: 90, borderRadius: '50%',
                    border: '2.5px dashed #1e3a8a',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#1e3a8a', fontWeight: 800, fontSize: 10,
                    textTransform: 'uppercase', textAlign: 'center'
                  }}>
                    <span>★ ADMISSION ★</span>
                    <span style={{ fontSize: 11 }}>CONFIRMED</span>
                  </div>

                  <div>
                    {photoPreview ? (
                      <img src={photoPreview} alt="Student" style={{ width: 80, height: 90, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                    ) : (
                      <div style={{ width: 80, height: 90, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
                        PHOTO
                      </div>
                    )}
                  </div>
                </div>

                {/* STUDENT DETAILS Banner */}
                <div style={{ background: '#1e3a8a', color: '#fff', padding: '6px 12px', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
                  STUDENT DETAILS
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Student Name</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {form.name}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Class / Section</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {selectedClass?.name || '7th A'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Date of Birth</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {form.dob}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Date of Joining</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {form.date_of_joining}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Gender</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {form.gender}</td>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>Academic Session</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>: {form.session}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Bottom Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #1e3a8a', paddingTop: 14, marginTop: 24, fontSize: 11, color: '#64748b' }}>
                  <div>🏫 Thank you for choosing {schoolSettings?.name || 'Sunrise Public School'}. Together, we nurture tomorrow's leaders.</div>
                  <div>Principal's Signature: _______________________</div>
                </div>

              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
