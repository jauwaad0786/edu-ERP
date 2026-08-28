import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const DEFAULT_DOC_TYPES = [
  { value: "AADHAR_STUDENT",       label: "Student Aadhaar Card",      icon: "ti-id-badge" },
  { value: "BIRTH_CERTIFICATE",    label: "Birth Certificate",         icon: "ti-certificate" },
  { value: "PHOTO",                label: "Student Passport Photo",    icon: "ti-camera" },
  { value: "TRANSFER_CERTIFICATE", label: "Transfer Certificate (TC)", icon: "ti-file-export" },
  { value: "REPORT_CARD",          label: "Previous Report Card",      icon: "ti-report" },
  { value: "AADHAR_PARENT",        label: "Parent Aadhaar Card",       icon: "ti-id-badge-2" },
  { value: "CASTE_CERTIFICATE",    label: "Caste Certificate",         icon: "ti-file" },
  { value: "ADDRESS_PROOF",        label: "Address Proof",             icon: "ti-home" },
  { value: "MEDICAL_CERTIFICATE",  label: "Medical Certificate",       icon: "ti-heartbeat" },
  { value: "RATION_CARD",          label: "Ration Card",               icon: "ti-file-text" },
  { value: "OTHER",                label: "Other Document",            icon: "ti-paperclip" },
];

