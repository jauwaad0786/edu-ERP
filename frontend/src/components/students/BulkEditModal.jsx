import React, { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function BulkEditModal({ isOpen, onClose, onSuccess, selectedStudentIds = [], session = '2024-25' }) {
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

  const [previewDiff, setPreviewDiff] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  if (!isOpen) return null;

  async function handleGeneratePreview() {
    setLoadingPreview(true);
    try {
      // Filter out empty fields
      const cleanAcademic = {};
      Object.entries(academicFields).forEach(([k, v]) => {
        if (v && v.trim()) cleanAcademic[k] = v.trim();
      });

      const cleanPermanent = {};
      Object.entries(permanentFields).forEach(([k, v]) => {
        if (v && v.trim()) cleanPermanent[k] = v.trim();
      });

      if (Object.keys(cleanAcademic).length === 0 && Object.keys(cleanPermanent).length === 0) {
        toast.error('Please enter at least one field to update');
        setLoadingPreview(false);
        return;
      }

      const res = await api.post('/principal/students/bulk-edit/preview', {
        student_ids: selectedStudentIds,
        academic_fields: cleanAcademic,
        permanent_fields: cleanPermanent,
      });

      setPreviewDiff(res.data);
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
        student_ids: selectedStudentIds,
        academic_fields: cleanAcademic,
        permanent_fields: cleanPermanent,
      });

      toast.success(res.data.message || 'Bulk edit applied successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk update failed');
    }
    setExecuting(false);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={e => e.target === e.currentTarget && !executing && onClose()} onKeyDown={e => e.key === "Escape" && (!executing && onClose())}>
      <div className="modal" style={{ maxWidth: 880, width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✏️</span> Bulk Edit Students
            </h3>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Updating {selectedStudentIds.length} selected students in session {session}
            </span>
          </div>
          <button className="modal-close" disabled={executing} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab selector */}
          <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 4 }}>
            <button
              type="button"
              onClick={() => { setActiveTab('academic'); setPreviewDiff(null); }}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', background: 'none',
                cursor: 'pointer',
                color: activeTab === 'academic' ? '#0176d3' : 'var(--neutral-6)',
                borderBottom: activeTab === 'academic' ? '2px solid #0176d3' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              📘 Session-Specific Academic Fields
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('permanent'); setPreviewDiff(null); }}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', background: 'none',
                cursor: 'pointer',
                color: activeTab === 'permanent' ? '#b45309' : 'var(--neutral-6)',
                borderBottom: activeTab === 'permanent' ? '2px solid #b45309' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              ⚠️ Permanent Master Profile Fields
            </button>
          </div>

          {/* ── TAB 1: ACADEMIC FIELDS ── */}
          {activeTab === 'academic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                ℹ️ <strong>Academic Year Isolation:</strong> Fields edited here apply strictly to active enrollments in session <strong>{session}</strong>. Historical marks and past enrollments are never affected.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f1">Stream</label>
                  <select id="bulkedit-f1"
                    className="form-select"
                    value={academicFields.stream}
                    onChange={e => { setAcademicFields(f => ({ ...f, stream: e.target.value })); setPreviewDiff(null); }}
                  >
                    <option value="">Leave unchanged</option>
                    <option value="General">General</option>
                    <option value="Science">Science</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Arts / Humanities">Arts / Humanities</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f2">House</label>
                  <input id="bulkedit-f2"
                    className="form-input"
                    placeholder="e.g. Red Tigers, Blue Whales"
                    value={academicFields.house}
                    onChange={e => { setAcademicFields(f => ({ ...f, house: e.target.value })); setPreviewDiff(null); }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f3">Enrollment Status</label>
                  <select id="bulkedit-f3"
                    className="form-select"
                    value={academicFields.enrollment_status}
                    onChange={e => { setAcademicFields(f => ({ ...f, enrollment_status: e.target.value })); setPreviewDiff(null); }}
                  >
                    <option value="">Leave unchanged</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROMOTED">PROMOTED</option>
                    <option value="RETAINED">RETAINED</option>
                    <option value="GRADUATED">GRADUATED</option>
                    <option value="WITHDRAWN">WITHDRAWN</option>
                    <option value="LEFT">LEFT</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f4">Roll Number Prefix (Sequential)</label>
                  <input id="bulkedit-f4"
                    className="form-input"
                    placeholder="e.g. 24A- (will set 24A-1, 24A-2...)"
                    value={academicFields.roll_number_prefix}
                    onChange={e => { setAcademicFields(f => ({ ...f, roll_number_prefix: e.target.value })); setPreviewDiff(null); }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: PERMANENT PROFILE FIELDS ── */}
          {activeTab === 'permanent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                ⚠️ <strong>Permanent Profile Modification:</strong> These fields update student lifetime master records. Exercise caution when editing permanent data across multiple students.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f5">Category / Caste</label>
                  <select id="bulkedit-f5"
                    className="form-select"
                    value={permanentFields.category}
                    onChange={e => { setPermanentFields(f => ({ ...f, category: e.target.value })); setPreviewDiff(null); }}
                  >
                    <option value="">Leave unchanged</option>
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f6">Blood Group</label>
                  <select id="bulkedit-f6"
                    className="form-select"
                    value={permanentFields.blood_group}
                    onChange={e => { setPermanentFields(f => ({ ...f, blood_group: e.target.value })); setPreviewDiff(null); }}
                  >
                    <option value="">Leave unchanged</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f7">Nationality</label>
                  <input id="bulkedit-f7"
                    className="form-input"
                    placeholder="e.g. Indian"
                    value={permanentFields.nationality}
                    onChange={e => { setPermanentFields(f => ({ ...f, nationality: e.target.value })); setPreviewDiff(null); }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bulkedit-f8">Permanent Address</label>
                  <input id="bulkedit-f8"
                    className="form-input"
                    placeholder="e.g. City, State, PIN"
                    value={permanentFields.address}
                    onChange={e => { setPermanentFields(f => ({ ...f, address: e.target.value })); setPreviewDiff(null); }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Generate Preview Button */}
          {!previewDiff && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loadingPreview}
                onClick={handleGeneratePreview}
              >
                {loadingPreview ? 'Generating Diff...' : 'Preview Bulk Changes →'}
              </button>
            </div>
          )}

          {/* ── PREVIEW DIFF TABLE ── */}
          {previewDiff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '2px solid #e2e8f0', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                  🔍 Changes Diff: {previewDiff.students_to_update?.length || 0} Students
                </h4>
                <button type="button" className="btn btn-neutral btn-sm" onClick={() => setPreviewDiff(null)}>
                  Modify Inputs
                </button>
              </div>

              <div className="table-container" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class & Roll</th>
                      <th>Proposed Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewDiff.students_to_update || []).map(s => (
                      <tr key={s.student_id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>Adm: {s.admission_no}</div>
                        </td>
                        <td>{s.class_name} | {s.current_roll_no || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {Object.entries(s.proposed_changes || {}).map(([f, val]) => (
                              <span key={f} style={{ fontSize: 12 }}>
                                <strong>{f}:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>{String(val)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-neutral" disabled={executing} onClick={onClose}>
            Cancel
          </button>
          {previewDiff && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={executing}
              onClick={handleConfirmBulkEdit}
            >
              {executing ? 'Applying Changes...' : `Confirm & Apply to ${previewDiff.students_to_update?.length} Students`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
