import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

function getFileIcon(ext, fileName) {
  const fileExt = (ext || (fileName ? fileName.split('.').pop() : '') || '').toLowerCase().replace('.', '');
  if (fileExt === 'pdf') return { icon: 'ti-file-type-pdf', color: '#dc2626', bg: '#fee2e2', label: 'PDF Document' };
  if (['doc', 'docx'].includes(fileExt)) return { icon: 'ti-file-type-doc', color: '#2563eb', bg: '#dbeafe', label: 'Word Document' };
  if (['ppt', 'pptx'].includes(fileExt)) return { icon: 'ti-file-type-ppt', color: '#d97706', bg: '#fef3c7', label: 'Presentation' };
  if (['xls', 'xlsx', 'csv'].includes(fileExt)) return { icon: 'ti-file-type-xls', color: '#16a34a', bg: '#dcfce7', label: 'Spreadsheet' };
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(fileExt)) return { icon: 'ti-photo', color: '#0891b2', bg: '#cffafe', label: 'Image' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt)) return { icon: 'ti-file-zip', color: '#7c3aed', bg: '#ede9fe', label: 'Archive' };
  return { icon: 'ti-file-text', color: '#475569', bg: '#f1f5f9', label: 'Study Note' };
}

export default function NotesPage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudent = role === 'STUDENT' || role === 'PARENT';
  const canUpload = isPrincipal || isTeacher;

  // ─── DATA STATE ─────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // ─── FILTER STATE ───────────────────────────────────────────────────────────
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterFileType, setFilterFileType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // ─── UPLOAD MODAL STATE ─────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjects, setFormSubjects] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFile, setFormFile] = useState(null);

  // ─── 1. FETCH INITIAL FILTER OPTIONS ─────────────────────────────────────────
  useEffect(() => {
    // Classes
    api.get('/principal/classes')
      .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
      .catch(() => setClasses([]));

    // Subjects
    api.get('/principal/subjects')
      .then(r => setSubjects(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSubjects([]));

    // Teachers
    if (isPrincipal) {
      api.get('/principal/teachers')
        .then(r => setTeachers(Array.isArray(r.data) ? r.data : []))
        .catch(() => setTeachers([]));
    }
  }, [isPrincipal]);

  // Distinct sections list derived from available classes
  const availableSections = useMemo(() => {
    const set = new Set();
    classes.forEach(c => {
      if (c.section) set.add(c.section.trim());
    });
    return Array.from(set).sort();
  }, [classes]);

  // Filtered subject list depending on selected class in filters
  const filteredSubjectOptions = useMemo(() => {
    if (!filterClass) return subjects;
    return subjects.filter(s => String(s.class_id) === String(filterClass));
  }, [subjects, filterClass]);

  // ─── 2. LOAD NOTES FROM BACKEND ─────────────────────────────────────────────
  const loadNotes = useCallback(() => {
    setLoading(true);
    let url = `/academic/notes?search=${encodeURIComponent(search)}`;
    if (filterClass)    url += `&class_id=${filterClass}`;
    if (filterSection)  url += `&section=${encodeURIComponent(filterSection)}`;
    if (filterSubject)  url += `&subject_id=${filterSubject}`;
    if (filterTeacher)  url += `&teacher_id=${filterTeacher}`;
    if (filterFileType) url += `&file_type=${encodeURIComponent(filterFileType)}`;
    if (filterDateFrom) url += `&date_from=${encodeURIComponent(filterDateFrom)}`;
    if (filterDateTo)   url += `&date_to=${encodeURIComponent(filterDateTo)}`;

    api.get(url)
      .then(r => setNotes(r.data?.notes || []))
      .catch(() => toast.error('Failed to load study materials'))
      .finally(() => setLoading(false));
  }, [filterClass, filterSection, filterSubject, filterTeacher, filterFileType, filterDateFrom, filterDateTo, search]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Load modal subjects when modal class changes
  useEffect(() => {
    if (formClassId) {
      api.get(`/principal/classes/${formClassId}/subjects`)
        .then(r => setFormSubjects(Array.isArray(r.data) ? r.data : []))
        .catch(() => setFormSubjects([]));
    } else {
      setFormSubjects(subjects);
    }
  }, [formClassId, subjects]);

  // ─── 3. UPLOAD NOTE ──────────────────────────────────────────────────────────
  async function handleUploadNote(e) {
    e.preventDefault();
    if (!formTitle.trim()) return toast.error('Please enter document title');
    if (!formFile) return toast.error('Please select a file to upload');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', formTitle.trim());
      fd.append('description', formDescription.trim());
      if (formClassId)   fd.append('class_id', formClassId);
      if (formSubjectId) fd.append('subject_id', formSubjectId);
      if (formTeacherId) fd.append('teacher_id', formTeacherId);
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
      setFormTeacherId('');
      setFormFile(null);
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // ─── 4. DELETE NOTE ──────────────────────────────────────────────────────────
  async function handleDeleteNote(noteId) {
    if (!window.confirm('Are you sure you want to permanently remove this study material?')) return;
    try {
      await api.delete(`/academic/notes/${noteId}`);
      toast.success('Study material deleted');
      loadNotes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  }

  const hasActiveFilters = Boolean(
    filterClass || filterSection || filterSubject || filterTeacher || filterFileType || filterDateFrom || filterDateTo || search
  );

  function resetFilters() {
    setFilterClass('');
    setFilterSection('');
    setFilterSubject('');
    setFilterTeacher('');
    setFilterFileType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearch('');
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Notes & Study Material" />
        <div className="page-body">

          {/* ══ HEADER ══ */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: 'linear-gradient(135deg, #0b3b7b, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, color: '#fff', boxShadow: '0 4px 16px rgba(11,59,123,0.25)'
                }}>
                  <i className="ti ti-books" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                      Notes & Academic Study Materials
                    </h2>
                    {isPrincipal && (
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20,
                        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe'
                      }}>
                        🏫 School-Wide View
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                    {isStudent
                      ? 'Access official subject notes, lecture slides, and reference materials uploaded by your school teachers'
                      : isPrincipal
                      ? 'Complete school oversight of all academic material, teacher uploads, and subject resources'
                      : 'Upload and distribute chapter notes, assignments material, PPTs, and PDFs for your assigned subjects'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid #e2e8f0' }}>
                  <button
                    onClick={() => setViewMode('table')}
                    style={{
                      border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent',
                      color: viewMode === 'table' ? '#0b3b7b' : '#64748b',
                      padding: '6px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                      boxShadow: viewMode === 'table' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                    }}
                  >
                    <i className="ti ti-list" /> Table View
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    style={{
                      border: 'none', background: viewMode === 'grid' ? '#fff' : 'transparent',
                      color: viewMode === 'grid' ? '#0b3b7b' : '#64748b',
                      padding: '6px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12.5,
                      boxShadow: viewMode === 'grid' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                    }}
                  >
                    <i className="ti ti-layout-grid" /> Grid Cards
                  </button>
                </div>

                <button onClick={loadNotes} style={S.btnGhost} title="Reload latest records">
                  <i className="ti ti-refresh" /> Refresh
                </button>

                {canUpload && (
                  <button onClick={() => setShowUploadModal(true)} style={S.btnPrimary}>
                    <i className="ti ti-cloud-upload" /> + Upload Study Material
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ══ COMPREHENSIVE FILTER TOOLBAR ══ */}
          <div style={{ ...S.card, marginBottom: 22, padding: '16px 20px' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-filter" style={{ color: '#2563eb' }} /> Filter Materials ({notes.length} results)
              </span>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <i className="ti ti-x" /> Reset All Filters
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
              {/* Search */}
              <div style={{ gridColumn: 'span 2', minWidth: 240 }}>
                <label style={S.label}>Search Title / File / Keywords</label>
                <div style={{ position: 'relative' }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }} />
                  <input
                    style={{ ...S.input, paddingLeft: 32 }}
                    placeholder="Search by topic, file name, keyword..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadNotes()}
                  />
                </div>
              </div>

              {/* Class Filter */}
              <div>
                <label style={S.label}>Class</label>
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={S.select}>
                  <option value="">🏫 All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div>
                <label style={S.label}>Section</label>
                <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={S.select}>
                  <option value="">🔤 All Sections</option>
                  {availableSections.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <label style={S.label}>Subject</label>
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={S.select}>
                  <option value="">📚 All Subjects</option>
                  {filteredSubjectOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `[${s.code}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher Filter (Visible for Principal & Admins) */}
              {isPrincipal && (
                <div>
                  <label style={S.label}>Teacher / Uploader</label>
                  <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={S.select}>
                    <option value="">👨‍🏫 All Teachers</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.designation || 'Teacher'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Document Type Filter */}
              <div>
                <label style={S.label}>File Type</label>
                <select value={filterFileType} onChange={e => setFilterFileType(e.target.value)} style={S.select}>
                  <option value="">📄 All Formats</option>
                  <option value="pdf">PDF Documents</option>
                  <option value="doc">Word Docs (DOC/DOCX)</option>
                  <option value="ppt">PowerPoint (PPT/PPTX)</option>
                  <option value="xls">Excel / CSV (XLS/XLSX)</option>
                  <option value="image">Images (PNG/JPG)</option>
                  <option value="zip">Archive / ZIP</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label style={S.label}>Date From</label>
                <input
                  type="date"
                  style={S.input}
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div>
                <label style={S.label}>Date To</label>
                <input
                  type="date"
                  style={S.input}
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ══ STUDY MATERIALS VIEW ══ */}
          {loading ? (
            <div style={{ ...S.card, padding: 50, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Loading academic study materials...</div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>Fetching verified school records</div>
            </div>
          ) : notes.length === 0 ? (
            <div style={{ ...S.card, padding: 60, textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#eff6ff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, color: '#2563eb', marginBottom: 14
              }}>
                📚
              </div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>No study materials found</h3>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, maxWidth: 460, margin: '6px auto 16px' }}>
                {hasActiveFilters
                  ? 'No documents matched the applied filters. Try resetting the search or filter criteria.'
                  : canUpload
                  ? 'No study materials uploaded yet. Click "+ Upload Study Material" above to share lecture notes and PDFs.'
                  : 'No learning resources are currently available for your enrolled subjects.'}
              </p>
              {hasActiveFilters && (
                <button onClick={resetFilters} style={S.btnPrimary}>
                  Reset All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* ─── 1. TABLE VIEW ────────────────────────────────────────────── */
            <div style={S.card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>Document / Resource Title</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left' }}>Subject</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left' }}>Class & Section</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left' }}>Uploaded By (Teacher)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left' }}>File Info</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left' }}>Upload Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', borderRadius: '0 8px 0 0' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((n, idx) => {
                      const iconInfo = getFileIcon(n.file_type, n.file_name);
                      const canDelete = isPrincipal || (isTeacher && String(n.uploaded_by) === String(user?.id));
                      const subName = n.subject?.name || n.subject_name || 'General';
                      const subCode = n.subject?.code || '';
                      const clsName = n.class?.name || (n.class_name ? n.class_name.split(' - ')[0] : 'All Classes');
                      const clsSection = n.class?.section || (n.class_name && n.class_name.includes(' - ') ? n.class_name.split(' - ')[1] : '');
                      const teacherName = n.teacher?.name || n.teacher_name || 'School Faculty';
                      const teacherEmail = n.teacher?.email || '';

                      return (
                        <tr key={n.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Title & Description */}
                          <td style={{ padding: '14px 16px', minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: iconInfo.bg, color: iconInfo.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, flexShrink: 0
                              }}>
                                <i className={`ti ${iconInfo.icon}`} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0b3b7b', fontSize: 13.5 }}>
                                  {n.title}
                                </div>
                                {n.description && (
                                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.3, maxWidth: 300 }}>
                                    {n.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Subject */}
                          <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '4px 10px', borderRadius: 8,
                              background: '#eff6ff', color: '#1e40af', fontWeight: 800, fontSize: 12,
                              border: '1px solid #dbeafe'
                            }}>
                              <i className="ti ti-bookmark" style={{ fontSize: 12 }} />
                              {subName}
                              {subCode && <span style={{ opacity: 0.7, fontSize: 10.5 }}>[{subCode}]</span>}
                            </span>
                          </td>

                          {/* Class & Section */}
                          <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                              {clsName}
                            </div>
                            {clsSection ? (
                              <span style={{
                                fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                                background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', display: 'inline-block', marginTop: 2
                              }}>
                                Section {clsSection}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>All Sections</span>
                            )}
                          </td>

                          {/* Teacher / Uploader */}
                          <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: '#e0e7ff', color: '#4338ca',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800
                              }}>
                                {teacherName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 12.5 }}>
                                  {teacherName}
                                </div>
                                {teacherEmail && (
                                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{teacherEmail}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* File Details */}
                          <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                              {fmtBytes(n.file_size) || (n.file_type || 'FILE').toUpperCase()}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94a3b8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {n.file_name || 'Document'}
                            </div>
                          </td>

                          {/* Upload Date */}
                          <td style={{ padding: '14px 14px', whiteSpace: 'nowrap', color: '#64748b', fontSize: 12 }}>
                            {fmtDate(n.uploaded_at)}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <a
                                href={n.file_url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                style={{
                                  ...S.btnPrimary,
                                  padding: '5px 12px', fontSize: 12, textDecoration: 'none',
                                  display: 'inline-flex', alignItems: 'center', gap: 5
                                }}
                              >
                                <i className="ti ti-download" /> Download
                              </a>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteNote(n.id)}
                                  style={{
                                    background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                                    padding: '5px 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  title="Delete Document"
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
          ) : (
            /* ─── 2. GRID CARDS VIEW ───────────────────────────────────────── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
              {notes.map(n => {
                const iconInfo = getFileIcon(n.file_type, n.file_name);
                const canDelete = isPrincipal || (isTeacher && String(n.uploaded_by) === String(user?.id));
                const subName = n.subject?.name || n.subject_name || 'General';
                const subCode = n.subject?.code || '';
                const clsName = n.class?.name || (n.class_name ? n.class_name.split(' - ')[0] : 'All Classes');
                const clsSection = n.class?.section || (n.class_name && n.class_name.includes(' - ') ? n.class_name.split(' - ')[1] : '');
                const teacherName = n.teacher?.name || n.teacher_name || 'Faculty';

                return (
                  <div
                    key={n.id}
                    style={{
                      ...S.card,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      padding: '18px 20px', transition: 'all 0.2s', position: 'relative',
                      borderTop: `4px solid ${iconInfo.color}`
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{
                          background: '#eff6ff', color: '#1e40af', fontSize: 11.5, fontWeight: 800,
                          padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe',
                          display: 'inline-flex', alignItems: 'center', gap: 4
                        }}>
                          <i className="ti ti-bookmark" /> {subName} {subCode && `[${subCode}]`}
                        </span>

                        <span style={{
                          background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 700,
                          padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0'
                        }}>
                          🏫 {clsName} {clsSection ? `(${clsSection})` : ''}
                        </span>
                      </div>

                      {/* Title & Icon */}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
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
                          <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="ti ti-user" style={{ fontSize: 12 }} />
                            Uploaded by: <strong>{teacherName}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {n.description && (
                        <p style={{
                          fontSize: 12.5, color: '#475569', background: '#f8fafc',
                          padding: '8px 12px', borderRadius: 8, margin: '8px 0 12px',
                          lineHeight: 1.45, border: '1px solid #f1f5f9'
                        }}>
                          {n.description}
                        </p>
                      )}
                    </div>

                    {/* Footer / Meta & Download */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 12
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                          {fmtBytes(n.file_size) || (n.file_type || 'FILE').toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          {fmtDate(n.uploaded_at)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <a
                          href={n.file_url} target="_blank" rel="noreferrer" download
                          style={{ ...S.btnPrimary, padding: '5px 12px', fontSize: 12, textDecoration: 'none' }}
                        >
                          <i className="ti ti-download" /> Download
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            style={{
                              background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                              padding: '5px 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer'
                            }}
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
          )}

          {/* ══ UPLOAD STUDY MATERIAL MODAL ══ */}
          {showUploadModal && (
            <div style={S.modalOverlay} onClick={() => setShowUploadModal(false)}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: 12, borderBottom: '1px solid #f1f5f9', marginBottom: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: '#eff6ff', color: '#2563eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>
                      <i className="ti ti-cloud-upload" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>
                        Upload Study Material & Notes
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Share PDFs, PPTs, or documents with your classes
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowUploadModal(false)} style={S.modalCloseBtn}>✕</button>
                </div>

                <form onSubmit={handleUploadNote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.label}>Class & Section *</label>
                      <select
                        value={formClassId}
                        onChange={e => setFormClassId(e.target.value)}
                        style={S.select}
                        required
                      >
                        <option value="">-- Select Class --</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section ? `(${c.section})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Subject *</label>
                      <select
                        value={formSubjectId}
                        onChange={e => setFormSubjectId(e.target.value)}
                        style={S.select}
                        required
                      >
                        <option value="">-- Select Subject --</option>
                        {formSubjects.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `[${s.code}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isPrincipal && (
                    <div>
                      <label style={S.label}>Assigned Teacher (Optional)</label>
                      <select
                        value={formTeacherId}
                        onChange={e => setFormTeacherId(e.target.value)}
                        style={S.select}
                      >
                        <option value="">-- Associate with Subject Teacher or Self --</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.designation || 'Teacher'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={S.label}>Document / Material Title *</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Chapter 4 Trigonometry Formula Sheet & Solutions"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={S.label}>Description / Chapter Notes (Optional)</label>
                    <textarea
                      style={{ ...S.input, minHeight: 65, resize: 'vertical' }}
                      placeholder="Key concepts, page references, reading instructions for students..."
                      value={formDescription}
                      onChange={e => setFormDescription(e.target.value)}
                    />
                  </div>

                  {/* File Upload Zone */}
                  <div style={{
                    background: '#f8fafc', border: '2px dashed #cbd5e1',
                    borderRadius: 12, padding: '18px 14px', textAlign: 'center'
                  }}>
                    <label style={{ ...S.btnOutline, cursor: 'pointer', display: 'inline-flex' }}>
                      <i className="ti ti-folder-open" /> Browse File (PDF, DOCX, PPT, Image, ZIP)
                      <input
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
                        style={{ display: 'none' }}
                        onChange={e => setFormFile(e.target.files[0] || null)}
                      />
                    </label>

                    {formFile ? (
                      <div style={{
                        marginTop: 10, fontSize: 13, color: '#0b3b7b', fontWeight: 700,
                        background: '#eff6ff', padding: '6px 12px', borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', gap: 6
                      }}>
                        <span>✅ {formFile.name} ({fmtBytes(formFile.size)})</span>
                        <button
                          type="button"
                          onClick={() => setFormFile(null)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
                        Supports PDF, Word DOCX, PowerPoint PPT, Images, ZIP up to 25MB
                      </div>
                    )}
                  </div>

                  {/* Submit / Cancel */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      style={S.btnGhost}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading || !formFile}
                      style={{
                        ...S.btnPrimary,
                        opacity: uploading || !formFile ? 0.6 : 1,
                        cursor: uploading || !formFile ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {uploading ? '⏳ Uploading to Cloud...' : '🚀 Publish & Distribute'}
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

// ─── SENIOR ERP DESIGN SYSTEM STYLES ──────────────────────────────────────────
const S = {
  card: {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  label: {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 5,
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#0f172a',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 12.5,
    background: '#fff',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #0b3b7b, #1d4ed8)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 6px rgba(11,59,123,0.2)',
    transition: 'all 0.15s',
  },
  btnOutline: {
    background: '#ffffff',
    color: '#0b3b7b',
    border: '1.5px solid #0b3b7b',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  },
  btnGhost: {
    background: '#f8fafc',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    padding: 24,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    boxSizing: 'border-box',
  },
  modalCloseBtn: {
    background: '#f1f5f9',
    border: 'none',
    width: 32,
    height: 32,
    borderRadius: '50%',
    color: '#64748b',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
