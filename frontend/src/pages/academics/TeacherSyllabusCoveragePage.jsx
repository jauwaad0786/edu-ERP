import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  BookOpen, Layers, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  TrendingUp, Calendar, ChevronRight, ChevronDown, Check, ArrowRight,
  Filter, Search, RefreshCw, BarChart2, BookMarked
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherSyllabusCoveragePage() {
  const [session, setSession] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [subjectsCoverage, setSubjectsCoverage] = useState([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch coverage data
  const fetchCoverage = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/curriculum/analytics/summary?session=${session}`);
      const list = res.data.subjects_breakdown || [];
      setSubjectsCoverage(list);

      // Auto-select first subject for drilldown if available
      if (list.length > 0 && !selectedCurriculumId) {
        setSelectedCurriculumId(list[0].curriculum_id);
      }
    } catch (err) {
      console.error('Error fetching coverage summary:', err);
      toast.error('Failed to load syllabus coverage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverage();
  }, [session]);

  // Fetch Drilldown when selectedCurriculumId changes
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
        toast.error('Failed to load detailed chapter breakdown');
      } finally {
        setLoadingDrilldown(false);
      }
    };

    fetchDrilldown();
  }, [selectedCurriculumId]);

  // Aggregate Stats
  const stats = React.useMemo(() => {
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

    return {
      avgCoverage,
      totalPlanned,
      totalTaught,
      onTrackCount,
      behindCount
    };
  }, [subjectsCoverage]);

  // Filtered subjects
  const filteredSubjects = subjectsCoverage.filter(s =>
    (s.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.class_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AHEAD':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Ahead of Schedule</span>;
      case 'ON_TRACK':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">On Track</span>;
      case 'BEHIND':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Behind Schedule</span>;
      case 'CRITICAL':
        return <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Critical Lag</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase">
            <BookMarked className="w-4 h-4" /> Academic Progress Tracking
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">My Syllabus & Curriculum Coverage</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor real-time syllabus completion rates, planned vs actual periods taught, and chapter-wise progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg text-sm font-medium px-3 py-1.5 shadow-sm text-slate-700"
          >
            <option value="2026-27">Session 2026-27</option>
            <option value="2025-26">Session 2025-26</option>
          </select>

          <button
            onClick={fetchCoverage}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white border border-slate-300 px-3 py-2 rounded-lg shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Average Coverage</p>
            <h3 className="text-2xl font-extrabold text-indigo-600 mt-1">
              {stats.avgCoverage}%
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Weighted across all topics</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Periods Taught</p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
              {stats.totalTaught} <span className="text-xs font-normal text-slate-500">/ {stats.totalPlanned}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Actual vs Planned periods</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Subjects On Track</p>
            <h3 className="text-2xl font-extrabold text-blue-600 mt-1">
              {stats.onTrackCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ahead or On schedule</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Needs Attention</p>
            <h3 className={`text-2xl font-extrabold mt-1 ${stats.behindCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {stats.behindCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Lagging behind schedule</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
            stats.behindCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Subjects List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Assigned Subjects</h3>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {filteredSubjects.length} Curriculums
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search subject or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Subject List */}
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                <p className="text-xs text-slate-400 mt-2">Loading subjects...</p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-xs">No subjects match search</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSubjects.map((sub) => {
                  const isSelected = selectedCurriculumId === sub.curriculum_id;
                  const cov = sub.coverage_percentage || 0;

                  return (
                    <div
                      key={sub.curriculum_id}
                      onClick={() => setSelectedCurriculumId(sub.curriculum_id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-300'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {sub.class_name}
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                            {sub.subject_name}
                          </h4>
                          {sub.book_name && (
                            <p className="text-[11px] text-slate-400">Book: {sub.book_name}</p>
                          )}
                        </div>
                        {getStatusBadge(sub.status)}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-semibold mb-1">
                          <span className="text-slate-600">Syllabus Coverage</span>
                          <span className="text-indigo-700">{cov}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              cov >= 75 ? 'bg-emerald-500' :
                              cov >= 45 ? 'bg-indigo-600' :
                              cov >= 25 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${cov}%` }}
                          />
                        </div>
                      </div>

                      {/* Periods Breakdown */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Chapters: {sub.chapters_count || 0}</span>
                        <span>
                          Periods: <strong className="text-slate-700">{sub.actual_periods_taught || 0}</strong> / {sub.total_planned_periods || 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chapter & Topic Breakdown Drilldown (7 cols) */}
        <div className="lg:col-span-7">
          {loadingDrilldown ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="text-xs text-slate-500 mt-3 font-medium">Loading syllabus breakdown...</p>
            </div>
          ) : !drilldownData ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">Select a subject from the left to view detailed syllabus progress</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
              {/* Drilldown Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    {drilldownData.class_name} • Session {drilldownData.session}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {drilldownData.subject_name}
                  </h3>
                  {drilldownData.book_name && (
                    <p className="text-xs text-slate-500">Prescribed Book: {drilldownData.book_name}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600">
                    {drilldownData.coverage_percentage || 0}%
                  </span>
                  <p className="text-[11px] text-slate-400 font-medium">Total Syllabus Done</p>
                </div>
              </div>

              {/* Chapter Accordion List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Chapter & Topic Breakdown ({drilldownData.chapters?.length || 0} Chapters)
                </h4>

                {(!drilldownData.chapters || drilldownData.chapters.length === 0) ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No chapters defined for this curriculum yet.
                  </div>
                ) : (
                  drilldownData.chapters.map((ch) => {
                    const isCompleted = ch.status === 'COMPLETED';
                    const isInProgress = ch.status === 'IN_PROGRESS';
                    const topics = ch.topics || [];
                    const completedTopicsCount = topics.filter(t => t.status === 'COMPLETED').length;

                    return (
                      <div
                        key={ch.id}
                        className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                      >
                        {/* Chapter Banner */}
                        <div className="p-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isInProgress
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {ch.chapter_no}
                            </span>
                            <div>
                              <h5 className="font-bold text-xs text-slate-900">{ch.title}</h5>
                              <p className="text-[11px] text-slate-500">
                                {topics.length} Topics • {ch.estimated_periods || 0} Planned Periods
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">
                              {completedTopicsCount} / {topics.length} Topics
                            </span>
                            {isCompleted ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Done
                              </span>
                            ) : isInProgress ? (
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                In Progress
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Topics Checklist within Chapter */}
                        <div className="p-3 space-y-1.5 bg-slate-50/40">
                          {topics.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No topics recorded under this chapter.</p>
                          ) : (
                            topics.map((top) => {
                              const isTopDone = top.status === 'COMPLETED';

                              return (
                                <div
                                  key={top.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                      isTopDone
                                        ? 'bg-emerald-600 text-white'
                                        : 'border border-slate-300 text-transparent'
                                    }`}>
                                      ✓
                                    </div>
                                    <span className={`font-medium ${isTopDone ? 'text-slate-800' : 'text-slate-600'}`}>
                                      {top.topic_no}. {top.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <span>{top.estimated_periods || 1} pd</span>
                                    {isTopDone && top.actual_completion_date && (
                                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                                        Completed on {top.actual_completion_date}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
