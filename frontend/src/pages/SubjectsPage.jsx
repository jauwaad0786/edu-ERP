// src/pages/SubjectsPage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";

const SUBJECT_TYPES = ["Theory", "Practical", "Both"];
const SUBJECT_STATUS = ["Active", "Pending"];

export default function SubjectsPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("ALL"); // 'ALL' or class_id string
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    class_id: "",
    teacher_id: "",
    type: "Theory",
    max_marks: 100,
    pass_marks: 33,
    credits: "",
    weekly_periods: "",
    description: "",
    status: "Active",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const [classRes, teacherRes, subjectRes] = await Promise.all([
        api.get("/principal/classes"),
        api.get("/principal/teachers"),
        api.get("/principal/subjects"),
      ]);

      const classData = Array.isArray(classRes.data) ? classRes.data : [];
      const teacherData = Array.isArray(teacherRes.data) ? teacherRes.data : [];
      const subjectData = Array.isArray(subjectRes.data) ? subjectRes.data : [];

      setClasses(classData);
      setTeachers(teacherData);
      setSubjects(subjectData);

      // Default form class to first class if available
      if (classData.length > 0) {
        setForm((prev) => ({
          ...prev,
          class_id: prev.class_id || String(classData[0].id),
        }));
      }
    } catch (err) {
      console.error("fetchInitialData error:", err);
      toast.error("Data load nahi hua — " + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  }

  function set(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // When user clicks a class tab, sync the form class_id as well
  function handleSelectClassTab(cId) {
    setSelectedClassId(cId);
    if (cId !== "ALL") {
      set("class_id", String(cId));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name || !form.class_id) {
      toast.error("Subject name aur Class select karna zaroori hai");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/principal/subjects", {
        name: form.name.trim(),
        code: form.code ? form.code.trim().toUpperCase() : "",
        class_id: Number(form.class_id),
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        max_marks: Number(form.max_marks) || 100,
        pass_marks: Number(form.pass_marks) || 33,
      });

      toast.success(`✅ Subject '${form.name}' created successfully!`);

      // Add to list or refresh
      setSubjects((prev) => [res.data, ...prev]);

      setForm((prev) => ({
        ...prev,
        name: "",
        code: "",
        teacher_id: "",
        type: "Theory",
        max_marks: 100,
        pass_marks: 33,
        credits: "",
        weekly_periods: "",
        description: "",
        status: "Active",
      }));
    } catch (err) {
      toast.error(err.response?.data?.error || "Subject create nahi hua");
    }

    setLoading(false);
  }

  async function handleDeleteSubject(subjId, subjName) {
    if (!window.confirm(`Kya aap subject '${subjName}' delete karna chahte hain?`)) return;
    setDeletingId(subjId);
    try {
      await api.delete(`/principal/subjects/${subjId}`);
      toast.success(`Subject '${subjName}' deleted`);
      setSubjects((prev) => prev.filter((s) => s.id !== subjId));
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
    setDeletingId(null);
  }

  function getClassName(id) {
    const found = classes.find((c) => c.id === id);
    return found ? `${found.name} - ${found.section}` : "-";
  }

  function getTeacherName(id) {
    if (!id) return null;
    const found = teachers.find((t) => t.id === id);
    return found ? found.name : null;
  }

  // Filtered subjects based on selected class tab and search query
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (selectedClassId !== "ALL" && String(s.class_id) !== String(selectedClassId)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sName = (s.name || "").toLowerCase();
        const sCode = (s.code || "").toLowerCase();
        const cName = getClassName(s.class_id).toLowerCase();
        const tName = (getTeacherName(s.teacher_id) || "").toLowerCase();
        if (!sName.includes(q) && !sCode.includes(q) && !cName.includes(q) && !tName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subjects, selectedClassId, searchQuery, classes, teachers]);

  const activeClassObj = useMemo(() => {
    if (selectedClassId === "ALL") return null;
    return classes.find((c) => String(c.id) === String(selectedClassId));
  }, [selectedClassId, classes]);

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main-content">
        <Navbar title="Subjects Management" />

        <div className="page-body">

          {/* PAGE HEADER */}
          <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 className="page-title">📚 Subjects Management</h2>
              <p className="page-subtitle">
                Class-wise academic subjects configure karein, teachers assign karein aur curriculum manage karein
              </p>
            </div>

            {activeClassObj && (
              <button
                className="btn btn-neutral btn-sm"
                onClick={() => navigate(`/classes/${activeClassObj.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                🏛 View {activeClassObj.name} - {activeClassObj.section} Details →
              </button>
            )}
          </div>

          {/* ANALYTICS CARDS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 22,
            }}
          >
            <AnalyticsCard
              title="Total Subjects"
              value={subjects.length}
              icon="📘"
              color="#0176d3"
            />

            <AnalyticsCard
              title="Classes Configured"
              value={classes.length}
              icon="🏫"
              color="#7c3aed"
            />

            <AnalyticsCard
              title="Teachers Assigned"
              value={subjects.filter((s) => s.teacher_id).length}
              icon="👨‍🏫"
              color="#059669"
            />

            <AnalyticsCard
              title="Unassigned Subjects"
              value={subjects.filter((s) => !s.teacher_id).length}
              icon="⚠️"
              color="#ea580c"
            />
          </div>

          {/* ══ CLASS-WISE FILTER BAR ══ */}
          <div
            style={{
              background: "white",
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 20,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🏫 Filter by Class:</span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                  (Showing {filteredSubjects.length} of {subjects.length} subjects)
                </span>
              </div>

              <input
                type="text"
                placeholder="🔍 Search subject / code / teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  width: 240,
                  outline: "none",
                }}
              />
            </div>

            {/* Class Tabs List */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => handleSelectClassTab("ALL")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: selectedClassId === "ALL" ? "2px solid #0176d3" : "1px solid #e2e8f0",
                  background: selectedClassId === "ALL" ? "#eff6ff" : "white",
                  color: selectedClassId === "ALL" ? "#0176d3" : "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🌐 All Classes</span>
                <span
                  style={{
                    background: selectedClassId === "ALL" ? "#0176d3" : "#f1f5f9",
                    color: selectedClassId === "ALL" ? "white" : "#64748b",
                    borderRadius: 12,
                    padding: "1px 6px",
                    fontSize: 10,
                  }}
                >
                  {subjects.length}
                </span>
              </button>

              {classes.map((cls) => {
                const count = subjects.filter((s) => s.class_id === cls.id).length;
                const isSel = String(selectedClassId) === String(cls.id);
                return (
                  <button
                    type="button"
                    key={cls.id}
                    onClick={() => handleSelectClassTab(String(cls.id))}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isSel ? "2px solid #0176d3" : "1px solid #e2e8f0",
                      background: isSel ? "#eff6ff" : "white",
                      color: isSel ? "#0176d3" : "#475569",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{cls.name} - {cls.section}</span>
                    <span
                      style={{
                        background: isSel ? "#0176d3" : "#f1f5f9",
                        color: isSel ? "white" : "#64748b",
                        borderRadius: 12,
                        padding: "1px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "380px 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >

            {/* LEFT FORM */}
            <div className="card" style={{ margin: 0 }}>

              <div className="card-header" style={{ background: "#f8faff" }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  ➕ Add Subject {activeClassObj ? `for ${activeClassObj.name} - ${activeClassObj.section}` : ""}
                </h4>
              </div>

              <form onSubmit={handleSubmit}>
                <div
                  className="card-body"
                  style={{
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >

                  {/* Class Selection */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                      Class & Section *
                    </label>

                    <select
                      className="form-select"
                      value={form.class_id}
                      required
                      onChange={(e) => set("class_id", e.target.value)}
                      style={{ fontSize: 13 }}
                    >
                      <option value="">-- Select Class --</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} - {cls.section} ({cls.session || "Current"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Name */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                      Subject Name *
                    </label>

                    <input
                      className="form-input"
                      placeholder="e.g. Mathematics, Hindi, Science"
                      required
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {/* Subject Code */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                      Subject Code (Optional)
                    </label>

                    <input
                      className="form-input"
                      placeholder="e.g. MTH101, HIN01"
                      value={form.code}
                      onChange={(e) => set("code", e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {/* Teacher */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                      Assign Subject Teacher
                    </label>

                    <select
                      className="form-select"
                      value={form.teacher_id}
                      onChange={(e) => set("teacher_id", e.target.value)}
                      style={{ fontSize: 13 }}
                    >
                      <option value="">-- Select Teacher (Optional) --</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} {teacher.department ? `(${teacher.department})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Max Marks & Pass Marks */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                        Max Marks
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.max_marks}
                        min={1}
                        onChange={(e) => set("max_marks", Number(e.target.value))}
                        style={{ fontSize: 13 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                        Pass Marks
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={form.pass_marks}
                        min={0}
                        onChange={(e) => set("pass_marks", Number(e.target.value))}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* Subject Type */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>
                      Subject Type
                    </label>

                    <div style={{ display: "flex", gap: 8 }}>
                      {SUBJECT_TYPES.map((type) => (
                        <button
                          type="button"
                          key={type}
                          onClick={() => set("type", type)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: 6,
                            border: form.type === type ? "2px solid #0176d3" : "1px solid #cbd5e1",
                            background: form.type === type ? "#eff6ff" : "#fff",
                            color: form.type === type ? "#0176d3" : "#475569",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <div
                  style={{
                    padding: "14px 20px",
                    borderTop: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {loading ? "⏳ Saving..." : "+ Save Subject"}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT TABLE / DIRECTORY */}
            <div className="card" style={{ margin: 0 }}>

              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  📖 Subject Directory {activeClassObj ? `— ${activeClassObj.name} (${activeClassObj.section})` : ""}
                </h4>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  {filteredSubjects.length} subject(s) listed
                </span>
              </div>

              <div className="card-body" style={{ padding: 0 }}>

                <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Subject Name</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Code</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Class</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Assigned Teacher</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Max / Pass</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSubjects.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: "48px 20px",
                            color: "#94a3b8",
                          }}
                        >
                          <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
                          <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                            {selectedClassId === "ALL" ? "No subjects configured yet" : `No subjects found for ${activeClassObj?.name || "this class"}`}
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                            Use the form on the left to add subjects for this class.
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredSubjects.map((subject) => {
                      const teacherName = getTeacherName(subject.teacher_id) || subject.teacher_name;
                      return (
                        <tr key={subject.id} style={{ borderBottom: "1px solid #f1f5f9" }}>

                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                              <span>📘</span>
                              <span>{subject.name}</span>
                            </div>
                          </td>

                          <td style={{ padding: "10px 14px" }}>
                            {subject.code ? (
                              <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                {subject.code}
                              </span>
                            ) : (
                              <span style={{ color: "#cbd5e1" }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ background: "#eff6ff", color: "#0176d3", padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              {getClassName(subject.class_id)}
                            </span>
                          </td>

                          <td style={{ padding: "10px 14px" }}>
                            {teacherName ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 14 }}>👨‍🏫</span>
                                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 12 }}>{teacherName}</span>
                              </div>
                            ) : (
                              <span style={{ color: "#d97706", fontSize: 11, fontWeight: 600, background: "#fffbeb", padding: "2px 6px", borderRadius: 4 }}>
                                ⚠️ Not Assigned
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0176d3" }}>
                              {subject.max_marks || 100}
                            </span>
                            <span style={{ color: "#94a3b8", margin: "0 3px" }}>/</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              {subject.pass_marks || 33}
                            </span>
                          </td>

                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <button
                              type="button"
                              title="Delete Subject"
                              disabled={deletingId === subject.id}
                              onClick={() => handleDeleteSubject(subject.id, subject.name)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: 14,
                                padding: "4px 6px",
                                borderRadius: 4,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                            >
                              {deletingId === subject.id ? "⏳" : "🗑"}
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ANALYTICS CARD */
function AnalyticsCard({ title, value, icon, color }) {
  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        borderLeft: `4px solid ${color}`,
        margin: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            {value}
          </div>
        </div>

        <div
          style={{
            fontSize: 28,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
