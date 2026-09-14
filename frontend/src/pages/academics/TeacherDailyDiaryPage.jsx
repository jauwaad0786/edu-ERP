import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
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
  { value: 'HIGH', label: 'Excellent (Most grasped concept)' },
  { value: 'MODERATE', label: 'Satisfactory (Needs minor revision)' },
  { value: 'NEEDS_REVIEW', label: 'Needs Remedial Support / Re-teaching' }
];

export default function TeacherDailyDiaryPage() {
  const navigate = useNavigate();
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
  const [activePeriod, setActivePeriod] = useState(null);
  const [curriculumChapters, setCurriculumChapters] = useState([]);
  const [availableTopics, setAvailableTopics] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    topic_completion_status: 'COMPLETED',
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

  // Load Classes & Subjects
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

  // Fetch Today's schedule
  const fetchTodaySchedule = useCallback(async () => {
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
  }, [selectedDate, session]);

  // History Tab Fetcher
  const fetchHistory = useCallback(async () => {
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
  }, [historyFilters, session]);

  // Worksheets Tab Fetcher
  const fetchWorksheets = useCallback(async () => {
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
  }, [session]);

  useEffect(() => {
    if (activeTab === 'today') {
      fetchTodaySchedule();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'worksheets') {
      fetchWorksheets();
    }
  }, [selectedDate, session, activeTab, fetchTodaySchedule, fetchHistory, fetchWorksheets]);

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

  // Auto-fill continuation of previous topic
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
      toast.error('Please select a topic or enter lesson focus');
      return;
    }

    setSubmitting(true);
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
      toast.success(res.data.message || 'Teaching log saved successfully!');

      fetchTodaySchedule();

      if (saveAndNext) {
        const currentPeriodNum = parseInt(entryForm.period_no);
        const nextPeriod = scheduleData.schedule.find(p => p.period_no > currentPeriodNum && p.log_status === 'PENDING');
        if (nextPeriod) {
          handleRecordPeriod(nextPeriod);
        } else {
          setShowEntryModal(false);
          toast.success('All scheduled periods for today are now completed! 🎉');
        }
      } else {
        setShowEntryModal(false);
      }
    } catch (err) {
      console.error('Error saving diary:', err);
      toast.error(err.response?.data?.message || 'Failed to save diary entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Teacher Daily Teaching Diary" />

        <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px' }}>
          {/* ══ HEADER & TOOLBAR ══ */}
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
                  ● 1P360 Teacher Diary
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{session}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                Daily Teaching Diary &amp; Lesson Log
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Log your daily lessons, classwork, homework, and topic-linked worksheets in under 2 minutes.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Date Input */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '4px 12px', gap: '8px' }}>
                <i className="ti ti-calendar" style={{ color: '#0176d3' }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                />
              </div>

              {/* Quick Jump Buttons */}
              <div style={{ display: 'flex', background: '#e2e8f0', padding: '3px', borderRadius: '10px', gap: '2px' }}>
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  style={{
                    border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: selectedDate === todayStr ? '#fff' : 'transparent',
                    color: selectedDate === todayStr ? '#0176d3' : '#64748b',
                    boxShadow: selectedDate === todayStr ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    setSelectedDate(y);
                  }}
                  style={{
                    border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: selectedDate !== todayStr ? '#fff' : 'transparent',
                    color: selectedDate !== todayStr ? '#0176d3' : '#64748b',
                    boxShadow: selectedDate !== todayStr ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Yesterday
                </button>
              </div>

              {/* Session Selector */}
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="form-select"
                style={{ width: '150px', fontWeight: 700, borderRadius: '10px' }}
              >
                <option value="2026-27">Session 2026-27</option>
                <option value="2025-26">Session 2025-26</option>
              </select>

              {/* Record Extra Period Button */}
              <button
                onClick={handleManualEntry}
                className="btn btn-primary"
                style={{
                  borderRadius: '10px', padding: '10px 16px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(1,118,211,0.25)'
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: '16px' }} />
                Record Extra Period
              </button>
            </div>
          </div>

          {/* ══ TABS NAVIGATION ══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', marginBottom: '22px' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <button
                onClick={() => setActiveTab('today')}
                style={{
                  padding: '0 0 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                  color: activeTab === 'today' ? '#0176d3' : '#64748b',
                  borderBottom: activeTab === 'today' ? '2px solid #0176d3' : '2px solid transparent'
                }}
              >
                <i className="ti ti-clock" />
                Today's Schedule &amp; Diary
                {scheduleData.summary?.pending_periods > 0 && (
                  <span style={{
                    background: '#fef3c7', color: '#d97706', fontSize: '11px',
                    fontWeight: 800, padding: '2px 8px', borderRadius: '100px'
                  }}>
                    {scheduleData.summary.pending_periods} Pending
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '0 0 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                  color: activeTab === 'history' ? '#0176d3' : '#64748b',
                  borderBottom: activeTab === 'history' ? '2px solid #0176d3' : '2px solid transparent'
                }}
              >
                <i className="ti ti-file-text" />
                Teaching History &amp; Register
              </button>

              <button
                onClick={() => setActiveTab('worksheets')}
                style={{
                  padding: '0 0 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
                  color: activeTab === 'worksheets' ? '#0176d3' : '#64748b',
                  borderBottom: activeTab === 'worksheets' ? '2px solid #0176d3' : '2px solid transparent'
                }}
              >
                <i className="ti ti-layers-subtract" />
                Topic Worksheets &amp; Homework
              </button>
            </div>

            {activeTab === 'history' && (
              <button
                onClick={() => window.print()}
                className="btn btn-neutral btn-sm"
                style={{ borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ti ti-printer" /> Print Monthly Register
              </button>
            )}
          </div>

          {/* ══ TAB 1: TODAY'S SCHEDULE & CARDS ══ */}
          {activeTab === 'today' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOTAL PERIODS TODAY</span>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-clock" style={{ fontSize: '18px' }} />
                    </span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
                    {scheduleData.summary?.total_scheduled_periods || 0}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Scheduled on timetable</p>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TEACHING RECORDED</span>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-check" style={{ fontSize: '18px' }} />
                    </span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>
                    {scheduleData.summary?.recorded_periods || 0}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Lessons logged in diary</p>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PENDING ENTRIES</span>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-alert-triangle" style={{ fontSize: '18px' }} />
                    </span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: scheduleData.summary?.pending_periods > 0 ? '#d97706' : '#94a3b8' }}>
                    {scheduleData.summary?.pending_periods || 0}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Requires teacher update</p>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>DIARY COMPLETION</span>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-notes" style={{ fontSize: '18px' }} />
                    </span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: scheduleData.summary?.all_periods_completed ? '#059669' : '#d97706', marginTop: '6px' }}>
                    {scheduleData.summary?.all_periods_completed ? '✓ Complete' : 'Action Needed'}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>For {selectedDate}</p>
                </div>
              </div>

              {/* Periods List */}
              {loading ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
                  <i className="ti ti-loader animate-spin" style={{ fontSize: '32px', color: '#0176d3' }} />
                  <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Loading today's periods...</p>
                </div>
              ) : scheduleData.schedule.length === 0 ? (
                <div style={{
                  background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
                  padding: '64px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: '#94a3b8'
                  }}>
                    <i className="ti ti-calendar-off" style={{ fontSize: '32px' }} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>
                    No Timetable Periods Found For This Date
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px' }}>
                    If you took a substitution, special remedial, or elective class, record it manually below.
                  </p>
                  <button
                    onClick={handleManualEntry}
                    className="btn btn-primary"
                    style={{ borderRadius: '10px', padding: '10px 20px', fontWeight: 800 }}
                  >
                    <i className="ti ti-plus" /> Record Extra Period
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {scheduleData.schedule.map((period) => {
                    const isRecorded = period.log_status === 'RECORDED';
                    const log = period.teaching_log;

                    return (
                      <div
                        key={period.period_no}
                        style={{
                          background: '#ffffff', borderRadius: '16px',
                          border: isRecorded ? '1px solid #bbf7d0' : '1px solid #fde68a',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                        }}
                      >
                        {/* Header */}
                        <div style={{
                          padding: '16px 18px',
                          background: isRecorded ? '#f0fdf4' : '#fffbeb',
                          borderBottom: isRecorded ? '1px solid #bbf7d0' : '1px solid #fde68a',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                        }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                              Period {period.period_no} {period.time && `(${period.time})`}
                            </span>
                            <h3 style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>
                              {period.subject_name}
                            </h3>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0176d3' }}>
                              {period.class_name} {period.room && `• Room ${period.room}`}
                            </span>
                          </div>

                          <span style={{
                            fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '100px',
                            background: isRecorded ? '#dcfce7' : '#fef3c7',
                            color: isRecorded ? '#15803d' : '#b45309',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            <i className={isRecorded ? 'ti ti-check' : 'ti ti-alert-triangle'} />
                            {isRecorded ? 'Recorded' : 'Update Required'}
                          </span>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '16px 18px', flex: 1 }}>
                          {isRecorded && log ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569' }}>
                              <div>
                                <strong style={{ color: '#0f172a' }}>Lesson / Topic:</strong>
                                <div style={{ color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
                                  {log.subtopic_title || log.topic_title || 'General Lesson'}
                                </div>
                              </div>

                              {log.classwork_summary && (
                                <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Classwork: </span>
                                  {log.classwork_summary}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {log.has_homework && (
                                  <span style={{ background: '#f3e8ff', color: '#7e22ce', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                                    📝 HW Assigned
                                  </span>
                                )}
                                {log.has_worksheet && (
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                                    📑 Worksheet
                                  </span>
                                )}
                                {log.teaching_methodology && (
                                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                                    {log.teaching_methodology}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                              Teaching log pending for this period. Click below to record in 1-2 minutes.
                            </p>
                          )}
                        </div>

                        {/* Footer Action */}
                        <div style={{ padding: '12px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button
                            onClick={() => handleRecordPeriod(period)}
                            className={isRecorded ? "btn btn-neutral btn-sm" : "btn btn-primary btn-sm"}
                            style={{ width: '100%', borderRadius: '8px', fontWeight: 800, justifyContent: 'center' }}
                          >
                            <i className={isRecorded ? "ti ti-edit" : "ti ti-plus"} />
                            {isRecorded ? 'View / Edit Entry' : 'Record Diary Entry'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ TAB 2: TEACHING HISTORY ══ */}
          {activeTab === 'history' && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              {/* Filter bar */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ minWidth: '140px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>From Date</label>
                  <input
                    type="date"
                    value={historyFilters.from_date}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, from_date: e.target.value })}
                    className="form-input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                </div>
                <div style={{ minWidth: '140px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>To Date</label>
                  <input
                    type="date"
                    value={historyFilters.to_date}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, to_date: e.target.value })}
                    className="form-input"
                    style={{ height: '32px', fontSize: '12px' }}
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Class</label>
                  <select
                    value={historyFilters.class_id}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, class_id: e.target.value })}
                    className="form-select"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Subject</label>
                  <select
                    value={historyFilters.subject_id}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, subject_id: e.target.value })}
                    className="form-select"
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    <option value="">All Subjects</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={fetchHistory} className="btn btn-primary btn-sm" style={{ height: '32px', fontWeight: 700 }}>
                    <i className="ti ti-search" /> Filter
                  </button>
                </div>
              </div>

              {/* History Table */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Period</th>
                      <th>Class &amp; Subject</th>
                      <th>Chapter &amp; Topic</th>
                      <th>Status</th>
                      <th>Classwork / Homework</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHistory ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                          <i className="ti ti-loader animate-spin" /> Loading logs...
                        </td>
                      </tr>
                    ) : historyLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No teaching diary entries found matching filters.
                        </td>
                      </tr>
                    ) : (
                      historyLogs.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700 }}>{item.date}</td>
                          <td><span className="badge badge-info">P-{item.period_no}</span></td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{item.subject_name}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{item.class_name}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {item.chapter_title ? `Ch ${item.chapter_no}: ${item.chapter_title}` : 'General Lesson'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {item.subtopic_title || item.topic_title || '-'}
                            </div>
                          </td>
                          <td>
                            <span className={item.topic_completion_status === 'COMPLETED' ? "badge badge-success" : "badge badge-warning"}>
                              {item.topic_completion_status}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', color: '#334155' }}>{item.classwork_summary || '-'}</div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                              {item.has_homework && <span className="badge" style={{ background: '#f3e8ff', color: '#7e22ce' }}>HW</span>}
                              {item.has_worksheet && <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>WS</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
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
                              className="btn btn-neutral btn-sm"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ TAB 3: TOPIC WORKSHEETS ══ */}
          {activeTab === 'worksheets' && (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Topic-Linked Practice Worksheets
                </h3>
                <button onClick={fetchWorksheets} className="btn btn-neutral btn-sm">
                  <i className="ti ti-refresh" /> Refresh
                </button>
              </div>

              {loadingWorksheets ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><i className="ti ti-loader animate-spin" /> Loading worksheets...</div>
              ) : worksheetsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No topic worksheets issued yet. Enable "Issue Worksheet" when logging any period entry.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {worksheetsList.map(ws => (
                    <div key={ws.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0176d3', textTransform: 'uppercase' }}>
                            {ws.subject_name} ({ws.class_name})
                          </span>
                          <h4 style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                            {ws.title}
                          </h4>
                        </div>
                        {ws.total_marks && (
                          <span className="badge badge-warning">{ws.total_marks} Marks</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#475569', margin: '8px 0' }}>
                        {ws.description || 'Topic reinforcement exercise.'}
                      </p>
                      <div style={{ fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                        Topic: <strong>{ws.topic_title || 'General Lesson'}</strong>
                        {ws.due_date && <div style={{ color: '#dc2626', marginTop: '2px' }}>Due: {ws.due_date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ FAST 1-2 MIN ENTRY MODAL ══ */}
          {showEntryModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '680px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{ padding: '16px 20px', background: '#0176d3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                      ⚡ 2-Minute Lesson Entry
                    </span>
                    <h3 style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: 900 }}>
                      {entryForm.id ? 'Edit Daily Teaching Diary Log' : 'Record Daily Teaching Diary Entry'}
                    </h3>
                  </div>
                  <button onClick={() => setShowEntryModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                  </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Row 1: Target Meta */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Class *</label>
                      <select
                        value={entryForm.class_id}
                        onChange={(e) => setEntryForm({ ...entryForm, class_id: e.target.value })}
                        className="form-select"
                        style={{ height: '34px', fontSize: '12px' }}
                      >
                        <option value="">Select</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Subject *</label>
                      <select
                        value={entryForm.subject_id}
                        onChange={(e) => setEntryForm({ ...entryForm, subject_id: e.target.value })}
                        className="form-select"
                        style={{ height: '34px', fontSize: '12px' }}
                      >
                        <option value="">Select</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Period # *</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={entryForm.period_no}
                        onChange={(e) => setEntryForm({ ...entryForm, period_no: e.target.value })}
                        className="form-input"
                        style={{ height: '34px', fontSize: '12px' }}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Date *</label>
                      <input
                        type="date"
                        value={entryForm.date}
                        onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                        className="form-input"
                        style={{ height: '34px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  {/* Fast Continuation Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f9ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 600 }}>Taught this class recently?</span>
                    <button
                      type="button"
                      onClick={handleContinuePreviousTopic}
                      style={{ background: '#fff', border: '1px solid #0284c7', color: '#0284c7', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Continue Previous Topic →
                    </button>
                  </div>

                  {/* Row 2: Curriculum Chapter & Topic */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Curriculum Chapter
                        {loadingChapters && <span style={{ fontSize: '10px', color: '#0176d3', marginLeft: '6px' }}>Loading...</span>}
                      </label>
                      <select
                        value={entryForm.chapter_id}
                        onChange={(e) => handleChapterChange(e.target.value)}
                        className="form-select"
                      >
                        <option value="">-- Choose Chapter --</option>
                        {curriculumChapters.map(ch => (
                          <option key={ch.id} value={ch.id}>Ch {ch.chapter_no}: {ch.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Syllabus Topic</label>
                      <select
                        value={entryForm.topic_id}
                        onChange={(e) => handleTopicChange(e.target.value)}
                        className="form-select"
                        disabled={availableTopics.length === 0}
                      >
                        <option value="">-- Choose Topic --</option>
                        {availableTopics.map(t => (
                          <option key={t.id} value={t.id}>{t.topic_no}. {t.title} ({t.status})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Subtopic / Title */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Specific Lesson Focus Taught Today *</label>
                    <input
                      type="text"
                      placeholder="e.g. Factorization Method for Quadratic Equations (Exercise 4.2)"
                      value={entryForm.subtopic_title}
                      onChange={(e) => setEntryForm({ ...entryForm, subtopic_title: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Row 4: Status & Periods Spent */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <label className="form-label">Topic Completion Status *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setEntryForm({ ...entryForm, topic_completion_status: 'COMPLETED' })}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                            border: entryForm.topic_completion_status === 'COMPLETED' ? '1px solid #16a34a' : '1px solid #cbd5e1',
                            background: entryForm.topic_completion_status === 'COMPLETED' ? '#16a34a' : '#fff',
                            color: entryForm.topic_completion_status === 'COMPLETED' ? '#fff' : '#475569'
                          }}
                        >
                          ✓ Completed Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryForm({ ...entryForm, topic_completion_status: 'IN_PROGRESS' })}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                            border: entryForm.topic_completion_status === 'IN_PROGRESS' ? '1px solid #d97706' : '1px solid #cbd5e1',
                            background: entryForm.topic_completion_status === 'IN_PROGRESS' ? '#d97706' : '#fff',
                            color: entryForm.topic_completion_status === 'IN_PROGRESS' ? '#fff' : '#475569'
                          }}
                        >
                          ⏳ In Progress
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Periods Spent *</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={entryForm.periods_spent}
                        onChange={(e) => setEntryForm({ ...entryForm, periods_spent: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  {/* Row 5: Pedagogy Pills */}
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Teaching Pedagogy Used</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {PEDAGOGY_OPTIONS.map(method => {
                        const isSel = entryForm.teaching_methodology === method;
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setEntryForm({ ...entryForm, teaching_methodology: method })}
                            style={{
                              padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                              border: isSel ? '1px solid #0176d3' : '1px solid #cbd5e1',
                              background: isSel ? '#0176d3' : '#f8fafc',
                              color: isSel ? '#fff' : '#475569'
                            }}
                          >
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 6: Classwork */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Classwork Summary</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Discussed factoring quadratic roots; solved Ex 4.2 Q1 to Q5"
                      value={entryForm.classwork_summary}
                      onChange={(e) => setEntryForm({ ...entryForm, classwork_summary: e.target.value })}
                      className="form-textarea"
                    />
                  </div>

                  {/* Row 7: Homework Toggle */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#faf5ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#6b21a8' }}>
                        <input
                          type="checkbox"
                          checked={entryForm.has_homework}
                          onChange={(e) => setEntryForm({ ...entryForm, has_homework: e.target.checked })}
                        />
                        Assign Homework
                      </label>
                    </div>

                    {entryForm.has_homework && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '10px' }}>
                        <input
                          type="text"
                          placeholder="e.g. Ex 4.2 Q6, 7 & 8 in notebook"
                          value={entryForm.homework_description}
                          onChange={(e) => setEntryForm({ ...entryForm, homework_description: e.target.value })}
                          className="form-input"
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                        <input
                          type="date"
                          value={entryForm.homework_due_date}
                          onChange={(e) => setEntryForm({ ...entryForm, homework_due_date: e.target.value })}
                          className="form-input"
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 8: Worksheet Toggle */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f0fdf4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                        <input
                          type="checkbox"
                          checked={entryForm.has_worksheet}
                          onChange={(e) => setEntryForm({ ...entryForm, has_worksheet: e.target.checked })}
                        />
                        Issue Topic-Linked Worksheet / Activity
                      </label>
                    </div>

                    {entryForm.has_worksheet && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '10px' }}>
                        <input
                          type="text"
                          placeholder="Worksheet title (e.g. Worksheet 3: Quadratic Drills)"
                          value={entryForm.worksheet_title}
                          onChange={(e) => setEntryForm({ ...entryForm, worksheet_title: e.target.value })}
                          className="form-input"
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          placeholder="Max Marks (10)"
                          value={entryForm.worksheet_total_marks}
                          onChange={(e) => setEntryForm({ ...entryForm, worksheet_total_marks: e.target.value })}
                          className="form-input"
                          style={{ height: '34px', fontSize: '12px' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 9: Evaluation & Tomorrow Plan */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Student Understanding Level</label>
                      <select
                        value={entryForm.student_understanding_level}
                        onChange={(e) => setEntryForm({ ...entryForm, student_understanding_level: e.target.value })}
                        className="form-select"
                      >
                        {UNDERSTANDING_LEVELS.map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Plan For Next Period</label>
                      <input
                        type="text"
                        placeholder="e.g. Continue with Discriminant & Nature of Roots"
                        value={entryForm.remarks_for_tomorrow}
                        onChange={(e) => setEntryForm({ ...entryForm, remarks_for_tomorrow: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" onClick={() => setShowEntryModal(false)} className="btn btn-neutral">
                    Cancel
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSaveEntry(true)}
                      className="btn btn-neutral"
                      style={{ border: '1px solid #16a34a', color: '#16a34a', fontWeight: 700 }}
                    >
                      <i className="ti ti-arrow-right" /> Save &amp; Next Period
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSaveEntry(false)}
                      className="btn btn-primary"
                      style={{ fontWeight: 800 }}
                    >
                      {submitting ? 'Saving...' : 'Save Entry'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
