import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar  from '../../components/Navbar';
import api     from '../../api/axios';
import toast   from 'react-hot-toast';

export default function HostelComplaints() {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('ederp_theme') === 'dark');
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
      setComplaints(res.data || []);
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
      setStudents(res.data || []);
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
        <Navbar title="Complaints &amp; Maintenance Requests" darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: darkMode ? '#f8fafc' : '#0f172a' }}>
                Hostel Complaints &amp; Maintenance Requests
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Track room maintenance tickets, electrical &amp; plumbing issues, warden resolutions, and repair logs.
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
              <i className="ti ti-plus" style={{ fontSize: 16 }}></i>
              Log Complaint
            </button>
          </div>

          {/* Filters Bar */}
          <div style={{ ...cardStyle, padding: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ ...labelStyle, marginBottom: 0, fontSize: 12, marginRight: 4 }}>STATUS:</span>
              {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: statusFilter === st ? 'none' : `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
                    background: statusFilter === st ? '#4f46e5' : (darkMode ? '#1e293b' : '#fff'),
                    color: statusFilter === st ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0, fontSize: 12 }}>CATEGORY:</label>
              <select
                style={{ ...inputStyle, width: 'auto', minWidth: 160, marginBottom: 0 }}
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
                <option value="WIFI">WiFi / Net</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESIDENT &amp; ROOM</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>ISSUE TITLE &amp; CATEGORY</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>PRIORITY</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>REPORTED AT</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>RESOLUTION DETAILS</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        Loading complaints...
                      </td>
                    </tr>
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8' }}>
                        <i className="ti ti-check-circle" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: '#16a34a', opacity: 0.6 }}></i>
                        No complaints logged for this filter.
                      </td>
                    </tr>
                  ) : (
                    complaints.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: darkMode ? '#f8fafc' : '#0f172a' }}>{c.student_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.hostel_name} &bull; Room {c.room_number}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{c.title}</div>
                          <span style={{
                            background: darkMode ? '#334155' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569',
                            padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, display: 'inline-block', marginTop: 2
                          }}>
                            {c.category}
                          </span>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 260 }} className="truncate">{c.description}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: c.priority === 'URGENT' ? '#fef2f2' : c.priority === 'HIGH' ? '#fefce8' : '#f1f5f9',
                            color: c.priority === 'URGENT' ? '#dc2626' : c.priority === 'HIGH' ? '#ca8a04' : '#64748b',
                            border: `1px solid ${c.priority === 'URGENT' ? '#fecaca' : c.priority === 'HIGH' ? '#fef08a' : '#cbd5e1'}`,
                            padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700
                          }}>
                            {c.priority}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            background: c.status === 'RESOLVED' ? '#f0fdf4' :
                                        c.status === 'IN_PROGRESS' ? '#fefce8' :
                                        c.status === 'CLOSED' ? '#f1f5f9' : '#fef2f2',
                            color: c.status === 'RESOLVED' ? '#16a34a' :
                                   c.status === 'IN_PROGRESS' ? '#ca8a04' :
                                   c.status === 'CLOSED' ? '#64748b' : '#dc2626',
                            border: `1px solid ${
                              c.status === 'RESOLVED' ? '#bbf7d0' :
                              c.status === 'IN_PROGRESS' ? '#fef08a' :
                              c.status === 'CLOSED' ? '#cbd5e1' : '#fecaca'
                            }`,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
                          }}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12, maxWidth: 200 }} className="truncate">
                          {c.resolution || 'Pending repair...'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => openResolve(c)}
                            style={{
                              background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe',
                              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                            }}
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
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 500, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Log Maintenance / Request Ticket</h3>
              <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateComplaint}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={inputStyle}
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
                  <div>
                    <label style={labelStyle}>Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Issue Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Geyser not heating / Tap leaking"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Description Details</label>
                  <textarea
                    rows="3"
                    placeholder="Specific details about room location or broken equipment..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
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
                  {submitting ? 'Logging...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve / Update Status Modal */}
      {resolveModal && selectedComp && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setResolveModal(false)}>
          <div className="modal" style={{ maxWidth: 480, background: darkMode ? '#1e293b' : '#ffffff', color: darkMode ? '#ffffff' : '#0f172a' }}>
            <div className="modal-header" style={{ borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Update Complaint Status</h3>
              <button className="modal-close" onClick={() => setResolveModal(false)}>✕</button>
            </div>
            <form onSubmit={handleResolveSubmit}>
              <div className="modal-body">
                <div style={{
                  background: darkMode ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 8,
                  marginBottom: 14, border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedComp.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedComp.student_name} &bull; Room {selectedComp.room_number} &bull; {selectedComp.category}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    value={resStatus}
                    onChange={(e) => setResStatus(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Resolution / Action Taken Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Describe how the issue was fixed, electrician notes, parts replaced..."
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>
                <button type="button" className="btn btn-neutral" onClick={() => setResolveModal(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={resolving}
                  style={{
                    background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: resolving ? 'not-allowed' : 'pointer',
                  }}
                >
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
