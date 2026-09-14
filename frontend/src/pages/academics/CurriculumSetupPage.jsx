import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';

export default function CurriculumSetupPage() {
  const [session, setSession] = useState('2026-27');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCurriculum, setActiveCurriculum] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    book_name: '',
    publisher: '',
    book_code: '',
    estimated_periods: 120,
    description: '',
    num_skeleton_chapters: 10,
  });

  const [chapterForm, setChapterForm] = useState({
    id: null,
    chapter_no: 1,
    title: '',
    description: '',
    estimated_periods: 8,
    weightage: 0,
    planned_start_date: '',
    planned_completion_date: '',
    learning_outcomes: '',
  });

  const [selectedChapterForTopic, setSelectedChapterForTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({
    id: null,
    topic_no: 1,
    title: '',
    description: '',
    sub_topics: '',
    estimated_periods: 2,
    learning_objectives: '',
  });

  const [copyTargetSession, setCopyTargetSession] = useState('2027-28');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // ── 1. Initial Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchCurriculums();
  }, [session, selectedClassId, selectedSubjectId]);

  const fetchInitialData = async () => {
    try {
      const clsRes = await api.get('/classes');
      setClasses(clsRes.data || []);
      const subRes = await api.get('/subjects');
      setSubjects(subRes.data || []);
    } catch (err) {
      console.error('Failed to load classes/subjects:', err);
    }
  };

  const fetchCurriculums = async () => {
    setLoading(true);
    try {
      let url = `/curriculum?session=${session}`;
      if (selectedClassId) url += `&class_id=${selectedClassId}`;
      if (selectedSubjectId) url += `&subject_id=${selectedSubjectId}`;
      const res = await api.get(url);
      setCurriculums(res.data || []);
    } catch (err) {
      console.error('Failed to load curriculums:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCurriculumDetails = async (cId) => {
    try {
      const res = await api.get(`/curriculum/${cId}`);
      setActiveCurriculum(res.data);
    } catch (err) {
      console.error('Failed to load curriculum details:', err);
    }
  };

  // ── 2. Create Curriculum with Skeleton Chapters ─────────────────────────────
  const handleCreateCurriculum = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Generate skeleton chapters if requested
      const skeletonChapters = [];
      const numChapters = parseInt(formData.num_skeleton_chapters, 10) || 0;
      const periodsPerCh = Math.max(1, Math.round((parseInt(formData.estimated_periods, 10) || 100) / (numChapters || 1)));

      for (let i = 1; i <= numChapters; i++) {
        skeletonChapters.push({
          chapter_no: i,
          title: `Chapter ${i}`,
          estimated_periods: periodsPerCh,
          description: '',
          learning_outcomes: '',
        });
      }

      const payload = {
        session,
        class_id: parseInt(selectedClassId, 10),
        subject_id: parseInt(selectedSubjectId, 10),
        book_name: formData.book_name,
        publisher: formData.publisher,
        book_code: formData.book_code,
        estimated_periods: parseInt(formData.estimated_periods, 10),
        description: formData.description,
        chapters: skeletonChapters,
      };

      const res = await api.post('/curriculum', payload);
      setSuccessMsg(`Curriculum "${res.data.book_name}" created with ${res.data.chapters?.length || 0} chapters!`);
      setShowAddModal(false);
      fetchCurriculums();
      setActiveCurriculum(res.data);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create curriculum');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 3. Save Chapter ─────────────────────────────────────────────────────────
  const handleSaveChapter = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (chapterForm.id) {
        await api.put(`/curriculum/chapters/${chapterForm.id}`, chapterForm);
      } else {
        await api.post(`/curriculum/${activeCurriculum.id}/chapters`, chapterForm);
      }
      setShowChapterModal(false);
      openCurriculumDetails(activeCurriculum.id);
      fetchCurriculums();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save chapter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (chId) => {
    if (!window.confirm('Are you sure you want to delete this chapter and all its topics?')) return;
    try {
      await api.delete(`/curriculum/chapters/${chId}`);
      openCurriculumDetails(activeCurriculum.id);
      fetchCurriculums();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete chapter');
    }
  };

  // ── 4. Save Topic ───────────────────────────────────────────────────────────
  const handleSaveTopic = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (topicForm.id) {
        await api.put(`/curriculum/topics/${topicForm.id}`, topicForm);
      } else {
        await api.post(`/curriculum/chapters/${selectedChapterForTopic.id}/topics`, topicForm);
      }
      setShowTopicModal(false);
      openCurriculumDetails(activeCurriculum.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save topic');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTopic = async (tpId) => {
    if (!window.confirm('Are you sure you want to delete this topic?')) return;
    try {
      await api.delete(`/curriculum/topics/${tpId}`);
      openCurriculumDetails(activeCurriculum.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete topic');
    }
  };

  // ── 5. Copy Curriculum ──────────────────────────────────────────────────────
  const handleCopyCurriculum = async () => {
    if (!copyTargetSession) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/curriculum/${activeCurriculum.id}/copy-session`, {
        target_session: copyTargetSession,
      });
      setSuccessMsg(res.data.message || 'Curriculum copied successfully!');
      setShowCopyModal(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to copy curriculum');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered subjects based on selected class
  const classSubjects = useMemo(() => {
    if (!selectedClassId) return subjects;
    return subjects.filter((s) => s.class_id === parseInt(selectedClassId, 10));
  }, [selectedClassId, subjects]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans text-slate-900 dark:text-slate-100">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <i className="ti ti-books text-2xl" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Curriculum & Syllabus Management</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Setup books, chapters, topics, and planned periods for session-wise syllabus tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold shadow-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="2026-27">Academic Session 2026-27</option>
            <option value="2025-26">Academic Session 2025-26</option>
            <option value="2027-28">Academic Session 2027-28</option>
          </select>

          <button
            onClick={() => {
              setFormData({
                book_name: '',
                publisher: '',
                book_code: '',
                estimated_periods: 120,
                description: '',
                num_skeleton_chapters: 12,
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
          >
            <i className="ti ti-plus" />
            <span>Setup New Curriculum</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3">
          <i className="ti ti-circle-check text-xl flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-64">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedSubjectId('');
            }}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section ? `- ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Subjects</option>
            {classSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code || 'No Code'})
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-400 font-medium">
          Found <span className="font-bold text-indigo-600 dark:text-indigo-400">{curriculums.length}</span> Curriculums Configured
        </div>
      </div>

      {/* ── Main Layout: Curriculums List & Chapter Details Split ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Curriculums Grid */}
        <div className={activeCurriculum ? 'lg:col-span-5 space-y-4' : 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}>
          {loading ? (
            <div className="col-span-full text-center py-12 text-slate-400">
              <i className="ti ti-loader animate-spin text-3xl mb-2" />
              <p>Loading Curriculums...</p>
            </div>
          ) : curriculums.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-8">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ti ti-book-off text-3xl" />
              </div>
              <h3 className="text-lg font-bold">No Curriculum Configured Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Get started by setting up the syllabus and textbook chapters for this academic session.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow hover:bg-indigo-700"
              >
                + Setup First Curriculum
              </button>
            </div>
          ) : (
            curriculums.map((c) => {
              const isActive = activeCurriculum?.id === c.id;
              const prog = c.progress || {};
              return (
                <div
                  key={c.id}
                  onClick={() => openCurriculumDetails(c.id)}
                  className={`cursor-pointer rounded-2xl border transition-all p-5 shadow-sm relative overflow-hidden ${
                    isActive
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {c.class_name || 'Class'}
                      </span>
                      <h3 className="text-base font-bold mt-1.5 line-clamp-1">{c.subject_name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <i className="ti ti-book text-indigo-500" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{c.book_name}</span>
                        {c.publisher && ` • ${c.publisher}`}
                      </p>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        prog.status === 'ON_TRACK'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : prog.status === 'AHEAD'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                          : prog.status === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      {prog.status?.replace('_', ' ') || 'ON TRACK'}
                    </span>
                  </div>

                  {/* Coverage Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Syllabus Coverage</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{prog.coverage_pct || 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, prog.coverage_pct || 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick stats footer */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">{c.total_chapters || 0}</strong> Chapters
                    </span>
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">{c.estimated_periods || 0}</strong> Planned Periods
                    </span>
                    <span>
                      <strong className="text-slate-700 dark:text-slate-200">{prog.actual_periods_taught || 0}</strong> Taught
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Active Curriculum Chapters & Topics Details */}
        {activeCurriculum && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    {activeCurriculum.class_name}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">Session {activeCurriculum.session}</span>
                </div>
                <h2 className="text-xl font-bold mt-1">{activeCurriculum.subject_name} — Chapters & Topics</h2>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <i className="ti ti-book text-indigo-500" />
                  <strong>{activeCurriculum.book_name}</strong>
                  {activeCurriculum.publisher && <span>({activeCurriculum.publisher})</span>}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  title="Copy book & chapters to next session"
                >
                  <i className="ti ti-copy" />
                  <span>Copy to Next Year</span>
                </button>

                <button
                  onClick={() => {
                    setChapterForm({
                      id: null,
                      chapter_no: (activeCurriculum.chapters?.length || 0) + 1,
                      title: '',
                      description: '',
                      estimated_periods: 8,
                      weightage: 0,
                      planned_start_date: '',
                      planned_completion_date: '',
                      learning_outcomes: '',
                    });
                    setShowChapterModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                >
                  <i className="ti ti-plus" />
                  <span>Add Chapter</span>
                </button>
              </div>
            </div>

            {/* Chapters Accordion / List */}
            <div className="space-y-4">
              {!activeCurriculum.chapters || activeCurriculum.chapters.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <i className="ti ti-folder-off text-3xl mb-2" />
                  <p>No chapters added yet for this book.</p>
                </div>
              ) : (
                activeCurriculum.chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50"
                  >
                    {/* Chapter Header */}
                    <div className="p-4 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                          Ch {ch.chapter_no}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{ch.title}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                            <span>{ch.estimated_periods || 0} Periods Planned</span>
                            <span>•</span>
                            <span>{ch.topics?.length || 0} Topics</span>
                            {ch.planned_start_date && (
                              <>
                                <span>•</span>
                                <span>Target: {ch.planned_start_date} to {ch.planned_completion_date}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            ch.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : ch.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {ch.status?.replace('_', ' ')}
                        </span>

                        <button
                          onClick={() => {
                            setSelectedChapterForTopic(ch);
                            setTopicForm({
                              id: null,
                              topic_no: (ch.topics?.length || 0) + 1,
                              title: '',
                              description: '',
                              sub_topics: '',
                              estimated_periods: 2,
                              learning_objectives: '',
                            });
                            setShowTopicModal(true);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg text-xs"
                          title="Add Topic"
                        >
                          <i className="ti ti-plus" />
                        </button>

                        <button
                          onClick={() => {
                            setChapterForm({
                              id: ch.id,
                              chapter_no: ch.chapter_no,
                              title: ch.title,
                              description: ch.description || '',
                              estimated_periods: ch.estimated_periods || 8,
                              weightage: ch.weightage || 0,
                              planned_start_date: ch.planned_start_date || '',
                              planned_completion_date: ch.planned_completion_date || '',
                              learning_outcomes: ch.learning_outcomes || '',
                            });
                            setShowChapterModal(true);
                          }}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs"
                          title="Edit Chapter"
                        >
                          <i className="ti ti-pencil" />
                        </button>

                        <button
                          onClick={() => handleDeleteChapter(ch.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg text-xs"
                          title="Delete Chapter"
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </div>

                    {/* Topics List */}
                    <div className="p-3 space-y-2">
                      {!ch.topics || ch.topics.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2 pl-3">
                          No topics added for this chapter yet. Click "+" to add topics.
                        </p>
                      ) : (
                        ch.topics.map((tp) => (
                          <div
                            key={tp.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 text-xs hover:border-slate-200 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                                {tp.topic_no}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{tp.title}</span>
                                {tp.learning_objectives && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1">{tp.learning_objectives}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-slate-400">{tp.estimated_periods || 1} Periods</span>
                              <span
                                className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                  tp.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                                    : tp.status === 'IN_PROGRESS'
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {tp.status?.replace('_', ' ')}
                              </span>

                              <button
                                onClick={() => {
                                  setSelectedChapterForTopic(ch);
                                  setTopicForm({
                                    id: tp.id,
                                    topic_no: tp.topic_no,
                                    title: tp.title,
                                    description: tp.description || '',
                                    sub_topics: tp.sub_topics || '',
                                    estimated_periods: tp.estimated_periods || 2,
                                    learning_objectives: tp.learning_objectives || '',
                                  });
                                  setShowTopicModal(true);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <i className="ti ti-pencil" />
                              </button>
                              <button
                                onClick={() => handleDeleteTopic(tp.id)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: SETUP NEW CURRICULUM ──────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <i className="ti ti-book text-indigo-600" />
                <span>Setup Textbook & Curriculum</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="ti ti-x text-xl" />
              </button>
            </div>

            {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleCreateCurriculum} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Class *</label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `- ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Subject *</label>
                  <select
                    required
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  >
                    <option value="">Select Subject</option>
                    {classSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Book / Textbook Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NCERT Mathematics Class 6"
                  value={formData.book_name}
                  onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Publisher (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. NCERT / Oxford"
                    value={formData.publisher}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Book Code / ISBN</label>
                  <input
                    type="text"
                    placeholder="e.g. MTH-06-NCERT"
                    value={formData.book_code}
                    onChange={(e) => setFormData({ ...formData, book_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                    Auto-Generate Chapters
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.num_skeleton_chapters}
                    onChange={(e) => setFormData({ ...formData, num_skeleton_chapters: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-bold"
                  />
                  <span className="text-[10px] text-slate-500">e.g. 14 chapters generated automatically</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                    Total Estimated Periods
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={formData.estimated_periods}
                    onChange={(e) => setFormData({ ...formData, estimated_periods: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-bold"
                  />
                  <span className="text-[10px] text-slate-500">Yearly periods budgeted</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Curriculum & Chapters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT CHAPTER ────────────────────────────────────────── */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-4">
              {chapterForm.id ? `Edit Chapter ${chapterForm.chapter_no}` : 'Add New Chapter'}
            </h3>

            <form onSubmit={handleSaveChapter} className="space-y-3 text-sm">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Ch No *</label>
                  <input
                    type="number"
                    required
                    value={chapterForm.chapter_no}
                    onChange={(e) => setChapterForm({ ...chapterForm, chapter_no: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold mb-1">Chapter Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fractions and Decimals"
                    value={chapterForm.title}
                    onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Estimated Periods *</label>
                  <input
                    type="number"
                    min="1"
                    value={chapterForm.estimated_periods}
                    onChange={(e) => setChapterForm({ ...chapterForm, estimated_periods: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Marks Weightage</label>
                  <input
                    type="number"
                    step="0.5"
                    value={chapterForm.weightage}
                    onChange={(e) => setChapterForm({ ...chapterForm, weightage: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Planned Start Date</label>
                  <input
                    type="date"
                    value={chapterForm.planned_start_date}
                    onChange={(e) => setChapterForm({ ...chapterForm, planned_start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Planned End Date</label>
                  <input
                    type="date"
                    value={chapterForm.planned_completion_date}
                    onChange={(e) => setChapterForm({ ...chapterForm, planned_completion_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Learning Outcomes</label>
                <textarea
                  rows="2"
                  placeholder="Key student learning outcomes for this chapter"
                  value={chapterForm.learning_outcomes}
                  onChange={(e) => setChapterForm({ ...chapterForm, learning_outcomes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700"
                >
                  Save Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT TOPIC ──────────────────────────────────────────── */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-1">
              {topicForm.id ? `Edit Topic ${topicForm.topic_no}` : `Add Topic to Chapter ${selectedChapterForTopic?.chapter_no}`}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{selectedChapterForTopic?.title}</p>

            <form onSubmit={handleSaveTopic} className="space-y-3 text-sm">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Topic #</label>
                  <input
                    type="number"
                    required
                    value={topicForm.topic_no}
                    onChange={(e) => setTopicForm({ ...topicForm, topic_no: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold mb-1">Topic Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Equivalent Fractions"
                    value={topicForm.title}
                    onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Estimated Periods</label>
                <input
                  type="number"
                  min="1"
                  value={topicForm.estimated_periods}
                  onChange={(e) => setTopicForm({ ...topicForm, estimated_periods: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Sub-topics (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Cross multiplication, Simplest form"
                  value={topicForm.sub_topics}
                  onChange={(e) => setTopicForm({ ...topicForm, sub_topics: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Learning Objectives</label>
                <textarea
                  rows="2"
                  placeholder="Students will be able to..."
                  value={topicForm.learning_objectives}
                  onChange={(e) => setTopicForm({ ...topicForm, learning_objectives: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700"
                >
                  Save Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: COPY CURRICULUM TO NEXT SESSION ───────────────────────────── */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <i className="ti ti-copy text-indigo-600" />
              <span>Copy Curriculum to New Session</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This clones <strong>{activeCurriculum?.book_name}</strong> and all {activeCurriculum?.chapters?.length || 0} chapters and topics.
              Historical dates and actual teaching logs are NOT copied.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">Target Academic Session *</label>
              <input
                type="text"
                value={copyTargetSession}
                onChange={(e) => setCopyTargetSession(e.target.value)}
                placeholder="e.g. 2027-28"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-semibold"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyCurriculum}
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold shadow hover:bg-indigo-700"
              >
                {submitting ? 'Copying...' : 'Confirm Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
