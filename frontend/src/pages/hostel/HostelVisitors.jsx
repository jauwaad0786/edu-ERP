import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelVisitors() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [visitors, setVisitors] = useState([]);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

  // Modal
  const [createModal, setCreateModal] = useState(false);
  const [students, setStudents]       = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [relation, setRelation]       = useState('PARENT');
  const [idProofType, setIdProofType] = useState('AADHAAR');
  const [idProofNo, setIdProofNo]     = useState('');
  const [purpose, setPurpose]         = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/visitors', { params: { visit_date: visitDate } });
      setVisitors(res.data || []);
    } catch (err) {
      toast.error('Failed to load visitor register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [visitDate]);

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

  const handleCreateVisitor = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select the resident being visited');
      return;
    }
    if (!visitorName.trim() || !visitorPhone.trim()) {
      toast.error('Visitor name and phone are required');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/visitors', {
        student_id: selectedStudent.student_id,
        visitor_name: visitorName,
        visitor_phone: visitorPhone,
        relation,
        id_proof_type: idProofType,
        id_proof_no: idProofNo,
        purpose,
      });
      toast.success('Visitor entry recorded');
      setCreateModal(false);
      setSelectedStudent(null);
      setVisitorName('');
      setVisitorPhone('');
      setIdProofNo('');
      setPurpose('');
      fetchVisitors();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (visitorId) => {
    try {
      await api.patch(`/hostel/visitors/${visitorId}/checkout`);
      toast.success('Visitor checked out successfully');
      fetchVisitors();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Checkout failed');
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
        <Navbar title="Visitor Register &amp; Gate Security" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Visitor Register &amp; Gate Security
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Record parent &amp; guardian campus visits, verify identity documentation, and log departure times.
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
              <i className="ti ti-user-plus" style={{ fontSize: 16 }}></i>
              New Visitor Entry
            </button>
          </div>

          {/* Date Selector Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12 }}>SELECT VISIT DATE:</label>
            <input
              type="date"
              style={{ ...inputStyle, width: 'auto', minWidth: 180, marginBottom: 0 }}
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </div>

          {/* Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VISITOR DETAILS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>VISITING RESIDENT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RELATION &amp; PURPOSE</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ID PROOF</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>IN-TIME</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>OUT-TIME</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading visitor log...
                      </td>
                    </tr>
                  ) : visitors.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-users" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}></i>
                        No visitor entries recorded for {visitDate}.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{v.visitor_name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}><i className="ti ti-phone me-1"></i>{v.visitor_phone}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{v.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{v.hostel_name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#1e1b4b' : '#eff6ff', color: '#3b82f6',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {v.relation}
                          </span>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{v.purpose || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '2px 6px', borderRadius: 4, fontSize: 11
                          }}>
                            {v.id_proof_type}
                          </span>
                          {v.id_proof_no && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{v.id_proof_no}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600
                          }}>
                            {v.in_time ? new Date(v.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {v.out_time ? (
                            <span style={{
                              background: '#f1f5f9', color: '#64748b',
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600
                            }}>
                              {new Date(v.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={{
                              background: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a',
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                            }}>
                              ON CAMPUS
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {!v.out_time ? (
                            <button
                              onClick={() => handleCheckout(v.id)}
                              style={{
                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              Check-Out
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Departed</span>
                          )}
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

      {/* Visitor Modal */}
      {createModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Record Visitor Entry</h3>
              <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateVisitor}>
              <div className="modal-body">
                {/* Search resident */}
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Visiting Resident *</label>
                  <input
                    type="text"
                    placeholder="Search resident by name or admission no..."
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
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{st.admission_no} &bull; Room {st.room_number}</div>
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
                        <strong>{selectedStudent.student_name}</strong> &bull; Room {selectedStudent.room_number} ({selectedStudent.hostel_name})
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Visitor Full Name *</label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Relation</label>
                    <select
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="RELATIVE">Relative</option>
                      <option value="FRIEND">Friend</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ID Proof Type</label>
                    <select
                      value={idProofType}
                      onChange={(e) => setIdProofType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="AADHAAR">Aadhaar</option>
                      <option value="PAN">PAN Card</option>
                      <option value="DRIVING_LICENSE">License</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="VOTER_ID">Voter ID</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>ID Number</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={idProofNo}
                      onChange={(e) => setIdProofNo(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Purpose of Visit</label>
                  <input
                    type="text"
                    placeholder="e.g. Delivering clothes, fee payment, weekend visit..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    style={inputStyle}
                  />
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
                  {submitting ? 'Recording...' : 'Record Gate Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
