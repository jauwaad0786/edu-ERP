import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelVisitors() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
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
      setVisitors(res.data);
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
      setStudents(res.data);
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

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Visitor Register &amp; Gate Security" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Visitor Register</h2>
              <p className="text-muted mb-0">Record parent and guardian visits, verify identity proof, and track entry/exit timestamps.</p>
            </div>
            <button
              className="btn btn-primary d-flex align-items-center gap-2"
              onClick={() => {
                setSelectedStudent(null);
                setStudents([]);
                setStudentSearch('');
                setCreateModal(true);
              }}
              style={{ borderRadius: '10px', padding: '10px 18px', fontWeight: 600 }}
            >
              <i className="ti ti-user-plus fs-5"></i>
              New Visitor Entry
            </button>
          </div>

          {/* Date Selector Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="d-flex align-items-center gap-3">
              <label className="form-label mb-0 fw-semibold text-muted small">SELECT VISIT DATE:</label>
              <input
                type="date"
                className="form-control"
                style={{ maxWidth: '200px' }}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Visitor Details</th>
                    <th className="py-3">Visiting Resident</th>
                    <th className="py-3">Relation &amp; Purpose</th>
                    <th className="py-3">ID Proof</th>
                    <th className="py-3">In-Time</th>
                    <th className="py-3">Out-Time</th>
                    <th className="py-3 text-end px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading visitor log...
                      </td>
                    </tr>
                  ) : visitors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        No visitor entries recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{v.visitor_name}</div>
                          <small className="text-muted"><i className="ti ti-phone me-1"></i>{v.visitor_phone}</small>
                        </td>
                        <td>
                          <div className="fw-semibold">{v.student_name}</div>
                          <small className="text-muted">{v.hostel_name}</small>
                        </td>
                        <td>
                          <span className="badge bg-info-subtle text-info border px-2 py-0 mb-1 d-inline-block">{v.relation}</span>
                          <div className="small text-muted">{v.purpose || '—'}</div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">{v.id_proof_type}</span>
                          {v.id_proof_no && <div className="small text-muted font-monospace">{v.id_proof_no}</div>}
                        </td>
                        <td>
                          <span className="badge bg-success-subtle text-success border">
                            {v.in_time ? new Date(v.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </td>
                        <td>
                          {v.out_time ? (
                            <span className="badge bg-secondary-subtle text-secondary border">
                              {new Date(v.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning border">ON CAMPUS</span>
                          )}
                        </td>
                        <td className="text-end px-4">
                          {!v.out_time ? (
                            <button
                              className="btn btn-sm btn-outline-danger px-3 fw-semibold"
                              style={{ borderRadius: '6px' }}
                              onClick={() => handleCheckout(v.id)}
                            >
                              Check-Out
                            </button>
                          ) : (
                            <span className="text-muted small">Completed</span>
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
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCreateVisitor} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Record Visitor Entry</h5>
                <button type="button" className="btn-close" onClick={() => setCreateModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Resident Visited</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search resident..."
                    value={studentSearch}
                    onChange={(e) => searchStudents(e.target.value)}
                  />
                  {students.length > 0 && !selectedStudent && (
                    <div className="list-group mt-2 border" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                      {students.map((st) => (
                        <button
                          key={st.student_id}
                          type="button"
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onClick={() => {
                            setSelectedStudent(st);
                            setStudents([]);
                            setStudentSearch(st.student_name);
                          }}
                        >
                          <div>
                            <div className="fw-semibold">{st.student_name}</div>
                            <small className="text-muted">Room {st.room_number}</small>
                          </div>
                          <span className="badge bg-primary">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <div className="alert alert-info py-2 px-3 mt-2 d-flex justify-content-between align-items-center mb-0">
                      <div><strong>{selectedStudent.student_name}</strong> &bull; Room {selectedStudent.room_number}</div>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setSelectedStudent(null)}>Change</button>
                    </div>
                  )}
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Visitor Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Full name"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Phone Number *</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="10-digit mobile"
                      value={visitorPhone}
                      onChange={(e) => setVisitorPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Relation</label>
                    <select
                      className="form-select"
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="RELATIVE">Relative</option>
                      <option value="FRIEND">Friend</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">ID Proof Type</label>
                    <select
                      className="form-select"
                      value={idProofType}
                      onChange={(e) => setIdProofType(e.target.value)}
                    >
                      <option value="AADHAAR">Aadhaar Card</option>
                      <option value="PAN">PAN Card</option>
                      <option value="DRIVING_LICENSE">Driving License</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="VOTER_ID">Voter ID</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">ID Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Optional ID no"
                      value={idProofNo}
                      onChange={(e) => setIdProofNo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Purpose of Visit</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Delivering clothes, fee payment, weekend visit..."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={submitting}>
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
