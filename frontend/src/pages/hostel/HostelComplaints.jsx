import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelComplaints() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ederp_theme') === 'dark');
  const [loading, setLoading]   = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [catFilter, setCatFilter]       = useState('ALL');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [students, setStudents]       = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [category, setCategory]       = useState('MAINTENANCE');
  const [priority, setPriority]       = useState('MEDIUM');
  const [title, setTitle]             = useState('');
  const [desc, setDesc]               = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const [resolveModal, setResolveModal] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);
  const [resStatus, setResStatus]       = useState('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving]       = useState(false);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hostel/complaints', {
        params: { status: statusFilter, category: catFilter !== 'ALL' ? catFilter : undefined }
      });
      setComplaints(res.data);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, catFilter]);

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

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select an active resident');
      return;
    }
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/hostel/complaints', {
        student_id: selectedStudent.student_id,
        category,
        priority,
        title,
        description: desc,
      });
      toast.success('Complaint ticket logged successfully');
      setCreateModal(false);
      setSelectedStudent(null);
      setTitle('');
      setDesc('');
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  const openResolve = (comp) => {
    setSelectedComp(comp);
    setResStatus('RESOLVED');
    setResolutionText(comp.resolution || '');
    setResolveModal(true);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    try {
      setResolving(true);
      await api.patch(`/hostel/complaints/${selectedComp.id}/status`, {
        status: resStatus,
        resolution: resolutionText,
      });
      toast.success('Complaint status updated');
      setResolveModal(false);
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={`app-shell${darkMode ? ' theme-dark' : ''}`}>
      <Sidebar darkMode={darkMode} />
      <div className="main-content">
        <Navbar title="Complaints &amp; Maintenance Requests" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div className="page-body">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: darkMode ? '#f8fafc' : '#1e293b' }}>Hostel Complaints &amp; Requests</h2>
              <p className="text-muted mb-0">Track maintenance tickets, electrical issues, plumbing repairs, and resident requests.</p>
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
              <i className="ti ti-plus fs-5"></i>
              Log Complaint
            </button>
          </div>

          {/* Filters */}
          <div className="card border-0 shadow-sm p-3 mb-4" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff' }}>
            <div className="row g-2 align-items-center">
              <div className="col-md-6 d-flex gap-1 flex-wrap">
                {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
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
              <div className="col-md-6 d-flex justify-content-md-end">
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: '220px' }}
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="PLUMBING">Plumbing</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="FOOD">Food / Mess</option>
                  <option value="SAFETY">Safety</option>
                  <option value="WIFI">WiFi / Internet</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Complaints Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead style={{ background: darkMode ? '#0f172a' : '#f8fafc', color: darkMode ? '#cbd5e1' : '#64748b' }}>
                  <tr>
                    <th className="py-3 px-4">Resident &amp; Room</th>
                    <th className="py-3">Issue Title &amp; Category</th>
                    <th className="py-3 text-center">Priority</th>
                    <th className="py-3">Reported At</th>
                    <th className="py-3 text-center">Status</th>
                    <th className="py-3">Resolution Details</th>
                    <th className="py-3 text-end px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
                        Loading complaints...
                      </td>
                    </tr>
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        <i className="ti ti-check-circle fs-1 d-block mb-2 text-success opacity-50"></i>
                        No complaints logged for this filter.
                      </td>
                    </tr>
                  ) : (
                    complaints.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4">
                          <div className="fw-bold" style={{ color: darkMode ? '#f8fafc' : '#0f172a' }}>{c.student_name}</div>
                          <small className="text-muted">{c.hostel_name} &bull; Room {c.room_number}</small>
                        </td>
                        <td>
                          <div className="fw-semibold">{c.title}</div>
                          <span className="badge bg-secondary-subtle text-secondary border px-2 py-0 small">{c.category}</span>
                          <div className="small text-muted text-truncate" style={{ maxWidth: '240px' }}>{c.description}</div>
                        </td>
                        <td className="text-center">
                          {c.priority === 'URGENT' ? (
                            <span className="badge bg-danger">URGENT</span>
                          ) : c.priority === 'HIGH' ? (
                            <span className="badge bg-warning text-dark">HIGH</span>
                          ) : (
                            <span className="badge bg-light text-dark border">MEDIUM</span>
                          )}
                        </td>
                        <td>
                          <small className="text-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</small>
                        </td>
                        <td className="text-center">
                          {c.status === 'RESOLVED' ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">RESOLVED</span>
                          ) : c.status === 'IN_PROGRESS' ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">IN PROGRESS</span>
                          ) : c.status === 'CLOSED' ? (
                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">CLOSED</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">OPEN</span>
                          )}
                        </td>
                        <td>
                          <div className="small text-muted text-truncate" style={{ maxWidth: '200px' }}>{c.resolution || 'Pending repair...'}</div>
                        </td>
                        <td className="text-end px-4">
                          <button
                            className="btn btn-sm btn-outline-primary px-3 fw-semibold"
                            style={{ borderRadius: '6px' }}
                            onClick={() => openResolve(c)}
                          >
                            Update
                          </button>
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

      {/* Log Modal */}
      {createModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleCreateComplaint} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Log Maintenance / Request Ticket</h5>
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
                    <label className="form-label fw-semibold">Category</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="PLUMBING">Plumbing</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="FOOD">Food / Mess</option>
                      <option value="SAFETY">Safety</option>
                      <option value="WIFI">WiFi / Internet</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Priority</label>
                    <select
                      className="form-select"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Issue Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Geyser not heating / Tap leaking"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Description</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Specific details about location, room or equipment..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={submitting}>
                  {submitting ? 'Logging...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve / Update Status Modal */}
      {resolveModal && selectedComp && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleResolveSubmit} className="modal-content" style={{ borderRadius: '16px', background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#fff' : '#000' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Update Complaint Status</h5>
                <button type="button" className="btn-close" onClick={() => setResolveModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <div className="p-3 mb-3 rounded-3" style={{ background: darkMode ? '#0f172a' : '#f1f5f9' }}>
                  <div className="fw-bold">{selectedComp.title}</div>
                  <div className="small text-muted">{selectedComp.student_name} &bull; Room {selectedComp.room_number} &bull; {selectedComp.category}</div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">New Status</label>
                  <select
                    className="form-select"
                    value={resStatus}
                    onChange={(e) => setResStatus(e.target.value)}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Resolution / Action Taken Notes</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Describe how the issue was fixed, electrician notes, parts replaced..."
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light" onClick={() => setResolveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary px-4 fw-semibold" disabled={resolving}>
                  {resolving ? 'Saving...' : 'Update Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
