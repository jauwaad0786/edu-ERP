import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function AnnualRegisterPage() {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Search & single registration state
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Form for new session enrollment
  const [targetSession, setTargetSession] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [stream, setStream] = useState('General');
  const [house, setHouse] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    api.get('/principal/students/sessions')
      .then(r => {
        const sess = r.data.sessions || [];
        setSessions(sess);
        if (sess.length > 0) {
          if (sess.length > 1) {
            setTargetSession(sess[1]);
          } else {
            const parts = sess[0].split('-');
            if (parts.length === 2 && !isNaN(parts[0])) {
              setTargetSession(`${parseInt(parts[0], 10) + 1}-${parseInt(parts[1], 10) + 1}`);
            } else {
              setTargetSession('2025-26');
            }
          }
        } else {
          setTargetSession('2025-26');
        }
      })
      .catch(() => {});
  }, []);

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
        class_id: parseInt(targetClassId, 10),
        roll_number: rollNumber || undefined,
        stream: stream || undefined,
        house: house || undefined,
        remarks: remarks || undefined,
      };

      const res = await api.post('/principal/students/annual-register', payload);
      toast.success(res.data.message || 'Student successfully registered for new session!');
      setSelectedStudent(null);
      setSearchTerm('');
      setRollNumber('');
      setRemarks('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    }
    setSaving(false);
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Annual Student Re-Registration" />
        <div className="page-body">

          {/* Breadcrumb & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                <span style={{ cursor: 'pointer', color: '#0176d3' }} onClick={() => navigate('/students')}>Student Management</span>
                <span>/</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>Annual Re-Registration</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>🎓</span> Annual Student Re-Registration
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Renew enrollments of continuing students into new academic sessions without creating duplicate accounts.
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

          {/* Main Card */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 24, maxWidth: 840, boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>

            {/* Step 1: Search Existing Student */}
            {!selectedStudent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#1e40af' }}>
                  🔍 Search an existing student by <strong>Admission Number</strong> or <strong>Name</strong>. Their permanent profile, fee ledger, and historical records will be automatically linked.
                </div>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="form-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Enter Student Name or Admission Number..."
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={searching || !searchTerm.trim()}
                    style={{ minWidth: 120, fontWeight: 700 }}
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      Select student to register ({searchResults.length} matches):
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      {searchResults.map(s => (
                        <div
                          key={s.id}
                          onClick={() => pickStudent(s)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Adm No: <strong>{s.admission_number}</strong> | Last Class: {s.class_name} {s.section}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-neutral"
                            style={{ fontSize: 12, padding: '4px 12px', fontWeight: 600, color: '#0176d3', borderColor: '#bae6fd' }}
                          >
                            Select →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Step 2: Fill Session Details */
              <form onSubmit={handleSubmitRegistration} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Selected Student Banner */}
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                  padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Selected Student
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Admission No: <strong>{selectedStudent.admission_number}</strong> | Previous Class: {selectedStudent.class_name} {selectedStudent.section}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕ Change Student
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Target Academic Session *
                    </label>
                    <input
                      className="form-input"
                      value={targetSession}
                      onChange={e => setTargetSession(e.target.value)}
                      placeholder="e.g. 2025-26"
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Target Class & Section *
                    </label>
                    <select
                      className="form-select"
                      value={targetClassId}
                      onChange={e => setTargetClassId(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="">-- Choose Class & Section --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Roll Number (for New Session)
                    </label>
                    <input
                      className="form-input"
                      value={rollNumber}
                      onChange={e => setRollNumber(e.target.value)}
                      placeholder="e.g. 15"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Stream
                    </label>
                    <input
                      className="form-input"
                      value={stream}
                      onChange={e => setStream(e.target.value)}
                      placeholder="e.g. Science / Commerce"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      House
                    </label>
                    <input
                      className="form-input"
                      value={house}
                      onChange={e => setHouse(e.target.value)}
                      placeholder="e.g. Red House"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Remarks / Notes
                    </label>
                    <input
                      className="form-input"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="e.g. Annual renewal cleared"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ minWidth: 200, fontWeight: 700 }}
                  >
                    {saving ? 'Submitting Registration...' : '✓ Complete Re-Registration'}
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
