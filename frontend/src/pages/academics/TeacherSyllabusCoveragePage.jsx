import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function TeacherSyllabusCoveragePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [subjectsCoverage, setSubjectsCoverage] = useState([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch coverage data
  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/curriculum/analytics/summary?session=${session}`);
      const list = res.data.subjects_breakdown || [];
      setSubjectsCoverage(list);

      if (list.length > 0 && !selectedCurriculumId) {
        setSelectedCurriculumId(list[0].curriculum_id);
      }
    } catch (err) {
      console.error('Error fetching coverage:', err);
      toast.error('Failed to load syllabus coverage');
    } finally {
      setLoading(false);
    }
  }, [session, selectedCurriculumId]);

  useEffect(() => {
    fetchCoverage();
  }, [session]);

  // Fetch Drilldown
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
        toast.error('Failed to load chapter breakdown');
      } finally {
        setLoadingDrilldown(false);
      }
    };

    fetchDrilldown();
  }, [selectedCurriculumId]);

  // Aggregate Stats
  const stats = useMemo(() => {
    if (!subjectsCoverage.length) return { avgCoverage: 0, totalPlanned: 0, totalTaught: 0, onTrackCount: 0, behindCount: 0 };

    let totalPlanned = 0;
    let totalTaught = 0;
    let weightedCoverageSum = 0;
    let onTrackCount = 0;
    let behindCount = 0;

    subjectsCoverage.forEach(s => {
      totalPlanned += s.total_planned_periods || 0;
      totalTaught += s.actual_periods_taught || 0;
      weightedCoverageSum += (s.coverage_percentage || 0);

      if (s.status === 'ON_TRACK' || s.status === 'AHEAD') onTrackCount++;
      else behindCount++;
    });

    const avgCoverage = Math.round(weightedCoverageSum / subjectsCoverage.length);

    return { avgCoverage, totalPlanned, totalTaught, onTrackCount, behindCount };
  }, [subjectsCoverage]);

  const filteredSubjects = subjectsCoverage.filter(s =>
    (s.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.class_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AHEAD':
        return <span className="badge badge-success">Ahead</span>;
      case 'ON_TRACK':
        return <span className="badge badge-info">On Track</span>;
      case 'BEHIND':
        return <span className="badge badge-warning">Behind</span>;
      case 'CRITICAL':
        return <span className="badge badge-error">Critical Lag</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="My Syllabus Coverage" />

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
                  ● Real-Time Coverage Tracker
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{session}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                My Syllabus &amp; Curriculum Coverage
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Monitor topic completion rates, planned vs actual teaching periods, and chapter-wise execution.
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
                onClick={fetchCoverage}
                className="btn btn-neutral"
                style={{ borderRadius: '10px', padding: '10px 14px', fontWeight: 700 }}
              >
                <i className="ti ti-refresh" /> Refresh
              </button>
            </div>
          </div>

          {/* ══ KPI CARDS ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>AVERAGE COVERAGE</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-chart-pie" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0176d3' }}>{stats.avgCoverage}%</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Weighted topic progress</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PERIODS TAUGHT</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-clock" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>
                {stats.totalTaught} <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>/ {stats.totalPlanned} pds</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Actual vs Planned</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ON SCHEDULE</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-check" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7' }}>{stats.onTrackCount}</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Ahead or On track</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>NEEDS ATTENTION</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-alert-triangle" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: stats.behindCount > 0 ? '#d97706' : '#94a3b8' }}>
                {stats.behindCount}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Lagging behind schedule</p>
            </div>
          </div>

          {/* ══ TWO-COLUMN PROGRESS VIEW ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left: Subjects List */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Assigned Subjects</h4>
                <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                  {filteredSubjects.length}
                </span>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Search subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ height: '34px', fontSize: '12px', paddingLeft: '32px' }}
                />
                <i className="ti ti-search" style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '30px' }}><i className="ti ti-loader animate-spin" /></div>
              ) : filteredSubjects.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '20px' }}>No subjects found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredSubjects.map(sub => {
                    const isSelected = selectedCurriculumId === sub.curriculum_id;
                    const cov = sub.coverage_percentage || 0;

                    return (
                      <div
                        key={sub.curriculum_id}
                        onClick={() => setSelectedCurriculumId(sub.curriculum_id)}
                        style={{
                          padding: '14px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                          border: isSelected ? '1px solid #0176d3' : '1px solid #f1f5f9',
                          background: isSelected ? '#f0f7ff' : '#ffffff',
                          boxShadow: isSelected ? '0 2px 8px rgba(1,118,211,0.1)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                            {sub.class_name}
                          </span>
                          {getStatusBadge(sub.status)}
                        </div>

                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                          {sub.subject_name}
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>Coverage</span>
                            <span style={{ color: '#0176d3' }}>{cov}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '100px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${cov}%`, height: '100%', borderRadius: '100px',
                                background: cov >= 75 ? '#16a34a' : cov >= 45 ? '#0176d3' : cov >= 25 ? '#d97706' : '#dc2626'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                          <span>{sub.chapters_count || 0} Chapters</span>
                          <span><strong>{sub.actual_periods_taught || 0}</strong> / {sub.total_planned_periods || 0} pds</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Detailed Drilldown */}
            <div>
              {loadingDrilldown ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
                  <i className="ti ti-loader animate-spin" style={{ fontSize: '32px', color: '#0176d3' }} />
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>Loading syllabus breakdown...</p>
                </div>
              ) : !drilldownData ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  Select a subject on the left to inspect chapter-by-chapter execution.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Banner */}
                  <div style={{
                    background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
                    padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0176d3', textTransform: 'uppercase' }}>
                        {drilldownData.class_name} • Session {drilldownData.session}
                      </span>
                      <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                        {drilldownData.subject_name} Execution Checklist
                      </h2>
                      {drilldownData.book_name && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                          Prescribed Book: <strong>{drilldownData.book_name}</strong>
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '32px', fontWeight: 900, color: '#0176d3', lineHeight: 1 }}>
                        {drilldownData.coverage_percentage || 0}%
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Total Syllabus Delivered
                      </span>
                    </div>
                  </div>

                  {/* Chapters List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {drilldownData.chapters?.map(ch => {
                      const isCompleted = ch.status === 'COMPLETED';
                      const isInProgress = ch.status === 'IN_PROGRESS';
                      const topics = ch.topics || [];
                      const doneCount = topics.filter(t => t.status === 'COMPLETED').length;

                      return (
                        <div
                          key={ch.id}
                          style={{
                            background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0',
                            overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{
                            padding: '14px 18px', background: isCompleted ? '#f0fdf4' : '#f8fafc',
                            borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                width: '28px', height: '28px', borderRadius: '8px',
                                background: isCompleted ? '#16a34a' : isInProgress ? '#0176d3' : '#e2e8f0',
                                color: isCompleted || isInProgress ? '#fff' : '#64748b',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800
                              }}>
                                {ch.chapter_no}
                              </span>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                  {ch.title}
                                </h4>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {doneCount} / {topics.length} Topics Completed • {ch.estimated_periods || 0} Planned Periods
                                </span>
                              </div>
                            </div>

                            <span className={isCompleted ? "badge badge-success" : isInProgress ? "badge badge-info" : "badge badge-neutral"}>
                              {isCompleted ? '✓ Completed' : isInProgress ? 'In Progress' : 'Pending'}
                            </span>
                          </div>

                          <div style={{ padding: '12px 18px' }}>
                            {topics.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                No topics defined for this chapter.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {topics.map(t => {
                                  const isTopDone = t.status === 'COMPLETED';

                                  return (
                                    <div
                                      key={t.id}
                                      style={{
                                        padding: '8px 12px', borderRadius: '8px',
                                        background: isTopDone ? '#f0fdf4' : '#ffffff',
                                        border: isTopDone ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i
                                          className={isTopDone ? 'ti ti-circle-check-filled' : 'ti ti-circle'}
                                          style={{ color: isTopDone ? '#16a34a' : '#cbd5e1', fontSize: '16px' }}
                                        />
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                          {t.topic_no}. {t.title}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                                          {t.estimated_periods || 1} pd
                                        </span>
                                        {isTopDone && t.actual_completion_date && (
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                                            Done on {t.actual_completion_date}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
      </div>
    </div>
  );
}
