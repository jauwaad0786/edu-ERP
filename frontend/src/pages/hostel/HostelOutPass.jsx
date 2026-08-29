import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelOutPass() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
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
      setPasses(res.data);
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
      setStudents(res.data);
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

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Gate Pass &amp; Out-Pass Management" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Out-Pass Register</h2>
              <p className="text-muted mb-0">Manage day outings, night stays, emergency gate passes, and arrival check-ins.</p>
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
              <i className="ti ti-ticket fs-5"></i>
              Issue Gate Pass
            </button>
          </div>

          {/* Filter Bar */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <span className="text-muted small fw-semibold me-2">FILTER:</span>
              {['ALL', 'REQUESTED', 'APPROVED', 'OUT', 'RETURNED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm px-3 fw-semibold ${statusFilter === st ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '8px' }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3">Type &amp; Purpose</th>
                    <th className="py-3">Departure (Out)</th>
                    <th className="py-3">Expected Return</th>
                    <th className="py-3">Actual Return</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3 text-end px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading out-passes...
                      </td>
                    </tr>
                  ) : passes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        No gate passes found for this filter.
                      </td>
                    </tr>
                  ) : (
                    passes.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{p.student_name}</div>
                          <small className="text-muted">{p.hostel_name}</small>
                        </td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary border px-2 py-1 mb-1 d-inline-block">
                            {p.pass_type.replace('_', ' ')}
                          </span>
                          <div className="small text-muted text-truncate" style={{ maxWidth: '200px' }}>
                            {p.reason} &bull; {p.destination || 'No destination'}
                          </div>
                        </td>
                        <td>
                          <small className="fw-semibold">{p.out_time ? new Date(p.out_time).toLocaleString() : '—'}</small>
                        </td>
                        <td>
                          <small className="fw-semibold text-warning">{p.expected_return ? new Date(p.expected_return).toLocaleString() : '—'}</small>
                        </td>
                        <td>
                          <small className="fw-semibold text-success">{p.actual_return ? new Date(p.actual_return).toLocaleString() : '—'}</small>
                        </td>
                        <td className="text-center">
                          {p.status === 'APPROVED' ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">APPROVED</span>
                          ) : p.status === 'OUT' ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">OUT OF CAMPUS</span>
                          ) : p.status === 'RETURNED' ? (
                            <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1">RETURNED</span>
                          ) : p.status === 'REJECTED' ? (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">REJECTED</span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">REQUESTED</span>
                          )}
                        </td>
                        <td className="text-end px-4">
                          <div className="d-flex gap-1 justify-content-end">
                            {p.status === 'REQUESTED' && (
                              <>
                                <button
                                  className="btn btn-sm btn-success px-2 py-1"
                                  style={{ borderRadius: '6px' }}
                                  onClick={() => handleUpdateStatus(p.id, 'APPROVED')}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger px-2 py-1"
                                  style={{ borderRadius: '6px' }}
                                  onClick={() => handleUpdateStatus(p.id, 'REJECTED')}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {p.status === 'APPROVED' && (
                              <button
                                className="btn btn-sm btn-warning px-2 py-1 fw-semibold"
                                style={{ borderRadius: '6px' }}
                                onClick={() => handleUpdateStatus(p.id, 'OUT')}
                              >
                                Mark Departed (OUT)
                              </button>
                            )}
                            {p.status === 'OUT' && (
                              <button
                                className="btn btn-sm btn-info px-2 py-1 text-white fw-semibold"
                                style={{ borderRadius: '6px' }}
                                onClick={() => handleUpdateStatus(p.id, 'RETURNED')}
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

      {/* Modal */}
      {createModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCreatePass} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Issue / Request Gate Pass</h5>
                <button type="button" className="btn-close" onClick={() => setCreateModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Resident</label>
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
                    <label className="form-label fw-semibold">Pass Type</label>
                    <select
                      className="form-select"
                      value={passType}
                      onChange={(e) => setPassType(e.target.value)}
                    >
                      <option value="DAY_OUTING">Day Outing</option>
                      <option value="NIGHT_STAY">Night Stay</option>
                      <option value="HOME_LEAVE">Home Leave</option>
                      <option value="EMERGENCY">Emergency</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Destination / City</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Home / City Market"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Departure Time *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={outTime}
                      onChange={(e) => setOutTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Expected Return *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={expectedReturn}
                      onChange={(e) => setExpectedReturn(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Reason for Out-Pass *</label>
                  <textarea
                    rows="2"
                    className="form-control"
                    placeholder="Doctor appointment, family visit, weekend leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Issue Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
