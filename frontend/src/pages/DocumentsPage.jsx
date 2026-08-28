import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
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

function fmtBytes(b) {
  if (!b) return "";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DocumentsPage({ initialTab, initialDocType }) {
  const { user } = useAuth();
  const location = useLocation();
  const role      = user?.role || "";
  const isAdmin   = ["PRINCIPAL", "SUPER_ADMIN", "ADMIN", "VICE_PRINCIPAL", "DIRECTOR"].includes(role);
  const isTeacher = role === "TEACHER";
  const isStudent = role === "STUDENT" || role === "PARENT";
  const canDelete = ["PRINCIPAL", "SUPER_ADMIN", "ADMIN"].includes(role);

  // Compute default active tab according to route and props
  const resolveDefaultTab = useCallback(() => {
    if (isStudent) return "my_docs";
    if (initialTab) return initialTab;
    if (location.pathname === "/issue-documents") return "issue_workspace";
    if (location.pathname === "/documents") return "class_matrix";
    return "class_matrix";
  }, [isStudent, initialTab, location.pathname]);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState(resolveDefaultTab);

  // Synchronize when route or initialTab changes
  useEffect(() => {
    setActiveTab(resolveDefaultTab());
  }, [resolveDefaultTab]);

  // ─── ISSUE WORKSPACE STATE ────────────────────────────────────────────────
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [wsClassId, setWsClassId] = useState("");
  const [wsSection, setWsSection] = useState("");
  const [wsDocType, setWsDocType] = useState(initialDocType || "");
  const [wsStatus, setWsStatus] = useState("ALL");
  const [wsSearch, setWsSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Certificate Generator State
  const [activeTemplateKey, setActiveTemplateKey] = useState(initialDocType || "TRANSFER_CERTIFICATE");
  const [certForm, setCertForm] = useState({});
  const [certRemarks, setCertRemarks] = useState("");
  const [certVisibleToStudent, setCertVisibleToStudent] = useState(true);
  const [certAttachedFile, setCertAttachedFile] = useState(null);
  const [issuingCert, setIssuingCert] = useState(false);

  // ─── MATRIX TAB STATE ─────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState(null);
  const [studentsStatus, setStudentsStatus] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixClassId, setMatrixClassId] = useState("");
  const [matrixStatusFilter, setMatrixStatusFilter] = useState("ALL");
  const [matrixSearch, setMatrixSearch] = useState("");

  // Quick Upload Modal
  const [uploadModalStudent, setUploadModalStudent] = useState(null);
  const [modalDocType, setModalDocType] = useState("AADHAR_STUDENT");
  const [modalCustomLabel, setModalCustomLabel] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalRemarks, setModalRemarks] = useState("");
  const [modalFile, setModalFile] = useState(null);
  const [modalUploading, setModalUploading] = useState(false);

  // ─── REPOSITORY TAB STATE ─────────────────────────────────────────────────
  const [repoSearch, setRepoSearch] = useState("");
  const [repoClass, setRepoClass] = useState("");
  const [repoYear, setRepoYear] = useState("");
  const [repoCategory, setRepoCategory] = useState("all");
  const [repoDocs, setRepoDocs] = useState([]);
  const [loadingRepo, setLoadingRepo] = useState(false);

  // ─── CONFIGURATION STATE ──────────────────────────────────────────────────
  const [docRequirements, setDocRequirements] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  // ─── STUDENT SELF VIEW STATE ──────────────────────────────────────────────
  const [myDocs, setMyDocs] = useState(null);
  const [loadingMyDocs, setLoadingMyDocs] = useState(false);
  const [myDocType, setMyDocType] = useState("AADHAR_STUDENT");
  const [myCustomLabel, setMyCustomLabel] = useState("");
  const [myTitle, setMyTitle] = useState("");
  const [myFile, setMyFile] = useState(null);
  const [myUploading, setMyUploading] = useState(false);

  const certificatePrintRef = useRef(null);

  // ─── 1. LOAD WORKSPACE (ISSUE DOCUMENTS) ──────────────────────────────────
  const loadIssueWorkspace = useCallback(() => {
    if (isStudent) return;
    setLoadingWorkspace(true);
    let url = `/principal/documents/issue-workspace?status=${wsStatus}`;
    if (wsClassId) url += `&class_id=${wsClassId}`;
    if (wsSection) url += `&section=${encodeURIComponent(wsSection)}`;
    if (wsDocType) url += `&doc_type=${encodeURIComponent(wsDocType)}`;
    if (wsSearch)  url += `&search=${encodeURIComponent(wsSearch)}`;

    api.get(url)
      .then(r => {
        setWorkspaceData(r.data);
        const list = r.data?.students || [];
        if (list.length > 0) {
          setSelectedStudent(prev => {
            const found = prev ? list.find(s => s.student_id === prev.student_id) : null;
            return found || list[0];
          });
        } else {
          setSelectedStudent(null);
        }
      })
      .catch(() => toast.error("Failed to load workspace data"))
      .finally(() => setLoadingWorkspace(false));
  }, [wsClassId, wsSection, wsDocType, wsStatus, wsSearch, isStudent]);

  // ─── 2. LOAD MATRIX & ANALYTICS ───────────────────────────────────────────
  const loadMatrixAndAnalytics = useCallback(() => {
    if (isStudent) return;
    setLoadingMatrix(true);

    const aUrl = matrixClassId ? `/principal/documents/analytics?class_id=${matrixClassId}` : "/principal/documents/analytics";
    api.get(aUrl).then(r => setAnalytics(r.data)).catch(() => {});

    let sUrl = `/principal/documents/students-status?status=${matrixStatusFilter}`;
    if (matrixClassId) sUrl += `&class_id=${matrixClassId}`;
    if (matrixSearch)  sUrl += `&search=${encodeURIComponent(matrixSearch)}`;

    api.get(sUrl)
      .then(r => {
        setStudentsStatus(r.data?.students || []);
        if (r.data?.requirements) setDocRequirements(r.data.requirements);
      })
      .catch(() => {})
      .finally(() => setLoadingMatrix(false));
  }, [matrixClassId, matrixStatusFilter, matrixSearch, isStudent]);

  // ─── 3. LOAD REPOSITORY ───────────────────────────────────────────────────
  const loadRepo = useCallback(() => {
    setLoadingRepo(true);
    let url = `/principal/documents/students/all?search=${encodeURIComponent(repoSearch)}&category=${repoCategory}`;
    if (repoClass) url += `&class_id=${repoClass}`;
    if (repoYear)  url += `&academic_year=${encodeURIComponent(repoYear)}`;
    api.get(url)
      .then(r => setRepoDocs(r.data?.documents || []))
      .catch(() => toast.error("Repository load failed"))
      .finally(() => setLoadingRepo(false));
  }, [repoSearch, repoCategory, repoClass, repoYear]);

  // ─── 4. LOAD CONFIG ───────────────────────────────────────────────────────
  const loadConfig = useCallback(() => {
    if (isStudent) return;
    api.get("/principal/documents/config")
      .then(r => setDocRequirements(r.data?.requirements || []))
      .catch(() => {});
  }, [isStudent]);

  // ─── 5. LOAD STUDENT MY-DOCS ──────────────────────────────────────────────
  const loadMyDocs = useCallback(() => {
    setLoadingMyDocs(true);
    api.get("/student/documents")
      .then(r => setMyDocs(r.data?.data?.[0] || null))
      .catch(() => {})
      .finally(() => setLoadingMyDocs(false));
  }, []);

  useEffect(() => {
    if (!isStudent) {
      if (activeTab === "issue_workspace") loadIssueWorkspace();
      if (activeTab === "class_matrix") loadMatrixAndAnalytics();
      if (activeTab === "repository") loadRepo();
      if (activeTab === "settings") loadConfig();
    } else {
      loadMyDocs();
    }
  }, [activeTab, loadIssueWorkspace, loadMatrixAndAnalytics, loadRepo, loadConfig, loadMyDocs, isStudent]);

  // Active template definition
  const currentTemplate = useMemo(() => {
    const tList = workspaceData?.templates || [];
    return tList.find(t => t.key === activeTemplateKey) || tList[0] || null;
  }, [workspaceData, activeTemplateKey]);

  // Auto-calculated next certificate number for current template
  const currentNextCertNo = useMemo(() => {
    if (!workspaceData) return "";
    const map = workspaceData.next_cert_numbers || {};
    return map[activeTemplateKey] || `${(workspaceData.school?.code || '001').toUpperCase()}/${activeTemplateKey.slice(0, 4)}/${(workspaceData.current_session || '2026').slice(0, 4)}/0001`;
  }, [workspaceData, activeTemplateKey]);

  // Set default form values when active template changes or student changes
  useEffect(() => {
    if (currentTemplate && selectedStudent) {
      const init = {};
      (currentTemplate.default_fields || []).forEach(f => {
        if (f.key === "academic_session") {
          init[f.key] = workspaceData?.current_session || "2026";
        } else if (f.key === "last_class_studied") {
          init[f.key] = selectedStudent.class_display || selectedStudent.class_name || "";
        } else {
          init[f.key] = f.default || "";
        }
      });
      setCertForm(init);
    }
  }, [currentTemplate, selectedStudent, workspaceData]);

  // ─── HANDLE ISSUE CERTIFICATE ACTION ──────────────────────────────────────
  async function handleIssueCertificate(e) {
    if (e) e.preventDefault();
    if (!selectedStudent) return toast.error("Please select a student");
    if (!currentTemplate) return toast.error("Please choose a certificate template");

    setIssuingCert(true);
    try {
      const payload = {
        doc_type: currentTemplate.key,
        title: currentTemplate.title,
        remarks: certRemarks.trim(),
        is_visible_to_student: certVisibleToStudent,
        payload: certForm,
      };

      let res;
      if (certAttachedFile) {
        const fd = new FormData();
        fd.append("doc_type", currentTemplate.key);
        fd.append("title", currentTemplate.title);
        fd.append("remarks", certRemarks.trim());
        fd.append("is_visible_to_student", certVisibleToStudent ? "true" : "false");
        fd.append("payload", JSON.stringify(certForm));
        fd.append("file", certAttachedFile);
        res = await api.post(`/principal/students/${selectedStudent.student_id}/issue-certificate`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await api.post(`/principal/students/${selectedStudent.student_id}/issue-certificate`, payload);
      }

      toast.success(`🎉 ${currentTemplate.title} issued successfully! [Ref: ${res.data?.certificate_no}]`);
      setCertAttachedFile(null);
      setCertRemarks("");
      loadIssueWorkspace();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to issue certificate");
    } finally {
      setIssuingCert(false);
    }
  }

  function handlePrintCertificate() {
    window.print();
  }

  // ─── HANDLE QUICK UPLOAD MODAL ────────────────────────────────────────────
  async function handleModalUpload(e) {
    e.preventDefault();
    if (!uploadModalStudent) return toast.error("Student not selected");
    if (!modalFile) return toast.error("Please choose a file or take a photo");
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
      loadMatrixAndAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setModalUploading(false);
    }
  }

  // ─── HANDLE DELETE DOCUMENT ───────────────────────────────────────────────
  async function handleDelete(docId, type = "issued") {
    if (!window.confirm("Are you sure you want to permanently delete this document record?")) return;
    try {
      const url = type === "issued" ? `/principal/documents/issued/${docId}` : `/principal/documents/student/${docId}`;
      await api.delete(url);
      toast.success("Document deleted");
      if (activeTab === "issue_workspace") loadIssueWorkspace();
      if (activeTab === "class_matrix") loadMatrixAndAnalytics();
      if (activeTab === "repository") loadRepo();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  }

  // ─── HANDLE STUDENT SELF UPLOAD ───────────────────────────────────────────
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

  // ─── SAVE CONFIGURATION ───────────────────────────────────────────────────
  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await api.post("/principal/documents/config", { requirements: docRequirements });
      toast.success("✅ Mandatory document requirements updated!");
      loadMatrixAndAnalytics();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  }

  const TABS = isStudent
    ? [{ id: "my_docs", icon: "ti-file-text", label: "My Documents & Certificates" }]
    : [
        { id: "issue_workspace", icon: "ti-award",       label: "Issue Official Documents & Certificates" },
        { id: "class_matrix",    icon: "ti-layout-grid", label: "Student KYC Docs & Admission Follow-up" },
        { id: "repository",      icon: "ti-database",    label: "All Documents Repository" },
        { id: "settings",        icon: "ti-settings",    label: "Required Documents Settings" },
      ];

  const school = workspaceData?.school || {};

  // Formatted Parent Names (Mr. & Mrs.)
  const fatherText = selectedStudent?.father_name || selectedStudent?.parent_name;
  const motherText = selectedStudent?.mother_name && selectedStudent.mother_name !== "—" ? selectedStudent.mother_name : "";

  return (
    <div className="app-shell">
      {/* ─── EXACT 1-PAGE A4 LANDSCAPE PRINT CSS ─────────────────────────────── */}
      <style>{`
        @page {
          size: 297mm 210mm;
          margin: 0mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-certificate-container, #printable-certificate-container * {
            visibility: visible !important;
          }
          #printable-certificate-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 12mm 16mm 8mm 16mm !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            border: 6px double #0b3b7b !important;
            box-shadow: none !important;
            z-index: 9999999 !important;
          }
        }
      `}</style>

      <Sidebar />
      <div className="main-content">
        <Navbar title={activeTab === 'issue_workspace' ? "Issue Documents & Certificates" : "Student Documents & KYC"} />
        <div className="page-body">

          {/* HEADER */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12,
                  background: "linear-gradient(135deg, #0b3b7b, #1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, color: "#fff", boxShadow: "0 4px 14px rgba(11,59,123,0.25)"
                }}>
                  <i className={`ti ${activeTab === 'issue_workspace' ? 'ti-award' : 'ti-file-text'}`} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#0f172a" }}>
                    {isStudent
                      ? "My Documents & Certificates"
                      : activeTab === 'issue_workspace'
                      ? "Issue Documents & Official Certificates"
                      : "Student Documents & KYC Verification"}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                    {isStudent
                      ? "View your KYC records and school-issued official certificates"
                      : activeTab === 'issue_workspace'
                      ? "Generate, verify, and issue Transfer Certificates, Bonafide, and custom official documents"
                      : "Track mandatory student KYC submission, verify digital uploads, and inspect document repository"}
                  </p>
                </div>
              </div>

              {!isStudent && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      if (activeTab === "issue_workspace") loadIssueWorkspace();
                      else if (activeTab === "class_matrix") loadMatrixAndAnalytics();
                      else if (activeTab === "repository") loadRepo();
                    }}
                    style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <i className="ti ti-refresh" /> Refresh
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TAB BAR */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTab === tab.id ? "3px solid #0b3b7b" : "3px solid transparent",
                  background: activeTab === tab.id ? "#eff6ff" : "transparent",
                  color: activeTab === tab.id ? "#0b3b7b" : "#64748b",
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 800 : 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <i className={`ti ${tab.icon}`} /> {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: ISSUE OFFICIAL DOCUMENTS & CERTIFICATES WORKSPACE           */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "issue_workspace" && !isStudent && (
            <div>
              {/* FILTERS & SEARCH BAR */}
              <div style={{ ...S.card, marginBottom: 18, padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={S.label}>Class</label>
                    <select
                      value={wsClassId}
                      onChange={e => setWsClassId(e.target.value)}
                      style={S.select}
                    >
                      <option value="">🏫 All Classes</option>
                      {(workspaceData?.classes || []).map(c => (
                        <option key={c.id} value={c.id}>{c.display}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: "1 1 130px" }}>
                    <label style={S.label}>Section</label>
                    <input
                      style={S.input}
                      placeholder="e.g. A / B"
                      value={wsSection}
                      onChange={e => setWsSection(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "1 1 200px" }}>
                    <label style={S.label}>Certificate Type Filter</label>
                    <select
                      value={wsDocType}
                      onChange={e => setWsDocType(e.target.value)}
                      style={S.select}
                    >
                      <option value="">🌟 All Certificate Types</option>
                      {(workspaceData?.templates || []).map(t => (
                        <option key={t.key} value={t.key}>{t.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: "1 1 150px" }}>
                    <label style={S.label}>Status</label>
                    <select
                      value={wsStatus}
                      onChange={e => setWsStatus(e.target.value)}
                      style={S.select}
                    >
                      <option value="ALL">All Students</option>
                      <option value="ISSUED">🏆 Already Issued</option>
                      <option value="NOT_ISSUED">⏳ Not Issued / Pending</option>
                    </select>
                  </div>

                  <div style={{ flex: "2 1 220px" }}>
                    <label style={S.label}>Search Student</label>
                    <div style={{ position: "relative" }}>
                      <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input
                        style={{ ...S.input, paddingLeft: 32 }}
                        placeholder="Search student name, roll, adm no, parent..."
                        value={wsSearch}
                        onChange={e => setWsSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && loadIssueWorkspace()}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={loadIssueWorkspace} style={S.btnPrimary}>
                      <i className="ti ti-filter" /> Filter
                    </button>
                    {(wsClassId || wsSection || wsDocType || wsStatus !== "ALL" || wsSearch) && (
                      <button
                        onClick={() => {
                          setWsClassId("");
                          setWsSection("");
                          setWsDocType("");
                          setWsStatus("ALL");
                          setWsSearch("");
                        }}
                        style={S.btnGhost}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN LAYOUT */}
              <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 20, alignItems: "start" }}>

                {/* LEFT: STUDENT PICKER LIST */}
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={S.cardTitle}><i className="ti ti-users" /> Students ({(workspaceData?.students || []).length})</h3>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Select to issue</span>
                  </div>

                  {loadingWorkspace ? (
                    <div style={S.emptyBox}>⏳ Loading students...</div>
                  ) : (workspaceData?.students || []).length === 0 ? (
                    <div style={{ ...S.emptyBox, padding: 40 }}>
                      <div style={{ fontSize: 32, marginBottom: 6 }}>👥</div>
                      <div>No students found for this filter</div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 600, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
                      {(workspaceData?.students || []).map(s => {
                        const isSelected = selectedStudent?.student_id === s.student_id;
                        return (
                          <div
                            key={s.student_id}
                            onClick={() => setSelectedStudent(s)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              cursor: "pointer",
                              background: isSelected ? "#eff6ff" : "#f8fafc",
                              border: isSelected ? "2px solid #0b3b7b" : "1px solid #e2e8f0",
                              transition: "all 0.12s",
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: "50%",
                              background: isSelected ? "#0b3b7b" : "#e2e8f0",
                              color: isSelected ? "#fff" : "#334155",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 800, fontSize: 14, flexShrink: 0, overflow: "hidden"
                            }}>
                              {s.photo_url
                                ? <img src={s.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : s.name?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: 800, fontSize: 13,
                                color: isSelected ? "#0b3b7b" : "#0f172a",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                              }}>
                                {s.name}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                                {s.class_display || s.class_name} · Adm: {s.admission_no} · Roll: {s.roll_number}
                              </div>
                            </div>
                            {s.issued_count > 0 && (
                              <span style={{
                                background: isSelected ? "#dbeafe" : "#ede9fe",
                                color: isSelected ? "#1e40af" : "#7c3aed",
                                fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 12
                              }}>
                                {s.issued_count} issued
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT: SELECTED STUDENT + CERTIFICATE BUILDER + LIVE PREVIEW */}
                <div>
                  {!selectedStudent ? (
                    <div style={{ ...S.emptyBox, padding: 60, borderRadius: 14, fontSize: 15 }}>
                      👈 Select a student from the left panel to issue or preview certificates.
                    </div>
                  ) : (
                    <div>
                      {/* 1. STUDENT IDENTITY BANNER */}
                      <div style={{
                        background: "linear-gradient(135deg, #0b3b7b 0%, #1e40af 100%)",
                        borderRadius: 14,
                        padding: "16px 22px",
                        color: "#fff",
                        marginBottom: 18,
                        boxShadow: "0 4px 16px rgba(11,59,123,0.2)",
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          border: "2px solid rgba(255,255,255,0.6)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 22, fontWeight: 900, flexShrink: 0, overflow: "hidden"
                        }}>
                          {selectedStudent.photo_url
                            ? <img src={selectedStudent.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : selectedStudent.name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>
                            {selectedStudent.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#bfdbfe", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <span>📚 <strong>{selectedStudent.class_display || selectedStudent.class_name}</strong></span>
                            <span>🎟️ Adm No: <strong>{selectedStudent.admission_no}</strong></span>
                            <span>🔢 Roll No: <strong>{selectedStudent.roll_number}</strong></span>
                            <span>🎂 DOB: <strong>{fmtDate(selectedStudent.dob)}</strong></span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "#e2e8f0", marginTop: 3 }}>
                            Parents: <strong>Mr. {fatherText}</strong> {motherText && <> &nbsp;|&nbsp; Mother: <strong>Mrs. {motherText}</strong></>}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
                            Session: {workspaceData?.current_session || "2026"}
                          </span>
                          <span style={{ background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 20, fontSize: 11 }}>
                            🏆 {selectedStudent.issued_count || 0} Certificates on Record
                          </span>
                        </div>
                      </div>

                      {/* 2. CERTIFICATE TEMPLATE SELECTOR */}
                      <div style={{ ...S.card, marginBottom: 18, padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={S.cardTitle}><i className="ti ti-grid" /> Choose Certificate Type to Generate & Issue</h3>
                        </div>

                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                          gap: 10,
                          maxHeight: 220,
                          overflowY: "auto",
                          padding: 2
                        }}>
                          {(workspaceData?.templates || []).map(t => {
                            const isSelected = t.key === activeTemplateKey;
                            const isAlreadyIssued = (selectedStudent.issued_types || []).includes(t.key);
                            return (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => setActiveTemplateKey(t.key)}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  border: isSelected ? `2px solid ${t.theme_color || '#0b3b7b'}` : "1px solid #e2e8f0",
                                  background: isSelected ? "#eff6ff" : "#fff",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                  <span style={{ fontSize: 14, color: t.theme_color || "#0b3b7b" }}>
                                    <i className={`ti ${t.icon || 'ti-certificate'}`} />
                                  </span>
                                  {isAlreadyIssued ? (
                                    <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 10 }}>
                                      ISSUED ✅
                                    </span>
                                  ) : (
                                    <span style={{ background: "#f1f5f9", color: "#64748b", fontSize: 9.5, padding: "2px 6px", borderRadius: 10 }}>
                                      {t.category}
                                    </span>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: 12,
                                  fontWeight: isSelected ? 800 : 700,
                                  color: isSelected ? "#0b3b7b" : "#0f172a",
                                  lineHeight: 1.3
                                }}>
                                  {t.title}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. DYNAMIC FORM & LIVE PREVIEW */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>

                        {/* DYNAMIC PARAMETERS FORM */}
                        {currentTemplate && (
                          <div style={{ ...S.card, padding: "18px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div>
                                <h3 style={S.cardTitle}>
                                  <i className={`ti ${currentTemplate.icon || 'ti-certificate'}`} style={{ color: currentTemplate.theme_color }} />
                                  Certificate Details: {currentTemplate.title}
                                </h3>
                                <span style={{ fontSize: 12, color: "#64748b" }}>
                                  Fill specific parameters below — the live certificate preview updates instantly.
                                </span>
                              </div>
                              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#0b3b7b", fontWeight: 800 }}>
                                Auto Ref: <code>{currentNextCertNo}</code>
                              </div>
                            </div>

                            <form onSubmit={handleIssueCertificate}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
                                {(currentTemplate.default_fields || []).map(f => (
                                  <div key={f.key}>
                                    <label style={S.label}>
                                      {f.label} {f.required && <span style={{ color: "#ef4444" }}>*</span>}
                                    </label>
                                    {f.type === "select" ? (
                                      <select
                                        value={certForm[f.key] ?? f.default ?? ""}
                                        onChange={e => setCertForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        style={S.select}
                                        required={f.required}
                                      >
                                        {(f.options || []).map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : f.type === "textarea" ? (
                                      <textarea
                                        value={certForm[f.key] ?? f.default ?? ""}
                                        onChange={e => setCertForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        style={{ ...S.input, minHeight: 60 }}
                                        required={f.required}
                                      />
                                    ) : (
                                      <input
                                        type={f.type || "text"}
                                        value={certForm[f.key] ?? f.default ?? ""}
                                        onChange={e => setCertForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        style={S.input}
                                        placeholder={f.label}
                                        required={f.required}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14, paddingTop: 8, borderTop: "1px dashed #e2e8f0" }}>
                                <div>
                                  <label style={S.label}>Certificate Number (Auto-Incremented per School)</label>
                                  <input
                                    style={{ ...S.input, background: "#f8fafc", fontWeight: 800, color: "#0b3b7b", cursor: "not-allowed" }}
                                    value={currentNextCertNo}
                                    readOnly
                                  />
                                </div>
                                <div>
                                  <label style={S.label}>Internal Remarks / Note</label>
                                  <input
                                    style={S.input}
                                    placeholder="e.g. Issued on parent request / Relocation"
                                    value={certRemarks}
                                    onChange={e => setCertRemarks(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#334155" }}>
                                  <input
                                    type="checkbox"
                                    checked={certVisibleToStudent}
                                    onChange={e => setCertVisibleToStudent(e.target.checked)}
                                    style={{ width: 16, height: 16 }}
                                  />
                                  Make certificate visible to student/parent in their mobile portal
                                </label>

                                <div style={{ display: "flex", gap: 10 }}>
                                  <button
                                    type="button"
                                    onClick={handlePrintCertificate}
                                    style={{ ...S.btnOutline, background: "#f8fafc" }}
                                    title="Print Certificate"
                                  >
                                    <i className="ti ti-printer" /> Print Preview (1 Page A4)
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={issuingCert}
                                    style={S.btnPrimary}
                                  >
                                    {issuingCert ? <><i className="ti ti-loader-2 ti-spin" /> Issuing...</> : <><i className="ti ti-award" /> Issue & Save to Records</>}
                                  </button>
                                </div>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* 4. LIVE CERTIFICATE PREVIEW CONTAINER */}
                        {currentTemplate && (
                          <div style={{ ...S.card, padding: "20px 24px", background: "#e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                🖨️ Official Certificate Live Canvas (Exact 1-Page A4)
                              </span>
                              <button onClick={handlePrintCertificate} style={{ ...S.btnPrimary, padding: "6px 14px", fontSize: 12 }}>
                                <i className="ti ti-printer" /> Print / Save as PDF
                              </button>
                            </div>

                            {/* THE PRINTABLE CERTIFICATE FRAME */}
                            <div
                              id="printable-certificate-container"
                              ref={certificatePrintRef}
                              style={{
                                background: "#ffffff",
                                border: `6px double ${currentTemplate.theme_color || '#0b3b7b'}`,
                                borderRadius: 12,
                                padding: "28px 36px 14px 36px",
                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                                color: "#0f172a",
                                fontFamily: "'Inter', sans-serif",
                                position: "relative",
                                overflow: "hidden",
                                minHeight: "520px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                              }}
                            >
                              {/* Background Watermark Seal */}
                              <div style={{
                                position: "absolute",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                opacity: 0.035,
                                fontSize: 260,
                                color: currentTemplate.theme_color || "#0b3b7b",
                                pointerEvents: "none",
                                zIndex: 0,
                              }}>
                                <i className="ti ti-school" />
                              </div>

                              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                
                                <div>
                                  {/* Top Certificate Header */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${currentTemplate.theme_color || '#0b3b7b'}`, paddingBottom: 14, marginBottom: 14 }}>
                                    <div style={{ width: 72, height: 72, flexShrink: 0 }}>
                                      {school.logo_url ? (
                                        <img src={school.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                      ) : (
                                        <div style={{ width: 72, height: 72, borderRadius: 12, background: currentTemplate.theme_color || "#0b3b7b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900 }}>
                                          {school.name?.charAt(0) || "S"}
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ textAlign: "center", flex: 1, padding: "0 16px" }}>
                                      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: currentTemplate.theme_color || "#0b3b7b", textTransform: "uppercase", letterSpacing: 1.2 }}>
                                        {school.name || "ABC PUBLIC SCHOOL"}
                                      </h1>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 4 }}>
                                        {school.address || "Sector 15, City Campus"} {school.city ? `, ${school.city}` : ""} {school.state ? `(${school.state})` : ""} {school.pincode ? `- ${school.pincode}` : ""}
                                      </div>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginTop: 3 }}>
                                        {school.code ? `School Code: ${school.code}` : "Affiliated to State / CBSE Board"} &nbsp;·&nbsp; Academic Session: {workspaceData?.current_session || "2026"}
                                      </div>
                                    </div>

                                    <div style={{ width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <div style={{ width: 62, height: 62, borderRadius: "50%", border: `2.5px dashed ${currentTemplate.accent_color || '#3b82f6'}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: currentTemplate.theme_color || "#0b3b7b" }}>
                                        <i className={`ti ${currentTemplate.icon || 'ti-award'}`} />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Certificate Title Banner */}
                                  <div style={{ textAlign: "center", margin: "14px 0 10px" }}>
                                    <div style={{
                                      display: "inline-block",
                                      padding: "7px 32px",
                                      background: currentTemplate.theme_color || "#0b3b7b",
                                      color: "#ffffff",
                                      fontWeight: 900,
                                      fontSize: 18,
                                      letterSpacing: 2,
                                      borderRadius: 4,
                                      textTransform: "uppercase"
                                    }}>
                                      {currentTemplate.title}
                                    </div>
                                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#475569", marginTop: 6, fontFamily: "monospace" }}>
                                      Certificate Ref: <strong>{currentNextCertNo}</strong>
                                    </div>
                                  </div>

                                  {/* Personalized Certificate Body Content */}
                                  <div style={{ fontSize: 15.5, lineHeight: 2.1, color: "#1e293b", margin: "16px 0", textAlign: "justify", fontWeight: 500 }}>
                                    This is to certify that &nbsp;
                                    <strong style={{ fontSize: 17, color: currentTemplate.theme_color || "#0b3b7b", borderBottom: "2px solid #64748b", padding: "0 8px", fontWeight: 900 }}>
                                      {selectedStudent.name}
                                    </strong>,&nbsp;
                                    Son/Daughter of &nbsp;
                                    <strong style={{ borderBottom: "2px solid #64748b", padding: "0 8px", fontWeight: 800 }}>
                                      Mr. {fatherText}
                                    </strong>
                                    {motherText && (
                                      <>
                                        &nbsp;and &nbsp;
                                        <strong style={{ borderBottom: "2px solid #64748b", padding: "0 8px", fontWeight: 800 }}>
                                          Mrs. {motherText}
                                        </strong>
                                      </>
                                    )}
                                    ,&nbsp;bearing Admission No. &nbsp;
                                    <strong style={{ borderBottom: "2px solid #64748b", padding: "0 6px", fontWeight: 800 }}>
                                      {selectedStudent.admission_no}
                                    </strong>&nbsp;
                                    and Roll No. &nbsp;
                                    <strong style={{ borderBottom: "2px solid #64748b", padding: "0 6px", fontWeight: 800 }}>
                                      {selectedStudent.roll_number}
                                    </strong>,&nbsp;
                                    is / was a bona fide student of Class & Section &nbsp;
                                    <strong style={{ borderBottom: "2px solid #64748b", padding: "0 8px", fontWeight: 800 }}>
                                      {selectedStudent.class_display || selectedStudent.class_name}
                                    </strong>&nbsp;
                                    during the academic session &nbsp;
                                    <strong style={{ borderBottom: "2px solid #64748b", padding: "0 6px", fontWeight: 800 }}>
                                      {certForm.academic_session || workspaceData?.current_session || "2026"}
                                    </strong>.

                                    {/* Rich Template Specific Body Statements */}
                                    {currentTemplate.key === "BEST_STUDENT" && (
                                      <div style={{ marginTop: 10 }}>
                                        In recognition of exemplary academic brilliance, steadfast discipline, outstanding moral character, and distinguished leadership across all curricular and co-curricular activities, he/she is hereby honored with the prestigious <strong>{certForm.award_title || "Best Student of the Year Award"}</strong>. {certForm.citation || "His/Her unwavering dedication, integrity, and positive influence set a benchmark of excellence for the entire institution."}
                                      </div>
                                    )}

                                    {currentTemplate.key === "TRANSFER_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        His/Her date of birth according to the Admission Register is <strong>{fmtDate(selectedStudent.dob)}</strong>.
                                        The student is leaving the school on account of <strong>{certForm.reason_for_leaving || "family relocation"}</strong>.
                                        All school dues have been <strong>{certForm.dues_paid || "cleared"}</strong>. General conduct has been <strong>{certForm.conduct || "Good"}</strong>. Total attendance record: <strong>{certForm.attended_meetings || "195"}</strong> days present out of <strong>{certForm.total_meetings || "210"}</strong> working days. We wish him/her all the best in future pursuits.
                                      </div>
                                    )}

                                    {currentTemplate.key === "SCHOOL_LEAVING_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        Date of Birth: <strong>{fmtDate(selectedStudent.dob)}</strong>.
                                        Reason for leaving: <strong>{certForm.reason_for_leaving || "On parent's own accord"}</strong>.
                                        Promotion status: <strong>{certForm.promoted_to_next || "Yes, Promoted to next higher class"}</strong>.
                                        General conduct: <strong>{certForm.conduct || "Good"}</strong>. Dues status: <strong>{certForm.dues_paid || "All dues cleared"}</strong>. We extend our warmest wishes for a bright future.
                                      </div>
                                    )}

                                    {currentTemplate.key === "SPORTS_ACHIEVEMENT" && (
                                      <div style={{ marginTop: 10 }}>
                                        In proud recognition of outstanding athletic prowess, sportsmanship, and commendable performance in the discipline of <strong>{certForm.sport_name || "Athletics"}</strong> at the <strong>{certForm.event_name || "Annual Inter-School Sports Meet"}</strong> where he/she secured <strong>{certForm.position_rank || "First Position (Gold Medal)"}</strong>. The school administration commends his/her dedication and sportsmanship.
                                      </div>
                                    )}

                                    {currentTemplate.key === "ACADEMIC_EXCELLENCE" && (
                                      <div style={{ marginTop: 10 }}>
                                        In commendation of extraordinary academic excellence, scholastic diligence, and highest honors. Having achieved <strong>{certForm.achievement_title || "Top Rank"}</strong> with score/rank <strong>{certForm.position_rank || "First Rank"}</strong> in {certForm.subject_name || "Overall Academics"}, the school proudly confers this Certificate of Academic Merit.
                                      </div>
                                    )}

                                    {currentTemplate.key === "COMPETITION_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        He/She actively participated in <strong>{certForm.competition_name || "Inter-House Science Exhibition"}</strong> organized by <strong>{certForm.organized_by || "Department of Co-Curricular Activities"}</strong> and secured <strong>{certForm.position_rank || "Winner - First Prize"}</strong>.
                                      </div>
                                    )}

                                    {currentTemplate.key === "CHARACTER_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        During his/her tenure at this school, he/she consistently bore an <strong>{certForm.conduct || "Exemplary"}</strong> character and conduct. {certForm.remarks || "He/She demonstrated keen discipline, moral integrity, and active participation in school life."}
                                      </div>
                                    )}

                                    {currentTemplate.key === "ATTENDANCE_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        In recognition of exceptional punctuality and dedication, achieving a remarkable record of <strong>{certForm.attendance_pct || "100% Attendance"}</strong> during the session. Keep up the good work!
                                      </div>
                                    )}

                                    {currentTemplate.key === "LEADERSHIP_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        Conferred in recognition of distinguished service and leadership as <strong>{certForm.designation_role || "House Captain"}</strong>. {certForm.citation || "Demonstrated excellent leadership qualities, proactive initiative, and guided fellow students with honor."}
                                      </div>
                                    )}

                                    {currentTemplate.key === "CULTURAL_ACTIVITY" && (
                                      <div style={{ marginTop: 10 }}>
                                        He/She participated enthusiastically in <strong>{certForm.activity_name || "Annual Cultural Fest"}</strong> showcasing <strong>{certForm.contribution_role || "Lead Performance"}</strong> with commendable artistic talent.
                                      </div>
                                    )}

                                    {currentTemplate.key === "DEBATE_OLYMPIAD" && (
                                      <div style={{ marginTop: 10 }}>
                                        For demonstrating intellectual brilliance and analytical excellence in <strong>{certForm.event_name || "Inter-School Debate Championship"}</strong> securing <strong>{certForm.position_rank || "First Place"}</strong>.
                                      </div>
                                    )}

                                    {currentTemplate.key === "PARTICIPATION_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        In recognition of enthusiastic participation in <strong>{certForm.event_name || "Annual School Event"}</strong> organized by <strong>{certForm.organized_by || "Event Committee"}</strong>. {certForm.remarks || "We appreciate the dedication and active involvement shown."}
                                      </div>
                                    )}

                                    {currentTemplate.key === "APPRECIATION_CERTIFICATE" && (
                                      <div style={{ marginTop: 10 }}>
                                        In sincere appreciation of <strong>{certForm.reason || "Exemplary Service & Positive Contribution"}</strong>. {certForm.citation || "The school leadership values his/her positive attitude and sincere efforts."}
                                      </div>
                                    )}

                                    {currentTemplate.key === "BONAFIDE" && (
                                      <div style={{ marginTop: 10 }}>
                                        This certificate is issued for <strong>{certForm.purpose || "Official / Verification Purpose"}</strong> on the request of his/her parent. {certForm.remarks || ""}
                                      </div>
                                    )}

                                    {currentTemplate.key === "OTHER" && (
                                      <div style={{ marginTop: 10 }}>
                                        {certForm.custom_body || "This certificate is issued on official school record."}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Signatures, Date, QR Code & Digital Signature */}
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1.5px dashed #cbd5e1", gap: 16 }}>
                                    {/* Left: Date & Place */}
                                    <div style={{ minWidth: 140 }}>
                                      <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
                                        Date: <strong>{fmtDate(new Date())}</strong>
                                      </div>
                                      <div style={{ fontSize: 13, color: "#334155", fontWeight: 700, marginTop: 3 }}>
                                        Place: <strong>{school.city || "School Campus"}</strong>
                                      </div>
                                    </div>

                                    {/* Center: Square QR Code + Digitally Signed & Certified Box */}
                                    <div style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 12,
                                      background: "#f8fafc",
                                      border: `1.5px solid ${currentTemplate.theme_color || '#0b3b7b'}33`,
                                      borderRadius: 8,
                                      padding: "6px 12px",
                                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                                    }}>
                                      {/* Square QR Code with Scan to Verify */}
                                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                                        <div style={{
                                          width: 62,
                                          height: 62,
                                          background: "#ffffff",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: 4,
                                          padding: 2,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}>
                                          <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                              `OFFICIAL CERTIFICATE VERIFICATION\n` +
                                              `School: ${school.name || "School"} (Code: ${school.code || "001"})\n` +
                                              `Certificate: ${currentTemplate.title}\n` +
                                              `Ref No: ${currentNextCertNo}\n` +
                                              `Student Name: ${selectedStudent.name}\n` +
                                              `Admission No: ${selectedStudent.admission_no} | Roll No: ${selectedStudent.roll_number}\n` +
                                              `Class & Section: ${selectedStudent.class_display || selectedStudent.class_name}\n` +
                                              `Father's Name: Mr. ${fatherText || "—"}\n` +
                                              `Academic Session: ${certForm.academic_session || workspaceData?.current_session || "2026"}\n` +
                                              `Date: ${fmtDate(new Date())}\n` +
                                              `Digital Signature: Principal, ${school.name || "School Authority"}\n` +
                                              `Status: AUTHENTIC & DIGITALLY VERIFIED\n` +
                                              `Platform: OnePlatform 360 Enterprise ERP`
                                            )}`}
                                            alt="Verification QR"
                                            style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
                                          />
                                        </div>
                                        <div style={{ fontSize: 8, fontWeight: 900, color: "#475569", marginTop: 2, letterSpacing: 0.4, textTransform: "uppercase" }}>
                                          Scan To Verify
                                        </div>
                                      </div>

                                      {/* Digital Signature & Timestamp Metadata */}
                                      <div style={{ textAlign: "left", lineHeight: 1.35 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 900, color: "#166534" }}>
                                          <span>🛡️ DIGITALLY SIGNED</span>
                                          <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>VERIFIED</span>
                                        </div>
                                        <div style={{ fontSize: 10, color: "#1e293b", fontWeight: 700, marginTop: 2 }}>
                                          Signatory: Principal, {school.name || "School Authority"}
                                        </div>
                                        <div style={{ fontSize: 9.5, color: "#64748b" }}>
                                          Signed: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                        <div style={{ fontSize: 9, color: "#0b3b7b", fontWeight: 800, marginTop: 1, fontFamily: "monospace" }}>
                                          Ref: {currentNextCertNo}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Principal Signature & Seal */}
                                    <div style={{ textAlign: "center", minWidth: 160 }}>
                                      {school.principal_signature_url ? (
                                        <img src={school.principal_signature_url} alt="" style={{ height: 42, marginBottom: 2 }} />
                                      ) : (
                                        <div style={{ height: 32, borderBottom: "2px solid #334155", width: 150, margin: "0 auto 4px" }} />
                                      )}
                                      <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>Principal</div>
                                      <div style={{ fontSize: 11.5, color: "#64748b" }}>(Signature & Seal)</div>
                                    </div>
                                  </div>

                                  {/* Enterprise Footer Tagline */}
                                  <div style={{ textAlign: "center", marginTop: 10, fontSize: 10.5, color: "#94a3b8", fontWeight: 600, letterSpacing: 0.5 }}>
                                    OnePlatform 360 — Enterprise School Management
                                  </div>
                                </div>


                              </div>
                            </div>
                          </div>
                        )}

                        {/* 5. STUDENT'S ISSUED DOCUMENTS HISTORY */}
                        <div style={S.card}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <h3 style={S.cardTitle}>
                              <i className="ti ti-history" /> Previously Issued Certificates for {selectedStudent.name} ({(selectedStudent.issued_documents || []).length})
                            </h3>
                          </div>

                          {(selectedStudent.issued_documents || []).length === 0 ? (
                            <div style={S.emptyBox}>No certificates issued to this student yet.</div>
                          ) : (
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                                <thead>
                                  <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Certificate Title</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Serial / Ref No</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Class at Issue</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Issue Date</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Issued By</th>
                                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedStudent.issued_documents || []).map(doc => (
                                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0b3b7b" }}>
                                        {doc.title || doc.label}
                                      </td>
                                      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11.5, color: "#475569" }}>
                                        {doc.certificate_no || "—"}
                                      </td>
                                      <td style={{ padding: "9px 12px", color: "#64748b" }}>
                                        {doc.class_name_at_issue || "—"}
                                      </td>
                                      <td style={{ padding: "9px 12px", color: "#64748b" }}>
                                        {fmtDate(doc.issued_at)}
                                      </td>
                                      <td style={{ padding: "9px 12px", color: "#64748b" }}>
                                        {doc.issued_by_name || "School Authority"}
                                      </td>
                                      <td style={{ padding: "9px 12px" }}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveTemplateKey(doc.doc_type);
                                              if (doc.payload) setCertForm(doc.payload);
                                              toast("Preview loaded above");
                                            }}
                                            style={{ ...S.btnOutline, padding: "4px 8px", fontSize: 11 }}
                                          >
                                            <i className="ti ti-eye" /> Preview
                                          </button>
                                          {doc.file_url && (
                                            <a
                                              href={doc.file_url} target="_blank" rel="noreferrer"
                                              style={{ ...S.btnPrimary, padding: "4px 8px", fontSize: 11, textDecoration: "none" }}
                                            >
                                              <i className="ti ti-download" /> File
                                            </a>
                                          )}
                                          {canDelete && (
                                            <button
                                              onClick={() => handleDelete(doc.id, "issued")}
                                              style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "4px 7px", borderRadius: 5, fontSize: 11, cursor: "pointer" }}
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
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: STUDENT KYC DOCUMENTS MATRIX & QUICK UPLOAD                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "class_matrix" && !isStudent && (
            <div>
              {/* ANALYTICS TILES */}
              {analytics && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
                  <div style={{ ...S.metricCard, borderLeft: "4px solid #0b3b7b" }}>
                    <div style={S.metricLabel}><i className="ti ti-users" /> TOTAL STUDENTS</div>
                    <div style={S.metricVal}>{analytics.total_students}</div>
                    <div style={S.metricSub}>Active enrollments</div>
                  </div>

                  <div style={{ ...S.metricCard, borderLeft: "4px solid #16a34a" }}>
                    <div style={{ ...S.metricLabel, color: "#16a34a" }}><i className="ti ti-circle-check" /> ALL DOCS COMPLETE</div>
                    <div style={{ ...S.metricVal, color: "#16a34a" }}>
                      {analytics.completed_students} <span style={{ fontSize: 13, fontWeight: 600 }}>({analytics.completion_pct}%)</span>
                    </div>
                    <div style={S.metricSub}>All mandatory docs verified</div>
                  </div>

                  <div style={{ ...S.metricCard, borderLeft: "4px solid #f59e0b" }}>
                    <div style={{ ...S.metricLabel, color: "#d97706" }}><i className="ti ti-alert-circle" /> PENDING ADMISSION DOCS</div>
                    <div style={{ ...S.metricVal, color: "#d97706" }}>{analytics.pending_students}</div>
                    <div style={S.metricSub}>Follow-up required</div>
                  </div>

                  <div style={{ ...S.metricCard, borderLeft: "4px solid #6366f1" }}>
                    <div style={{ ...S.metricLabel, color: "#6366f1" }}><i className="ti ti-files" /> STORED FILES</div>
                    <div style={{ ...S.metricVal, color: "#4f46e5" }}>{analytics.total_documents_uploaded}</div>
                    <div style={S.metricSub}>Secure cloud storage</div>
                  </div>
                </div>
              )}

              {/* Filter Controls Bar */}
              <div style={{ ...S.card, marginBottom: 18, padding: "14px 18px" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={S.label}>Class</label>
                    <select
                      value={matrixClassId}
                      onChange={e => setMatrixClassId(e.target.value)}
                      style={S.select}
                    >
                      <option value="">🏫 All Classes</option>
                      {(workspaceData?.classes || []).map(c => (
                        <option key={c.id} value={c.id}>{c.display}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: "1 1 180px" }}>
                    <label style={S.label}>Status</label>
                    <select
                      value={matrixStatusFilter}
                      onChange={e => setMatrixStatusFilter(e.target.value)}
                      style={S.select}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="COMPLETE">✅ Complete (All Docs)</option>
                      <option value="PARTIAL">⚠️ Partial (Some Missing)</option>
                      <option value="MISSING">❌ Missing (No Docs)</option>
                    </select>
                  </div>

                  <div style={{ flex: "2 1 260px" }}>
                    <label style={S.label}>Search</label>
                    <input
                      style={S.input}
                      placeholder="Search student name, roll number, admission no, parent..."
                      value={matrixSearch}
                      onChange={e => setMatrixSearch(e.target.value)}
                    />
                  </div>

                  <button onClick={loadMatrixAndAnalytics} style={S.btnPrimary}>
                    <i className="ti ti-filter" /> Apply
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={S.cardTitle}>Student KYC Documents ({studentsStatus.length})</h3>
                </div>

                {loadingMatrix ? (
                  <div style={S.emptyBox}>⏳ Loading student records...</div>
                ) : studentsStatus.length === 0 ? (
                  <div style={{ ...S.emptyBox, padding: 50 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                    <div>No student records found</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                          <th style={{ padding: "10px 12px", textAlign: "left" }}>Student</th>
                          <th style={{ padding: "10px 12px", textAlign: "left" }}>Class & Parent</th>
                          <th style={{ padding: "10px 12px", textAlign: "left" }}>Status</th>
                          <th style={{ padding: "10px 12px", textAlign: "left" }}>Uploaded KYC Docs</th>
                          <th style={{ padding: "10px 12px", textAlign: "left" }}>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsStatus.map(st => (
                          <tr key={st.student_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontWeight: 800, color: "#0f172a" }}>{st.name}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>Adm: {st.admission_no} · Roll: {st.roll_number}</div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontWeight: 700, color: "#0b3b7b" }}>{st.class_name || "—"}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>Parent: {st.parent_name}</div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{
                                padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800,
                                background: st.status === "COMPLETE" ? "#dcfce7" : st.status === "PARTIAL" ? "#fef3c7" : "#fee2e2",
                                color: st.status === "COMPLETE" ? "#16a34a" : st.status === "PARTIAL" ? "#d97706" : "#dc2626",
                              }}>
                                {st.status === "COMPLETE" ? "✅ Complete" : st.status === "PARTIAL" ? "⚠️ Partial" : "❌ Missing"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 360 }}>
                                {st.uploaded_documents?.map(doc => (
                                  <div key={doc.id} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 7px", borderRadius: 5, fontSize: 11, color: "#0b3b7b", fontWeight: 700, display: "flex", gap: 5, alignItems: "center" }}>
                                    <span>{doc.label}</span>
                                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}><i className="ti ti-external-link" /></a>
                                    {canDelete && (
                                      <button onClick={() => handleDelete(doc.id, "kyc")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}>✕</button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <button
                                onClick={() => {
                                  setUploadModalStudent(st);
                                  if (st.missing_required_types?.length > 0) setModalDocType(st.missing_required_types[0]);
                                  else setModalDocType("AADHAR_STUDENT");
                                }}
                                style={{ ...S.btnPrimary, padding: "5px 10px", fontSize: 11.5 }}
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
          {/* TAB 3: ALL DOCUMENTS REPOSITORY                                    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "repository" && !isStudent && (
            <div>
              <div style={{ ...S.card, marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "2 1 200px" }}>
                    <label style={S.label}>Search</label>
                    <input style={S.input} placeholder="Student name, admission no, serial..." value={repoSearch} onChange={e => setRepoSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && loadRepo()} />
                  </div>
                  <div style={{ flex: "1 1 150px" }}>
                    <label style={S.label}>Class</label>
                    <select value={repoClass} onChange={e => setRepoClass(e.target.value)} style={S.select}>
                      <option value="">All Classes</option>
                      {(workspaceData?.classes || []).map(c => <option key={c.id} value={c.id}>{c.display}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 130px" }}>
                    <label style={S.label}>Category</label>
                    <select value={repoCategory} onChange={e => setRepoCategory(e.target.value)} style={S.select}>
                      <option value="all">All Documents</option>
                      <option value="issued">Issued Certificates</option>
                      <option value="kyc">KYC Documents</option>
                    </select>
                  </div>
                  <div style={{ flex: "1 1 110px" }}>
                    <label style={S.label}>Year</label>
                    <input style={S.input} placeholder="2026" value={repoYear} onChange={e => setRepoYear(e.target.value)} />
                  </div>
                  <button onClick={loadRepo} style={S.btnPrimary}>
                    <i className="ti ti-search" /> Search
                  </button>
                </div>
              </div>

              {loadingRepo ? (
                <div style={S.emptyBox}>⏳ Loading repository...</div>
              ) : repoDocs.length === 0 ? (
                <div style={{ ...S.emptyBox, padding: 50 }}>No documents found</div>
              ) : (
                <div style={S.card}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                          {["Student", "Class", "Parent", "Document Title", "Serial / Ref", "Category", "Date", "Actions"].map(h => (
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repoDocs.map(d => (
                          <tr key={`${d.category}-${d.id}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: "#0b3b7b" }}>{d.student_name}</td>
                            <td style={{ padding: "9px 12px", color: "#475569" }}>{d.current_class}</td>
                            <td style={{ padding: "9px 12px", color: "#64748b" }}>{d.parent_name}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ background: "#eff6ff", color: "#0b3b7b", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>
                                {d.title || d.label}
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11 }}>{d.certificate_no || "—"}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{
                                background: d.category === "issued" ? "#ede9fe" : "#f0fdf4",
                                color: d.category === "issued" ? "#7c3aed" : "#166534",
                                padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                              }}>
                                {d.category === "issued" ? "🏛️ Issued" : "📋 KYC"}
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px", color: "#64748b" }}>{fmtDate(d.uploaded_at || d.issued_at)}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                {d.file_url ? (
                                  <a href={d.file_url} target="_blank" rel="noreferrer" style={{ ...S.btnPrimary, padding: "3px 8px", fontSize: 11, textDecoration: "none" }}>
                                    <i className="ti ti-eye" /> View
                                  </a>
                                ) : (
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Generated</span>
                                )}
                                {canDelete && (
                                  <button onClick={() => handleDelete(d.id, d.category)} style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "3px 7px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
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
          {/* TAB 4: REQUIRED DOCUMENTS SETTINGS                                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && !isStudent && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={S.cardTitle}><i className="ti ti-adjustments-horizontal" /> Mandatory Admission Documents Configuration</h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Configure mandatory document requirements for student admissions & tracking</span>
                </div>
                <button onClick={handleSaveConfig} disabled={savingConfig} style={S.btnPrimary}>
                  {savingConfig ? "Saving..." : "💾 Save Changes"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {docRequirements.map((req, idx) => (
                  <div key={req.doc_type} style={{
                    background: req.is_required ? "#eff6ff" : "#f8fafc",
                    border: req.is_required ? "1.5px solid #0b3b7b" : "1px solid #e2e8f0",
                    borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{req.label}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Type: {req.doc_type}</div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, color: req.is_required ? "#0b3b7b" : "#64748b" }}>
                      <input
                        type="checkbox"
                        checked={req.is_required}
                        onChange={e => {
                          const copy = [...docRequirements];
                          copy[idx].is_required = e.target.checked;
                          setDocRequirements(copy);
                        }}
                        style={{ width: 16, height: 16 }}
                      />
                      {req.is_required ? "Mandatory" : "Optional"}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: STUDENT SELF SERVICE VIEW                                   */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === "my_docs" && isStudent && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              <div style={S.card}>
                <h3 style={S.cardTitle}><i className="ti ti-cloud-upload" /> Upload KYC Document</h3>
                <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 14px" }}>Upload your Aadhaar Card, Birth Certificate, or other KYC documents.</p>
                <form onSubmit={handleMyUpload} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={S.label}>Document Type *</label>
                    <select value={myDocType} onChange={e => setMyDocType(e.target.value)} style={S.select}>
                      {DEFAULT_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {myDocType === "OTHER" ? (
                    <div>
                      <label style={S.label}>Document Name *</label>
                      <input style={S.input} placeholder="e.g. Migration Certificate" value={myCustomLabel} onChange={e => setMyCustomLabel(e.target.value)} required />
                    </div>
                  ) : (
                    <div>
                      <label style={S.label}>Title (Optional)</label>
                      <input style={S.input} placeholder="e.g. Aadhaar Card Front & Back" value={myTitle} onChange={e => setMyTitle(e.target.value)} />
                    </div>
                  )}
                  <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <label style={{ ...S.btnOutline, cursor: "pointer", display: "inline-flex" }}>
                      <i className="ti ti-folder-open" /> Choose File
                      <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => setMyFile(e.target.files[0] || null)} />
                    </label>
                    {myFile ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
                        ✅ {myFile.name} ({fmtBytes(myFile.size)})
                        <button type="button" onClick={() => setMyFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
                    )}
                  </div>
                  <button type="submit" disabled={myUploading || !myFile} style={S.btnPrimary}>
                    {myUploading ? "Uploading..." : "Save Document"}
                  </button>
                </form>
              </div>

              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={S.cardTitle}><i className="ti ti-files" /> Your Issued Certificates & Documents</h3>
                  <button onClick={loadMyDocs} style={S.btnGhost}><i className="ti ti-refresh" /></button>
                </div>
                {loadingMyDocs ? <div style={S.emptyBox}>⏳ Loading...</div> : !myDocs ? <div style={S.emptyBox}>No records found</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {myDocs.issued_documents?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", marginBottom: 6, textTransform: "uppercase" }}>🏛️ Official School Certificates</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.issued_documents.map(d => (
                            <div key={d.id} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", padding: "10px 12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: "#581c87" }}>{d.title || d.label}</div>
                                <div style={{ fontSize: 11, color: "#7e22ce" }}>Serial: {d.certificate_no || "—"} · Issued: {fmtDate(d.issued_at)}</div>
                              </div>
                              {d.file_url && (
                                <a href={d.file_url} target="_blank" rel="noreferrer" style={{ ...S.btnPrimary, padding: "4px 10px", fontSize: 11.5, textDecoration: "none" }}>
                                  <i className="ti ti-download" /> Download
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {myDocs.kyc_documents?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#0b3b7b", marginBottom: 6, textTransform: "uppercase" }}>📋 Submitted KYC Documents</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {myDocs.kyc_documents.map(d => (
                            <div key={d.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{d.title || d.label}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>Uploaded: {fmtDate(d.uploaded_at)}</div>
                              </div>
                              <a href={d.file_url} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, padding: "4px 10px", fontSize: 11.5, textDecoration: "none" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      📁 Upload KYC Document for {uploadModalStudent.name}
                    </h3>
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                      {uploadModalStudent.class_name} · Adm: {uploadModalStudent.admission_no}
                    </div>
                  </div>
                  <button onClick={() => setUploadModalStudent(null)} style={S.modalCloseBtn}>✕</button>
                </div>

                <form onSubmit={handleModalUpload} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={S.label}>Document Type *</label>
                    <select value={modalDocType} onChange={e => setModalDocType(e.target.value)} style={S.select}>
                      {DEFAULT_DOC_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {modalDocType === "OTHER" ? (
                    <div>
                      <label style={S.label}>Document Custom Name *</label>
                      <input style={S.input} placeholder="e.g. Migration Certificate" value={modalCustomLabel} onChange={e => setModalCustomLabel(e.target.value)} required />
                    </div>
                  ) : (
                    <div>
                      <label style={S.label}>Document Title (Optional)</label>
                      <input style={S.input} placeholder="e.g. Aadhaar Card Front & Back" value={modalTitle} onChange={e => setModalTitle(e.target.value)} />
                    </div>
                  )}

                  <div>
                    <label style={S.label}>Remarks (Optional)</label>
                    <input style={S.input} placeholder="e.g. Verified by class teacher" value={modalRemarks} onChange={e => setModalRemarks(e.target.value)} />
                  </div>

                  <div style={{ background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-folder-open" /> Choose File
                        <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => setModalFile(e.target.files[0] || null)} />
                      </label>
                      <label style={{ ...S.btnOutline, cursor: "pointer" }}>
                        <i className="ti ti-camera" /> Take Photo
                        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => setModalFile(e.target.files[0] || null)} />
                      </label>
                    </div>
                    {modalFile ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "#0b3b7b", fontWeight: 700 }}>
                        ✅ {modalFile.name} ({fmtBytes(modalFile.size)})
                        <button type="button" onClick={() => setModalFile(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>PDF, JPG, PNG · Max 10 MB</div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
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
    padding: "18px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 14.5,
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
    padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0b3b7b",
    letterSpacing: 0.5,
    marginBottom: 4,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  metricVal: {
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
    marginBottom: 3,
  },
  metricSub: {
    fontSize: 11,
    color: "#64748b",
  },
  label: {
    display: "block",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 12.5,
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  },
  select: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 12.5,
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "#0b3b7b",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 12.5,
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
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyBox: {
    textAlign: "center",
    padding: 24,
    background: "#f8fafc",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 12.5,
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
    padding: "20px 22px",
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
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
