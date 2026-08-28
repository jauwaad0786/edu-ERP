import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1048576) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getFileIcon(ext) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return { icon: 'ti-file-type-pdf', color: '#dc2626', bg: '#fee2e2' };
  if (['doc', 'docx'].includes(e)) return { icon: 'ti-file-type-doc', color: '#2563eb', bg: '#dbeafe' };
  if (['ppt', 'pptx'].includes(e)) return { icon: 'ti-file-type-ppt', color: '#d97706', bg: '#fef3c7' };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return { icon: 'ti-photo', color: '#16a34a', bg: '#dcfce7' };
  if (['zip', 'rar'].includes(e)) return { icon: 'ti-file-zip', color: '#7c3aed', bg: '#ede9fe' };
  return { icon: 'ti-file-text', color: '#475569', bg: '#f1f5f9' };
}

export default function NotesPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudent = role === 'STUDENT' || role === 'PARENT';
  const canUpload = isPrincipal || isTeacher;

  // ─── STATE ───────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjects, setFormSubjects] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFile, setFormFile] = useState(null);

  // ─── 1. LOAD NOTES ──────────────────────────────────────────────────────────
  const loadNotes = useCallback(() => {
    setLoading(true);
    let url = `/academic/notes?search=${encodeURIComponent(search)}`;
    if (filterClass)   url += `&class_id=${filterClass}`;
    if (filterSubject) url += `&subject_id=${filterSubject}`;
    if (filterTeacher) url += `&teacher_id=${filterTeacher}`;

    api.get(url)
      .then(r => setNotes(r.data?.notes || []))
      .catch(() => toast.error('Failed to load study materials'))
      .finally(() => setLoading(false));
  }, [filterClass, filterSubject, filterTeacher, search]);

  useEffect(() => {
    if (canUpload) {
      api.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
      api.get('/principal/teachers').then(r => setTeachers(r.data || [])).catch(() => {});
    }
  }, [canUpload]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Load subjects when class selected in upload modal
  useEffect(() => {
    if (formClassId) {
      api.get(`/principal/classes/${formClassId}/subjects`)
        .then(r => setFormSubjects(r.data || []))
        .catch(() => setFormSubjects([]));
    } else {
      setFormSubjects([]);
    }
  }, [formClassId]);

  // ─── 2. UPLOAD NOTE ─────────────────────────────────────────────────────────
  async function handleUploadNote(e) {
    e.preventDefault();
    if (!formTitle.trim()) return toast.error('Please enter title');
    if (!formFile) return toast.error('Please choose a file to upload');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', formTitle.trim());
      fd.append('description', formDescription.trim());
      if (formClassId)   fd.append('class_id', formClassId);
      if (formSubjectId) fd.append('subject_id', formSubjectId);
      fd.append('file', formFile);

      const res = await api.post('/academic/notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data?.message || 'Study material uploaded successfully!');
      setShowUploadModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormClassId('');
      setFormSubjectId('');
      setFormFile(null);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // ─── 3. DELETE NOTE ─────────────────────────────────────────────────────────
  async function handleDeleteNote(noteId) {
    if (!window.confirm('Are you sure you want to delete this study material?')) return;
    try {
      await api.delete(`/academic/notes/${noteId}`);
      toast.success('Study material deleted');
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Notes & Study Material" />
        <div className="page-body">

          {/* HEADER */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'linear-gradient(135deg, #0b3b7b, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: '#fff', boxShadow: '0 4px 14px rgba(11,59,123,0.25)'
                }}>
                  <i className="ti ti-books" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0f172a' }}>
                    Notes & Academic Learning Resources
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                    {isStudent
                      ? 'Access study materials, lecture slides, and notes uploaded by your teachers'
                      : 'Upload and distribute subject-wise study materials, PPTs, and PDFs for your classes'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{
                      border: 'none', background: viewMode === 'grid' ? '#fff' : 'transparent',
                      color: viewMode === 'grid' ? '#0b3b7b' : '#64748b',
                      padding: '5px 10px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12
                    }}
                  >
                    <i className="ti ti-layout-grid" /> Grid
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    style={{
                      border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent',
                      color: viewMode === 'table' ? '#0b3b7b' : '#64748b',
                      padding: '5px 10px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12
                    }}
                  >
                    <i className="ti ti-list" /> Table
                  </button>
                </div>

                <button onClick={loadNotes} style={S.btnGhost}>
                  <i className="ti ti-refresh" /> Refresh
                </button>
                {canUpload && (
                  <button onClick={() => setShowUploadModal(true)} style={S.btnPrimary}>
                    <i className="ti ti-cloud-upload" /> Upload Material
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* FILTERS */}
          <div style={{ ...S.card, marginBottom: 20, padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {!isStudent && (
                <>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={S.label}>Class</label>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={S.select}>
                      <option value="">🏫 All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                    </select>
                  </div>

                  {isPrincipal && (
                    <div style={{ flex: '1 1 180px' }}>
                      <label style={S.label}>Teacher</label>
                      <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={S.select}>
                        <option value="">👨‍🏫 All Teachers</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={{ flex: '2 1 240px' }}>
                <label style={S.label}>Search</label>
                <div style={{ position: 'relative' }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    style={{ ...S.input, paddingLeft: 32 }}
                    placeholder="Search material title, file name, description..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadNotes()}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={loadNotes} style={S.btnPrimary}>
                  <i className="ti ti-filter" /> Filter
                </button>
                {(filterClass || filterSubject || filterTeacher || search) && (
                  <button
                    onClick={() => {
                      setFilterClass('');
                      setFilterSubject('');
                      setFilterTeacher('');
                      setSearch('');
                    }}
                    style={S.btnGhost}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STUDY MATERIAL CONTENT (GRID / TABLE)                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {loading ? (
            <div style={S.emptyBox}>⏳ Loading learning materials...</div>
          ) : notes.length === 0 ? (
            <div style={{ ...S.emptyBox, padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
              <h3 style={{ margin: 0, color: '#0f172a' }}>No study materials found</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                {canUpload ? 'Click "+ Upload Material" to add your first study resource.' : 'No notes currently available for your subjects.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {notes.map(n => {
                const iconInfo = getFileIcon(n.file_type || n.file_name?.split('.').pop());
                const canDelete = isPrincipal || (isTeacher && n.uploaded_by === user?.id);

                return (
                  <div key={n.id} style={{ ...S.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px 18px' }}>
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ background: '#eff6ff', color: '#0b3b7b', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                          {n.class_name || 'All Classes'} · {n.subject_name || 'General'}
                        </span>

                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {fmtDate(n.uploaded_at)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          background: iconInfo.bg, color: iconInfo.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, flexShrink: 0
                        }}>
                          <i className={`ti ${iconInfo.icon}`} />
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                            {n.title}
                          </h4>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>
                            Uploaded by: <strong>{n.teacher_name}</strong>
                          </div>
                        </div>
                      </div>

                      {n.description && (
                        <p style={{ fontSize: 12.5, color: '#475569', background: '#f8fafc', padding: '8px 10px', borderRadius: 6, margin: '10px 0 12px', lineHeight: 1.4 }}>
                          {n.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action & File Meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {fmtBytes(n.file_size) || (n.file_type || 'FILE').toUpperCase()}
                      </span>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <a
                          href={n.file_url} target="_blank" rel="noreferrer"
                          style={{ ...S.btnPrimary, padding: '5px 12px', fontSize: 11.5, textDecoration: 'none' }}
                        >
                          <i className="ti ti-download" /> Download
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '5px 8px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
                            title="Delete Material"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={S.card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Title & Description</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Class & Subject</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Uploaded By</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>File Size</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map(n => {
                      const canDelete = isPrincipal || (isTeacher && n.uploaded_by === user?.id);
                      return (
                        <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 800, color: '#0b3b7b' }}>{n.title}</div>
                            {n.description && <div style={{ fontSize: 11, color: '#64748b' }}>{n.description}</div>}
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{n.class_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{n.subject_name}</div>
                          </td>

                          <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>
                            {n.teacher_name}
                          </td>

                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                            {fmtBytes(n.file_size) || (n.file_type || '').toUpperCase()}
                          </td>

                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                            {fmtDate(n.uploaded_at)}
                          </td>

                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <a
                                href={n.file_url} target="_blank" rel="noreferrer"
                                style={{ ...S.btnPrimary, padding: '4px 10px', fontSize: 11.5, textDecoration: 'none' }}
                              >
                                <i className="ti ti-download" /> Download
                              </a>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteNote(n.id)}
                                  style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* UPLOAD STUDY MATERIAL MODAL                                        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {showUploadModal && (
            <div style={S.modalOverlay} onClick={() => setShowUploadModal(false)}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                    📚 Upload Study Material / Notes
                  </h3>
                  <button onClick={() => setShowUploadModal(false)} style={S.modalCloseBtn}>✕</button>
                </div>

                <form onSubmit={handleUploadNote} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Class & Section</label>
                      <select value={formClassId} onChange={e => setFormClassId(e.target.value)} style={S.select}>
                        <option value="">All Classes (General)</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Subject</label>
                      <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)} style={S.select}>
                        <option value="">General / All Subjects</option>
                        {formSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Material Title *</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Chapter 3 Chemical Reactions Lecture Notes"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={S.label}>Description / Chapter Details</label>
                    <textarea
                      style={{ ...S.input, minHeight: 60 }}
                      placeholder="Key topics covered, reading instructions..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <label style={{ ...S.btnOutline, cursor: 'pointer', display: 'inline-flex' }}>
                      <i className="ti ti-folder-open" /> Choose Document / Presentation / PDF
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
                        style={{ display: 'none' }}
                        onChange={e => setFormFile(e.target.files[0] || null)}
                      />
                    </label>
                    {formFile ? (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#0b3b7b', fontWeight: 700 }}>
                        ✅ {formFile.name} ({fmtBytes(formFile.size)})
                        <button type="button" onClick={() => setFormFile(null)} style={{ marginLeft: 6, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>PDF, DOCX, PPT, JPG, ZIP · Max 25 MB</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                    <button type="button" onClick={() => setShowUploadModal(false)} style={S.btnGhost}>Cancel</button>
                    <button type="submit" disabled={uploading || !formFile} style={S.btnPrimary}>
                      {uploading ? 'Uploading...' : 'Save & Share with Students'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: '18px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  },
  label: {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    background: '#0b3b7b',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s',
  },
  btnOutline: {
    background: '#fff',
    color: '#0b3b7b',
    border: '1.5px solid #0b3b7b',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyBox: {
    textAlign: 'center',
    padding: 24,
    background: '#f8fafc',
    borderRadius: 10,
    color: '#94a3b8',
    fontSize: 12.5,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: 14,
    padding: '20px 22px',
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: '#64748b',
    cursor: 'pointer',
    padding: 4,
  },
};
