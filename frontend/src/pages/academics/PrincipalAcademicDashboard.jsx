import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import {
  BookOpen, BarChart3, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Award, Calendar, Layers, Users, ShieldAlert, ArrowUpRight,
  Filter, Search, RefreshCw, Printer, ChevronRight, ChevronDown, Check,
  BookMarked, Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, CartesianGrid, Cell, PieChart, Pie
} from 'recharts';
import toast from 'react-hot-toast';

export default function PrincipalAcademicDashboard() {
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
  const fetchDashboard = async () => {
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
  };

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
      planned_periods: s.total_planned_periods || 0,
      actual_periods: s.actual_periods_taught || 0
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
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase">
            <BookMarked className="w-4 h-4" /> Academic Leadership & Monitoring
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Principal Academic & Syllabus Coverage Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Institutional oversight of curriculum progress, planned vs actual teaching periods, and teacher lesson logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg text-sm font-semibold px-3 py-2 shadow-sm text-slate-700"
          >
            <option value="2026-27">Session 2026-27</option>
            <option value="2025-26">Session 2025-26</option>
          </select>

          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white border border-slate-300 px-3 py-2 rounded-lg shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Audit Report
          </button>

          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Critical Lag & Missing Curriculum Alerts */}
      {(dashboardData.critical_alerts || []).length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-xs">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Curriculum Intervention Alerts ({dashboardData.critical_alerts.length})
          </div>
          <div className="mt-2 space-y-1 text-xs text-rose-700">
            {dashboardData.critical_alerts.map((alert, idx) => (
              <p key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <strong>{alert.class_name} - {alert.subject_name}:</strong> Lagging behind by {alert.lag_percentage}% (Taught {alert.actual_periods} of {alert.planned_periods} planned periods).
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Avg School Coverage</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-indigo-700 mt-2">
            {summary.average_school_coverage || 0}%
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Across {summary.total_curriculums || 0} active subjects</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">On Schedule</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">
            {summary.on_track_subjects || 0}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Ahead or on track</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Behind Schedule</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 mt-2">
            {summary.behind_subjects || 0}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Slight syllabus lag</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Critical Lag</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2">
            {summary.critical_subjects || 0}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Immediate action required</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Lessons Logged</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-blue-700 mt-2">
            {summary.total_teaching_logs || 0}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{summary.total_periods_taught || 0} Periods taught</p>
        </div>
      </div>

      {/* Visual Analytics Row: Subject Progress & Class Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subject-Wise Coverage Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Subject Syllabus Coverage %</h3>
              <p className="text-xs text-slate-500">Real-time completion percentage based on planned periods</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No syllabus data available for session {session}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val) => [`${val}%`, 'Coverage']}
                  />
                  <Bar dataKey="coverage" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          entry.coverage >= 75 ? '#10b981' :
                          entry.coverage >= 45 ? '#4f46e5' :
                          entry.coverage >= 25 ? '#f59e0b' : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Class-Wise Progress Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Class-Wise Average Coverage</h3>
              <p className="text-xs text-slate-500">Benchmark across classes</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {classChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No class data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '11px' }}
                    formatter={(val) => [`${val}%`, 'Avg Progress']}
                  />
                  <Bar dataKey="avg_coverage" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Institutional Subjects Coverage Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Institutional Curriculum Progress Register</h3>
            <p className="text-xs text-slate-500">Detailed tracking of all classes, assigned teachers, and syllabus delivery status.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search subject/teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="ON_TRACK">On Track</option>
              <option value="AHEAD">Ahead</option>
              <option value="BEHIND">Behind</option>
              <option value="CRITICAL">Critical Lag</option>
            </select>
          </div>
        </div>

        {/* Master Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Class</th>
                <th className="py-3 px-3">Subject & Book</th>
                <th className="py-3 px-3">Assigned Teacher</th>
                <th className="py-3 px-3">Coverage %</th>
                <th className="py-3 px-3">Planned vs Taught</th>
                <th className="py-3 px-3">Chapters</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Audit Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No curriculums found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub) => {
                  const isSelected = selectedCurriculumId === sub.curriculum_id;
                  const cov = sub.coverage_percentage || 0;

                  return (
                    <tr
                      key={sub.curriculum_id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-indigo-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {sub.class_name}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{sub.subject_name}</div>
                        {sub.book_name && (
                          <div className="text-[11px] text-slate-500">{sub.book_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                        {sub.teacher_name || 'Assigned Teacher'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                cov >= 75 ? 'bg-emerald-500' :
                                cov >= 45 ? 'bg-indigo-600' :
                                cov >= 25 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${cov}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-800">{cov}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-emerald-700">{sub.actual_periods_taught || 0}</span>
                        <span className="text-slate-400"> / {sub.total_planned_periods || 0} pds</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {sub.chapters_count || 0} Chapters
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {sub.status === 'AHEAD' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Ahead</span>
                        )}
                        {sub.status === 'ON_TRACK' && (
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">On Track</span>
                        )}
                        {sub.status === 'BEHIND' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Behind</span>
                        )}
                        {sub.status === 'CRITICAL' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Critical</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedCurriculumId(sub.curriculum_id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-all"
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

      {/* Drilldown Drawer / Inspection Section */}
      {selectedCurriculumId && drilldownData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Inspection & Chapter Verification: {drilldownData.class_name} • {drilldownData.subject_name}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Curriculum Syllabus Execution Breakdown
              </h3>
              {drilldownData.book_name && (
                <p className="text-xs text-slate-500">Prescribed Book: {drilldownData.book_name}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-3xl font-black text-indigo-600">
                  {drilldownData.coverage_percentage || 0}%
                </span>
                <p className="text-[11px] text-slate-400 font-bold uppercase">Syllabus Delivered</p>
              </div>
            </div>
          </div>

          {/* Chapters & Topics Drilldown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drilldownData.chapters?.map((ch) => {
              const isDone = ch.status === 'COMPLETED';
              const topics = ch.topics || [];
              const completedCount = topics.filter(t => t.status === 'COMPLETED').length;

              return (
                <div key={ch.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Chapter {ch.chapter_no}</span>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">{ch.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        {ch.estimated_periods || 0} Planned Periods • {completedCount} / {topics.length} Topics Done
                      </p>
                    </div>
                    {isDone ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        In Progress
                      </span>
                    )}
                  </div>

                  {/* Topics breakdown */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    {topics.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/70"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                            t.status === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                          }`}>
                            {t.status === 'COMPLETED' ? '✓' : ''}
                          </span>
                          <span className={`text-slate-800 ${t.status === 'COMPLETED' ? 'font-semibold' : 'text-slate-600'}`}>
                            {t.topic_no}. {t.title}
                          </span>
                        </div>

                        {t.status === 'COMPLETED' && t.actual_completion_date && (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                            {t.actual_completion_date}
                          </span>
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
  );
}
