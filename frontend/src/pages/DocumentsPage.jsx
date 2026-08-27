import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar  from '../components/Navbar';
import api     from '../api/axios';
import toast   from 'react-hot-toast';

const DOC_TYPES = [
  { value: 'AADHAR_STUDENT',      label: 'Student Aadhaar Card' },
  { value: 'AADHAR_PARENT',       label: 'Parent / Guardian Aadhaar Card' },
  { value: 'BIRTH_CERTIFICATE',   label: 'Birth Certificate' },
  { value: 'TRANSFER_CERTIFICATE',label: 'Transfer Certificate (TC)' },
  { value: 'REPORT_CARD',         label: 'Previous Class Report Card' },
  { value: 'ADDRESS_PROOF',       label: 'Address Proof' },
  { value: 'CASTE_CERTIFICATE',   label: 'Caste / Category Certificate' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Fitness Certificate' },
  { value: 'OTHER',               label: 'Other Document' },
];

export default function DocumentsPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  
  // Selected student documents
  const [studentDocs, setStudentDocs] = useState([]);
  const [loadingStudentDocs, setLoadingStudentDocs] = useState(false);

  // Upload Form State
  const [docType, setDocType] = useState('AADHAR_STUDENT');
  const [customLabel, setCustomLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // All school-wide documents list
  const [allDocs, setAllDocs] = useState([]);
  const [loadingAllDocs, setLoadingAllDocs] = useState(false);
  const [allDocsSearch, setAllDocsSearch] = useState('');
  const [allDocsTypeFilter, setAllDocsTypeFilter] = useState('');

  // Active Tab: 'upload' | 'repository'
  const [activeTab, setActiveTab] = useState('upload');

  // Load students for autocomplete/search
  useEffect(() => {
    api.get('/principal/students?per_page=500')
      .then(r => {
        const list = r.data?.students || (Array.isArray(r.data) ? r.data : []);
        setStudents(list);
        if (list.length > 0 && !selectedStudent) {
          setSelectedStudent(list[0]);
        }
      })
      .catch(() => {});

    loadAllDocuments();
  }, []);

  // When selected student changes, fetch their documents
  useEffect(() => {
    if (!selectedStudent?.id) return;
    loadStudentDocs(selectedStudent.id);
  }, [selectedStudent]);

  function loadStudentDocs(studentId) {
    setLoadingStudentDocs(true);
    api.get(`/principal/students/${studentId}/documents`)
      .then(r => {
        setStudentDocs(r.data?.student_documents || []);
      })
      .catch(() => {
        toast.error('Student documents load nahi ho sake');
      })
      .finally(() => setLoadingStudentDocs(false));
  }

  function loadAllDocuments() {
    setLoadingAllDocs(true);
    let url = `/principal/documents/students/all?search=${encodeURIComponent(allDocsSearch)}`;
    if (allDocsTypeFilter) {
      url += `&doc_type=${encodeURIComponent(allDocsTypeFilter)}`;
    }
    api.get(url)
      .then(r => {
        setAllDocs(r.data?.documents || []);
      })
      .catch(() => {})
      .finally(() => setLoadingAllDocs(false));
  }

  // Filter students based on search input
  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase();
    return (
      !q ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
      (s.admission_no && s.admission_no.toLowerCase().includes(q)) ||
      (s.parent_name && s.parent_name.toLowerCase().includes(q)) ||
      (s.father_name && s.father_name.toLowerCase().includes(q))
    );
  });

  // Check if current docType is already uploaded for selected student
  const existingDocForType = studentDocs.find(d => d.doc_type === docType);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size 10 MB se zyada nahi honi chahiye');
      return;
    }
    setSelectedFile(file);
    toast.success(`File selected: ${file.name}`);
  }

  async function handleUpload(e) {
    if (e) e.preventDefault();
    if (!selectedStudent?.id) {
      toast.error('Student select karein');
      return;
    }
    if (!selectedFile) {
      toast.error('File choose karein ya photo lein');
      return;
    }
    if (docType === 'OTHER' && !customLabel.trim()) {
      toast.error('Other document ke liye label zaroori hai');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('doc_type', docType);
      if (docType === 'OTHER') {
        fd.append('custom_label', customLabel);
      }

      await api.post(`/principal/students/${selectedStudent.id}/documents/student`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(existingDocForType ? '✅ Document successfully replaced / updated!' : '🎉 Document uploaded successfully!');
      setSelectedFile(null);
      setCustomLabel('');
      loadStudentDocs(selectedStudent.id);
      loadAllDocuments();
    } catch (err) {
      const msg = err.response?.data?.error || 'Document upload error';
      toast.error(msg);
    }
    setUploading(false);
  }

  async function handleDeleteDoc(docId) {
    if (!window.confirm('Kya aap yeh document delete karna chahte hain?')) return;
    try {
      await api.delete(`/principal/documents/student/${docId}`);
      toast.success('Document deleted');
      if (selectedStudent?.id) loadStudentDocs(selectedStudent.id);
      loadAllDocuments();
    } catch {
      toast.error('Delete failed');
    }
  }

  const EXT_ICON = {
    pdf: '📄', doc: '📝', docx: '📝',
    png: '🖼', jpg: '🖼', jpeg: '🖼',
  };

  function getFileIcon(filename) {
    const ext = filename ? filename.split('.').pop().toLowerCase() : '';
    return EXT_ICON[ext] || '📎';
  }

  function formatDocType(type, custom) {
    if (type === 'OTHER' && custom) return custom;
    const found = DOC_TYPES.find(d => d.value === type);
    return found ? found.label : (type ? type.replace(/_/g, ' ') : 'Document');
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Documents" />
        <div className="page-body">

          {/* PAGE HEADER */}
          <div className="page-header" style={{ marginBottom: 20 }}>
            <h2 className="page-title">📁 Student KYC &amp; Official Documents</h2>
            <p className="page-subtitle">Permanent student Aadhaar, Birth Certificates &amp; KYC records (Class-independent &amp; preserved forever)</p>
          </div>

          {/* TAB BAR */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab('upload')}
              style={{
                background: activeTab === 'upload' ? '#0B3B7B' : '#f8fafc',
                color: activeTab === 'upload' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: activeTab === 'upload' ? '0 4px 12px rgba(11,59,123,0.2)' : 'none'
              }}
            >
              📤 Student-Wise KYC &amp; Upload
            </button>
            <button
              onClick={() => { setActiveTab('repository'); loadAllDocuments(); }}
              style={{
                background: activeTab === 'repository' ? '#0B3B7B' : '#f8fafc',
                color: activeTab === 'repository' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: activeTab === 'repository' ? '0 4px 12px rgba(11,59,123,0.2)' : 'none'
              }}
            >
              📚 All Student Documents ({allDocs.length})
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
              
              {/* LEFT: STUDENT SELECTOR (Search by name, roll, parent name) */}
              <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18, height: 'fit-content' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0B3B7B', fontWeight: 800 }}>
                  🔍 Search &amp; Select Student
                </h4>
                
                <input
                  type="text"
                  placeholder="Search student or parent..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12.5, marginBottom: 12, outline: 'none' }}
                />

                <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12 }}>
                      Koi student nahi mila
                    </div>
                  ) : (
                    filteredStudents.map(s => {
                      const isSel = selectedStudent?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedStudent(s)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: isSel ? '#EFF6FF' : '#f8fafc',
                            border: isSel ? '1.5px solid #0B3B7B' : '1px solid #e2e8f0',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: isSel ? '#0B3B7B' : '#0f172a' }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Adm: <strong>{s.admission_no || s.admission_number || '—'}</strong> | Roll: <strong>{s.roll_number || '—'}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            Parent: <strong>{s.parent_name || s.father_name || '—'}</strong>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: STUDENT PROFILE & DOCUMENT UPLOAD / LIST */}
              <div>
                {selectedStudent ? (
                  <>
                    {/* SELECTED STUDENT BANNER */}
                    <div style={{
                      background: '#0B3B7B',
                      color: '#ffffff',
                      borderRadius: 14,
                      padding: '18px 24px',
                      marginBottom: 20,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: '#ffffff',
                          color: '#0B3B7B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          fontWeight: 800
                        }}>
                          {selectedStudent.photo_url ? (
                            <img src={selectedStudent.photo_url} alt="Student" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div>
                          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>{selectedStudent.name}</h3>
                          <div style={{ fontSize: 12, color: '#93C5FD' }}>
                            Admission No: <strong>{selectedStudent.admission_no || selectedStudent.admission_number || '—'}</strong> &nbsp;|&nbsp; 
                            Roll No: <strong>{selectedStudent.roll_number || '—'}</strong> &nbsp;|&nbsp; 
                            Current Class: <strong>{selectedStudent.class_display || selectedStudent.class_name || '—'}</strong>
                          </div>
                          <div style={{ fontSize: 12, color: '#E2E8F0', marginTop: 2 }}>
                            Parent / Guardian: <strong>{selectedStudent.parent_name || selectedStudent.father_name || '—'}</strong> ({selectedStudent.parent_phone || '—'})
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.12)', padding: '6px 14px', borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: '#93c5fd', display: 'block' }}>Permanent ID</span>
                        <strong style={{ fontSize: 13 }}>ID: #{selectedStudent.id}</strong>
                      </div>
                    </div>

                    {/* UPLOAD / REPLACE CARD */}
                    <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22, marginBottom: 24 }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: 15, color: '#0B3B7B', fontWeight: 800 }}>
                        📤 Upload / Replace KYC Document
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Document Type <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                          >
                            {DOC_TYPES.map(d => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                        </div>

                        {docType === 'OTHER' ? (
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                              Custom Document Name <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Migration Certificate"
                              value={customLabel}
                              onChange={e => setCustomLabel(e.target.value)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: existingDocForType ? '#c2410c' : '#166534', background: existingDocForType ? '#fff7ed' : '#f0fdf4', padding: '8px 12px', borderRadius: 8, border: existingDocForType ? '1px solid #fdba74' : '1px solid #bbf7d0' }}>
                            {existingDocForType ? (
                              <span>⚠️ <strong>{formatDocType(docType)}</strong> already exists. Uploading will replace the existing file.</span>
                            ) : (
                              <span>✓ Ready to upload new <strong>{formatDocType(docType)}</strong></span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* DUAL UPLOAD OPTIONS (Browse from Device OR Take Photo with Camera) */}
                      <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                          
                          <label style={{
                            background: '#ffffff',
                            border: '1.5px solid #0B3B7B',
                            color: '#0B3B7B',
                            padding: '10px 22px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                          }}>
                            📁 Choose File from Device
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                          </label>

                          <label style={{
                            background: '#0B3B7B',
                            border: '1.5px solid #0B3B7B',
                            color: '#ffffff',
                            padding: '10px 22px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 2px 8px rgba(11,59,123,0.25)'
                          }}>
                            📸 Take Photo / Scan with Camera
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />
                          </label>

                        </div>

                        {selectedFile ? (
                          <div style={{ marginTop: 14, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                            Selected: <span style={{ color: '#0B3B7B' }}>{selectedFile.name}</span> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>
                            PDF, JPG, PNG supported (Max 10 MB limit)
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleUpload}
                          disabled={uploading || !selectedFile}
                          style={{
                            background: uploading || !selectedFile ? '#94a3b8' : '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 28px',
                            borderRadius: 8,
                            fontSize: 13.5,
                            fontWeight: 800,
                            cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            boxShadow: '0 4px 12px rgba(22,163,74,0.25)'
                          }}
                        >
                          {uploading ? '⏳ Uploading...' : (existingDocForType ? '🔄 Replace / Update Document' : '📤 Save & Upload Document')}
                        </button>
                      </div>
                    </div>

                    {/* UPLOADED DOCUMENTS GALLERY / TABLE */}
                    <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4 style={{ margin: 0, fontSize: 15, color: '#0B3B7B', fontWeight: 800 }}>
                          📋 Uploaded KYC Documents for {selectedStudent.name}
                        </h4>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {studentDocs.length} documents on file
                        </span>
                      </div>

                      {loadingStudentDocs ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Loading documents...</div>
                      ) : studentDocs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 30, background: '#f8fafc', borderRadius: 10, color: '#94a3b8' }}>
                          <div style={{ fontSize: 32, marginBottom: 6 }}>📁</div>
                          Is student ka abhi tak koi KYC document upload nahi hua hai. Upar se upload karein.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                          {studentDocs.map(doc => (
                            <div
                              key={doc.id}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                  <span style={{ fontSize: 24 }}>{getFileIcon(doc.file_name)}</span>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0B3B7B' }}>
                                      {formatDocType(doc.doc_type, doc.custom_label)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      {doc.file_name || 'Document File'}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 12 }}>
                                  Uploaded: {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN') : '—'}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    background: '#0B3B7B',
                                    color: '#ffffff',
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                >
                                  👁️ View / Download
                                </a>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                    Select a student from the left panel to manage documents.
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* ALL STUDENTS MASTER DOCUMENTS REPOSITORY */
            <div style={{ background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
              
              {/* FILTERS */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by student name, roll no, or parent name..."
                  value={allDocsSearch}
                  onChange={e => setAllDocsSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadAllDocuments(); }}
                  style={{ minWidth: 280, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />

                <select
                  value={allDocsTypeFilter}
                  onChange={e => { setAllDocsTypeFilter(e.target.value); }}
                  style={{ minWidth: 220, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff' }}
                >
                  <option value="">All Document Types</option>
                  {DOC_TYPES.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>

                <button
                  onClick={loadAllDocuments}
                  style={{ background: '#0B3B7B', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Apply Search
                </button>

                <div style={{ marginLeft: 'auto', fontSize: 12.5, color: '#64748b' }}>
                  Total: <strong>{allDocs.length}</strong> documents
                </div>
              </div>

              {/* TABLE */}
              {loadingAllDocs ? (
                <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>⏳ Loading documents repository...</div>
              ) : allDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Koi document nahi mila</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 12px' }}>Student Name</th>
                        <th style={{ padding: '10px 12px' }}>Admission No.</th>
                        <th style={{ padding: '10px 12px' }}>Parent Name</th>
                        <th style={{ padding: '10px 12px' }}>Class</th>
                        <th style={{ padding: '10px 12px' }}>Document Type</th>
                        <th style={{ padding: '10px 12px' }}>Uploaded At</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allDocs.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0B3B7B' }}>{d.student_name}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{d.admission_no}</td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{d.parent_name}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>{d.current_class}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: '#eff6ff', color: '#0B3B7B', padding: '3px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
                              {formatDocType(d.doc_type, d.custom_label)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11.5 }}>
                            {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ background: '#0B3B7B', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', marginRight: 6 }}
                            >
                              👁️ View
                            </a>
                            <button
                              onClick={() => handleDeleteDoc(d.id)}
                              style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
