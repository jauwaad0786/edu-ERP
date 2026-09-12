import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function BulkEditPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Roster state
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState(
    new Set(location.state?.selectedIds ? location.state.selectedIds : [])
  );

  // Edit fields
  const [activeTab, setActiveTab] = useState('academic'); // 'academic' | 'permanent'
  const [academicFields, setAcademicFields] = useState({
    roll_number_prefix: '',
    stream: '',
    house: '',
    enrollment_status: '',
  });
  const [permanentFields, setPermanentFields] = useState({
    category: '',
    blood_group: '',
    nationality: '',
    address: '',
  });

  // Diff & execution
  const [previewDiff, setPreviewDiff] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0) setSession(sess[0]);
      })
      .catch(() => {});
  }, []);

  // Fetch students based on filters
  const loadStudents = () => {
    setLoadingStudents(true);
    const params = [];
    if (selectedClassId) params.push(`class_id=${selectedClassId}`);
    if (session) params.push(`session=${encodeURIComponent(session)}`);
    const q = params.length ? `?${params.join('&')}` : '';

    api.get(`/principal/students${q}`)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.data || []);
        setStudents(list);
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  };

  useEffect(() => {
    loadStudents();
  }, [selectedClassId, session]);

  // Filtered roster by search
  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
      (s.roll_number && String(s.roll_number).toLowerCase().includes(q))
    );
  });

  function toggleStudent(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreviewDiff(null);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
    setPreviewDiff(null);
  }

  async function handleGeneratePreview() {
    if (selectedIds.size === 0) {
      toast.error('Please select at least 1 student to edit');
      return;
    }

    const cleanAcademic = {};
    Object.entries(academicFields).forEach(([k, v]) => {
      if (v && v.trim()) cleanAcademic[k] = v.trim();
    });

    const cleanPermanent = {};
    Object.entries(permanentFields).forEach(([k, v]) => {
      if (v && v.trim()) cleanPermanent[k] = v.trim();
    });

    if (Object.keys(cleanAcademic).length === 0 && Object.keys(cleanPermanent).length === 0) {
      toast.error('Please specify at least one field to update');
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await api.post('/principal/students/bulk-edit/preview', {
        student_ids: Array.from(selectedIds),
        academic_fields: cleanAcademic,
        permanent_fields: cleanPermanent,
      });
      setPreviewDiff(res.data);
      toast.success('Preview generated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to preview bulk changes');
    }
    setLoadingPreview(false);
  }

  async function handleConfirmBulkEdit() {
    if (!previewDiff) return;
    setExecuting(true);
    try {
      const cleanAcademic = {};
      Object.entries(academicFields).forEach(([k, v]) => {
        if (v && v.trim()) cleanAcademic[k] = v.trim();
      });

      const cleanPermanent = {};
      Object.entries(permanentFields).forEach(([k, v]) => {
        if (v && v.trim()) cleanPermanent[k] = v.trim();
      });

      const res = await api.post('/principal/students/bulk-edit/confirm', {
        student_ids: Array.from(selectedIds),
        academic_fields: cleanAcademic,
        permanent_fields: cleanPermanent,
      });

      toast.success(res.data.message || 'Bulk edit applied successfully!');
      setPreviewDiff(null);
      loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk update failed');
    }
    setExecuting(false);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Students Bulk Edit & Operations" />
        <div className="page-body">

          {/* Breadcrumb & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Bulk Edit</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>✏️</span> Students Bulk Operations & Editor
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Batch update enrollment status, stream, house, category, blood group, or address across multiple students at once.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => navigate('/students')}
                style={{ fontSize: 13 }}
              >
                ← Back to Students
              </button>
            </div>
          </div>

          {/* Step 1 & 2 Grid: Left Roster Selection, Right Fields Editor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Left: Student Selection Roster */}
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1e293b' }}>
                  1. Select Students ({selectedIds.size} selected)
                </h3>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{ background: 'none', border: 'none', color: '#0176d3', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  {selectedIds.size === filteredStudents.length && filteredStudents.length > 0 ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Session</label>
                  <select
                    className="form-select"
                    value={session}
                    onChange={e => setSession(e.target.value)}
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  >
                    <option value="">All Sessions</option>
                    {sessions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Class & Section</label>
                  <select
                    className="form-select"
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="🔍 Search student by name, roll no, adm no..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '7px 10px' }}
                />
              </div>

              {/* Student Scroll List */}
              <div style={{ flex: 1, minHeight: 320, maxHeight: 420, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                {loadingStudents ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading roster...</div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No students match criteria.</div>
                ) : (
                  filteredStudents.map(s => (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                        background: selectedIds.has(s.id) ? '#eff6ff' : '#fff'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => {}}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {s.class_name} {s.section} | Adm: {s.admission_number || '—'} | Roll: {s.roll_number || '—'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: s.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                        color: s.status === 'ACTIVE' ? '#15803d' : '#475569'
                      }}>
                        {s.status || 'ACTIVE'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Update Fields Panel */}
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column'
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#1e293b' }}>
                2. Specify Fields to Bulk Update
              </h3>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('academic')}
                  style={{
                    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    borderBottom: activeTab === 'academic' ? '2px solid #0176d3' : '2px solid transparent',
                    color: activeTab === 'academic' ? '#0176d3' : '#64748b'
                  }}
                >
                  🎓 Academic Fields
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('permanent')}
                  style={{
                    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    borderBottom: activeTab === 'permanent' ? '2px solid #0176d3' : '2px solid transparent',
                    color: activeTab === 'permanent' ? '#0176d3' : '#64748b'
                  }}
                >
                  👤 Permanent / Profile Fields
                </button>
              </div>

              {activeTab === 'academic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Enrollment Status
                    </label>
                    <select
                      className="form-select"
                      value={academicFields.enrollment_status}
                      onChange={e => setAcademicFields(prev => ({ ...prev, enrollment_status: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      <option value="">-- No Change --</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PROMOTED">PROMOTED</option>
                      <option value="RETAINED">RETAINED</option>
                      <option value="GRADUATED">GRADUATED</option>
                      <option value="WITHDRAWN">WITHDRAWN</option>
                      <option value="LEFT">LEFT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Stream (e.g. Science, Commerce, Arts)
                    </label>
                    <input
                      className="form-input"
                      value={academicFields.stream}
                      onChange={e => setAcademicFields(prev => ({ ...prev, stream: e.target.value }))}
                      placeholder="Leave blank for no change"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      House (e.g. Red, Blue, Green, Yellow)
                    </label>
                    <input
                      className="form-input"
                      value={academicFields.house}
                      onChange={e => setAcademicFields(prev => ({ ...prev, house: e.target.value }))}
                      placeholder="Leave blank for no change"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Roll Number Prefix
                    </label>
                    <input
                      className="form-input"
                      value={academicFields.roll_number_prefix}
                      onChange={e => setAcademicFields(prev => ({ ...prev, roll_number_prefix: e.target.value }))}
                      placeholder="e.g. 2024-"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'permanent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Social Category
                    </label>
                    <select
                      className="form-select"
                      value={permanentFields.category}
                      onChange={e => setPermanentFields(prev => ({ ...prev, category: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      <option value="">-- No Change --</option>
                      <option value="GEN">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Blood Group
                    </label>
                    <select
                      className="form-select"
                      value={permanentFields.blood_group}
                      onChange={e => setPermanentFields(prev => ({ ...prev, blood_group: e.target.value }))}
                      style={{ width: '100%' }}
                    >
                      <option value="">-- No Change --</option>
                      {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Nationality
                    </label>
                    <input
                      className="form-input"
                      value={permanentFields.nationality}
                      onChange={e => setPermanentFields(prev => ({ ...prev, nationality: e.target.value }))}
                      placeholder="e.g. Indian"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      City / Permanent Address
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={permanentFields.address}
                      onChange={e => setPermanentFields(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Leave blank for no change"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loadingPreview || selectedIds.size === 0}
                  onClick={handleGeneratePreview}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  {loadingPreview ? 'Generating Preview...' : `🔍 Preview Bulk Changes (${selectedIds.size} Selected)`}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Diff Preview & Confirmation */}
          {previewDiff && (
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: 20, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>
                    Step 3: Review Preview Diff Before Applying
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                    {previewDiff.diff?.length || 0} students will be updated.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={executing || !previewDiff.diff || previewDiff.diff.length === 0}
                  onClick={handleConfirmBulkEdit}
                  style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700, minWidth: 220 }}
                >
                  {executing ? 'Applying Updates...' : '✓ Confirm & Save All Changes'}
                </button>
              </div>

              {/* Diff Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Admission No</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Field</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>Previous Value</th>
                      <th style={{ padding: '10px 14px', fontSize: 12, textAlign: 'left' }}>New Proposed Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!previewDiff.diff || previewDiff.diff.length === 0) ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          No changes detected for the selected students.
                        </td>
                      </tr>
                    ) : (
                      previewDiff.diff.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                            {item.student_name}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                            {item.admission_number || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            {item.field}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#dc2626', background: '#fef2f2' }}>
                            {item.old_value || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#16a34a', background: '#f0fdf4', fontWeight: 600 }}>
                            {item.new_value || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
