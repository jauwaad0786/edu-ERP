import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const STUDENT_DOC_TYPES = [
  { value: "AADHAR_STUDENT",       label: "Student Aadhaar Card" },
  { value: "AADHAR_PARENT",        label: "Parent Aadhaar Card" },
  { value: "BIRTH_CERTIFICATE",    label: "Birth Certificate" },
  { value: "TRANSFER_CERTIFICATE", label: "Transfer Certificate (TC)" },
  { value: "REPORT_CARD",          label: "Previous Report Card" },
  { value: "ADDRESS_PROOF",        label: "Address Proof" },
  { value: "CASTE_CERTIFICATE",    label: "Caste Certificate" },
  { value: "MEDICAL_CERTIFICATE",  label: "Medical Certificate" },
  { value: "RATION_CARD",          label: "Ration Card" },
  { value: "OTHER",                label: "Other Document" },
];
const ISSUED_DOC_TYPES = [
  { value: "BONAFIDE",              label: "Bonafide Certificate" },
  { value: "TC",                    label: "Transfer Certificate" },
  { value: "CHARACTER_CERTIFICATE", label: "Character Certificate" },
  { value: "ID_CARD",               label: "School ID Card" },
  { value: "MIGRATION",             label: "Migration Certificate" },
  { value: "FEE_RECEIPT",           label: "Fee Receipt" },
  { value: "OTHER",                 label: "Other Document" },
];
const ROLE_COLORS = {
  PRINCIPAL: { bg: "#fef3c7", color: "#92400e" },
  TEACHER:   { bg: "#eff6ff", color: "#1d4ed8" },
  STUDENT:   { bg: "#f0fdf4", color: "#166534" },
};

