import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell
} from 'recharts';

export default function PrincipalAcademicDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState('2026-27');
  const [loading, setLoading] = useState(true);

  // Summary & Breakdown data
  const [dashboardData, setDashboardData] = useState({
    summary: {},
    subjects_breakdown: [],
    classes_breakdown: [],
    teacher_activity: [],
    critical_alerts: []
  });

  // Drilldown selection
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  // Filters for subjects table
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch complete academic summary
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/curriculum/analytics/summary?session=${session}`);
      setDashboardData(res.data);

      const subjects = res.data.subjects_breakdown || [];
      if (subjects.length > 0 && !selectedCurriculumId) {
        setSelectedCurriculumId(subjects[0].curriculum_id);
      }
    } catch (err) {
      console.error('Error fetching academic dashboard:', err);
      toast.error('Failed to load academic dashboard data');
    } finally {
      setLoading(false);
    }
  }, [session, selectedCurriculumId]);

  useEffect(() => {
    fetchDashboard();
  }, [session]);

  // Fetch Drilldown when selected
  useEffect(() => {
    if (!selectedCurriculumId) {
      setDrilldownData(null);
      return;
    }

    const fetchDrilldown = async () => {
      setLoadingDrilldown(true);
      try {
        const res = await api.get(`/curriculum/analytics/drill-down/${selectedCurriculumId}`);
        setDrilldownData(res.data);
      } catch (err) {
        console.error('Error fetching drilldown:', err);
      } finally {
        setLoadingDrilldown(false);
      }
    };

    fetchDrilldown();
  }, [selectedCurriculumId]);

  // Filtered subjects table
  const filteredSubjects = useMemo(() => {
    let list = dashboardData.subjects_breakdown || [];

    if (classFilter) {
      list = list.filter(s => String(s.class_id) === String(classFilter));
    }
    if (statusFilter) {
      list = list.filter(s => s.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.subject_name || '').toLowerCase().includes(q) ||
        (s.class_name || '').toLowerCase().includes(q) ||
        (s.teacher_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [dashboardData.subjects_breakdown, classFilter, statusFilter, searchQuery]);

  // Chart data preparation
  const chartData = useMemo(() => {
    return (dashboardData.subjects_breakdown || []).slice(0, 10).map(s => ({
      name: `${s.subject_name} (${s.class_name})`,
      coverage: s.coverage_percentage || 0,
    }));
  }, [dashboardData.subjects_breakdown]);

  const classChartData = useMemo(() => {
    return (dashboardData.classes_breakdown || []).map(c => ({
      name: c.class_name,
      avg_coverage: c.average_coverage_percentage || 0
    }));
  }, [dashboardData.classes_breakdown]);

  const summary = dashboardData.summary || {};

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Academic Syllabus Oversight" />

        <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px' }}>
          {/* ══ HEADER ══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    background: '#f1f5f9', border: 'none', borderRadius: '8px',
                    padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 700, color: '#475569'
                  }}
                >
                  <i className="ti ti-arrow-left" /> Back
                </button>
                <span style={{
                  background: '#ecfdf5', color: '#059669', fontSize: '12px',
                  fontWeight: 800, padding: '4px 10px', borderRadius: '100px'
                }}>
                  ● Institutional Oversight
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{session}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                Principal Academic &amp; Syllabus Coverage Dashboard
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Monitor curriculum delivery rates, planned vs actual teaching periods, and teacher lesson logs school-wide.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="form-select"
                style={{ width: '150px', fontWeight: 700, borderRadius: '10px' }}
              >
                <option value="2026-27">Session 2026-27</option>
                <option value="2025-26">Session 2025-26</option>
              </select>

              <button
                onClick={() => window.print()}
                className="btn btn-neutral"
                style={{ borderRadius: '10px', padding: '10px 14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ti ti-printer" /> Print Audit Report
              </button>

              <button
                onClick={fetchDashboard}
                className="btn btn-neutral"
                style={{ borderRadius: '10px', padding: '10px 14px', fontWeight: 700 }}
              >
                <i className="ti ti-refresh" /> Refresh
              </button>
            </div>
          </div>

          {/* ══ CRITICAL ALERTS STRIP ══ */}
          {(dashboardData.critical_alerts || []).length > 0 && (
            <div style={{
              background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '12px',
              padding: '14px 18px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: 800, fontSize: '13px' }}>
                <i className="ti ti-alert-octagon" style={{ fontSize: '18px' }} />
                Curriculum Delivery Alerts ({dashboardData.critical_alerts.length})
              </div>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#b91c1c' }}>
                {dashboardData.critical_alerts.map((alert, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>•</span>
                    <strong>{alert.class_name} - {alert.subject_name}:</strong> Lagging behind by {alert.lag_percentage}% ({alert.actual_periods} of {alert.planned_periods} periods taught).
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TOP 5 KPI CARDS ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>AVG SCHOOL COVERAGE</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-chart-bar" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0176d3' }}>
                {summary.average_school_coverage || 0}%
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Across {summary.total_curriculums || 0} active subjects</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ON SCHEDULE</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-circle-check" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>
                {summary.on_track_subjects || 0}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Ahead or on schedule</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>BEHIND SCHEDULE</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#d97706' }}>
                {summary.behind_subjects || 0}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Minor syllabus lag</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CRITICAL LAG</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-shield-alert" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#dc2626' }}>
                {summary.critical_subjects || 0}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Action required</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>LESSONS LOGGED</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-notes" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed' }}>
                {summary.total_teaching_logs || 0}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>{summary.total_periods_taught || 0} Periods taught</p>
            </div>
          </div>

          {/* ══ CHARTS ROW ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '20px', marginBottom: '22px' }}>
            {/* Subject Coverage BarChart */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Subject Syllabus Coverage %
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
                Real-time syllabus completion by subject
              </p>

              <div style={{ height: '240px', width: '100%' }}>
                {chartData.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No syllabus data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val) => [`${val}%`, 'Coverage']} />
                      <Bar dataKey="coverage" fill="#0176d3" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={
                              entry.coverage >= 75 ? '#16a34a' :
                              entry.coverage >= 45 ? '#0176d3' :
                              entry.coverage >= 25 ? '#d97706' : '#dc2626'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Class-wise Progress BarChart */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Class-Wise Average Progress
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
                Comparative benchmarks across classes
              </p>

              <div style={{ height: '240px', width: '100%' }}>
                {classChartData.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    No class data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val) => [`${val}%`, 'Avg Coverage']} />
                      <Bar dataKey="avg_coverage" fill="#0284c7" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ══ MASTER SUBJECTS REGISTER TABLE ══ */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Institutional Curriculum Progress Register
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  All subjects, assigned teachers, and delivery status
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search subject or teacher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ height: '32px', fontSize: '12px', paddingLeft: '30px' }}
                  />
                  <i className="ti ti-search" style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                  style={{ height: '32px', fontSize: '12px', width: '130px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="ON_TRACK">On Track</option>
                  <option value="AHEAD">Ahead</option>
                  <option value="BEHIND">Behind</option>
                  <option value="CRITICAL">Critical Lag</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Subject &amp; Book</th>
                    <th>Teacher</th>
                    <th>Coverage %</th>
                    <th>Planned vs Taught</th>
                    <th>Chapters</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Audit Drilldown</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No curriculums found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map(sub => {
                      const isSel = selectedCurriculumId === sub.curriculum_id;
                      const cov = sub.coverage_percentage || 0;

                      return (
                        <tr key={sub.curriculum_id} style={{ background: isSel ? '#f0f9ff' : 'transparent' }}>
                          <td style={{ fontWeight: 800, color: '#0f172a' }}>{sub.class_name}</td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{sub.subject_name}</strong>
                            {sub.book_name && <div style={{ fontSize: '11px', color: '#64748b' }}>{sub.book_name}</div>}
                          </td>
                          <td style={{ color: '#475569' }}>{sub.teacher_name || 'Assigned Teacher'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '100px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${cov}%`, height: '100%', borderRadius: '100px',
                                    background: cov >= 75 ? '#16a34a' : cov >= 45 ? '#0176d3' : cov >= 25 ? '#d97706' : '#dc2626'
                                  }}
                                />
                              </div>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{cov}%</span>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: '#16a34a' }}>{sub.actual_periods_taught || 0}</strong>
                            <span style={{ color: '#94a3b8' }}> / {sub.total_planned_periods || 0} pds</span>
                          </td>
                          <td>{sub.chapters_count || 0} Chapters</td>
                          <td>
                            {sub.status === 'AHEAD' && <span className="badge badge-success">Ahead</span>}
                            {sub.status === 'ON_TRACK' && <span className="badge badge-info">On Track</span>}
                            {sub.status === 'BEHIND' && <span className="badge badge-warning">Behind</span>}
                            {sub.status === 'CRITICAL' && <span className="badge badge-error">Critical</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedCurriculumId(sub.curriculum_id)}
                              className="btn btn-neutral btn-sm"
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}
                            >
                              Audit Details →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ AUDIT DRILLDOWN SECTION ══ */}
          {selectedCurriculumId && drilldownData && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0176d3', textTransform: 'uppercase' }}>
                    Inspection &amp; Verification: {drilldownData.class_name} • {drilldownData.subject_name}
                  </span>
                  <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                    Curriculum Execution Breakdown
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#0176d3' }}>
                    {drilldownData.coverage_percentage || 0}%
                  </span>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Delivered</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {drilldownData.chapters?.map(ch => {
                  const isDone = ch.status === 'COMPLETED';
                  const topics = ch.topics || [];
                  const doneCount = topics.filter(t => t.status === 'COMPLETED').length;

                  return (
                    <div key={ch.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Ch {ch.chapter_no}</span>
                          <h4 style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{ch.title}</h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {doneCount} / {topics.length} Topics • {ch.estimated_periods || 0} pds
                          </span>
                        </div>
                        <span className={isDone ? "badge badge-success" : "badge badge-neutral"}>
                          {isDone ? 'Done' : 'In Progress'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                        {topics.map(t => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 6px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{t.topic_no}. {t.title}</span>
                            {t.status === 'COMPLETED' ? (
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Done</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
