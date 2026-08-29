import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelOutPass() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [passes, setPasses]     = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Out-Pass Request Modal
  const [createModal, setCreateModal] = useState(false);
  const [students, setStudents]       = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [passType, setPassType]       = useState('DAY_OUTING');
  const [reason, setReason]           = useState('');
  const [destination, setDestination] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [outTime, setOutTime]         = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/out-passes', { params: { status: statusFilter } });
      setPasses(res.data || []);
    } catch (err) {
      toast.error('Failed to load out-pass records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
  }, [statusFilter]);

  const searchStudents = async (query) => {
    setStudentSearch(query);
    if (query.trim().length < 2) return;
    try {
      const res = await api.get('/hostel/admissions', { params: { search: query } });
      setStudents(res.data || []);
    } catch (err) {
      // ignore
    }
  };

  const handleCreatePass = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a resident');
      return;
    }
    if (!outTime || !expectedReturn) {
      toast.error('Please specify both departure and expected return times');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/out-passes', {
        student_id: selectedStudent.student_id,
        pass_type: passType,
        reason,
        destination,
        guardian_contact: guardianContact,
        out_time: outTime,
        expected_return: expectedReturn,
      });
      toast.success('Out-pass requested successfully');
      setCreateModal(false);
      setSelectedStudent(null);
      setReason('');
      setDestination('');
      fetchPasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit out-pass');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (passId, newStatus, extra = {}) => {
    try {
      await api.patch(`/hostel/out-passes/${passId}/status`, { status: newStatus, ...extra });
      toast.success(`Out-pass marked as ${newStatus}`);
      fetchPasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Status update failed');
    }
  };

  const cardStyle = {
    background: darkMode ? '#1e293b' : '#fff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12, padding: 20,
  };
  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 13,
    border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
    background: darkMode ? '#0f172a' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a',
    marginBottom: 12,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: darkMode ? '#0f172a' : '#f8fafc' }}>
      <Sidebar darkMode={darkMode} />
      <div style={{ marginLeft: 232, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar title="Gate Pass &amp; Out-Pass Register" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Gate Pass &amp; Out-Pass Register
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Manage resident day outings, night leaves, Warden approvals, and campus departure/arrival tracking.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setStudents([]);
                setStudentSearch('');
                setCreateModal(true);
              }}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <i className="ti ti-ticket" style={{ fontSize: 16 }}></i>
              Issue Gate Pass
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ ...labelStyle, marginBottom: 0, fontSize: 12, marginRight: 6 }}>FILTER STATUS:</span>
            {['ALL', 'REQUESTED', 'APPROVED', 'OUT', 'RETURNED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: statusFilter === st ? 'none' : `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                  background: statusFilter === st ? '#4f46e5' : (darkMode ? '#1e293b' : '#fff'),
                  color: statusFilter === st ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESIDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>PASS TYPE &amp; PURPOSE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>DEPARTURE TIME</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>EXPECTED RETURN</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ACTUAL RETURN</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading out-passes...
                      </td>
                    </tr>
                  ) : passes.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-ticket" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}></i>
                        No gate passes found for this filter.
                      </td>
                    </tr>
                  ) : (
                    passes.map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{p.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.hostel_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#1e1b4b' : '#eff6ff', color: '#3b82f6',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {p.pass_type.replace('_', ' ')}
                          </span>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.reason} &bull; {p.destination || 'No destination'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{p.out_time ? new Date(p.out_time).toLocaleString() : '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#d97706' }}>{p.expected_return ? new Date(p.expected_return).toLocaleString() : '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#16a34a' }}>{p.actual_return ? new Date(p.actual_return).toLocaleString() : '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: p.status === 'APPROVED' ? '#f0fdf4' :
                                        p.status === 'OUT' ? '#fefce8' :
                                        p.status === 'RETURNED' ? '#eff6ff' :
                                        p.status === 'REJECTED' ? '#fef2f2' : '#f1f5f9',
                            color: p.status === 'APPROVED' ? '#16a34a' :
                                   p.status === 'OUT' ? '#ca8a04' :
                                   p.status === 'RETURNED' ? '#2563eb' :
                                   p.status === 'REJECTED' ? '#dc2626' : '#64748b',
                            border: `1px solid ${
                              p.status === 'APPROVED' ? '#bbf7d0' :
                              p.status === 'OUT' ? '#fef08a' :
                              p.status === 'RETURNED' ? '#bfdbfe' :
                              p.status === 'REJECTED' ? '#fecaca' : '#cbd5e1'
                            }`,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {p.status === 'REQUESTED' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(p.id, 'APPROVED')}
                                  style={{
                                    background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(p.id, 'REJECTED')}
                                  style={{
                                    background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'APPROVED' && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'OUT')}
                                style={{
                                  background: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a',
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Mark Departed (OUT)
                              </button>
                            )}
                            {p.status === 'OUT' && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'RETURNED')}
                                style={{
                                  background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                Mark Returned
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Out-Pass Modal */}
      {createModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Issue / Request Hostel Gate Pass</h3>
              <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreatePass}>
              <div className="modal-body">
                {/* Search resident */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Resident *</label>
                  <input
                    type="text"
                    placeholder="Search resident..."
                    value={studentSearch}
                    onChange={(e) => searchStudents(e.target.value)}
                    style={inputStyle}
                  />
                  {students.length > 0 && !selectedStudent && (
                    <div style={{
                      maxHeight: 140, overflowY: 'auto', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 8, background: darkMode ? '#0f172a' : '#fff', marginTop: -6, marginBottom: 10
                    }}>
                      {students.map((st) => (
                        <div
                          key={st.student_id}
                          onClick={() => {
                            setSelectedStudent(st);
                            setStudents([]);
                            setStudentSearch(st.student_name);
                          }}
                          style={{
                            padding: '8px 12px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`,
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{st.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Room {st.room_number}</div>
                          </div>
                          <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>Select</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <div style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6, marginBottom: 10
                    }}>
                      <div style={{ fontSize: 12, color: '#1e40af' }}>
                        <strong>{selectedStudent.student_name}</strong> &bull; Room {selectedStudent.room_number}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(null)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Pass Type</label>
                    <select
                      value={passType}
                      onChange={(e) => setPassType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="DAY_OUTING">Day Outing</option>
                      <option value="NIGHT_STAY">Night Stay</option>
                      <option value="HOME_LEAVE">Home Leave</option>
                      <option value="EMERGENCY">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Destination</label>
                    <input
                      type="text"
                      placeholder="e.g. Home / Market"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Departure Time *</label>
                    <input
                      type="datetime-local"
                      value={outTime}
                      onChange={(e) => setOutTime(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Expected Return *</label>
                    <input
                      type="datetime-local"
                      value={expectedReturn}
                      onChange={(e) => setExpectedReturn(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Reason for Out-Pass *</label>
                  <textarea
                    rows="2"
                    placeholder="Doctor appointment, family visit, weekend leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setCreateModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Issue Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
