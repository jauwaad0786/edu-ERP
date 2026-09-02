import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'INTERN'];
const EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'RESIGNED', 'TERMINATED', 'RETIRED', 'INACTIVE'];
const STAFF_ROLES = [
  'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'RECEPTIONIST', 'HOSTEL', 'TRANSPORT', 'HR',
  'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'EXAM_CONTROLLER', 'DRIVER'
];

export default function EmployeeDirectory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  useEffect(() => { localStorage.setItem('ederp_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, TEACHER, STAFF
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: 'TEACHER', employee_id: '',
    department: '', designation: '', salary: '', gender: 'MALE',
    dob: '', joining_date: new Date().toISOString().slice(0, 10),
    qualification: '', experience_years: '0', employment_type: 'PERMANENT',
    bank_name: '', account_number: '', ifsc_code: '', pan_number: '', aadhaar_number: '',
  });

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  const loadData = () => {
    setLoading(true);
    const params = { type: typeFilter, status: statusFilter };
    if (deptFilter) params.department_id = deptFilter;
    if (search) params.search = search;

    Promise.all([
      api.get('/hrms/employees', { params }),
      api.get('/hrms/departments'),
      api.get('/hrms/designations'),
    ])
      .then(([empRes, deptRes, desigRes]) => {
        setEmployees(empRes.data || []);
        setDepartments(deptRes.data || []);
        setDesignations(desigRes.data || []);
      })
      .catch(err => toast.error(err.response?.data?.error || 'Failed to load employees'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, deptFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/hrms/employees', form);
      toast.success('Employee created successfully!');
      setShowAddModal(false);
      setForm({
        name: '', email: '', phone: '', role: 'TEACHER', employee_id: '',
        department: '', designation: '', salary: '', gender: 'MALE',
        dob: '', joining_date: new Date().toISOString().slice(0, 10),
        qualification: '', experience_years: '0', employment_type: 'PERMANENT',
        bank_name: '', account_number: '', ifsc_code: '', pan_number: '', aadhaar_number: '',
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  const cardBg = {
    background: darkMode ? '#141b2d' : '#ffffff',
    borderColor: darkMode ? '#1e293b' : '#e2e8f0',
    color: darkMode ? '#f8fafc' : '#0f172a'
  };

  const getStatusBadge = (status, isActive) => {
    if (!isActive || status === 'INACTIVE' || status === 'RESIGNED' || status === 'TERMINATED') {
      return <span style={{ background: '#ef444418', color: '#ef4444', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>{status || 'INACTIVE'}</span>;
    }
    if (status === 'PROBATION') {
      return <span style={{ background: '#f59e0b18', color: '#f59e0b', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>PROBATION</span>;
    }
    if (status === 'NOTICE_PERIOD') {
      return <span style={{ background: '#8b5cf618', color: '#8b5cf6', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>NOTICE PERIOD</span>;
    }
    return <span style={{ background: '#10b98118', color: '#10b981', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>ACTIVE</span>;
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Staff &amp; Teacher Directory" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header & Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>Employee Master Directory</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Total {employees.length} records found
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  background: '#2563eb', color: '#ffffff', border: 'none', padding: '9px 16px',
                  borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                }}
              >
                <i className="ti ti-user-plus" /> Add Employee
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ ...cardBg, borderRadius: '14px', border: '1px solid', padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Type Filter Buttons */}
              <div style={{ display: 'flex', background: darkMode ? '#1e293b' : '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                {['ALL', 'TEACHER', 'STAFF'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    style={{
                      background: typeFilter === t ? (darkMode ? '#3b82f6' : '#ffffff') : 'transparent',
                      color: typeFilter === t ? (darkMode ? '#ffffff' : '#1e3a8a') : '#64748b',
                      border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 700,
                      fontSize: '12px', cursor: 'pointer', boxShadow: typeFilter === t ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {t === 'ALL' ? 'All Roles' : t === 'TEACHER' ? 'Teachers' : 'Non-Teaching Staff'}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f8fafc' : '#0f172a' }}
              >
                <option value="ACTIVE">Active Staff</option>
                <option value="ALL">All Statuses</option>
                <option value="INACTIVE">Inactive / Exited</option>
              </select>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Search by name, ID, phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  fontSize: '12.5px', width: '220px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#f8fafc' : '#0f172a'
                }}
              />
              <button
                type="submit"
                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0 14px', borderRadius: '8px', cursor: 'pointer' }}
              >
                <i className="ti ti-search" />
              </button>
            </form>
          </div>

          {/* Directory Table */}
          <div style={{ ...cardBg, borderRadius: '16px', border: '1px solid', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <i className="ti ti-loader-2 ti-spin" style={{ fontSize: '28px', marginBottom: '8px' }} />
                <p>Loading employee directory...</p>
              </div>
            ) : employees.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                <i className="ti ti-users-minus" style={{ fontSize: '42px', marginBottom: '10px' }} />
                <p style={{ fontSize: '15px', fontWeight: 600 }}>No employees match the selected filters.</p>
                <button
                  onClick={() => { setTypeFilter('ALL'); setStatusFilter('ALL'); setSearch(''); }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#e2e8f0'}`, textAlign: 'left', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '14px 18px' }}>Employee</th>
                      <th style={{ padding: '14px 18px' }}>Role &amp; Type</th>
                      <th style={{ padding: '14px 18px' }}>Department</th>
                      <th style={{ padding: '14px 18px' }}>Designation</th>
                      <th style={{ padding: '14px 18px' }}>Status</th>
                      <th style={{ padding: '14px 18px' }}>Joining Date</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr
                        key={emp.user_id}
                        style={{ borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#1e293b50' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f620',
                              color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '13px', overflow: 'hidden'
                            }}>
                              {emp.avatar_url ? (
                                <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                emp.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{emp.name}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                ID: <b>{emp.employee_id || '—'}</b> • {emp.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{
                            background: emp.role === 'TEACHER' ? '#3b82f615' : '#8b5cf615',
                            color: emp.role === 'TEACHER' ? '#3b82f6' : '#8b5cf6',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700
                          }}>
                            {emp.role}
                          </span>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{emp.employment_type}</div>
                        </td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{emp.department || '—'}</td>
                        <td style={{ padding: '12px 18px', fontWeight: 500 }}>{emp.designation || '—'}</td>
                        <td style={{ padding: '12px 18px' }}>{getStatusBadge(emp.employment_status, emp.is_active)}</td>
                        <td style={{ padding: '12px 18px', color: '#64748b' }}>{emp.joining_date || '—'}</td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/hrms/employees/${emp.user_id}`)}
                            style={{
                              background: '#3b82f616', color: '#3b82f6', border: 'none', padding: '6px 12px',
                              borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            View 360° Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══ Add Employee Modal ══ */}
          {showAddModal && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
            }}>
              <div style={{
                ...cardBg, borderRadius: '20px', width: '100%', maxWidth: '780px',
                maxHeight: '90vh', overflowY: 'auto', border: '1px solid', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', padding: '28px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Add New Employee (Teacher / Staff)</h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Fill in personal, employment, and statutory details</span>
                  </div>
                  <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>
                    <i className="ti ti-x" />
                  </button>
                </div>

                <form onSubmit={handleCreateEmployee}>
                  {/* Personal Section */}
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 800, margin: '0 0 12px' }}>
                    1. Basic &amp; Contact Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Full Name *</label>
                      <input
                        type="text" required placeholder="e.g., Rajesh Sharma" value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Email (Login) *</label>
                      <input
                        type="email" required placeholder="rajesh@school.com" value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Mobile Phone</label>
                      <input
                        type="tel" placeholder="9876543210" value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Role / Category *</label>
                      <select
                        value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      >
                        {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Gender</label>
                      <select
                        value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Date of Birth</label>
                      <input
                        type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Employment Section */}
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 800, margin: '16px 0 12px' }}>
                    2. Employment &amp; Salary Structure
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Department</label>
                      <input
                        type="text" placeholder="e.g. Science / Administration" value={form.department}
                        onChange={e => setForm({ ...form, department: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Designation</label>
                      <input
                        type="text" placeholder="e.g. Senior PGT / Accountant" value={form.designation}
                        onChange={e => setForm({ ...form, designation: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Monthly Gross Salary (₹)</label>
                      <input
                        type="number" placeholder="35000" value={form.salary}
                        onChange={e => setForm({ ...form, salary: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Joining Date</label>
                      <input
                        type="date" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Employment Type</label>
                      <select
                        value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      >
                        {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Qualification</label>
                      <input
                        type="text" placeholder="e.g. M.Sc, B.Ed" value={form.qualification}
                        onChange={e => setForm({ ...form, qualification: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Bank & KYC Section */}
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 800, margin: '16px 0 12px' }}>
                    3. Bank Details &amp; Identification
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Bank Name</label>
                      <input
                        type="text" placeholder="State Bank of India" value={form.bank_name}
                        onChange={e => setForm({ ...form, bank_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Account Number</label>
                      <input
                        type="text" placeholder="123456789012" value={form.account_number}
                        onChange={e => setForm({ ...form, account_number: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>IFSC Code</label>
                      <input
                        type="text" placeholder="SBIN0001234" value={form.ifsc_code}
                        onChange={e => setForm({ ...form, ifsc_code: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>PAN Number</label>
                      <input
                        type="text" placeholder="ABCDE1234F" value={form.pan_number}
                        onChange={e => setForm({ ...form, pan_number: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Aadhaar Number</label>
                      <input
                        type="text" placeholder="1234 5678 9012" value={form.aadhaar_number}
                        onChange={e => setForm({ ...form, aadhaar_number: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <button
                      type="button" onClick={() => setShowAddModal(false)}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={saving}
                      style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {saving ? 'Creating...' : 'Save & Onboard Employee'}
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
