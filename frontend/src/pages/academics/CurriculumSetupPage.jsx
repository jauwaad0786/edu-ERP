import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function CurriculumSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
    estimated_periods: 1.0,
    planned_date: '',
  });

  const [copySessionTarget, setCopySessionTarget] = useState('2027-28');
  const [submitting, setSubmitting] = useState(false);

  // Fetch initial classes and subjects
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
        console.error('Error fetching metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Curriculums
  const fetchCurriculums = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ session });
      if (selectedClassId) params.append('class_id', selectedClassId);
      if (selectedSubjectId) params.append('subject_id', selectedSubjectId);

      const res = await api.get(`/curriculum?${params.toString()}`);
      const list = res.data.curriculums || [];
      setCurriculums(list);

      if (list.length > 0) {
        if (!activeCurriculum || !list.some(c => c.id === activeCurriculum.id)) {
          setActiveCurriculum(list[0]);
        } else {
          const updated = list.find(c => c.id === activeCurriculum.id);
          setActiveCurriculum(updated || list[0]);
        }
      } else {
        setActiveCurriculum(null);
      }
    } catch (err) {
      console.error('Error fetching curriculums:', err);
      toast.error('Failed to load curriculum list');
    } finally {
      setLoading(false);
    }
  }, [session, selectedClassId, selectedSubjectId, activeCurriculum]);

  useEffect(() => {
    fetchCurriculums();
  }, [session, selectedClassId, selectedSubjectId]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalChapters = 0;
    let totalTopics = 0;
    let totalPeriods = 0;

    curriculums.forEach(c => {
      totalPeriods += (c.estimated_periods || 0);
      const chs = c.chapters || [];
      totalChapters += chs.length;
      chs.forEach(ch => {
        totalTopics += (ch.topics || []).length;
      });
    });

    return {
      totalCurriculums: curriculums.length,
      totalChapters,
      totalTopics,
      totalPeriods,
    };
  }, [curriculums]);

  // Handle Save Curriculum
  const handleSaveCurriculum = async (e) => {
    e.preventDefault();
    if (!formData.class_id || !formData.subject_id) {
      toast.error('Please select both Class and Subject');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/curriculum', {
        ...formData,
        session,
        class_id: parseInt(formData.class_id),
        subject_id: parseInt(formData.subject_id),
        estimated_periods: parseInt(formData.estimated_periods) || 100,
        num_skeleton_chapters: parseInt(formData.num_skeleton_chapters) || 0,
      });

      toast.success(res.data.message || 'Curriculum created successfully!');
      setShowAddModal(false);
      setFormData({
        book_name: '',
        publisher: '',
        book_code: '',
        estimated_periods: 120,
        description: '',
        num_skeleton_chapters: 10,
      });
      fetchCurriculums();
    } catch (err) {
      console.error('Save curriculum error:', err);
      toast.error(err.response?.data?.message || 'Failed to save curriculum');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Save Chapter
  const handleSaveChapter = async (e) => {
    e.preventDefault();
    if (!activeCurriculum) return;
    setSubmitting(true);
    try {
      const res = await api.post('/curriculum/chapter', {
        ...chapterForm,
        curriculum_id: activeCurriculum.id,
        chapter_no: parseInt(chapterForm.chapter_no),
        estimated_periods: parseFloat(chapterForm.estimated_periods) || 0,
        weightage: parseFloat(chapterForm.weightage) || 0,
      });

      toast.success(res.data.message || 'Chapter saved successfully!');
      setShowChapterModal(false);
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
      fetchCurriculums();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save chapter');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Save Topic
  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!selectedChapterForTopic) return;
    setSubmitting(true);
    try {
      const res = await api.post('/curriculum/topic', {
        ...topicForm,
        chapter_id: selectedChapterForTopic.id,
        topic_no: parseInt(topicForm.topic_no),
        estimated_periods: parseFloat(topicForm.estimated_periods) || 1.0,
      });

      toast.success(res.data.message || 'Topic saved successfully!');
      setShowTopicModal(false);
      setTopicForm({
        id: null,
        topic_no: (selectedChapterForTopic.topics?.length || 0) + 1,
        title: '',
        estimated_periods: 1.0,
        planned_date: '',
      });
      fetchCurriculums();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save topic');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Copy Session
  const handleCopySession = async (e) => {
    e.preventDefault();
    if (!activeCurriculum) return;
    setSubmitting(true);
    try {
      const res = await api.post('/curriculum/copy-session', {
        source_curriculum_id: activeCurriculum.id,
        target_session: copySessionTarget,
      });

      toast.success(res.data.message || `Curriculum cloned to Session ${copySessionTarget}`);
      setShowCopyModal(false);
      setSession(copySessionTarget);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to copy curriculum');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar title="Curriculum & Syllabus Setup" />

        <div className="page-body" style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 28px' }}>
          {/* ══ HEADER & ACTIONS ══ */}
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
                  ● 1P360 Academic Engine
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Session <strong>{session}</strong>
                </span>
              </div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>
                Curriculum &amp; Syllabus Management
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Setup prescribed books, syllabus chapters, topic-wise period budgets, and clone curriculum to upcoming sessions.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="form-select"
                style={{ width: '160px', fontWeight: 700, borderRadius: '10px' }}
              >
                <option value="2026-27">Session 2026-27</option>
                <option value="2025-26">Session 2025-26</option>
                <option value="2027-28">Session 2027-28</option>
              </select>

              <button
                onClick={() => {
                  setFormData({
                    class_id: classes[0]?.id || '',
                    subject_id: subjects[0]?.id || '',
                    book_name: '',
                    publisher: '',
                    book_code: '',
                    estimated_periods: 120,
                    description: '',
                    num_skeleton_chapters: 10,
                  });
                  setShowAddModal(true);
                }}
                className="btn btn-primary"
                style={{
                  borderRadius: '10px', padding: '10px 18px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(1,118,211,0.25)'
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: '16px' }} />
                Setup New Curriculum
              </button>

              {activeCurriculum && (
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="btn btn-neutral"
                  style={{ borderRadius: '10px', padding: '10px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="ti ti-copy" />
                  Copy to Next Session
                </button>
              )}
            </div>
          </div>

          {/* ══ METRICS STRIP ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CURRICULUMS CONFIGURED</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-books" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>{stats.totalCurriculums}</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>For academic session {session}</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOTAL CHAPTERS</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-bookmarks" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669' }}>{stats.totalChapters}</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Across all subjects</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOPICS CATALOGED</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-list-check" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#d97706' }}>{stats.totalTopics}</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Individual learning items</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TOTAL PLANNED PERIODS</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-clock" style={{ fontSize: '18px' }} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed' }}>{stats.totalPeriods} <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>pds</span></div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Cumulative teaching budget</p>
            </div>
          </div>

          {/* ══ FILTERS STRIP ══ */}
          <div style={{
            background: '#ffffff', borderRadius: '16px', padding: '16px 20px',
            border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '22px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '13px', fontWeight: 700 }}>
              <i className="ti ti-filter" style={{ color: '#0176d3' }} /> Filter:
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="form-select"
                style={{ width: '100%', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="form-select"
                style={{ width: '100%', borderRadius: '8px', fontSize: '13px' }}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {(selectedClassId || selectedSubjectId) && (
              <button
                onClick={() => { setSelectedClassId(''); setSelectedSubjectId(''); }}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '8px',
                  padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#64748b'
                }}
              >
                Reset Filters
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
              Found <strong>{curriculums.length}</strong> Curriculums Configured
            </div>
          </div>

          {/* ══ MAIN BODY ══ */}
          {loading ? (
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center' }}>
              <i className="ti ti-loader animate-spin" style={{ fontSize: '32px', color: '#0176d3' }} />
              <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Loading curriculum database...</p>
            </div>
          ) : curriculums.length === 0 ? (
            <div style={{
              background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
              padding: '64px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: '#94a3b8'
              }}>
                <i className="ti ti-book-off" style={{ fontSize: '32px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>
                No Curriculum Configured Yet
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px' }}>
                Get started by setting up the syllabus and textbook chapters for this academic session.
              </p>
              <button
                onClick={() => {
                  setFormData({
                    class_id: classes[0]?.id || '',
                    subject_id: subjects[0]?.id || '',
                    book_name: '',
                    publisher: '',
                    book_code: '',
                    estimated_periods: 120,
                    description: '',
                    num_skeleton_chapters: 10,
                  });
                  setShowAddModal(true);
                }}
                className="btn btn-primary"
                style={{ borderRadius: '10px', padding: '10px 20px', fontWeight: 800 }}
              >
                <i className="ti ti-plus" /> Setup First Curriculum
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Left Sidebar: Curriculums List */}
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Subjects</span>
                  <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '100px' }}>
                    {curriculums.length}
                  </span>
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {curriculums.map((curr) => {
                    const isSelected = activeCurriculum?.id === curr.id;
                    const chCount = curr.chapters?.length || 0;

                    return (
                      <div
                        key={curr.id}
                        onClick={() => setActiveCurriculum(curr)}
                        style={{
                          padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                          border: isSelected ? '1px solid #0176d3' : '1px solid #f1f5f9',
                          background: isSelected ? '#f0f7ff' : '#ffffff',
                          boxShadow: isSelected ? '0 2px 8px rgba(1,118,211,0.1)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: isSelected ? '#0176d3' : '#64748b', textTransform: 'uppercase' }}>
                            {curr.class_name}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                            {curr.estimated_periods || 0} pds
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                          {curr.subject_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {curr.book_name ? `Book: ${curr.book_name}` : 'No book assigned'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ti ti-bookmarks" /> {chCount} Chapters defined
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Active Curriculum Details, Chapters & Topics */}
              {activeCurriculum && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Banner Card */}
                  <div style={{
                    background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
                    padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ background: '#0176d3', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                            {activeCurriculum.class_name}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                            Session {activeCurriculum.session}
                          </span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>
                          {activeCurriculum.subject_name} Syllabus Master
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#475569', flexWrap: 'wrap' }}>
                          {activeCurriculum.book_name && (
                            <span><i className="ti ti-book" style={{ color: '#0176d3' }} /> Book: <strong>{activeCurriculum.book_name}</strong></span>
                          )}
                          {activeCurriculum.publisher && (
                            <span><i className="ti ti-building" style={{ color: '#64748b' }} /> Publisher: <strong>{activeCurriculum.publisher}</strong></span>
                          )}
                          {activeCurriculum.book_code && (
                            <span><i className="ti ti-barcode" style={{ color: '#64748b' }} /> Code: <strong>{activeCurriculum.book_code}</strong></span>
                          )}
                          <span><i className="ti ti-clock" style={{ color: '#059669' }} /> Planned: <strong>{activeCurriculum.estimated_periods || 0} Periods</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
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
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: '8px', fontWeight: 700 }}
                        >
                          <i className="ti ti-plus" /> Add Chapter
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Chapters List */}
                  <div style={{
                    background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0',
                    padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Chapters &amp; Syllabus Outline</span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                        {activeCurriculum.chapters?.length || 0} Chapters
                      </span>
                    </h3>

                    {(!activeCurriculum.chapters || activeCurriculum.chapters.length === 0) ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>No chapters defined yet for this curriculum.</p>
                        <button
                          onClick={() => {
                            setChapterForm({
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
                            setShowChapterModal(true);
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '10px' }}
                        >
                          + Add First Chapter
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {activeCurriculum.chapters.map((ch) => {
                          const topics = ch.topics || [];
                          const completedTopics = topics.filter(t => t.status === 'COMPLETED').length;

                          return (
                            <div
                              key={ch.id}
                              style={{
                                border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
                                background: '#ffffff', transition: 'border-color 0.15s ease'
                              }}
                            >
                              {/* Chapter Header */}
                              <div style={{
                                padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{
                                    width: '30px', height: '30px', borderRadius: '8px', background: '#0176d3', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800
                                  }}>
                                    {ch.chapter_no}
                                  </span>
                                  <div>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                      {ch.title}
                                    </h4>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                      {ch.estimated_periods || 0} Planned Periods • {topics.length} Topics ({completedTopics} Completed)
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedChapterForTopic(ch);
                                      setTopicForm({
                                        id: null,
                                        topic_no: (topics.length || 0) + 1,
                                        title: '',
                                        estimated_periods: 1.0,
                                        planned_date: '',
                                      });
                                      setShowTopicModal(true);
                                    }}
                                    className="btn btn-neutral btn-sm"
                                    style={{ borderRadius: '6px', fontSize: '11px', padding: '4px 8px' }}
                                  >
                                    <i className="ti ti-plus" /> Add Topic
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
                                    className="btn btn-neutral btn-sm"
                                    style={{ borderRadius: '6px', fontSize: '11px', padding: '4px 8px' }}
                                  >
                                    <i className="ti ti-edit" />
                                  </button>
                                </div>
                              </div>

                              {/* Topics List */}
                              <div style={{ padding: '12px 18px' }}>
                                {topics.length === 0 ? (
                                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    No subtopics cataloged under this chapter. Click "+ Add Topic" above.
                                  </p>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                                    {topics.map(t => {
                                      const isDone = t.status === 'COMPLETED';

                                      return (
                                        <div
                                          key={t.id}
                                          style={{
                                            padding: '8px 12px', borderRadius: '8px', background: isDone ? '#f0fdf4' : '#ffffff',
                                            border: isDone ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                            <i
                                              className={isDone ? 'ti ti-circle-check-filled' : 'ti ti-circle'}
                                              style={{ color: isDone ? '#16a34a' : '#cbd5e1', fontSize: '16px', flexShrink: 0 }}
                                            />
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {t.topic_no}. {t.title}
                                            </span>
                                          </div>
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', flexShrink: 0, marginLeft: '6px' }}>
                                            {t.estimated_periods || 1} pd
                                          </span>
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
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MODAL 1: ADD/EDIT CURRICULUM ══ */}
          {showAddModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '580px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', background: '#0176d3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Setup New Subject Curriculum</h3>
                  <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveCurriculum} style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Class *</label>
                      <select
                        value={formData.class_id}
                        onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                        className="form-select"
                        required
                      >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Subject *</label>
                      <select
                        value={formData.subject_id}
                        onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                        className="form-select"
                        required
                      >
                        <option value="">Select Subject</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Prescribed Book / Textbook Name</label>
                    <input
                      type="text"
                      placeholder="e.g. NCERT Mathematics Class 10"
                      value={formData.book_name}
                      onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Publisher</label>
                      <input
                        type="text"
                        placeholder="e.g. NCERT / Pearson"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Total Planned Periods</label>
                      <input
                        type="number"
                        value={formData.estimated_periods}
                        onChange={(e) => setFormData({ ...formData, estimated_periods: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                    <label className="form-label" style={{ marginBottom: '4px' }}>Auto-Generate Chapter Skeleton (Fast Setup)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={formData.num_skeleton_chapters}
                        onChange={(e) => setFormData({ ...formData, num_skeleton_chapters: e.target.value })}
                        className="form-input"
                        style={{ width: '100px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Auto-creates placeholder chapters (Ch 1 to Ch {formData.num_skeleton_chapters}) with equal period budgets.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                      {submitting ? 'Creating...' : 'Save Curriculum'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══ MODAL 2: ADD/EDIT CHAPTER ══ */}
          {showChapterModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '540px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', background: '#0176d3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    {chapterForm.id ? 'Edit Chapter' : 'Add Chapter'}
                  </h3>
                  <button onClick={() => setShowChapterModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveChapter} style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Ch # *</label>
                      <input
                        type="number"
                        value={chapterForm.chapter_no}
                        onChange={(e) => setChapterForm({ ...chapterForm, chapter_no: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Chapter Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Real Numbers & Polynomials"
                        value={chapterForm.title}
                        onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Estimated Periods</label>
                      <input
                        type="number"
                        value={chapterForm.estimated_periods}
                        onChange={(e) => setChapterForm({ ...chapterForm, estimated_periods: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Weightage Marks (%)</label>
                      <input
                        type="number"
                        value={chapterForm.weightage}
                        onChange={(e) => setChapterForm({ ...chapterForm, weightage: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Key Learning Outcomes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Students will learn Fundamental Theorem of Arithmetic & Proof of Irrationality"
                      value={chapterForm.learning_outcomes}
                      onChange={(e) => setChapterForm({ ...chapterForm, learning_outcomes: e.target.value })}
                      className="form-textarea"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setShowChapterModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                      {submitting ? 'Saving...' : 'Save Chapter'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══ MODAL 3: ADD TOPIC ══ */}
          {showTopicModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '500px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', background: '#0176d3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    Add Topic to Chapter {selectedChapterForTopic?.chapter_no}
                  </h3>
                  <button onClick={() => setShowTopicModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveTopic} style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Topic # *</label>
                      <input
                        type="number"
                        value={topicForm.topic_no}
                        onChange={(e) => setTopicForm({ ...topicForm, topic_no: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Topic Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Fundamental Theorem of Arithmetic"
                        value={topicForm.title}
                        onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Estimated Periods for this Topic</label>
                    <input
                      type="number"
                      step="0.5"
                      value={topicForm.estimated_periods}
                      onChange={(e) => setTopicForm({ ...topicForm, estimated_periods: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setShowTopicModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                      {submitting ? 'Saving...' : 'Save Topic'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══ MODAL 4: COPY TO NEXT SESSION ══ */}
          {showCopyModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', background: '#0176d3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Clone to Next Academic Session</h3>
                  <button onClick={() => setShowCopyModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCopySession} style={{ padding: '20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#475569' }}>
                    Cloning will copy the textbook, chapters, topics, and planned periods into the target session. All completion progress and dates will be cleanly reset for the new academic year.
                  </p>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Target Academic Session *</label>
                    <input
                      type="text"
                      value={copySessionTarget}
                      onChange={(e) => setCopySessionTarget(e.target.value)}
                      className="form-input"
                      placeholder="e.g. 2027-28"
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setShowCopyModal(false)} className="btn btn-neutral">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary">
                      {submitting ? 'Cloning...' : 'Confirm & Clone'}
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
