import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import {
  BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, Plus,
  ChevronRight, Search, Filter, Edit3, Trash2, Printer, Check,
  FileText, Sparkles, ArrowRight, Layers, Users, Award, BookMarked,
  X, RefreshCw, Send, HelpCircle, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const PEDAGOGY_OPTIONS = [
  'Interactive / Discussion',
  'Lecture & Demonstration',
  'Chalk & Board / Problem Solving',
  'Smart Board / Digital Media',
  'Lab Experiment / Practical',
  'Group Activity / Peer Learning',
  'Inquiry & Research',
  'Concept Reinforcement / Revision'
];

const UNDERSTANDING_LEVELS = [
  { value: 'HIGH', label: 'Excellent (Most grasped concept)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  { value: 'MODERATE', label: 'Satisfactory (Needs minor revision)', color: 'text-amber-700 bg-amber-50 border-amber-300' },
  { value: 'NEEDS_REVIEW', label: 'Needs Remedial Support / Re-teaching', color: 'text-rose-700 bg-rose-50 border-rose-300' }
];

export default function TeacherDailyDiaryPage() {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [session, setSession] = useState('2026-27');
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'history' | 'worksheets'
  const [loading, setLoading] = useState(true);

  // Today Schedule & Logs
  const [scheduleData, setScheduleData] = useState({ date: todayStr, schedule: [], summary: {} });

  // Filter / Dropdown state
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Modal State
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [activePeriod, setActivePeriod] = useState(null); // when recording from timetable card
  const [curriculumChapters, setCurriculumChapters] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Diary Entry Form
  const [entryForm, setEntryForm] = useState({
    id: null,
    class_id: '',
    subject_id: '',
    period_no: 1,
    date: todayStr,
    session: '2026-27',
    chapter_id: '',
    topic_id: '',
    subtopic_title: '',
    periods_spent: 1,
    topic_completion_status: 'COMPLETED', // 'COMPLETED' | 'IN_PROGRESS'
    teaching_methodology: 'Interactive / Discussion',
    classwork_summary: '',
    learning_outcomes: '',
    has_homework: false,
    homework_title: '',
    homework_description: '',
    homework_due_date: '',
    has_worksheet: false,
    worksheet_title: '',
    worksheet_description: '',
    worksheet_total_marks: 10,
    worksheet_due_date: '',
    student_understanding_level: 'HIGH',
    remarks_for_tomorrow: ''
  });

  // History Tab states
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    from_date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    to_date: todayStr,
    class_id: '',
    subject_id: ''
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Worksheets Tab
  const [worksheetsList, setWorksheetsList] = useState([]);
  const [loadingWorksheets, setLoadingWorksheets] = useState(false);

  // Load Classes & Subjects for manual entry & filters
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          api.get('/curriculum/classes'),
          api.get('/curriculum/subjects')
        ]);
        setClasses(cRes.data.classes || []);
        setSubjects(sRes.data.subjects || []);
      } catch (err) {
        console.error('Error fetching classes/subjects:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Today's schedule whenever selectedDate changes
  const fetchTodaySchedule = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/curriculum/teaching-diary/today?date=${selectedDate}&session=${session}`);
      setScheduleData(res.data);
    } catch (err) {
      console.error('Error loading schedule:', err);
      toast.error('Failed to load schedule for selected date');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'today') {
      fetchTodaySchedule();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'worksheets') {
      fetchWorksheets();
    }
  }, [selectedDate, session, activeTab]);

  // Fetch Curriculum Chapters when class & subject are selected in modal
  useEffect(() => {
    if (!entryForm.class_id || !entryForm.subject_id) {
      setCurriculumChapters([]);
      setAvailableTopics([]);
      return;
    }

    const fetchChapters = async () => {
      setLoadingChapters(true);
      try {
        const res = await api.get(
          `/curriculum?class_id=${entryForm.class_id}&subject_id=${entryForm.subject_id}&session=${session}`
        );
        const currs = res.data.curriculums || [];
        if (currs.length > 0 && currs[0].chapters) {
          setCurriculumChapters(currs[0].chapters);
          // If chapter already selected, refresh available topics
          if (entryForm.chapter_id) {
            const ch = currs[0].chapters.find(c => c.id === parseInt(entryForm.chapter_id));
            setAvailableTopics(ch ? ch.topics || [] : []);
          }
        } else {
          setCurriculumChapters([]);
          setAvailableTopics([]);
        }
      } catch (err) {
        console.error('Error fetching curriculum chapters:', err);
      } finally {
        setLoadingChapters(false);
      }
    };

    fetchChapters();
  }, [entryForm.class_id, entryForm.subject_id, session]);

  // Handle Chapter change in entry form
  const handleChapterChange = (chapterId) => {
    const chIdNum = parseInt(chapterId);
    const ch = curriculumChapters.find(c => c.id === chIdNum);
    const topics = ch ? ch.topics || [] : [];
    setAvailableTopics(topics);

    setEntryForm(prev => ({
      ...prev,
      chapter_id: chapterId,
      topic_id: '',
      subtopic_title: '',
      learning_outcomes: ch ? (ch.learning_outcomes || '') : prev.learning_outcomes
    }));
  };

  // Handle Topic change in entry form
  const handleTopicChange = (topicId) => {
    const topIdNum = parseInt(topicId);
    const topic = availableTopics.find(t => t.id === topIdNum);
    setEntryForm(prev => ({
      ...prev,
      topic_id: topicId,
      subtopic_title: topic ? topic.title : prev.subtopic_title
    }));
  };

  // Open modal from timetable card
  const handleRecordPeriod = (periodItem) => {
    setActivePeriod(periodItem);
    const existing = periodItem.teaching_log;

    if (existing) {
      setEntryForm({
        id: existing.id,
        class_id: periodItem.class_id,
        subject_id: periodItem.subject_id,
        period_no: periodItem.period_no,
        date: selectedDate,
        session: session,
        chapter_id: existing.chapter_id || '',
        topic_id: existing.topic_id || '',
        subtopic_title: existing.subtopic_title || '',
        periods_spent: existing.periods_spent || 1,
        topic_completion_status: existing.topic_completion_status || 'COMPLETED',
        teaching_methodology: existing.teaching_methodology || 'Interactive / Discussion',
        classwork_summary: existing.classwork_summary || '',
        learning_outcomes: existing.learning_outcomes || '',
        has_homework: existing.has_homework || false,
        homework_title: existing.homework_title || '',
        homework_description: existing.homework_description || '',
        homework_due_date: existing.homework_due_date || '',
        has_worksheet: existing.has_worksheet || false,
        worksheet_title: existing.worksheet ? existing.worksheet.title : '',
        worksheet_description: existing.worksheet ? existing.worksheet.description : '',
        worksheet_total_marks: existing.worksheet ? existing.worksheet.total_marks : 10,
        worksheet_due_date: existing.worksheet ? existing.worksheet.due_date : '',
        student_understanding_level: existing.student_understanding_level || 'HIGH',
        remarks_for_tomorrow: existing.remarks_for_tomorrow || ''
      });
    } else {
      setEntryForm({
        id: null,
        class_id: periodItem.class_id,
        subject_id: periodItem.subject_id,
        period_no: periodItem.period_no,
        date: selectedDate,
        session: session,
        chapter_id: '',
        topic_id: '',
        subtopic_title: '',
        periods_spent: 1,
        topic_completion_status: 'COMPLETED',
        teaching_methodology: 'Interactive / Discussion',
        classwork_summary: '',
        learning_outcomes: '',
        has_homework: false,
        homework_title: '',
        homework_description: '',
        homework_due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        has_worksheet: false,
        worksheet_title: '',
        worksheet_description: '',
        worksheet_total_marks: 10,
        worksheet_due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        student_understanding_level: 'HIGH',
        remarks_for_tomorrow: ''
      });
    }

    setShowEntryModal(true);
  };

  // Open manual entry modal (unscheduled period / substitution)
  const handleManualEntry = () => {
    setActivePeriod(null);
    setEntryForm({
      id: null,
      class_id: classes.length > 0 ? classes[0].id : '',
      subject_id: subjects.length > 0 ? subjects[0].id : '',
      period_no: 1,
      date: selectedDate,
      session: session,
      chapter_id: '',
      topic_id: '',
      subtopic_title: '',
      periods_spent: 1,
      topic_completion_status: 'COMPLETED',
      teaching_methodology: 'Interactive / Discussion',
      classwork_summary: '',
      learning_outcomes: '',
      has_homework: false,
      homework_title: '',
      homework_description: '',
      homework_due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      has_worksheet: false,
      worksheet_title: '',
      worksheet_description: '',
      worksheet_total_marks: 10,
      worksheet_due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      student_understanding_level: 'HIGH',
      remarks_for_tomorrow: ''
    });
    setShowEntryModal(true);
  };

  // Auto-fill continuation of previous topic taught for this class & subject
  const handleContinuePreviousTopic = async () => {
    if (!entryForm.class_id || !entryForm.subject_id) return;
    try {
      const res = await api.get(
        `/curriculum/teaching-diary/history?class_id=${entryForm.class_id}&subject_id=${entryForm.subject_id}&per_page=1`
      );
      const logs = res.data.logs || [];
      if (logs.length > 0) {
        const last = logs[0];
        setEntryForm(prev => ({
          ...prev,
          chapter_id: last.chapter_id || '',
          topic_id: last.topic_id || '',
          subtopic_title: last.subtopic_title ? `${last.subtopic_title} (Continued)` : '',
          teaching_methodology: last.teaching_methodology || prev.teaching_methodology,
          learning_outcomes: last.learning_outcomes || prev.learning_outcomes
        }));
        toast.success(`Continued from: Chapter ${last.chapter_no || ''} - ${last.subtopic_title || 'Previous topic'}`);
      } else {
        toast('No previous teaching log found for this subject.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error('Error continuing topic:', err);
    }
  };

  // Submit Diary Entry
  const handleSaveEntry = async (saveAndNext = false) => {
    if (!entryForm.class_id || !entryForm.subject_id) {
      toast.error('Please select Class and Subject');
      return;
    }
    if (!entryForm.subtopic_title && !entryForm.topic_id) {
      toast.error('Please select a topic or enter topic/subtopic title');
      return;
    }

    try {
      const payload = {
        ...entryForm,
        class_id: parseInt(entryForm.class_id),
        subject_id: parseInt(entryForm.subject_id),
        period_no: parseInt(entryForm.period_no) || 1,
        periods_spent: parseFloat(entryForm.periods_spent) || 1,
        chapter_id: entryForm.chapter_id ? parseInt(entryForm.chapter_id) : null,
        topic_id: entryForm.topic_id ? parseInt(entryForm.topic_id) : null,
        worksheet_total_marks: entryForm.worksheet_total_marks ? parseInt(entryForm.worksheet_total_marks) : null
      };

      const res = await api.post('/curriculum/teaching-diary/entry', payload);
      toast.success(res.data.message || 'Diary recorded successfully!');

      fetchTodaySchedule();

      if (saveAndNext) {
        // Find next period from schedule
        const currentPeriodNum = parseInt(entryForm.period_no);
        const nextPeriod = scheduleData.schedule.find(p => p.period_no > currentPeriodNum && p.log_status === 'PENDING');
        if (nextPeriod) {
          handleRecordPeriod(nextPeriod);
        } else {
          setShowEntryModal(false);
          toast.success('All scheduled periods for today are now completed! Great job! 🎉');
        }
      } else {
        setShowEntryModal(false);
      }
    } catch (err) {
      console.error('Error saving diary:', err);
      toast.error(err.response?.data?.message || 'Failed to save diary entry');
    }
  };

  // History Tab Fetcher
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({
        start_date: historyFilters.from_date,
        end_date: historyFilters.to_date,
        session: session
      });
      if (historyFilters.class_id) params.append('class_id', historyFilters.class_id);
      if (historyFilters.subject_id) params.append('subject_id', historyFilters.subject_id);

      const res = await api.get(`/curriculum/teaching-diary/history?${params.toString()}`);
      setHistoryLogs(res.data.logs || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Failed to load teaching history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Worksheets Tab Fetcher
  const fetchWorksheets = async () => {
    setLoadingWorksheets(true);
    try {
      const res = await api.get(`/curriculum/teaching-diary/worksheets?session=${session}`);
      setWorksheetsList(res.data.worksheets || []);
    } catch (err) {
      console.error('Error fetching worksheets:', err);
      toast.error('Failed to load worksheets');
    } finally {
      setLoadingWorksheets(false);
    }
  };

  // Print Monthly Register Trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase">
            <BookMarked className="w-4 h-4" /> Teacher Academic Portal
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Daily Teaching Diary & Lesson Log</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Log your daily classroom teaching, curriculum progress, classwork, homework & topic-linked worksheets in under 2 minutes.
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-1.5">
            <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>

          {/* Quick Date Shortcuts */}
          <div className="hidden sm:flex bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedDate === todayStr ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                setSelectedDate(y);
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedDate !== todayStr ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
          </div>

          {/* Session Selector */}
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg text-sm font-medium px-3 py-1.5 shadow-sm text-slate-700"
          >
            <option value="2026-27">Session 2026-27</option>
            <option value="2025-26">Session 2025-26</option>
          </select>

          {/* Unscheduled Extra Period Button */}
          <button
            onClick={handleManualEntry}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all hover:from-indigo-700 hover:to-indigo-800"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Extra Period</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('today')}
            className={`pb-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
              activeTab === 'today'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Today's Schedule & Diary
            {scheduleData.summary?.pending_periods > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                {scheduleData.summary.pending_periods} Pending
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
              activeTab === 'history'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Teaching History & Register
          </button>

          <button
            onClick={() => setActiveTab('worksheets')}
            className={`pb-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
              activeTab === 'worksheets'
                ? 'text-indigo-600 border-b-2 border-indigo-600 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Topic Worksheets & Homework
          </button>
        </div>

        {activeTab === 'history' && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-300 px-3 py-1.5 rounded-md shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Monthly Diary
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TODAY'S SCHEDULE & DIARY CARDS */}
      {/* ========================================================================= */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Total Periods Today</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">
                  {scheduleData.summary?.total_scheduled_periods || 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Teaching Recorded</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  {scheduleData.summary?.recorded_periods || 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Update Pending</p>
                <h3 className={`text-2xl font-bold mt-1 ${scheduleData.summary?.pending_periods > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {scheduleData.summary?.pending_periods || 0}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                scheduleData.summary?.pending_periods > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
              }`}>
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Diary Status</p>
                <h3 className="text-lg font-bold text-slate-700 mt-1">
                  {scheduleData.summary?.all_periods_completed ? (
                    <span className="text-emerald-600 flex items-center gap-1 text-sm font-semibold">
                      ✓ All Complete
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 text-sm font-semibold">
                      Action Required
                    </span>
                  )}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Schedule Timeline Header */}
          <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-xs text-slate-500">
                  Select any period card below to record your topic, pedagogy, classwork & homework.
                </p>
              </div>
            </div>
            <button
              onClick={fetchTodaySchedule}
              className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Periods List Cards */}
          {loading ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-500 font-medium">Loading today's teaching periods...</p>
            </div>
          ) : scheduleData.schedule.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Timetable Periods Scheduled</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
                No regular timetable periods found for your account on this day. If you took an extra, substitution, or elective class, click below to record it!
              </p>
              <button
                onClick={handleManualEntry}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-5 py-2.5 rounded-lg shadow transition-all"
              >
                <Plus className="w-4 h-4" /> Record Extra / Substitution Class
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduleData.schedule.map((period) => {
                const isRecorded = period.log_status === 'RECORDED';
                const log = period.teaching_log;

                return (
                  <div
                    key={period.period_no}
                    className={`rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      isRecorded
                        ? 'bg-white border-emerald-200 shadow-sm hover:border-emerald-300'
                        : 'bg-white border-amber-300/80 shadow-md ring-1 ring-amber-200 hover:shadow-lg'
                    }`}
                  >
                    {/* Period Card Header */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Period {period.period_no}
                          {period.time && <span className="font-normal text-slate-500">({period.time})</span>}
                        </span>

                        {isRecorded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3 h-3" /> Recorded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Update Required
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                          {period.subject_name}
                          <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {period.class_name}
                          </span>
                        </h4>
                        {period.room && (
                          <p className="text-xs text-slate-400 mt-0.5">Room: {period.room}</p>
                        )}
                      </div>
                    </div>

                    {/* Period Card Body */}
                    <div className="p-4 flex-1">
                      {isRecorded && log ? (
                        <div className="space-y-2.5 text-xs text-slate-600">
                          {/* Chapter & Topic */}
                          <div>
                            <span className="font-semibold text-slate-700">Chapter & Topic:</span>
                            <p className="text-slate-900 font-medium mt-0.5 line-clamp-2">
                              {log.chapter_title ? `${log.chapter_title}: ` : ''}
                              {log.subtopic_title || log.topic_title || 'Topic Recorded'}
                            </p>
                          </div>

                          {/* Pedagogy */}
                          {log.teaching_methodology && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <span className="text-slate-400">Method:</span>
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                {log.teaching_methodology}
                              </span>
                            </div>
                          )}

                          {/* Classwork / HW Tags */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {log.classwork_summary && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200/60">
                                ✓ Classwork Done
                              </span>
                            )}
                            {log.has_homework && (
                              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium border border-purple-200/60">
                                📝 HW Given
                              </span>
                            )}
                            {log.has_worksheet && (
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200/60">
                                📑 Worksheet
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-xs text-slate-500">
                            Class finished? Take 60 seconds to log today's lesson topics and assigned tasks.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Period Card Footer Action */}
                    <div className="p-3 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                      {isRecorded ? (
                        <button
                          onClick={() => handleRecordPeriod(period)}
                          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 py-1.5 rounded-lg hover:bg-indigo-50/60 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> View / Edit Entry
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRecordPeriod(period)}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg shadow-sm transition-all"
                        >
                          <Plus className="w-4 h-4" /> Record Diary Entry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEACHING HISTORY & REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          {/* History Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">From Date</label>
              <input
                type="date"
                value={historyFilters.from_date}
                onChange={(e) => setHistoryFilters(prev => ({ ...prev, from_date: e.target.value }))}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={historyFilters.to_date}
                onChange={(e) => setHistoryFilters(prev => ({ ...prev, to_date: e.target.value }))}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Class Filter</label>
              <select
                value={historyFilters.class_id}
                onChange={(e) => setHistoryFilters(prev => ({ ...prev, class_id: e.target.value }))}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Subject Filter</label>
              <div className="flex gap-2">
                <select
                  value={historyFilters.subject_id}
                  onChange={(e) => setHistoryFilters(prev => ({ ...prev, subject_id: e.target.value }))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  onClick={fetchHistory}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* History Table */}
          {loadingHistory ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="text-xs text-slate-500 mt-2">Loading diary history...</p>
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No teaching diary logs found matching criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Period</th>
                    <th className="py-3 px-3">Class & Subject</th>
                    <th className="py-3 px-3">Chapter & Topic</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Classwork & Pedagogy</th>
                    <th className="py-3 px-3">HW / Worksheet</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="py-3 px-3 font-bold text-indigo-700 whitespace-nowrap">
                        P-{item.period_no}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.subject_name}</div>
                        <div className="text-slate-500 text-[11px]">{item.class_name}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-900 truncate">
                          {item.chapter_title ? `${item.chapter_no ? `Ch ${item.chapter_no}: ` : ''}${item.chapter_title}` : 'General Lesson'}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {item.subtopic_title || item.topic_title || 'Class Instruction'}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.topic_completion_status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="text-slate-800 truncate">{item.classwork_summary || 'Class instruction delivered'}</div>
                        <div className="text-slate-400 text-[11px] italic">{item.teaching_methodology}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {item.has_homework && (
                            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              HW
                            </span>
                          )}
                          {item.has_worksheet && (
                            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              WS
                            </span>
                          )}
                          {!item.has_homework && !item.has_worksheet && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEntryForm({
                              id: item.id,
                              class_id: item.class_id,
                              subject_id: item.subject_id,
                              period_no: item.period_no,
                              date: item.date,
                              session: session,
                              chapter_id: item.chapter_id || '',
                              topic_id: item.topic_id || '',
                              subtopic_title: item.subtopic_title || '',
                              periods_spent: item.periods_spent || 1,
                              topic_completion_status: item.topic_completion_status || 'COMPLETED',
                              teaching_methodology: item.teaching_methodology || 'Interactive / Discussion',
                              classwork_summary: item.classwork_summary || '',
                              learning_outcomes: item.learning_outcomes || '',
                              has_homework: item.has_homework || false,
                              homework_title: item.homework_title || '',
                              homework_description: item.homework_description || '',
                              homework_due_date: item.homework_due_date || '',
                              has_worksheet: item.has_worksheet || false,
                              worksheet_title: item.worksheet ? item.worksheet.title : '',
                              worksheet_description: item.worksheet ? item.worksheet.description : '',
                              worksheet_total_marks: item.worksheet ? item.worksheet.total_marks : 10,
                              worksheet_due_date: item.worksheet ? item.worksheet.due_date : '',
                              student_understanding_level: item.student_understanding_level || 'HIGH',
                              remarks_for_tomorrow: item.remarks_for_tomorrow || ''
                            });
                            setShowEntryModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-bold hover:underline"
                        >
                          Edit
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

      {/* ========================================================================= */}
      {/* TAB 3: TOPIC-LINKED WORKSHEETS REPOSITORY */}
      {/* ========================================================================= */}
      {activeTab === 'worksheets' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-800">Topic-Specific Worksheets & Practice Assignments</h3>
              <p className="text-xs text-slate-500">All worksheets issued during daily teaching, strictly linked to chapters & topics.</p>
            </div>
            <button
              onClick={fetchWorksheets}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingWorksheets ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="text-xs text-slate-500 mt-2">Loading worksheets...</p>
            </div>
          ) : worksheetsList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No worksheets have been issued yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Toggle "Give Worksheet / Activity" when logging any period entry to create a topic-linked worksheet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {worksheetsList.map((ws) => (
                <div key={ws.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {ws.subject_name} ({ws.class_name})
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-1.5">{ws.title}</h4>
                    </div>
                    {ws.total_marks && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        {ws.total_marks} Marks
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {ws.description || 'Practice worksheet assigned to reinforce classroom concept.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                    <div>
                      <span className="font-semibold text-slate-700">Topic:</span> {ws.topic_title || 'General Chapter Task'}
                    </div>
                    {ws.due_date && (
                      <div className="text-rose-600 font-medium">
                        Due Date: {ws.due_date}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FAST 1-2 MIN DIARY ENTRY MODAL */}
      {/* ========================================================================= */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> 2-Minute Quick Lesson Entry
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {entryForm.id ? 'Edit Daily Teaching Log' : 'Record Teaching Diary Entry'}
                </h3>
              </div>
              <button
                onClick={() => setShowEntryModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Row 1: Target Class, Subject, Period, Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Class *</label>
                  <select
                    value={entryForm.class_id}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, class_id: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject *</label>
                  <select
                    value={entryForm.subject_id}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, subject_id: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Period # *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={entryForm.period_no}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, period_no: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Fast Action: Continue Previous Topic */}
              <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 px-3 py-2 rounded-lg">
                <span className="text-indigo-900 font-medium text-xs">
                  Already taught this class recently?
                </span>
                <button
                  type="button"
                  onClick={handleContinuePreviousTopic}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1 rounded-md shadow-xs flex items-center gap-1"
                >
                  <ArrowRight className="w-3 h-3" /> Continue Previous Topic
                </button>
              </div>

              {/* Row 2: Curriculum Chapter & Topic Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Curriculum Chapter
                    {loadingChapters && <span className="ml-2 font-normal text-indigo-600">Loading...</span>}
                  </label>
                  <select
                    value={entryForm.chapter_id}
                    onChange={(e) => handleChapterChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                  >
                    <option value="">-- Choose Chapter --</option>
                    {curriculumChapters.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        Ch {ch.chapter_no}: {ch.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Syllabus Topic</label>
                  <select
                    value={entryForm.topic_id}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800"
                    disabled={availableTopics.length === 0}
                  >
                    <option value="">-- Choose Topic --</option>
                    {availableTopics.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.topic_no}. {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Subtopic or Custom Title */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Specific Topic / Lesson Focus Taught Today *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Solving Quadratic Equations by Factorization Method (Ex 4.2)"
                  value={entryForm.subtopic_title}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, subtopic_title: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900 placeholder:font-normal"
                />
              </div>

              {/* Row 4: Status & Periods Spent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Topic Completion Status *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryForm(prev => ({ ...prev, topic_completion_status: 'COMPLETED' }))}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        entryForm.topic_completion_status === 'COMPLETED'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> Completed Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryForm(prev => ({ ...prev, topic_completion_status: 'IN_PROGRESS' }))}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        entryForm.topic_completion_status === 'IN_PROGRESS'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" /> In Progress (Partial)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Marking 'Completed Today' advances the subject's curriculum coverage percentage.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Periods Spent on Topic *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={entryForm.periods_spent}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, periods_spent: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Default 1 period. Adjust if double-period or fractional lesson.
                  </p>
                </div>
              </div>

              {/* Row 5: Teaching Methodology (Pill Buttons) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Teaching Methodology / Pedagogy Used
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PEDAGOGY_OPTIONS.map((method) => {
                    const isSelected = entryForm.teaching_methodology === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setEntryForm(prev => ({ ...prev, teaching_methodology: method }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 6: Classwork Summary */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Classwork Done (Key problems, notes, exercise numbers)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Explained factoring principles; students solved Ex 4.2 Q1 to Q5 on blackboard and notebooks."
                  value={entryForm.classwork_summary}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, classwork_summary: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              {/* Row 7: Homework Toggle Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hw_check"
                      checked={entryForm.has_homework}
                      onChange={(e) => setEntryForm(prev => ({ ...prev, has_homework: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="hw_check" className="font-bold text-slate-800 cursor-pointer text-xs">
                      Assign Homework for Today's Lesson
                    </label>
                  </div>
                  {entryForm.has_homework && (
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>

                {entryForm.has_homework && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Homework Description *</label>
                      <input
                        type="text"
                        placeholder="e.g., Complete Ex 4.2 Questions 6, 7 & 8; write formula summary"
                        value={entryForm.homework_description}
                        onChange={(e) => setEntryForm(prev => ({ ...prev, homework_description: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Submission Due Date</label>
                      <input
                        type="date"
                        value={entryForm.homework_due_date}
                        onChange={(e) => setEntryForm(prev => ({ ...prev, homework_due_date: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 8: Topic-Linked Worksheet Toggle Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ws_check"
                      checked={entryForm.has_worksheet}
                      onChange={(e) => setEntryForm(prev => ({ ...prev, has_worksheet: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="ws_check" className="font-bold text-slate-800 cursor-pointer text-xs">
                      Issue Topic-Linked Worksheet / Activity
                    </label>
                  </div>
                  {entryForm.has_worksheet && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Linked to Topic
                    </span>
                  )}
                </div>

                {entryForm.has_worksheet && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Worksheet Title *</label>
                      <input
                        type="text"
                        placeholder="e.g., Worksheet 3: Quadratic Factorization Drills"
                        value={entryForm.worksheet_title}
                        onChange={(e) => setEntryForm(prev => ({ ...prev, worksheet_title: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Max Marks (Optional)</label>
                      <input
                        type="number"
                        value={entryForm.worksheet_total_marks}
                        onChange={(e) => setEntryForm(prev => ({ ...prev, worksheet_total_marks: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-slate-700 mb-1">Instructions / Description</label>
                      <input
                        type="text"
                        placeholder="e.g., 10 multiple-choice & 3 short answer questions. Self-check on Monday."
                        value={entryForm.worksheet_description}
                        onChange={(e) => setEntryForm(prev => ({ ...prev, worksheet_description: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 9: Learning Outcomes & Understanding Check */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Student Understanding Level (Quick Evaluation)
                  </label>
                  <select
                    value={entryForm.student_understanding_level}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, student_understanding_level: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    {UNDERSTANDING_LEVELS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Plan / Objective for Next Period
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Continue with Nature of Roots & Discriminant (Ex 4.3)"
                    value={entryForm.remarks_for_tomorrow}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, remarks_for_tomorrow: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveEntry(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save & Next Period
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEntry(false)}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