function fmtBytes(b) {
  if (!b) return "";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── DocCard ──────────────────────────────────────────────────────────────────
function DocCard({ doc, onDelete, canDelete, isIssued }) {
  const dateStr   = fmtDate(isIssued ? doc.issued_at : doc.uploaded_at);
  const classStr  = isIssued ? doc.class_name_at_issue : doc.class_name_at_upload;
  const roleStyle = ROLE_COLORS[doc.uploaded_by_role] || null;

  return (
    <div style={{
      background: "#fff",
      border: isIssued ? "1.5px solid #c4b5fd" : "1.5px solid #e2e8f0",
      borderRadius: 12, padding: "14px 16px",
      transition: "box-shadow 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(11,59,123,0.1)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: isIssued ? "linear-gradient(135deg,#7c3aed,#a78bfa)" : "linear-gradient(135deg,#0b3b7b,#3b82f6)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff",
        }}>
          <i className="ti ti-file-text" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.title || doc.label}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{doc.label}</div>
        </div>
        {isIssued && (
          <span style={{ background: "#ede9fe", color: "#7c3aed", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>
            OFFICIAL
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
        {classStr && <span style={{ background: "#f1f5f9", color: "#475569", fontSize: 10.5, padding: "2px 7px", borderRadius: 8 }}>📚 {classStr}</span>}
        {doc.academic_year && <span style={{ background: "#fef9c3", color: "#854d0e", fontSize: 10.5, padding: "2px 7px", borderRadius: 8 }}>📅 {doc.academic_year}</span>}
        {roleStyle && <span style={{ ...roleStyle, fontSize: 10.5, padding: "2px 7px", borderRadius: 8 }}>👤 {doc.uploaded_by_role}</span>}
        {doc.file_size && <span style={{ background: "#f0fdf4", color: "#166534", fontSize: 10.5, padding: "2px 7px", borderRadius: 8 }}>{fmtBytes(doc.file_size)}</span>}
      </div>

      {doc.remarks && (
        <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", borderLeft: "3px solid #e2e8f0", paddingLeft: 8, marginTop: 8 }}>
          {doc.remarks}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 10 }}>
        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
          {isIssued ? "Issued" : "Uploaded"}: {dateStr}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <a href={doc.file_url} target="_blank" rel="noreferrer"
            style={{ background: "#0b3b7b", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <i className="ti ti-eye" /> View
          </a>
          {canDelete && (
            <button onClick={() => onDelete(doc.id, isIssued ? "issued" : "kyc")}
              style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "5px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UploadForm ────────────────────────────────────────────────────────────────
function UploadForm({ types, docType, setDocType, customLabel, setCustomLabel, title, setTitle, remarks, setRemarks, file, setFile, onSubmit, uploading, extra }) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        <div>
          <label style={S.label}>Document Type *</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} style={S.select}>
            {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {docType === "OTHER" ? (
          <div>
            <label style={S.label}>Custom Name *</label>
            <input style={S.input} placeholder="e.g. Migration Certificate" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
          </div>
        ) : (
          <div>
            <label style={S.label}>Title (Optional)</label>
            <input style={S.input} placeholder="e.g. For bank account" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        )}
      </div>
      {setRemarks && (
        <div>
          <label style={S.label}>Remarks</label>
          <input style={S.input} placeholder="Any note..." value={remarks} onChange={e => setRemarks(e.target.value)} />
        </div>
      )}
      {extra}
      <div style={{ background: "#f8fafc", border: "1.5px dashed #94a3b8", borderRadius: 10, padding: 18, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ ...S.btnOutline, cursor: "pointer" }}>
            <i className="ti ti-folder-open" /> Browse File
            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
              onChange={e => { const f = e.target.files[0]; if (f) { if (f.size > 10485760) { toast.error("Max 10 MB"); return; } setFile(f); } }} />
          </label>
          <label style={{ ...S.btnOutline, cursor: "pointer" }}>
            <i className="ti ti-camera" /> Camera
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} />
          </label>
        </div>
        {file ? (
          <div style={{ marginTop: 12, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
            ✅ {file.name} ({fmtBytes(file.size)})
            <button type="button" onClick={() => setFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={uploading || !file}
          style={{ ...S.btnPrimary, opacity: uploading || !file ? 0.5 : 1, cursor: uploading || !file ? "not-allowed" : "pointer" }}>
          {uploading ? <><i className="ti ti-loader-2" /> Uploading...</> : <><i className="ti ti-cloud-upload" /> Save Document</>}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const { user } = useAuth();
  const role      = user?.role || "";
  const isAdmin   = ["PRINCIPAL","SUPER_ADMIN","ADMIN","VICE_PRINCIPAL","DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT" || role === "PARENT";
  const canDelete = ["PRINCIPAL","SUPER_ADMIN","ADMIN"].includes(role);

  const [activeTab, setActiveTab]         = useState(isStudent ? "my_docs" : "kyc");
  const [classes, setClasses]             = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents]           = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  // KYC upload state
  const [kycDocs, setKycDocs]             = useState([]);
  const [loadingKyc, setLoadingKyc]       = useState(false);
  const [kycDocType, setKycDocType]       = useState("AADHAR_STUDENT");
  const [kycCustomLabel, setKycCustomLabel] = useState("");
  const [kycTitle, setKycTitle]           = useState("");
  const [kycRemarks, setKycRemarks]       = useState("");
  const [kycFile, setKycFile]             = useState(null);
  const [kycUploading, setKycUploading]   = useState(false);

  // Issued doc state
  const [issuedDocs, setIssuedDocs]       = useState([]);
  const [issDocType, setIssDocType]       = useState("BONAFIDE");
  const [issCustomLabel, setIssCustomLabel] = useState("");
  const [issTitle, setIssTitle]           = useState("");
  const [issRemarks, setIssRemarks]       = useState("");
  const [issVisible, setIssVisible]       = useState(true);
  const [issFile, setIssFile]             = useState(null);
  const [issUploading, setIssUploading]   = useState(false);

  // Repository state
  const [repoSearch, setRepoSearch]       = useState("");
  const [repoClass, setRepoClass]         = useState("");
  const [repoYear, setRepoYear]           = useState("");
  const [repoCategory, setRepoCategory]   = useState("all");
  const [repoDocs, setRepoDocs]           = useState([]);
  const [loadingRepo, setLoadingRepo]     = useState(false);

  // Student self-view
  const [myDocs, setMyDocs]               = useState(null);
  const [loadingMyDocs, setLoadingMyDocs] = useState(false);
  const [myDocType, setMyDocType]         = useState("AADHAR_STUDENT");
  const [myCustomLabel, setMyCustomLabel] = useState("");
  const [myTitle, setMyTitle]             = useState("");
  const [myFile, setMyFile]               = useState(null);
  const [myUploading, setMyUploading]     = useState(false);

  useEffect(() => {
    if (!isStudent) {
      api.get("/principal/classes").then(r => setClasses(r.data || [])).catch(() => {});
    }
  }, [isStudent]);

  useEffect(() => {
    if (isStudent) return;
    const url = selectedClassId
      ? `/principal/students?per_page=500&class_id=${selectedClassId}`
      : "/principal/students?per_page=500";
    api.get(url).then(r => {
      const list = r.data?.students || (Array.isArray(r.data) ? r.data : []);
      setStudents(list);
      setSelectedStudent(list.length > 0 ? list[0] : null);
    }).catch(() => {});
  }, [selectedClassId, isStudent]);

  useEffect(() => {
    if (selectedStudent?.id) loadStudentDocs(selectedStudent.id);
  }, [selectedStudent]);

  useEffect(() => {
    if (isStudent) loadMyDocs();
  }, [isStudent]);

  function loadStudentDocs(sid) {
    setLoadingKyc(true);
    api.get(`/principal/students/${sid}/documents`)
      .then(r => {
        setKycDocs(r.data?.student_documents || []);
        setIssuedDocs(r.data?.issued_documents || []);
      })
      .catch(() => toast.error("Documents load nahi ho sake"))
      .finally(() => setLoadingKyc(false));
  }

  function loadMyDocs() {
    setLoadingMyDocs(true);
    api.get("/student/documents")
      .then(r => setMyDocs(r.data?.data?.[0] || null))
      .catch(() => {})
      .finally(() => setLoadingMyDocs(false));
  }

  function loadRepo() {
    setLoadingRepo(true);
    let url = `/principal/documents/students/all?search=${encodeURIComponent(repoSearch)}&category=${repoCategory}`;
    if (repoClass) url += `&class_id=${repoClass}`;
    if (repoYear)  url += `&academic_year=${encodeURIComponent(repoYear)}`;
    api.get(url).then(r => setRepoDocs(r.data?.documents || []))
      .catch(() => toast.error("Repository load failed"))
      .finally(() => setLoadingRepo(false));
  }

  async function handleKycUpload(e) {
    e.preventDefault();
    if (!selectedStudent) return toast.error("Student select karein");
    if (!kycFile) return toast.error("File choose karein");
    if (kycDocType === "OTHER" && !kycCustomLabel.trim()) return toast.error("Custom label required");
    setKycUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", kycFile); fd.append("doc_type", kycDocType);
      fd.append("custom_label", kycCustomLabel); fd.append("title", kycTitle); fd.append("remarks", kycRemarks);
      await api.post(`/principal/students/${selectedStudent.id}/documents/student`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("✅ KYC Document uploaded!");
      setKycFile(null); setKycTitle(""); setKycRemarks(""); setKycCustomLabel("");
      loadStudentDocs(selectedStudent.id);
    } catch (err) { toast.error(err.response?.data?.error || "Upload failed"); }
    setKycUploading(false);
  }

  async function handleIssuedUpload(e) {
    e.preventDefault();
    if (!selectedStudent) return toast.error("Student select karein");
    if (!issFile) return toast.error("File choose karein");
    if (issDocType === "OTHER" && !issCustomLabel.trim()) return toast.error("Custom label required");
    setIssUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", issFile); fd.append("doc_type", issDocType);
      fd.append("custom_label", issCustomLabel); fd.append("title", issTitle);
      fd.append("remarks", issRemarks); fd.append("is_visible_to_student", issVisible ? "true" : "false");
      await api.post(`/principal/students/${selectedStudent.id}/documents/issued`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("🏆 Official document issued!");
      setIssFile(null); setIssTitle(""); setIssRemarks(""); setIssCustomLabel("");
      loadStudentDocs(selectedStudent.id);
    } catch (err) { toast.error(err.response?.data?.error || "Upload failed"); }
    setIssUploading(false);
  }

  async function handleMyUpload(e) {
    e.preventDefault();
    if (!myFile) return toast.error("File choose karein");
    if (myDocType === "OTHER" && !myCustomLabel.trim()) return toast.error("Custom label required");
    setMyUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", myFile); fd.append("doc_type", myDocType);
      fd.append("custom_label", myCustomLabel); fd.append("title", myTitle);
      await api.post("/student/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("✅ Document uploaded!");
      setMyFile(null); setMyTitle(""); setMyCustomLabel("");
      loadMyDocs();
    } catch (err) { toast.error(err.response?.data?.error || "Upload failed"); }
    setMyUploading(false);
  }

  async function handleDelete(docId, type) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    try {
      await api.delete(type === "issued" ? `/principal/documents/issued/${docId}` : `/principal/documents/student/${docId}`);
      toast.success("Document deleted");
      if (selectedStudent?.id) loadStudentDocs(selectedStudent.id);
      if (activeTab === "repository") loadRepo();
    } catch (err) { toast.error(err.response?.data?.error || "Delete failed"); }
  }

  const filteredStudents = students.filter(s => {
    const q = studentSearch.toLowerCase();
    return !q || [s.name, s.roll_number, s.admission_no, s.parent_name, s.father_name]
      .some(v => v && v.toLowerCase().includes(q));
  });

  const TABS = isStudent
    ? [{ id: "my_docs", icon: "ti-file-text", label: "My Documents" }]
    : [
        { id: "kyc",        icon: "ti-id-badge-2", label: "Student KYC Docs" },
        { id: "issued",     icon: "ti-certificate", label: "Issue Document" },
        { id: "repository", icon: "ti-database",   label: "All Documents" },
      ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Documents" />
        <div className="page-body">

          {/* HEADER */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#0b3b7b,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff" }}>
              <i className="ti ti-folder-filled" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Document Management</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                {isStudent ? "View your KYC & school-issued documents" : "Manage student KYC, issue official docs & maintain records · Delete restricted to Principal"}
              </p>
            </div>
          </div>

          {/* TABS */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e2e8f0" }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "repository") loadRepo(); }}
                style={{
                  padding: "10px 18px", border: "none", borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === tab.id ? "3px solid #0b3b7b" : "3px solid transparent",
                  background: activeTab === tab.id ? "#eff6ff" : "transparent",
                  color: activeTab === tab.id ? "#0b3b7b" : "#64748b",
                  fontSize: 13.5, fontWeight: activeTab === tab.id ? 800 : 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                }}>
                <i className={`ti ${tab.icon}`} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ══ MY DOCS (Student) ══════════════════════════════════════════════ */}
          {activeTab === "my_docs" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
              <div style={S.card}>
                <h4 style={S.cardTitle}><i className="ti ti-cloud-upload" /> Upload Your KYC Document</h4>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 14px" }}>Upload Aadhaar, Birth Certificate or any KYC document. School admin will be notified.</p>
                <UploadForm types={STUDENT_DOC_TYPES} docType={myDocType} setDocType={setMyDocType}
                  customLabel={myCustomLabel} setCustomLabel={setMyCustomLabel}
                  title={myTitle} setTitle={setMyTitle} remarks={undefined} setRemarks={undefined}
                  file={myFile} setFile={setMyFile} onSubmit={handleMyUpload} uploading={myUploading} />
              </div>
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h4 style={S.cardTitle}><i className="ti ti-files" /> Your Documents</h4>
                  <button onClick={loadMyDocs} style={S.btnGhost}><i className="ti ti-refresh" /></button>
                </div>
                {loadingMyDocs ? <div style={S.emptyBox}>⏳ Loading...</div> : !myDocs ? <div style={S.emptyBox}>No documents found</div> : (
                  <>
                    {myDocs.issued_documents?.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>🏛️ School-Issued Documents</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.issued_documents.map(d => <DocCard key={d.id} doc={d} isIssued canDelete={false} onDelete={() => {}} />)}
                        </div>
                      </div>
                    )}
                    {myDocs.kyc_documents?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#0b3b7b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>📋 My KYC Documents</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.kyc_documents.map(d => <DocCard key={d.id} doc={d} isIssued={false} canDelete={false} onDelete={() => {}} />)}
                        </div>
                      </div>
                    )}
                    {!myDocs.issued_documents?.length && !myDocs.kyc_documents?.length && <div style={S.emptyBox}>No documents yet</div>}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ KYC / ISSUED (Admin+Teacher) ═══════════════════════════════════ */}
          {(activeTab === "kyc" || activeTab === "issued") && (isAdmin || isTeacher) && (
            <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 22 }}>
              {/* Student Selector */}
              <div style={S.card}>
                <h4 style={S.cardTitle}><i className="ti ti-users" /> Select Student</h4>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} style={{ ...S.select, marginBottom: 10 }}>
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                </select>
                <input style={{ ...S.input, marginBottom: 10 }} placeholder="Search name, roll, parent..."
                  value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                <div style={{ maxHeight: 460, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                  {filteredStudents.length === 0 ? <div style={S.emptyBox}>No students</div> : filteredStudents.map(s => {
                    const sel = selectedStudent?.id === s.id;
                    return (
                      <div key={s.id} onClick={() => setSelectedStudent(s)} style={{
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        background: sel ? "#eff6ff" : "#f8fafc",
                        border: `1.5px solid ${sel ? "#0b3b7b" : "#e2e8f0"}`, transition: "all 0.12s",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: sel ? "#0b3b7b" : "#0f172a" }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.class_display || s.class_name || "—"} · Roll: {s.roll_number || "—"}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Parent: {s.parent_name || s.father_name || "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel */}
              <div>
                {!selectedStudent ? (
                  <div style={{ ...S.emptyBox, padding: 60, borderRadius: 14, fontSize: 15 }}>👈 Select a student to manage documents</div>
                ) : (
                  <>
                    {/* Student Banner */}
                    <div style={{
                      background: "linear-gradient(135deg,#0b3b7b,#1d4ed8)",
                      color: "#fff", borderRadius: 14, padding: "16px 22px",
                      marginBottom: 20, display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {selectedStudent.photo_url
                          ? <img src={selectedStudent.photo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          : <i className="ti ti-user" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{selectedStudent.name}</div>
                        <div style={{ fontSize: 12, color: "#93c5fd" }}>
                          {selectedStudent.class_display || selectedStudent.class_name || "—"} &nbsp;·&nbsp; Adm: {selectedStudent.admission_no || "—"} &nbsp;·&nbsp; Roll: {selectedStudent.roll_number || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 2 }}>Parent: {selectedStudent.parent_name || selectedStudent.father_name || "—"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>KYC: {kycDocs.length}</span>
                        <span style={{ background: "rgba(167,139,250,0.35)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Issued: {issuedDocs.length}</span>
                      </div>
                    </div>

                    {activeTab === "kyc" ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                        <div style={S.card}>
                          <h4 style={S.cardTitle}><i className="ti ti-upload" /> Upload KYC Document</h4>
                          <UploadForm types={STUDENT_DOC_TYPES} docType={kycDocType} setDocType={setKycDocType}
                            customLabel={kycCustomLabel} setCustomLabel={setKycCustomLabel}
                            title={kycTitle} setTitle={setKycTitle} remarks={kycRemarks} setRemarks={setKycRemarks}
                            file={kycFile} setFile={setKycFile} onSubmit={handleKycUpload} uploading={kycUploading} />
                        </div>
                        <div style={S.card}>
                          <h4 style={S.cardTitle}><i className="ti ti-files" /> KYC Documents ({kycDocs.length})</h4>
                          {loadingKyc ? <div style={S.emptyBox}>⏳ Loading...</div> : kycDocs.length === 0 ? (
                            <div style={S.emptyBox}><div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>No KYC documents yet</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
                              {kycDocs.map(d => <DocCard key={d.id} doc={d} isIssued={false} canDelete={canDelete} onDelete={handleDelete} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                        <div style={S.card}>
                          <h4 style={S.cardTitle}><i className="ti ti-certificate" /> Issue Official Document</h4>
                          <UploadForm types={ISSUED_DOC_TYPES} docType={issDocType} setDocType={setIssDocType}
                            customLabel={issCustomLabel} setCustomLabel={setIssCustomLabel}
                            title={issTitle} setTitle={setIssTitle} remarks={issRemarks} setRemarks={setIssRemarks}
                            file={issFile} setFile={setIssFile} onSubmit={handleIssuedUpload} uploading={issUploading}
                            extra={
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#475569", userSelect: "none" }}>
                                <input type="checkbox" checked={issVisible} onChange={e => setIssVisible(e.target.checked)} style={{ width: 16, height: 16 }} />
                                Visible to student / parent portal
                              </label>
                            } />
                        </div>
                        <div style={S.card}>
                          <h4 style={S.cardTitle}><i className="ti ti-certificate" /> Issued Documents ({issuedDocs.length})</h4>
                          {issuedDocs.length === 0 ? (
                            <div style={S.emptyBox}><div style={{ fontSize: 28, marginBottom: 6 }}>🏛️</div>No official documents issued yet</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
                              {issuedDocs.map(d => <DocCard key={d.id} doc={d} isIssued canDelete={canDelete} onDelete={handleDelete} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ REPOSITORY ═════════════════════════════════════════════════════ */}
          {activeTab === "repository" && (
            <div>
              <div style={{ ...S.card, marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={S.label}>Search</label>
                    <input style={S.input} placeholder="Name, roll no, parent..." value={repoSearch}
                      onChange={e => setRepoSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && loadRepo()} />
                  </div>
                  <div style={{ flex: "1 1 150px" }}>
                    <label style={S.label}>Class</label>
                    <select style={S.select} value={repoClass} onChange={e => setRepoClass(e.target.value)}>
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 130px" }}>
                    <label style={S.label}>Category</label>
                    <select style={S.select} value={repoCategory} onChange={e => setRepoCategory(e.target.value)}>
                      <option value="all">All</option>
                      <option value="kyc">KYC Only</option>
                      <option value="issued">Issued Only</option>
                    </select>
                  </div>
                  <div style={{ flex: "1 1 110px" }}>
                    <label style={S.label}>Year</label>
                    <input style={S.input} placeholder="2024-25" value={repoYear} onChange={e => setRepoYear(e.target.value)} />
                  </div>
                  <button onClick={loadRepo} style={{ ...S.btnPrimary, alignSelf: "flex-end" }}>
                    <i className="ti ti-search" /> Search
                  </button>
                </div>
              </div>

              {loadingRepo ? <div style={S.emptyBox}>⏳ Loading...</div> : repoDocs.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 50 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                  Use filters above and click Search to load documents
                </div>
              ) : (
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Document Repository</h4>
                    <span style={{ background: "#f1f5f9", padding: "4px 12px", borderRadius: 20, fontSize: 12.5, color: "#64748b" }}>{repoDocs.length} results</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {["Student","Class","Parent","Document","Category","Year","Uploaded By","Date","Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repoDocs.map(d => {
                          const roleSt = ROLE_COLORS[d.uploaded_by_role];
                          return (
                            <tr key={`${d.category}-${d.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                              onMouseLeave={e => e.currentTarget.style.background = ""}>
                              <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0b3b7b" }}>{d.student_name}</td>
                              <td style={{ padding: "9px 12px", color: "#475569" }}>{d.current_class}</td>
                              <td style={{ padding: "9px 12px", color: "#64748b" }}>{d.parent_name}</td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{ background: "#eff6ff", color: "#0b3b7b", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>{d.label || d.doc_type}</span>
                                {d.title && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>{d.title}</div>}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{
                                  background: d.category === "issued" ? "#ede9fe" : "#f0fdf4",
                                  color: d.category === "issued" ? "#7c3aed" : "#166534",
                                  padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                                }}>{d.category === "issued" ? "🏛️ Issued" : "📋 KYC"}</span>
                              </td>
                              <td style={{ padding: "9px 12px", color: "#64748b" }}>{d.academic_year || "—"}</td>
                              <td style={{ padding: "9px 12px" }}>
                                {roleSt ? <span style={{ ...roleSt, padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{d.uploaded_by_role}</span> : "—"}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(d.uploaded_at || d.issued_at)}</td>
                              <td style={{ padding: "9px 12px" }}>
                                <div style={{ display: "flex", gap: 5 }}>
                                  <a href={d.file_url} target="_blank" rel="noreferrer"
                                    style={{ background: "#0b3b7b", color: "#fff", padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                                    <i className="ti ti-eye" />
                                  </a>
                                  {canDelete && (
                                    <button onClick={() => handleDelete(d.id, d.category)}
                                      style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "4px 8px", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const S = {
  card:       { background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" },
  cardTitle:  { margin: "0 0 14px", fontSize: 14.5, fontWeight: 800, color: "#0b3b7b", display: "flex", alignItems: "center", gap: 8 },
  label:      { display: "block", fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 5 },
  input:      { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" },
  select:     { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", boxSizing: "border-box" },
  btnPrimary: { background: "#0b3b7b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  btnOutline: { background: "#fff", color: "#0b3b7b", border: "1.5px solid #0b3b7b", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 },
  btnGhost:   { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", padding: "6px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer" },
  emptyBox:   { textAlign: "center", padding: 28, background: "#f8fafc", borderRadius: 10, color: "#94a3b8", fontSize: 13 },
};