const ISSUED_DOC_TYPES = [
  { value: "BONAFIDE",              label: "Bonafide Certificate",   icon: "ti-award" },
  { value: "TC",                    label: "Transfer Certificate",   icon: "ti-rocket" },
  { value: "CHARACTER_CERTIFICATE", label: "Character Certificate",  icon: "ti-star" },
  { value: "ID_CARD",               label: "School ID Card",         icon: "ti-id-badge" },
  { value: "MIGRATION",             label: "Migration Certificate",  icon: "ti-file-export" },
  { value: "FEE_RECEIPT",           label: "Fee Receipt",            icon: "ti-receipt" },
  { value: "OTHER",                 label: "Other Document",         icon: "ti-paperclip" },
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

export default function DocumentsPage() {
  const { user } = useAuth();
  const role      = user?.role || "";
  const isAdmin   = ["PRINCIPAL", "SUPER_ADMIN", "ADMIN", "VICE_PRINCIPAL", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT" || role === "PARENT";
  const canDelete = ["PRINCIPAL", "SUPER_ADMIN", "ADMIN"].includes(role);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState(isStudent ? "my_docs" : "class_matrix");

  // Global filters
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Class Matrix (Students status list)
  const [studentsStatus, setStudentsStatus] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Requirements Config
  const [docRequirements, setDocRequirements] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  // Quick Upload Modal
  const [uploadModalStudent, setUploadModalStudent] = useState(null);
  const [modalDocType, setModalDocType] = useState("AADHAR_STUDENT");
  const [modalCustomLabel, setModalCustomLabel] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalRemarks, setModalRemarks] = useState("");
  const [modalFile, setModalFile] = useState(null);
  const [modalUploading, setModalUploading] = useState(false);

  // Issued Doc Form State
  const [issStudent, setIssStudent] = useState(null);
  const [issDocType, setIssDocType] = useState("BONAFIDE");
  const [issCustomLabel, setIssCustomLabel] = useState("");
  const [issTitle, setIssTitle] = useState("");
  const [issRemarks, setIssRemarks] = useState("");
  const [issVisible, setIssVisible] = useState(true);
  const [issFile, setIssFile] = useState(null);
  const [issUploading, setIssUploading] = useState(false);

  // Master Repository State
  const [repoSearch, setRepoSearch] = useState("");
  const [repoClass, setRepoClass] = useState("");
  const [repoYear, setRepoYear] = useState("");
  const [repoCategory, setRepoCategory] = useState("all");
  const [repoDocs, setRepoDocs] = useState([]);
  const [loadingRepo, setLoadingRepo] = useState(false);

  // Student Self-Service View
  const [myDocs, setMyDocs] = useState(null);
  const [loadingMyDocs, setLoadingMyDocs] = useState(false);
  const [myDocType, setMyDocType] = useState("AADHAR_STUDENT");
  const [myCustomLabel, setMyCustomLabel] = useState("");
  const [myTitle, setMyTitle] = useState("");
  const [myFile, setMyFile] = useState(null);
  const [myUploading, setMyUploading] = useState(false);

  // Load Classes
  useEffect(() => {
    if (!isStudent) {
      api.get("/principal/classes").then(r => setClasses(r.data || [])).catch(() => {});
    }
  }, [isStudent]);

  // Load Analytics
  const loadAnalytics = useCallback(() => {
    if (isStudent) return;
    setLoadingAnalytics(true);
    const url = selectedClassId ? `/principal/documents/analytics?class_id=${selectedClassId}` : "/principal/documents/analytics";
    api.get(url)
      .then(r => setAnalytics(r.data))
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false));
  }, [selectedClassId, isStudent]);

  // Load Students Document Status Matrix
  const loadStudentsStatus = useCallback(() => {
    if (isStudent) return;
    setLoadingMatrix(true);
    let url = `/principal/documents/students-status?status=${statusFilter}`;
    if (selectedClassId) url += `&class_id=${selectedClassId}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

    api.get(url)
      .then(r => {
        setStudentsStatus(r.data?.students || []);
        if (r.data?.requirements) setDocRequirements(r.data.requirements);
      })
      .catch(() => {})
      .finally(() => setLoadingMatrix(false));
  }, [selectedClassId, statusFilter, searchQuery, isStudent]);

  // Load Config
  const loadConfig = useCallback(() => {
    if (isStudent) return;
    api.get("/principal/documents/config")
      .then(r => setDocRequirements(r.data?.requirements || []))
      .catch(() => {});
  }, [isStudent]);

  // Load Master Repository
  const loadRepo = useCallback(() => {
    setLoadingRepo(true);
    let url = `/principal/documents/students/all?search=${encodeURIComponent(repoSearch)}&category=${repoCategory}`;
    if (repoClass) url += `&class_id=${repoClass}`;
    if (repoYear) url += `&academic_year=${encodeURIComponent(repoYear)}`;
    api.get(url)
      .then(r => setRepoDocs(r.data?.documents || []))
      .catch(() => toast.error("Repository load failed"))
      .finally(() => setLoadingRepo(false));
  }, [repoSearch, repoCategory, repoClass, repoYear]);

  // Load Student Self-view
  const loadMyDocs = useCallback(() => {
    setLoadingMyDocs(true);
    api.get("/student/documents")
      .then(r => setMyDocs(r.data?.data?.[0] || null))
      .catch(() => {})
      .finally(() => setLoadingMyDocs(false));
  }, []);

  useEffect(() => {
    if (!isStudent) {
      loadAnalytics();
      loadStudentsStatus();
    } else {
      loadMyDocs();
    }
  }, [loadAnalytics, loadStudentsStatus, loadMyDocs, isStudent]);

  // Handle Quick Document Upload
  async function handleModalUpload(e) {
    e.preventDefault();
    if (!uploadModalStudent) return toast.error("Student not selected");
    if (!modalFile) return toast.error("Please choose a file or capture photo");
    if (modalDocType === "OTHER" && !modalCustomLabel.trim()) return toast.error("Document name required");

    setModalUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", modalFile);
      fd.append("doc_type", modalDocType);
      fd.append("custom_label", modalCustomLabel);
      fd.append("title", modalTitle);
      fd.append("remarks", modalRemarks);

      await api.post(`/principal/students/${uploadModalStudent.student_id}/documents/student`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(`✅ ${modalDocType.replace(/_/g, ' ')} uploaded for ${uploadModalStudent.name}!`);
      setUploadModalStudent(null);
      setModalFile(null);
      setModalTitle("");
      setModalRemarks("");
      setModalCustomLabel("");
      loadStudentsStatus();
      loadAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setModalUploading(false);
    }
  }

  // Handle Issue Official Document
  async function handleIssuedUpload(e) {
    e.preventDefault();
    if (!issStudent) return toast.error("Please select a student");
    if (!issFile) return toast.error("Please choose a document file");
    if (issDocType === "OTHER" && !issCustomLabel.trim()) return toast.error("Document name required");

    setIssUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", issFile);
      fd.append("doc_type", issDocType);
      fd.append("custom_label", issCustomLabel);
      fd.append("title", issTitle);
      fd.append("remarks", issRemarks);
      fd.append("is_visible_to_student", issVisible ? "true" : "false");

      await api.post(`/principal/students/${issStudent.student_id}/documents/issued`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("🏆 Official document issued successfully!");
      setIssFile(null);
      setIssTitle("");
      setIssRemarks("");
      setIssCustomLabel("");
      loadStudentsStatus();
      loadAnalytics();
      if (activeTab === "repository") loadRepo();
    } catch (err) {
      toast.error(err.response?.data?.error || "Issuance failed");
    } finally {
      setIssUploading(false);
    }
  }

  // Handle Student Self-upload
  async function handleMyUpload(e) {
    e.preventDefault();
    if (!myFile) return toast.error("Please choose a file");
    if (myDocType === "OTHER" && !myCustomLabel.trim()) return toast.error("Document name required");

    setMyUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", myFile);
      fd.append("doc_type", myDocType);
      fd.append("custom_label", myCustomLabel);
      fd.append("title", myTitle);

      await api.post("/student/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("✅ Document uploaded successfully!");
      setMyFile(null);
      setMyTitle("");
      setMyCustomLabel("");
      loadMyDocs();
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setMyUploading(false);
    }
  }

  // Handle Delete Document
  async function handleDelete(docId, type = "kyc") {
    if (!window.confirm("Are you sure you want to permanently delete this document?")) return;
    try {
      const url = type === "issued" ? `/principal/documents/issued/${docId}` : `/principal/documents/student/${docId}`;
      await api.delete(url);
      toast.success("Document deleted");
      loadStudentsStatus();
      loadAnalytics();
      if (activeTab === "repository") loadRepo();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  }

  // Handle Save Requirements Config
  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await api.post("/principal/documents/config", { requirements: docRequirements });
      toast.success("✅ Document requirements updated!");
      loadAnalytics();
      loadStudentsStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  }

  const TABS = isStudent
    ? [{ id: "my_docs", icon: "ti-file-text", label: "My Documents" }]
    : [
        { id: "class_matrix", icon: "ti-layout-grid",    label: "Student Documents & Upload" },
        { id: "issued",       icon: "ti-certificate",    label: "Issue Official Document" },
        { id: "repository",   icon: "ti-database",       label: "All Documents Repository" },
        { id: "settings",     icon: "ti-settings",       label: "Required Documents Settings" },
      ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Student Documents Management" />
        <div className="page-body">

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* HEADER & ANALYTICS OVERVIEW                                        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "linear-gradient(135deg, #0b3b7b, #4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, color: "#fff", boxShadow: "0 4px 12px rgba(11,59,123,0.2)"
                }}>
                  <i className="ti ti-folder-filled" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                    Student Documents Management
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                    {isStudent
                      ? "View your KYC records and school-issued certificates"
                      : "Class-wise student document upload, admission follow-up & completion analytics"}
                  </p>
                </div>
              </div>

              {!isStudent && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => { loadAnalytics(); loadStudentsStatus(); }}
                    style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }}
                    title="Refresh Data"
                  >
                    <i className="ti ti-refresh" /> Refresh
                  </button>
                  <button
                    onClick={() => setActiveTab("settings")}
                    style={{ ...S.btnOutline, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <i className="ti ti-adjustments-horizontal" /> Configure Requirements
                  </button>
                </div>
              )}
            </div>

            {/* TOP ANALYTICS TILES */}
            {!isStudent && analytics && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginTop: 20 }}>
                <div style={{ ...S.metricCard, borderLeft: "4px solid #0b3b7b" }}>
                  <div style={S.metricLabel}><i className="ti ti-users" /> TOTAL STUDENTS</div>
                  <div style={S.metricVal}>{analytics.total_students}</div>
                  <div style={S.metricSub}>Enrolled across active classes</div>
                </div>

                <div style={{ ...S.metricCard, borderLeft: "4px solid #16a34a" }}>
                  <div style={{ ...S.metricLabel, color: "#16a34a" }}><i className="ti ti-circle-check" /> ALL DOCS SUBMITTED</div>
                  <div style={{ ...S.metricVal, color: "#16a34a" }}>
                    {analytics.completed_students} <span style={{ fontSize: 14, fontWeight: 600 }}>({analytics.completion_pct}%)</span>
                  </div>
                  <div style={S.metricSub}>All mandatory documents verified</div>
                </div>

                <div style={{ ...S.metricCard, borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ ...S.metricLabel, color: "#d97706" }}><i className="ti ti-alert-circle" /> PENDING / MISSING</div>
                  <div style={{ ...S.metricVal, color: "#d97706" }}>{analytics.pending_students}</div>
                  <div style={S.metricSub}>Admission doc follow-up required</div>
                </div>

                <div style={{ ...S.metricCard, borderLeft: "4px solid #6366f1" }}>
                  <div style={{ ...S.metricLabel, color: "#6366f1" }}><i className="ti ti-files" /> TOTAL UPLOADED DOCS</div>
                  <div style={{ ...S.metricVal, color: "#4f46e5" }}>{analytics.total_documents_uploaded}</div>
                  <div style={S.metricSub}>Stored securely in cloud storage</div>
                </div>
              </div>
            )}

            {/* DOCUMENT-WISE COMPLETION PROGRESS BARS */}
            {!isStudent && analytics?.document_wise_stats?.length > 0 && (
              <div style={{ ...S.card, marginTop: 16, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    📊 Mandatory Document Submission Breakdown
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {analytics.document_wise_stats.filter(d => d.is_required).length} Mandatory Requirements Active
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                  {analytics.document_wise_stats.map(ds => (
                    <div key={ds.doc_type} style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                        <span>
                          {ds.label} {ds.is_required && <span style={{ color: "#ef4444", fontSize: 11 }}>*</span>}
                        </span>
                        <span style={{ color: ds.percentage >= 80 ? "#16a34a" : ds.percentage >= 50 ? "#d97706" : "#dc2626" }}>
                          {ds.uploaded_count}/{analytics.total_students} ({ds.percentage}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 7, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          width: `${ds.percentage}%`,
                          height: "100%",
                          borderRadius: 99,
                          background: ds.percentage >= 80 ? "#16a34a" : ds.percentage >= 50 ? "#f59e0b" : "#ef4444",
                          transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB BAR NAVIGATION                                                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ display: "flex", gap: 6, marginBottom: 22, borderBottom: "2px solid #e2e8f0" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "repository") loadRepo();
                  if (tab.id === "settings") loadConfig();
                }}
                style={{
                  padding: "11px 20px",
                  border: "none",
                  borderRadius: "10px 10px 0 0",
                  borderBottom: activeTab === tab.id ? "3px solid #0b3b7b" : "3px solid transparent",
                  background: activeTab === tab.id ? "#eff6ff" : "transparent",
                  color: activeTab === tab.id ? "#0b3b7b" : "#64748b",
                  fontSize: 13.5,
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  transition: "all 0.15s",
                }}
              >
                <i className={`ti ${tab.icon}`} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: CLASS-WISE STUDENT DOCUMENT MATRIX & QUICK UPLOAD           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "class_matrix" && !isStudent && (
            <div>
              {/* Filter Controls Bar */}
              <div style={{ ...S.card, marginBottom: 18, padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={S.label}>Filter by Class</label>
                    <select
                      value={selectedClassId}
                      onChange={e => setSelectedClassId(e.target.value)}
                      style={S.select}
                    >
                      <option value="">🏫 All Classes</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: "1 1 180px" }}>
                    <label style={S.label}>Submission Status</label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      style={S.select}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="COMPLETE">✅ Complete (All Docs)</option>
                      <option value="PARTIAL">⚠️ Partial (Some Missing)</option>
                      <option value="MISSING">❌ Missing (No Docs)</option>
                    </select>
                  </div>

                  <div style={{ flex: "2 1 260px" }}>
                    <label style={S.label}>Search Student</label>
                    <div style={{ position: "relative" }}>
                      <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        style={{ ...S.input, paddingLeft: 34 }}
                        placeholder="Search student name, roll number, admission no, parent..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={loadStudentsStatus} style={S.btnPrimary}>
                      <i className="ti ti-filter" /> Apply Filter
                    </button>
                    {(selectedClassId || statusFilter !== "ALL" || searchQuery) && (
                      <button
                        onClick={() => { setSelectedClassId(""); setStatusFilter("ALL"); setSearchQuery(""); }}
                        style={S.btnGhost}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Students Table */}
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      Student Document Records ({studentsStatus.length})
                    </h3>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Upload pending admission documents directly or view submitted certificates
                    </span>
                  </div>
                </div>

                {loadingMatrix ? (
                  <div style={S.emptyBox}>⏳ Loading student records...</div>
                ) : studentsStatus.length === 0 ? (
                  <div style={{ ...S.emptyBox, padding: 50 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                    <div style={{ fontWeight: 700, color: "#334155" }}>No student records found</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Try clearing or changing your filters</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "2px solid #e2e8f0" }}>
                          <th style={{ padding: "12px 14px", textAlign: "left" }}>Student Details</th>
                          <th style={{ padding: "12px 14px", textAlign: "left" }}>Class & Parent</th>
                          <th style={{ padding: "12px 14px", textAlign: "left" }}>Status</th>
                          <th style={{ padding: "12px 14px", textAlign: "left" }}>Uploaded Documents</th>
                          <th style={{ padding: "12px 14px", textAlign: "left", minWidth: 200 }}>Quick Upload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsStatus.map(st => (
                          <tr key={st.student_id} style={{ borderBottom: "1px solid #f1f5f9" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            {/* Student Details */}
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                  width: 40, height: 40, borderRadius: "50%", background: "#eff6ff",
                                  color: "#0b3b7b", display: "flex", alignItems: "center", justifyContent: "center",
                                  fontWeight: 800, fontSize: 15, flexShrink: 0, overflow: "hidden", border: "1.5px solid #bfdbfe"
                                }}>
                                  {st.photo_url
                                    ? <img src={st.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : st.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 13.5 }}>{st.name}</div>
                                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                    Adm: <strong>{st.admission_no}</strong> · Roll: <strong>{st.roll_number}</strong>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Class & Parent */}
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ fontWeight: 700, color: "#0b3b7b" }}>{st.class_name || "—"}</div>
                              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                Parent: {st.parent_name}
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                                <span style={{
                                  padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                                  background: st.status === "COMPLETE" ? "#dcfce7" : st.status === "PARTIAL" ? "#fef3c7" : "#fee2e2",
                                  color: st.status === "COMPLETE" ? "#16a34a" : st.status === "PARTIAL" ? "#d97706" : "#dc2626",
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                }}>
                                  {st.status === "COMPLETE" ? "✅ Complete" : st.status === "PARTIAL" ? "⚠️ Partial" : "❌ Missing"}
                                </span>
                                {st.missing_required_types?.length > 0 && (
                                  <span style={{ fontSize: 10.5, color: "#dc2626" }}>
                                    Missing: {st.missing_required_types.map(m => m.replace(/_/g, ' ')).join(", ")}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Uploaded Documents List */}
                            <td style={{ padding: "12px 14px" }}>
                              {st.uploaded_documents?.length === 0 ? (
                                <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>None uploaded yet</span>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 360 }}>
                                  {st.uploaded_documents.map(doc => (
                                    <div
                                      key={doc.id}
                                      style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        background: "#eff6ff", border: "1px solid #bfdbfe",
                                        borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#0b3b7b"
                                      }}
                                    >
                                      <span>{doc.label}</span>
                                      <a
                                        href={doc.file_url} target="_blank" rel="noreferrer"
                                        style={{ color: "#2563eb", textDecoration: "none" }}
                                        title="View / Download"
                                      >
                                        <i className="ti ti-external-link" />
                                      </a>
                                      {canDelete && (
                                        <button
                                          onClick={() => handleDelete(doc.id, "kyc")}
                                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}
                                          title="Delete Document"
                                        >
                                          <i className="ti ti-trash" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Quick Upload Button */}
                            <td style={{ padding: "12px 14px" }}>
                              <button
                                onClick={() => {
                                  setUploadModalStudent(st);
                                  // Suggest missing doc type if available
                                  if (st.missing_required_types?.length > 0) {
                                    setModalDocType(st.missing_required_types[0]);
                                  } else {
                                    setModalDocType("AADHAR_STUDENT");
                                  }
                                }}
                                style={{ ...S.btnPrimary, padding: "6px 12px", fontSize: 12 }}
                              >
                                <i className="ti ti-cloud-upload" /> Upload Doc
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ISSUE OFFICIAL SCHOOL DOCUMENT                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "issued" && !isStudent && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div style={S.card}>
                <h3 style={S.cardTitle}><i className="ti ti-certificate" /> Issue Official Document</h3>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px" }}>
                  Issue Bonafide, Transfer Certificate (TC), Character Certificate or ID Card to a student.
                </p>

                <form onSubmit={handleIssuedUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={S.label}>Select Student *</label>
                    <select
                      value={issStudent ? issStudent.student_id : ""}
                      onChange={e => {
                        const sid = parseInt(e.target.value);
                        const found = studentsStatus.find(s => s.student_id === sid);
                        setIssStudent(found || null);
                      }}
                      style={S.select}
                      required
                    >
                      <option value="">-- Choose Student --</option>
                      {studentsStatus.map(s => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.name} ({s.class_name} · Adm: {s.admission_no})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={S.label}>Document Type *</label>
                      <select value={issDocType} onChange={e => setIssDocType(e.target.value)} style={S.select}>
                        {ISSUED_DOC_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {issDocType === "OTHER" ? (
                      <div>
                        <label style={S.label}>Custom Certificate Name *</label>
                        <input
                          style={S.input}
                          placeholder="e.g. Sports Merit Certificate"
                          value={issCustomLabel}
                          onChange={e => setIssCustomLabel(e.target.value)}
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label style={S.label}>Title / Reason (Optional)</label>
                        <input
                          style={S.input}
                          placeholder="e.g. For Passport / Bank Account"
                          value={issTitle}
                          onChange={e => setIssTitle(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={S.label}>Remarks / Ref No.</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Issued on parent request / TC Ref #1042"
                      value={issRemarks}
                      onChange={e => setIssRemarks(e.target.value)}
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={issVisible}
                      onChange={e => setIssVisible(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    Visible on Student & Parent Portal
                  </label>

                  {/* File Selector */}
                  <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: 18, textAlign: "center" }}>
                    <label style={{ ...S.btnOutline, cursor: "pointer", display: "inline-flex" }}>
                      <i className="ti ti-folder-open" /> Choose Document File
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "none" }}
                        onChange={e => setIssFile(e.target.files[0] || null)}
                      />
                    </label>
                    {issFile ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
                        ✅ {issFile.name} ({fmtBytes(issFile.size)})
                        <button type="button" onClick={() => setIssFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
                    )}
                  </div>

                  <button type="submit" disabled={issUploading || !issFile || !issStudent} style={S.btnPrimary}>
                    {issUploading ? <><i className="ti ti-loader-2 ti-spin" /> Issuing...</> : <><i className="ti ti-send" /> Issue Document</>}
                  </button>
                </form>
              </div>

              {/* Instructions / Summary */}
              <div style={S.card}>
                <h3 style={S.cardTitle}><i className="ti ti-info-circle" /> Official Documents Policy</h3>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                  <p>🏛️ <strong>School-Issued Documents</strong> represent certificates and official letters generated by the school authority for a student.</p>
                  <p>🔒 <strong>Access & Security:</strong> Once issued, documents are permanently archived in the repository. Deletion is strictly reserved for the Principal.</p>
                  <p>📱 <strong>Student Visibility:</strong> When marked visible, students and parents can instantly download their Bonafide, Character, or Fee certificates from their mobile portal without visiting the office.</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: ALL DOCUMENTS REPOSITORY                                    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "repository" && !isStudent && (
            <div>
              <div style={{ ...S.card, marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "2 1 220px" }}>
                    <label style={S.label}>Search</label>
                    <input
                      style={S.input}
                      placeholder="Student name, admission no, roll no..."
                      value={repoSearch}
                      onChange={e => setRepoSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && loadRepo()}
                    />
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={S.label}>Class</label>
                    <select value={repoClass} onChange={e => setRepoClass(e.target.value)} style={S.select}>
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <label style={S.label}>Category</label>
                    <select value={repoCategory} onChange={e => setRepoCategory(e.target.value)} style={S.select}>
                      <option value="all">All Documents</option>
                      <option value="kyc">KYC Only</option>
                      <option value="issued">Issued Only</option>
                    </select>
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={S.label}>Academic Year</label>
                    <input style={S.input} placeholder="2024-25" value={repoYear} onChange={e => setRepoYear(e.target.value)} />
                  </div>
                  <button onClick={loadRepo} style={S.btnPrimary}>
                    <i className="ti ti-search" /> Search
                  </button>
                </div>
              </div>

              {loadingRepo ? (
                <div style={S.emptyBox}>⏳ Searching document repository...</div>
              ) : repoDocs.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 50 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                  <div>No documents found matching search criteria</div>
                </div>
              ) : (
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                      Document Repository ({repoDocs.length})
                    </h3>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>
                          {["Student", "Class", "Parent", "Document", "Category", "Year", "Uploaded By", "Date", "Actions"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repoDocs.map(d => (
                          <tr key={`${d.category}-${d.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0b3b7b" }}>{d.student_name}</td>
                            <td style={{ padding: "10px 12px", color: "#475569" }}>{d.current_class}</td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{d.parent_name}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ background: "#eff6ff", color: "#0b3b7b", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                                {d.label || d.doc_type}
                              </span>
                              {d.title && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{d.title}</div>}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{
                                background: d.category === "issued" ? "#ede9fe" : "#f0fdf4",
                                color: d.category === "issued" ? "#7c3aed" : "#166534",
                                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              }}>
                                {d.category === "issued" ? "🏛️ Issued" : "📋 KYC"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{d.academic_year || "—"}</td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>
                              {d.uploaded_by_role ? (
                                <span style={{ ...((ROLE_COLORS[d.uploaded_by_role]) || {}), padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                  {d.uploaded_by_role}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                              {fmtDate(d.uploaded_at || d.issued_at)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <a
                                  href={d.file_url} target="_blank" rel="noreferrer"
                                  style={{ background: "#0b3b7b", color: "#fff", padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                                >
                                  <i className="ti ti-eye" /> View
                                </a>
                                {canDelete && (
                                  <button
                                    onClick={() => handleDelete(d.id, d.category)}
                                    style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                                  >
                                    <i className="ti ti-trash" />
                                  </button>
                                )}
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
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: REQUIRED DOCUMENTS SETTINGS (DYNAMIC CONFIG)                */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && !isStudent && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h3 style={S.cardTitle}><i className="ti ti-adjustments-horizontal" /> Configure Mandatory Admission Documents</h3>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
                    Select which document types are mandatory for admission completion and dashboard verification.
                  </p>
                </div>
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  style={S.btnPrimary}
                >
                  {savingConfig ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {docRequirements.map((req, idx) => (
                  <div
                    key={req.doc_type}
                    style={{
                      background: req.is_required ? "#eff6ff" : "#f8fafc",
                      border: req.is_required ? "1.5px solid #0b3b7b" : "1.5px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0f172a" }}>{req.label}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Type: {req.doc_type}</div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: req.is_required ? "#0b3b7b" : "#64748b" }}>
                      <input
                        type="checkbox"
                        checked={req.is_required}
                        onChange={e => {
                          const copy = [...docRequirements];
                          copy[idx].is_required = e.target.checked;
                          setDocRequirements(copy);
                        }}
                        style={{ width: 18, height: 18 }}
                      />
                      {req.is_required ? "Mandatory" : "Optional"}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: STUDENT / PARENT SELF-SERVICE VIEW                          */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "my_docs" && isStudent && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div style={S.card}>
                <h3 style={S.cardTitle}><i className="ti ti-cloud-upload" /> Upload KYC Document</h3>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px" }}>
                  Upload your Aadhaar Card, Birth Certificate, or other KYC documents here.
                </p>
                <form onSubmit={handleMyUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={S.label}>Document Type *</label>
                    <select value={myDocType} onChange={e => setMyDocType(e.target.value)} style={S.select}>
                      {DEFAULT_DOC_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {myDocType === "OTHER" ? (
                    <div>
                      <label style={S.label}>Document Name *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Migration Certificate"
                        value={myCustomLabel}
                        onChange={e => setMyCustomLabel(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={S.label}>Title (Optional)</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Aadhaar Front & Back"
                        value={myTitle}
                        onChange={e => setMyTitle(e.target.value)}
                      />
                    </div>
                  )}

                  <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: 18, textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-folder-open" /> Choose File
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: "none" }}
                          onChange={e => setMyFile(e.target.files[0] || null)}
                        />
                      </label>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-camera" /> Camera
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: "none" }}
                          onChange={e => setMyFile(e.target.files[0] || null)}
                        />
                      </label>
                    </div>
                    {myFile ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
                        ✅ {myFile.name} ({fmtBytes(myFile.size)})
                        <button type="button" onClick={() => setMyFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
                    )}
                  </div>

                  <button type="submit" disabled={myUploading || !myFile} style={S.btnPrimary}>
                    {myUploading ? <><i className="ti ti-loader-2 ti-spin" /> Uploading...</> : <><i className="ti ti-upload" /> Save Document</>}
                  </button>
                </form>
              </div>

              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={S.cardTitle}><i className="ti ti-files" /> Your Documents</h3>
                  <button onClick={loadMyDocs} style={S.btnGhost}><i className="ti ti-refresh" /></button>
                </div>
                {loadingMyDocs ? (
                  <div style={S.emptyBox}>⏳ Loading your documents...</div>
                ) : !myDocs ? (
                  <div style={S.emptyBox}>No records found</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Issued Certificates */}
                    {myDocs.issued_documents?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", marginBottom: 8, textTransform: "uppercase" }}>
                          🏛️ Official School Certificates
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.issued_documents.map(d => (
                            <div key={d.id} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", padding: "12px 14px", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: "#581c87" }}>{d.title || d.label}</div>
                                <div style={{ fontSize: 11, color: "#7e22ce", marginTop: 2 }}>Issued: {fmtDate(d.issued_at)}</div>
                              </div>
                              <a href={d.file_url} target="_blank" rel="noreferrer" style={{ ...S.btnPrimary, padding: "5px 12px", fontSize: 12, textDecoration: "none" }}>
                                <i className="ti ti-download" /> Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* KYC Documents */}
                    {myDocs.kyc_documents?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#0b3b7b", marginBottom: 8, textTransform: "uppercase" }}>
                          📋 Submitted KYC Documents
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.kyc_documents.map(d => (
                            <div key={d.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{d.title || d.label}</div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Uploaded: {fmtDate(d.uploaded_at)}</div>
                              </div>
                              <a href={d.file_url} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, padding: "5px 12px", fontSize: 12, textDecoration: "none" }}>
                                <i className="ti ti-eye" /> View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* QUICK UPLOAD MODAL                                                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {uploadModalStudent && (
            <div style={S.modalOverlay} onClick={() => setUploadModalStudent(null)}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      📁 Upload Document for {uploadModalStudent.name}
                    </h3>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {uploadModalStudent.class_name} · Adm: {uploadModalStudent.admission_no}
                    </div>
                  </div>
                  <button onClick={() => setUploadModalStudent(null)} style={S.modalCloseBtn}>✕</button>
                </div>

                <form onSubmit={handleModalUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={S.label}>Document Type *</label>
                    <select
                      value={modalDocType}
                      onChange={e => setModalDocType(e.target.value)}
                      style={S.select}
                    >
                      {DEFAULT_DOC_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {modalDocType === "OTHER" ? (
                    <div>
                      <label style={S.label}>Document Custom Name *</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Migration Certificate"
                        value={modalCustomLabel}
                        onChange={e => setModalCustomLabel(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={S.label}>Document Title (Optional)</label>
                      <input
                        style={S.input}
                        placeholder="e.g. Aadhaar Card Front & Back"
                        value={modalTitle}
                        onChange={e => setModalTitle(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label style={S.label}>Remarks (Optional)</label>
                    <input
                      style={S.input}
                      placeholder="e.g. Submitted during post-admission follow-up"
                      value={modalRemarks}
                      onChange={e => setModalRemarks(e.target.value)}
                    />
                  </div>

                  {/* File Upload Selector */}
                  <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: 18, textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-folder-open" /> Choose File
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: "none" }}
                          onChange={e => setModalFile(e.target.files[0] || null)}
                        />
                      </label>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-camera" /> Take Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          style={{ display: "none" }}
                          onChange={e => setModalFile(e.target.files[0] || null)}
                        />
                      </label>
                    </div>

                    {modalFile ? (
                      <div style={{ marginTop: 12, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
                        ✅ {modalFile.name} ({fmtBytes(modalFile.size)})
                        <button type="button" onClick={() => setModalFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11.5, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                    <button type="button" onClick={() => setUploadModalStudent(null)} style={S.btnGhost}>Cancel</button>
                    <button type="submit" disabled={modalUploading || !modalFile} style={S.btnPrimary}>
                      {modalUploading ? "Uploading..." : "Save Document"}
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
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    padding: "20px 22px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 800,
    color: "#0b3b7b",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  metricCard: {
    background: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "16px 18px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: 800,
    color: "#0b3b7b",
    letterSpacing: 0.5,
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
    marginBottom: 4,
  },
  metricSub: {
    fontSize: 11.5,
    color: "#64748b",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "#0b3b7b",
    color: "#fff",
    border: "none",
    padding: "9px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.15s",
  },
  btnOutline: {
    background: "#fff",
    color: "#0b3b7b",
    border: "1.5px solid #0b3b7b",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  btnGhost: {
    background: "transparent",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyBox: {
    textAlign: "center",
    padding: 30,
    background: "#f8fafc",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 13,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.6)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },
  modalContent: {
    background: "#ffffff",
    borderRadius: 14,
    padding: "22px 24px",
    width: "100%",
    maxWidth: 500,
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    color: "#64748b",
    cursor: "pointer",
    padding: 4,
  },
};

