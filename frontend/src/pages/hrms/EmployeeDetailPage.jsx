import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function EmployeeDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // profile, academic, salary, leaves, documents, attendance, status

  // Status Change State
  const [statusForm, setStatusForm] = useState({ status: 'ACTIVE', exit_date: '', exit_reason: '' });
  const [savingStatus, setSavingStatus] = useState(false);

  // Document Upload State
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', doc_type: 'AADHAAR', file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Salary Structure State
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    basic_salary: 0, hra: 0, da: 0, ta: 0, special_allowance: 0,
    pf_deduction: 0, esi_deduction: 0, prof_tax: 0, tds: 0, effective_from: new Date().toISOString().slice(0, 10)
  });
  const [savingSalary, setSavingSalary] = useState(false);

  const loadEmployee = () => {
    setLoading(true);
    api.get(`/hrms/employees/${userId}`)
      .then(res => {
        setData(res.data);
        const p = res.data?.profile || {};
        setStatusForm({
          status: p.employment_status || 'ACTIVE',
          exit_date: p.exit_date || '',
          exit_reason: p.exit_reason || '',
        });
        const s = res.data?.salary_structure;
        if (s) {
          setSalaryForm({
            basic_salary: s.basic_salary || 0,
            hra: s.hra || 0,
            da: s.da || 0,
            ta: s.ta || 0,
            special_allowance: s.special_allowance || 0,
            pf_deduction: s.pf_deduction || 0,
            esi_deduction: s.esi_deduction || 0,
            prof_tax: s.prof_tax || 0,
            tds: s.tds || 0,
            effective_from: new Date().toISOString().slice(0, 10)
          });
        }
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load employee profile'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEmployee();
  }, [userId]);

  const handleStatusChange = async (e) => {
    e.preventDefault();
    setSavingStatus(true);
    try {
      await api.post(`/hrms/employees/${userId}/status`, statusForm);
      toast.success('Employment status updated');
      loadEmployee();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleVerifyDocument = async (docId, approve) => {
    try {
      await api.post(`/hrms/documents/${docId}/verify`, { approve, notes: approve ? 'Verified by Admin' : 'Document rejected' });
      toast.success(approve ? 'Document marked as verified' : 'Document rejected');
      loadEmployee();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    }
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    setSavingSalary(true);
    try {
      await api.post(`/hrms/employees/${userId}/salary-structure`, salaryForm);
      toast.success('Salary structure assigned successfully');
      setShowSalaryModal(false);
      loadEmployee();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update salary structure');
    } finally {
      setSavingSalary(false);
    }
  };

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  if (loading) {
    return (
      <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
        <Sidebar darkMode={darkMode} />
        <div className="main-content">
          <Navbar title="Employee Profile" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />
          <div className="page-body" style={{ textAlign: 'center', padding: '100px' }}>
            <i className="ti ti-loader-2 ti-spin" style={{ fontSize: '36px', color: '#3b82f6' }} />
            <p>Loading 360° Employee Details...</p>
          </div>
        </div>
      </div>
    );
  }

  const u = data?.user || {};
  const p = data?.profile || {};
  const acad = data?.academic;
  const sal = data?.salary_structure;
  const balances = data?.leave_balances || [];
  const docs = data?.documents || [];

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Employee 360° Master" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* ══ Header Banner with Profile Summary ══ */}
          <div style={{ ...cardBg, borderRadius: '18px', border: '1px solid', padding: '24px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{
                  width: '70px', height: '70px', borderRadius: '50%', background: '#3b82f620',
                  color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', fontWeight: 800, overflow: 'hidden', border: '2px solid #3b82f6'
                }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    u.name.charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>{u.name}</h2>
                    <span style={{
                      background: p.employment_status === 'ACTIVE' ? '#10b98118' : '#ef444418',
                      color: p.employment_status === 'ACTIVE' ? '#10b981' : '#ef4444',
                      padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800
                    }}>
                      {p.employment_status || 'ACTIVE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    <b>ID:</b> {u.employee_id || '—'} • <b>Role:</b> {u.role} • <b>Dept:</b> {p.department || u.department || '—'} • <b>Designation:</b> {p.designation || u.designation || 'Staff'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    📧 {u.email} • 📞 {u.phone || 'N/A'} • 🗓 Joined: {p.joining_date || '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => navigate('/hrms/employees')}
                  style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600 }}
                >
                  ← Back to Directory
                </button>
              </div>
            </div>

            {/* Nav Tabs */}
            <div style={{ display: 'flex', gap: '6px', borderTop: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, marginTop: '20px', paddingTop: '14px', overflowX: 'auto' }}>
              {[
                { id: 'profile', label: 'Personal & Contact', icon: 'ti-user' },
                ...(u.role === 'TEACHER' ? [{ id: 'academic', label: 'Academic Responsibilities', icon: 'ti-school' }] : []),
                { id: 'salary', label: 'Salary Structure', icon: 'ti-wallet' },
                { id: 'leaves', label: 'Leave Balances', icon: 'ti-calendar-event' },
                { id: 'documents', label: `Documents (${docs.length})`, icon: 'ti-file-text' },
                { id: 'status', label: 'Status & Exit Action', icon: 'ti-settings' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? (darkMode ? '#3b82f6' : '#eff6ff') : 'transparent',
                    color: activeTab === tab.id ? (darkMode ? '#ffffff' : '#2563eb') : '#64748b',
                    border: activeTab === tab.id ? (darkMode ? 'none' : '1px solid #bfdbfe') : 'none',
                    padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  <i className={`ti ${tab.icon}`} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ══ Tab Content ══ */}

          {/* TAB 1: Personal & Employment */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', color: '#3b82f6' }}>
                  👤 Personal Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Gender:</span>
                    <span style={{ fontWeight: 600 }}>{p.gender || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Date of Birth:</span>
                    <span style={{ fontWeight: 600 }}>{p.dob || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Blood Group:</span>
                    <span style={{ fontWeight: 600 }}>{p.blood_group || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Father / Husband Name:</span>
                    <span style={{ fontWeight: 600 }}>{p.father_husband_name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Emergency Contact:</span>
                    <span style={{ fontWeight: 600 }}>{p.emergency_contact ? `${p.emergency_contact} (${p.emergency_relation || 'Relation'})` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Current Address:</span>
                    <span style={{ fontWeight: 600, maxWidth: '200px', textAlign: 'right' }}>{p.current_address ? `${p.current_address}, ${p.city || ''} ${p.pincode || ''}` : '—'}</span>
                  </div>
                </div>
              </div>

              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', color: '#3b82f6' }}>
                  💼 Employment &amp; Academic
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Employment Type:</span>
                    <span style={{ fontWeight: 600 }}>{p.employment_type || 'PERMANENT'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Qualification:</span>
                    <span style={{ fontWeight: 600 }}>{p.qualification || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Experience:</span>
                    <span style={{ fontWeight: 600 }}>{p.experience_years} Years</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Work Location:</span>
                    <span style={{ fontWeight: 600 }}>{p.work_location || 'Main Campus'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Reporting Manager:</span>
                    <span style={{ fontWeight: 600 }}>{p.reporting_manager_name || 'Principal'}</span>
                  </div>
                </div>
              </div>

              <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', color: '#3b82f6' }}>
                  🏦 Bank &amp; Identification (KYC)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Bank Name:</span>
                    <span style={{ fontWeight: 600 }}>{p.bank_name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Account No:</span>
                    <span style={{ fontWeight: 600 }}>{p.account_number || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>IFSC Code:</span>
                    <span style={{ fontWeight: 600 }}>{p.ifsc_code || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>PAN Number:</span>
                    <span style={{ fontWeight: 600 }}>{p.pan_number || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Aadhaar Number:</span>
                    <span style={{ fontWeight: 600 }}>{p.aadhaar_number || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>UAN / PF No:</span>
                    <span style={{ fontWeight: 600 }}>{p.uan_number || p.pf_number || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Academic (if Teacher) */}
          {activeTab === 'academic' && acad && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '22px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Academic Responsibilities &amp; Workload</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 8px' }}>Class Teacher Designation</h4>
                {acad.is_class_teacher_of.length > 0 ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {acad.is_class_teacher_of.map((c, i) => (
                      <span key={i} style={{ background: '#3b82f618', color: '#3b82f6', padding: '4px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '12px' }}>
                        ⭐ Class Teacher of {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned as Class Teacher</span>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 8px' }}>Classes &amp; Subjects Taught</h4>
                {acad.classes_assigned.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>No subjects currently assigned to this teacher.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                        <th style={{ padding: '10px 14px' }}>Class &amp; Section</th>
                        <th style={{ padding: '10px 14px' }}>Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acad.classes_assigned.map((cls, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>{cls.class_name}</td>
                          <td style={{ padding: '10px 14px' }}>{cls.subject_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Salary Structure */}
          {activeTab === 'salary' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Monthly Compensation &amp; Salary Structure</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Earnings breakdown and statutory deduction components</span>
                </div>
                <button
                  onClick={() => setShowSalaryModal(true)}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                >
                  <i className="ti ti-edit" /> Configure Salary
                </button>
              </div>

              {sal ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#10b981', fontSize: '13.5px', fontWeight: 800 }}>💰 Earnings Components</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Basic Pay:</span>
                        <b>₹{sal.basic_salary?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>House Rent Allowance (HRA):</span>
                        <b>₹{sal.hra?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Dearness Allowance (DA):</span>
                        <b>₹{sal.da?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Special Allowance:</span>
                        <b>₹{sal.special_allowance?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px', color: '#10b981' }}>
                        <span style={{ fontWeight: 800 }}>Total Gross Salary:</span>
                        <b style={{ fontSize: '15px' }}>₹{sal.gross_salary?.toLocaleString('en-IN')}</b>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px', color: '#ef4444', fontSize: '13.5px', fontWeight: 800 }}>📉 Statutory Deductions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Provident Fund (PF):</span>
                        <b>₹{sal.pf_deduction?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>ESI:</span>
                        <b>₹{sal.esi_deduction?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Professional Tax (PT):</span>
                        <b>₹{sal.prof_tax?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>TDS (Income Tax):</span>
                        <b>₹{sal.tds?.toLocaleString('en-IN')}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '8px', color: '#3b82f6' }}>
                        <span style={{ fontWeight: 800 }}>Expected Net Salary:</span>
                        <b style={{ fontSize: '15px' }}>₹{sal.net_salary?.toLocaleString('en-IN')}</b>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <p>No structured salary assigned. Base salary is ₹{(u.salary || 0).toLocaleString('en-IN')}</p>
                  <button
                    onClick={() => setShowSalaryModal(true)}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Setup Salary Structure
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Leave Balances */}
          {activeTab === 'leaves' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Leave Balances (Academic Session {new Date().getFullYear()})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                {balances.map((b) => (
                  <div key={b.id} style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{b.leave_type_name} ({b.leave_type_code})</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6', margin: '6px 0' }}>{b.remaining} <span style={{ fontSize: '13px', color: '#64748b' }}>days left</span></div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Allocated: {b.allocated} • Used: {b.used}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Documents Repository */}
          {activeTab === 'documents' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Employee Documents &amp; KYC</h3>
              </div>

              {docs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <i className="ti ti-files" style={{ fontSize: '36px', marginBottom: '8px' }} />
                  <p>No documents uploaded yet.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '12px 14px' }}>Document</th>
                      <th style={{ padding: '12px 14px' }}>Type</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                          <a href={d.file_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                            <i className="ti ti-file" /> {d.title}
                          </a>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>{d.doc_type_label}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            background: d.verification_status === 'VERIFIED' ? '#10b98118' : d.verification_status === 'REJECTED' ? '#ef444418' : '#f59e0b18',
                            color: d.verification_status === 'VERIFIED' ? '#10b981' : d.verification_status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800
                          }}>
                            {d.verification_status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {d.verification_status !== 'VERIFIED' && (
                            <button
                              onClick={() => handleVerifyDocument(d.id, true)}
                              style={{ background: '#10b98116', color: '#10b981', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', marginRight: '6px' }}
                            >
                              Verify
                            </button>
                          )}
                          <a
                            href={d.file_url} target="_blank" rel="noreferrer"
                            style={{ background: '#3b82f616', color: '#3b82f6', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, textDecoration: 'none' }}
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: Status & Exit Action */}
          {activeTab === 'status' && (
            <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', padding: '24px', maxWidth: '600px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Employee Lifecycle Status Transition</h3>
              <form onSubmit={handleStatusChange}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Status *</label>
                  <select
                    value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    {['ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'RESIGNED', 'TERMINATED', 'RETIRED', 'INACTIVE'].map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {['RESIGNED', 'TERMINATED', 'RETIRED', 'INACTIVE'].includes(statusForm.status) && (
                  <>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Exit Date</label>
                      <input
                        type="date" value={statusForm.exit_date} onChange={e => setStatusForm({ ...statusForm, exit_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Exit Reason / Notes</label>
                      <textarea
                        rows={3} placeholder="Reason for resignation / termination / exit" value={statusForm.exit_reason}
                        onChange={e => setStatusForm({ ...statusForm, exit_reason: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit" disabled={savingStatus}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {savingStatus ? 'Saving...' : 'Update Employment Status'}
                </button>
              </form>
            </div>
          )}

          {/* Salary Configuration Modal */}
          {showSalaryModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{ ...cardBg, borderRadius: '18px', width: '100%', maxWidth: '640px', padding: '24px', border: '1px solid' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 800 }}>Assign Salary Structure</h3>
                <form onSubmit={handleSaveSalary}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Basic Salary (₹) *</label>
                      <input
                        type="number" required value={salaryForm.basic_salary}
                        onChange={e => setSalaryForm({ ...salaryForm, basic_salary: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>HRA (₹)</label>
                      <input
                        type="number" value={salaryForm.hra}
                        onChange={e => setSalaryForm({ ...salaryForm, hra: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>DA (₹)</label>
                      <input
                        type="number" value={salaryForm.da}
                        onChange={e => setSalaryForm({ ...salaryForm, da: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Special Allowance (₹)</label>
                      <input
                        type="number" value={salaryForm.special_allowance}
                        onChange={e => setSalaryForm({ ...salaryForm, special_allowance: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>PF Deduction (₹)</label>
                      <input
                        type="number" value={salaryForm.pf_deduction}
                        onChange={e => setSalaryForm({ ...salaryForm, pf_deduction: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Effective Date</label>
                      <input
                        type="date" value={salaryForm.effective_from}
                        onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button" onClick={() => setShowSalaryModal(false)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={savingSalary}
                      style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {savingSalary ? 'Saving...' : 'Save Structure'}
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
