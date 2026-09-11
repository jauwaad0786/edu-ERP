import React, { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function AnnualRegisterModal({ isOpen, onClose, onSuccess, classes = [], sessions = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Form for new session enrollment
  const [targetSession, setTargetSession] = useState(sessions[1] || '2025-26');
  const [targetClassId, setTargetClassId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [stream, setStream] = useState('General');
  const [house, setHouse] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSearch(e) {
    e?.preventDefault();
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/principal/students?search=${encodeURIComponent(searchTerm.trim())}`);
      const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setSearchResults(list);
      if (list.length === 0) {
        toast.error('No matching student found');
      }
    } catch {
      toast.error('Search failed');
    }
    setSearching(false);
  }

  function pickStudent(student) {
    setSelectedStudent(student);
    setSearchResults([]);
    setRollNumber(student.roll_number || '');
    setHouse(student.house || '');
    setStream(student.stream || 'General');
  }

  async function handleSubmitRegistration(e) {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please search and select a student first');
      return;
    }
    if (!targetSession || !targetClassId) {
      toast.error('Please specify target session and class');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        session: targetSession,
        class_id: parseInt(targetClassId),
        roll_number: rollNumber || undefined,
        stream: stream || undefined,
        house: house || undefined,
        remarks: remarks || undefined,
      };

      const res = await api.post('/principal/students/annual-register', payload);
      toast.success(res.data.message || 'Student successfully registered for new session!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal" style={{ maxWidth: 680, width: '95%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎓</span> Annual Student Re-Registration
            </h3>
            <span style={{ fontSize: 12, color: 'var(--neutral-5)' }}>
              Enroll an existing student into a new academic session without duplicate profiles or accounts
            </span>
          </div>
          <button className="modal-close" disabled={saving} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1: Search Existing Student */}
          {!selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                🔍 Search an existing student by <strong>Admission Number</strong> or <strong>Name</strong>. Their permanent dossier and admission history will be linked automatically.
              </div>

              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Enter admission number or name (e.g. ADM2024001, Rohan)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map(s => (
                    <div
                      key={s.id}
                      onClick={() => pickStudent(s)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'inherit'}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--neutral-9)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                          Adm No: {s.admission_no || '—'} &nbsp;·&nbsp; Current Class: {s.class_name || '—'} &nbsp;·&nbsp; Session: {s.session || '—'}
                        </div>
                      </div>
                      <button type="button" className="btn btn-neutral btn-sm">
                        Select →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected student profile card */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    Permanent Master Profile Linked ✅
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-9)', marginTop: 2 }}>
                    {selectedStudent.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--neutral-6)' }}>
                    Admission No: <strong>{selectedStudent.admission_no || '—'}</strong> &nbsp;|&nbsp; Initial Adm: {selectedStudent.original_admission_year || '—'} &nbsp;|&nbsp; Parent: {selectedStudent.parent_name || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  onClick={() => setSelectedStudent(null)}
                >
                  Change Student
                </button>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSubmitRegistration} id="annual-reg-form">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">New Academic Session *</label>
                    <input
                      className="form-input"
                      required
                      value={targetSession}
                      onChange={e => setTargetSession(e.target.value)}
                      placeholder="e.g. 2025-26"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Enrolled Class & Section *</label>
                    <select
                      className="form-select"
                      required
                      value={targetClassId}
                      onChange={e => setTargetClassId(e.target.value)}
                    >
                      <option value="">Select class...</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} — {c.section}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">New Roll Number</label>
                    <input
                      className="form-input"
                      value={rollNumber}
                      onChange={e => setRollNumber(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stream</label>
                    <select
                      className="form-select"
                      value={stream}
                      onChange={e => setStream(e.target.value)}
                    >
                      <option value="General">General</option>
                      <option value="Science">Science</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Arts / Humanities">Arts / Humanities</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">House</label>
                    <input
                      className="form-input"
                      value={house}
                      onChange={e => setHouse(e.target.value)}
                      placeholder="e.g. Red Tigers"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <input
                      className="form-input"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="e.g. Re-enrolled for 2025-26"
                    />
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-neutral" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          {selectedStudent && (
            <button
              type="submit"
              form="annual-reg-form"
              className="btn btn-primary"
              disabled={saving || !targetClassId}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              {saving ? 'Registering...' : '🎓 Complete Session Registration'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
