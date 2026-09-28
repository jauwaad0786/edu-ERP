// mob_app/src/screens/curriculum/CurriculumScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const PEDAGOGY_OPTIONS = [
  'Interactive / Discussion',
  'Lecture & Demonstration',
  'Chalk & Board / Practice',
  'Smart Board / Digital Media',
  'Lab Experiment / Practical',
];

function formatDateDisplay(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function addDays(dateStr, days) {
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export default function CurriculumScreen({ navigation, route }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'TEACHER';
  const isPrincipal = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Default tab can come from route params or 'diary'
  const initialTab = route?.params?.initialTab || (route?.name === 'TeachingDiary' ? 'diary' : route?.name === 'CurriculumCoverage' ? 'coverage' : route?.name === 'CurriculumSetup' ? 'setup' : 'diary');
  const [activeTab, setActiveTab] = useState(initialTab); // 'diary' | 'coverage' | 'setup' | 'history'

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Teacher Filter for Principals
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // Diary State
  const [scheduleData, setScheduleData] = useState({ schedule: [], summary: {} });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Coverage State
  const [coverageData, setCoverageData] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [coverageFilterClass, setCoverageFilterClass] = useState('ALL');
  const [classesList, setClassesList] = useState([]);

  // Books & Curriculum Setup State
  const [curriculums, setCurriculums] = useState([]);
  const [loadingCurriculums, setLoadingCurriculums] = useState(false);
  const [setupSession, setSetupSession] = useState('2026-27');
  const [setupClassId, setSetupClassId] = useState('ALL');
  const [setupSubjectId, setSetupSubjectId] = useState('ALL');
  const [subjectsList, setSubjectsList] = useState([]);
  const [expandedCurriculumId, setExpandedCurriculumId] = useState(null);
  const [curriculumDetailMap, setCurriculumDetailMap] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);

  // Add Book Modal State
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [submittingBook, setSubmittingBook] = useState(false);
  const [bookForm, setBookForm] = useState({
    class_id: '',
    subject_id: '',
    book_name: '',
    publisher: '',
    book_code: '',
    estimated_periods: '120',
    description: '',
    num_skeleton_chapters: '10',
  });

  // Chapter Modal State
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [editingCurriculumId, setEditingCurriculumId] = useState(null);
  const [submittingChapter, setSubmittingChapter] = useState(false);
  const [chapterForm, setChapterForm] = useState({
    id: null,
    chapter_no: 1,
    title: '',
    estimated_periods: '8',
    weightage: '10',
    description: '',
    learning_outcomes: '',
  });

  // Topic Modal State
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [targetChapterId, setTargetChapterId] = useState(null);
  const [targetCurriculumId, setTargetCurriculumId] = useState(null);
  const [submittingTopic, setSubmittingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState({
    topic_no: 1,
    title: '',
    estimated_periods: '1',
    description: '',
  });

  // Copy Session Modal State
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyCurriculumId, setCopyCurriculumId] = useState(null);
  const [copyTargetSession, setCopyTargetSession] = useState('2027-28');
  const [copyingSession, setCopyingSession] = useState(false);

  // Drilldown Modal
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [drilldownModal, setDrilldownModal] = useState(false);
  const [drilldownChapters, setDrilldownChapters] = useState([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Diary Entry Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [topicCovered, setTopicCovered] = useState('');
  const [classworkSummary, setClassworkSummary] = useState('');
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [methodology, setMethodology] = useState('Interactive / Discussion');
  const [hasHomework, setHasHomework] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Teachers List (Principal only)
  useEffect(() => {
    if (isPrincipal) {
      client.get('/principal/teachers')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.teachers || []);
          setTeachers(list);
        })
        .catch(() => setTeachers([]));
    }
  }, [isPrincipal]);

  // 2. Fetch Classes List for Filtering
  useEffect(() => {
    client.get('/principal/classes')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.classes || []);
        setClassesList(list);
      })
      .catch(() => setClassesList([]));
  }, []);

  // 3. Fetch Today's Teaching Diary Schedule
  const loadSchedule = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingSchedule(true);
    try {
      const params = {
        date: selectedDate,
        session: '2026-27',
      };
      if (selectedTeacherId) {
        params.teacher_id = selectedTeacherId;
      }

      const res = await client.get('/curriculum/teaching-diary/today', { params }).catch(() => null);

      if (res?.data && (res.data.schedule || Array.isArray(res.data))) {
        const schedule = Array.isArray(res.data) ? res.data : (res.data.schedule || []);
        const summary = res.data.summary || {};
        setScheduleData({ schedule, summary });
      } else {
        // Fallback: fetch timetable periods
        const fallback = await client.get('/principal/timetables/today').catch(() => null);
        const pList = Array.isArray(fallback?.data) ? fallback.data : [];
        setScheduleData({ schedule: pList, summary: {} });
      }
    } catch {
      setScheduleData({ schedule: [], summary: {} });
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoadingSchedule(false);
    }
  }, [selectedDate, selectedTeacherId]);

  // 4. Fetch Syllabus Coverage Tracker
  const loadCoverage = useCallback(async () => {
    setLoadingCoverage(true);
    try {
      // Try summary analytics first matching Web ERP
      const res = await client.get('/curriculum/analytics/summary', {
        params: { session: '2026-27' },
      }).catch(() => null);

      if (res?.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.curriculums || res.data?.coverage || res.data?.data || []);
        setCoverageData(list);
      } else {
        const fallback = await client.get('/curriculum/syllabus/coverage').catch(() => null);
        const list = Array.isArray(fallback?.data) ? fallback.data : (fallback?.data?.coverage || []);
        setCoverageData(list);
      }
    } catch {
      setCoverageData([]);
    } finally {
      setLoadingCoverage(false);
    }
  }, []);

  // 5. Fetch Diary History Logs
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await client.get('/curriculum/teaching-diary/history', {
        params: {
          session: '2026-27',
          limit: 30,
        },
      }).catch(() => null);

      const list = Array.isArray(res.data) ? res.data : (res.data?.logs || res.data?.history || []);
      setHistoryLogs(list);
    } catch {
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load Subjects List for Setup
  useEffect(() => {
    client.get('/principal/subjects')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.subjects || []);
        setSubjectsList(list);
      })
      .catch(() => setSubjectsList([]));
  }, []);

  // 6. Fetch Curriculums for Setup Tab
  const loadCurriculums = useCallback(async (isRefresh = false) => {
    setLoadingCurriculums(true);
    try {
      const params = { session: setupSession };
      if (setupClassId !== 'ALL') params.class_id = setupClassId;
      if (setupSubjectId !== 'ALL') params.subject_id = setupSubjectId;

      const res = await client.get('/curriculum', { params }).catch(() => null);
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.curriculums || []);
      setCurriculums(list);
    } catch {
      setCurriculums([]);
    } finally {
      setLoadingCurriculums(false);
    }
  }, [setupSession, setupClassId, setupSubjectId]);

  const toggleExpandCurriculum = async (currId) => {
    if (expandedCurriculumId === currId) {
      setExpandedCurriculumId(null);
      return;
    }
    setExpandedCurriculumId(currId);
    if (!curriculumDetailMap[currId]) {
      setLoadingDetailId(currId);
      try {
        const res = await client.get(`/curriculum/${currId}`);
        if (res?.data) {
          setCurriculumDetailMap(prev => ({ ...prev, [currId]: res.data }));
        }
      } catch (err) {
        console.warn('Error loading curriculum detail:', err);
      } finally {
        setLoadingDetailId(null);
      }
    }
  };

  const refreshCurriculumDetail = async (currId) => {
    try {
      const res = await client.get(`/curriculum/${currId}`);
      if (res?.data) {
        setCurriculumDetailMap(prev => ({ ...prev, [currId]: res.data }));
      }
    } catch {}
  };

  // Add Book Action
  const handleAddBook = async () => {
    if (!bookForm.book_name.trim()) {
      Alert.alert('Required', 'Please enter a Book / Curriculum Name.');
      return;
    }
    if (!bookForm.class_id || !bookForm.subject_id) {
      Alert.alert('Required', 'Please select both Class and Subject.');
      return;
    }
    setSubmittingBook(true);
    try {
      await client.post('/curriculum', {
        class_id: parseInt(bookForm.class_id, 10),
        subject_id: parseInt(bookForm.subject_id, 10),
        book_name: bookForm.book_name.trim(),
        publisher: bookForm.publisher.trim(),
        book_code: bookForm.book_code.trim(),
        session: setupSession,
        estimated_periods: parseInt(bookForm.estimated_periods, 10) || 120,
        description: bookForm.description.trim(),
        num_skeleton_chapters: parseInt(bookForm.num_skeleton_chapters, 10) || 0,
      });
      Alert.alert('Success', 'Curriculum & Book setup created successfully!');
      setShowAddBookModal(false);
      setBookForm({
        class_id: '',
        subject_id: '',
        book_name: '',
        publisher: '',
        book_code: '',
        estimated_periods: '120',
        description: '',
        num_skeleton_chapters: '10',
      });
      loadCurriculums();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || err?.response?.data?.message || 'Failed to create curriculum.');
    } finally {
      setSubmittingBook(false);
    }
  };

  // Chapter Action: Save (Create or Update)
  const handleSaveChapter = async () => {
    if (!chapterForm.title.trim()) {
      Alert.alert('Required', 'Please enter a Chapter Title.');
      return;
    }
    setSubmittingChapter(true);
    try {
      if (chapterForm.id) {
        await client.put(`/curriculum/chapters/${chapterForm.id}`, {
          title: chapterForm.title.trim(),
          chapter_no: parseInt(chapterForm.chapter_no, 10) || 1,
          estimated_periods: parseInt(chapterForm.estimated_periods, 10) || 1,
          weightage: parseFloat(chapterForm.weightage) || 0,
          description: chapterForm.description.trim(),
          learning_outcomes: chapterForm.learning_outcomes.trim(),
        });
        Alert.alert('Updated', 'Chapter details saved successfully.');
      } else {
        await client.post(`/curriculum/${editingCurriculumId}/chapters`, {
          title: chapterForm.title.trim(),
          chapter_no: parseInt(chapterForm.chapter_no, 10) || 1,
          estimated_periods: parseInt(chapterForm.estimated_periods, 10) || 1,
          weightage: parseFloat(chapterForm.weightage) || 0,
          description: chapterForm.description.trim(),
          learning_outcomes: chapterForm.learning_outcomes.trim(),
        });
        Alert.alert('Created', 'New chapter added to curriculum!');
      }
      setShowChapterModal(false);
      if (editingCurriculumId) refreshCurriculumDetail(editingCurriculumId);
      loadCurriculums();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save chapter.');
    } finally {
      setSubmittingChapter(false);
    }
  };

  // Chapter Action: Delete
  const handleDeleteChapter = (chId, currId) => {
    Alert.alert('Delete Chapter', 'Are you sure you want to delete this chapter and all its topics?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/curriculum/chapters/${chId}`);
            Alert.alert('Deleted', 'Chapter removed successfully.');
            refreshCurriculumDetail(currId);
            loadCurriculums();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete chapter.');
          }
        },
      },
    ]);
  };

  // Topic Action: Save
  const handleSaveTopic = async () => {
    if (!topicForm.title.trim()) {
      Alert.alert('Required', 'Please enter a Topic Title.');
      return;
    }
    setSubmittingTopic(true);
    try {
      await client.post(`/curriculum/chapters/${targetChapterId}/topics`, {
        title: topicForm.title.trim(),
        topic_no: parseInt(topicForm.topic_no, 10) || 1,
        estimated_periods: parseInt(topicForm.estimated_periods, 10) || 1,
        description: topicForm.description.trim(),
      });
      Alert.alert('Added', 'Topic added to chapter successfully!');
      setShowTopicModal(false);
      if (targetCurriculumId) refreshCurriculumDetail(targetCurriculumId);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add topic.');
    } finally {
      setSubmittingTopic(false);
    }
  };

  // Topic Action: Delete
  const handleDeleteTopic = (topId, currId) => {
    Alert.alert('Delete Topic', 'Are you sure you want to delete this topic?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/curriculum/topics/${topId}`);
            Alert.alert('Deleted', 'Topic removed.');
            refreshCurriculumDetail(currId);
          } catch {
            Alert.alert('Error', 'Failed to delete topic.');
          }
        },
      },
    ]);
  };

  // Copy Session Action
  const handleCopySession = async () => {
    if (!copyTargetSession.trim()) {
      Alert.alert('Required', 'Please enter target session (e.g. 2027-28).');
      return;
    }
    setCopyingSession(true);
    try {
      const res = await client.post(`/curriculum/${copyCurriculumId}/copy-session`, {
        target_session: copyTargetSession.trim(),
      });
      Alert.alert('Success', res?.data?.message || 'Curriculum copied to session successfully!');
      setShowCopyModal(false);
      loadCurriculums();
    } catch (err) {
      Alert.alert('Copy Failed', err?.response?.data?.error || 'Failed to copy curriculum.');
    } finally {
      setCopyingSession(false);
    }
  };

  // Aggregate stats for setup tab
  const setupStats = useMemo(() => {
    let totalChapters = 0;
    let totalTopics = 0;
    let totalPeriods = 0;
    curriculums.forEach(c => {
      totalPeriods += (c.estimated_periods || 0);
      totalChapters += (c.total_chapters || (c.chapters || []).length || 0);
      totalTopics += (c.total_topics || 0);
    });
    return {
      totalCurriculums: curriculums.length,
      totalChapters,
      totalTopics,
      totalPeriods,
    };
  }, [curriculums]);

  // Sync tab loading
  useEffect(() => {
    if (activeTab === 'diary') {
      loadSchedule();
    } else if (activeTab === 'coverage') {
      loadCoverage();
    } else if (activeTab === 'setup') {
      loadCurriculums();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadSchedule, loadCoverage, loadCurriculums, loadHistory]);

  // Open Log Diary Modal
  const openLogModal = (period) => {
    setSelectedPeriod(period);
    setTopicCovered(period.subtopic_title || period.topic_title || period.topic || '');
    setClassworkSummary(period.classwork_summary || '');
    setHomeworkTitle(period.homework_title || period.homework || '');
    setMethodology(period.teaching_methodology || 'Interactive / Discussion');
    setHasHomework(Boolean(period.homework_title || period.homework));
    setModalVisible(true);
  };

  // Submit Diary Entry
  const handleSubmitDiary = async () => {
    if (!topicCovered.trim()) {
      Alert.alert('Validation Error', 'Please enter the topic or chapter covered in this period.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/curriculum/teaching-diary/entry', {
        date: selectedDate,
        session: '2026-27',
        class_id: selectedPeriod?.class_id || selectedPeriod?.class?.id || 1,
        subject_id: selectedPeriod?.subject_id || selectedPeriod?.subject?.id || 1,
        period_no: selectedPeriod?.period_no || 1,
        subtopic_title: topicCovered.trim(),
        classwork_summary: classworkSummary.trim(),
        teaching_methodology: methodology,
        has_homework: hasHomework,
        homework_title: hasHomework ? homeworkTitle.trim() : '',
        topic_completion_status: 'COMPLETED',
      });

      Alert.alert('Success', 'Teaching diary and homework successfully logged.');
      setModalVisible(false);
      loadSchedule();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || err.response?.data?.message || 'Could not record teaching diary.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Drilldown Modal for Subject Coverage
  const openDrilldown = async (item) => {
    setSelectedCurriculum(item);
    setDrilldownModal(true);
    setLoadingDrilldown(true);
    try {
      const currId = item.curriculum_id || item.id;
      const res = await client.get(`/curriculum/analytics/drill-down/${currId}`).catch(() => null);
      if (res?.data) {
        const chapters = res.data.chapters || res.data.curriculum?.chapters || [];
        setDrilldownChapters(chapters);
      } else {
        setDrilldownChapters(item.chapters || []);
      }
    } catch {
      setDrilldownChapters(item.chapters || []);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  const scheduleList = scheduleData.schedule || [];
  const loggedCount = scheduleList.filter(p => Boolean(p.diary_id || p.subtopic_title || p.topic_title)).length;
  const pendingCount = Math.max(0, scheduleList.length - loggedCount);

  // Filtered Coverage list
  const filteredCoverage = useMemo(() => {
    if (coverageFilterClass === 'ALL') return coverageData;
    return coverageData.filter(c =>
      String(c.class_id) === String(coverageFilterClass) ||
      (c.class_name && c.class_name.toLowerCase().includes(String(coverageFilterClass).toLowerCase()))
    );
  }, [coverageData, coverageFilterClass]);

  // Filtered History list
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historyLogs;
    const q = historySearch.toLowerCase();
    return historyLogs.filter(h =>
      (h.topic_title || h.subtopic_title || '').toLowerCase().includes(q) ||
      (h.subject_name || '').toLowerCase().includes(q) ||
      (h.class_name || '').toLowerCase().includes(q) ||
      (h.teacher_name || '').toLowerCase().includes(q)
    );
  }, [historyLogs, historySearch]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Curriculum & Teaching Diary</Text>
            <Text style={styles.headerSub}>Syllabus coverage & daily teacher logs</Text>
          </View>
        </View>

        {activeTab === 'diary' && (
          <TouchableOpacity
            style={styles.todayPillBtn}
            onPress={() => setSelectedDate(todayStr)}
          >
            <Ionicons name="today-outline" size={14} color="#ffffff" />
            <Text style={styles.todayPillText}>Today</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'setup' && (
          <TouchableOpacity
            style={[styles.todayPillBtn, { backgroundColor: '#16a34a' }]}
            onPress={() => setShowAddBookModal(true)}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.todayPillText}>+ Add Book</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'diary' && styles.tabBtnActive]}
          onPress={() => setActiveTab('diary')}
        >
          <Ionicons name="book-outline" size={14} color={activeTab === 'diary' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'diary' && styles.tabBtnTextActive]}>Diary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'coverage' && styles.tabBtnActive]}
          onPress={() => setActiveTab('coverage')}
        >
          <Ionicons name="pie-chart-outline" size={14} color={activeTab === 'coverage' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'coverage' && styles.tabBtnTextActive]}>Coverage</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'setup' && styles.tabBtnActive]}
          onPress={() => setActiveTab('setup')}
        >
          <Ionicons name="library-outline" size={14} color={activeTab === 'setup' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'setup' && styles.tabBtnTextActive]}>Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={14} color={activeTab === 'history' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: TEACHING DIARY ── */}
      {activeTab === 'diary' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSchedule(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Interactive Date Navigation Bar */}
          <View style={styles.dateControlBar}>
            <TouchableOpacity
              style={styles.dateStepBtn}
              onPress={() => setSelectedDate(prev => addDays(prev, -1))}
            >
              <Ionicons name="chevron-back" size={20} color="#0b57d0" />
            </TouchableOpacity>

            <View style={styles.dateCenter}>
              <Ionicons name="calendar-outline" size={16} color="#0b57d0" style={{ marginRight: 6 }} />
              <Text style={styles.dateCenterText}>{formatDateDisplay(selectedDate)}</Text>
              {selectedDate === todayStr && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>TODAY</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.dateStepBtn}
              onPress={() => setSelectedDate(prev => addDays(prev, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color="#0b57d0" />
            </TouchableOpacity>
          </View>

          {/* Teacher Selector for Principal */}
          {isPrincipal && teachers.length > 0 && (
            <View style={styles.teacherFilterBox}>
              <Text style={styles.filterSectionLabel}>Select Staff / Teacher:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                <TouchableOpacity
                  style={[styles.teacherChip, !selectedTeacherId && styles.teacherChipActive]}
                  onPress={() => setSelectedTeacherId(null)}
                >
                  <Text style={[styles.teacherChipText, !selectedTeacherId && styles.teacherChipTextActive]}>
                    All Teachers
                  </Text>
                </TouchableOpacity>
                {teachers.map(t => {
                  const isSel = String(selectedTeacherId) === String(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.teacherChip, isSel && styles.teacherChipActive]}
                      onPress={() => setSelectedTeacherId(isSel ? null : String(t.id))}
                    >
                      <Text style={[styles.teacherChipText, isSel && styles.teacherChipTextActive]}>
                        {t.name || t.full_name || `Teacher #${t.id}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Day KPIs Banner */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderColor: '#dbeafe', backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.kpiVal, { color: '#0b57d0' }]}>{scheduleList.length}</Text>
              <Text style={styles.kpiLabel}>Periods</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: '#dcfce7', backgroundColor: '#f0fdf4' }]}>
              <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{loggedCount}</Text>
              <Text style={styles.kpiLabel}>Logged</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: '#fef3c7', backgroundColor: '#fffbeb' }]}>
              <Text style={[styles.kpiVal, { color: '#d97706' }]}>{pendingCount}</Text>
              <Text style={styles.kpiLabel}>Pending</Text>
            </View>
          </View>

          {/* Periods List */}
          {loadingSchedule ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading teaching periods for {selectedDate}...</Text>
            </View>
          ) : scheduleList.length > 0 ? (
            scheduleList.map((period, idx) => {
              const pNo = period.period_no || idx + 1;
              const hasLogged = Boolean(period.diary_id || period.subtopic_title || period.topic_title);

              return (
                <View key={period.id || idx} style={styles.diaryCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.periodPill}>
                      <Text style={styles.periodPillText}>P{pNo}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>{period.subject_name || period.subject || 'Subject'}</Text>
                      <Text style={styles.classMeta}>
                        Class: {period.class_name || period.class_grade || 'Class'} {period.section ? `(${period.section})` : ''} · {period.time || period.start_time || 'Period ' + pNo}
                      </Text>
                      {Boolean(period.teacher_name) && (
                        <Text style={styles.teacherSubMeta}>Instructor: {period.teacher_name}</Text>
                      )}
                    </View>

                    <View style={[styles.statusTag, hasLogged ? styles.statusTagDone : styles.statusTagPending]}>
                      <Ionicons
                        name={hasLogged ? 'checkmark-circle' : 'time-outline'}
                        size={12}
                        color={hasLogged ? '#16a34a' : '#d97706'}
                        style={{ marginRight: 3 }}
                      />
                      <Text style={[styles.statusTagText, hasLogged ? { color: '#16a34a' } : { color: '#d97706' }]}>
                        {hasLogged ? 'Logged' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {hasLogged ? (
                    <View style={styles.loggedDetailsBox}>
                      <Text style={styles.topicTitle}>
                        📖 Topic: {period.subtopic_title || period.topic_title || period.topic}
                      </Text>
                      {Boolean(period.classwork_summary) && (
                        <Text style={styles.classworkText}>
                          📌 Activities: {period.classwork_summary}
                        </Text>
                      )}
                      {Boolean(period.homework_title || period.homework) && (
                        <Text style={styles.homeworkText}>
                          📝 Homework: {period.homework_title || period.homework}
                        </Text>
                      )}
                      {Boolean(period.teaching_methodology) && (
                        <Text style={styles.methodologyText}>
                          💡 Method: {period.teaching_methodology}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.pendingHint}>
                      Lecture topics and homework have not been posted yet.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, hasLogged && styles.actionBtnEdit]}
                    onPress={() => openLogModal(period)}
                  >
                    <Ionicons
                      name={hasLogged ? 'create-outline' : 'add-circle-outline'}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.actionBtnText}>
                      {hasLogged ? 'Edit Teaching Entry' : 'Log Period Diary'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Scheduled Classes</Text>
              <Text style={styles.emptySub}>
                No timetable periods allocated for {formatDateDisplay(selectedDate)}.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TAB 2: SYLLABUS COVERAGE ── */}
      {activeTab === 'coverage' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCoverage()} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Class Filter Bar */}
          <View style={styles.coverageFilterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              <TouchableOpacity
                style={[styles.filterChip, coverageFilterClass === 'ALL' && styles.filterChipActive]}
                onPress={() => setCoverageFilterClass('ALL')}
              >
                <Text style={[styles.filterChipText, coverageFilterClass === 'ALL' && styles.filterChipTextActive]}>
                  All Classes
                </Text>
              </TouchableOpacity>
              {classesList.map(c => {
                const isSel = String(coverageFilterClass) === String(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.filterChip, isSel && styles.filterChipActive]}
                    onPress={() => setCoverageFilterClass(isSel ? 'ALL' : String(c.id))}
                  >
                    <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                      Class {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loadingCoverage ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Calculating syllabus completion rates...</Text>
            </View>
          ) : filteredCoverage.length > 0 ? (
            filteredCoverage.map((item, idx) => {
              const pct = Number(item.percentage_completed || item.coverage_pct || item.progress || 0);
              const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#0b57d0' : '#d97706';

              return (
                <TouchableOpacity
                  key={item.curriculum_id || item.id || idx}
                  style={styles.coverageCard}
                  activeOpacity={0.8}
                  onPress={() => openDrilldown(item)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.subjectName}>{item.subject_name || item.name || 'Subject'}</Text>
                      <Text style={styles.classMeta}>
                        Class: {item.class_name || 'All Sections'} {item.book_title ? `· ${item.book_title}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.pctBadge, { backgroundColor: `${color}15`, borderColor: color }]}>
                      <Text style={[styles.coveragePctText, { color }]}>{pct}%</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(2, pct))}%`, backgroundColor: color }]} />
                  </View>

                  <View style={styles.coverageFooter}>
                    <View style={styles.statPill}>
                      <Ionicons name="book-outline" size={13} color="#64748b" />
                      <Text style={styles.coverageStats}>
                        {item.completed_chapters || 0} / {item.total_chapters || 0} Chapters
                      </Text>
                    </View>
                    <View style={styles.statPill}>
                      <Ionicons name="checkmark-done-outline" size={13} color="#64748b" />
                      <Text style={styles.coverageStats}>
                        {item.completed_topics || 0} / {item.total_topics || 0} Topics
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#0b57d0', fontWeight: '700' }}>Details</Text>
                      <Ionicons name="chevron-forward" size={14} color="#0b57d0" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="pie-chart-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Curriculum Tracking Available</Text>
              <Text style={styles.emptySub}>
                Curriculum syllabus structures and chapters have not been defined for this session.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TAB 3: CURRICULUM & BOOKS SETUP ── */}
      {activeTab === 'setup' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loadingCurriculums} onRefresh={() => loadCurriculums(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Session Selector Chips */}
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.filterSectionLabel}>Academic Session</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['2025-26', '2026-27', '2027-28'].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sessionChip, setupSession === s && styles.sessionChipActive]}
                  onPress={() => setSetupSession(s)}
                >
                  <Text style={[styles.sessionChipText, setupSession === s && styles.sessionChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Class Filter Chips */}
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.filterSectionLabel}>Class Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.filterChip, setupClassId === 'ALL' && styles.filterChipActive]}
                  onPress={() => setSetupClassId('ALL')}
                >
                  <Text style={[styles.filterChipText, setupClassId === 'ALL' && styles.filterChipTextActive]}>All Classes</Text>
                </TouchableOpacity>
                {classesList.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.filterChip, String(setupClassId) === String(c.id) && styles.filterChipActive]}
                    onPress={() => setSetupClassId(String(c.id))}
                  >
                    <Text style={[styles.filterChipText, String(setupClassId) === String(c.id) && styles.filterChipTextActive]}>
                      Class {c.name}{c.section ? ` (${c.section})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Subject Filter Chips */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.filterSectionLabel}>Subject Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.filterChip, setupSubjectId === 'ALL' && styles.filterChipActive]}
                  onPress={() => setSetupSubjectId('ALL')}
                >
                  <Text style={[styles.filterChipText, setupSubjectId === 'ALL' && styles.filterChipTextActive]}>All Subjects</Text>
                </TouchableOpacity>
                {subjectsList.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.filterChip, String(setupSubjectId) === String(s.id) && styles.filterChipActive]}
                    onPress={() => setSetupSubjectId(String(s.id))}
                  >
                    <Text style={[styles.filterChipText, String(setupSubjectId) === String(s.id) && styles.filterChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Setup KPI Banner */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <Text style={[styles.kpiVal, { color: '#0b57d0' }]}>{setupStats.totalCurriculums}</Text>
              <Text style={styles.kpiLabel}>Books</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{setupStats.totalChapters}</Text>
              <Text style={styles.kpiLabel}>Chapters</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
              <Text style={[styles.kpiVal, { color: '#7c3aed' }]}>{setupStats.totalTopics}</Text>
              <Text style={styles.kpiLabel}>Topics</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <Text style={[styles.kpiVal, { color: '#ea580c' }]}>{setupStats.totalPeriods}</Text>
              <Text style={styles.kpiLabel}>Periods</Text>
            </View>
          </View>

          {/* Curriculum List */}
          {loadingCurriculums ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0b57d0" />
              <Text style={styles.loadingText}>Loading curriculum and book catalog...</Text>
            </View>
          ) : curriculums.length > 0 ? (
            curriculums.map((curr) => {
              const isExpanded = expandedCurriculumId === curr.id;
              const detail = curriculumDetailMap[curr.id] || curr;
              const chList = detail.chapters || [];
              const pct = Math.round(curr.coverage_percentage ?? curr.completion_percentage ?? 0);

              return (
                <View key={curr.id} style={styles.setupCard}>
                  {/* Card Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="book" size={18} color="#0b57d0" />
                        <Text style={styles.setupBookTitle}>{curr.book_name || 'Standard Curriculum'}</Text>
                      </View>
                      <Text style={styles.setupBookMeta}>
                        {curr.publisher ? `Publisher: ${curr.publisher} · ` : ''}
                        {curr.book_code ? `Code: ${curr.book_code}` : ''}
                      </Text>
                    </View>
                    <View style={styles.setupSessionBadge}>
                      <Text style={styles.setupSessionBadgeText}>{curr.session}</Text>
                    </View>
                  </View>

                  {/* Class & Subject Badges */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
                    <View style={styles.setupPill}>
                      <Ionicons name="school-outline" size={12} color="#0284c7" />
                      <Text style={[styles.setupPillText, { color: '#0284c7' }]}>
                        {curr.class_name ? `Class ${curr.class_name}` : 'All Classes'}
                      </Text>
                    </View>
                    <View style={[styles.setupPill, { backgroundColor: '#f0fdf4' }]}>
                      <Ionicons name="bookmark-outline" size={12} color="#16a34a" />
                      <Text style={[styles.setupPillText, { color: '#16a34a' }]}>
                        {curr.subject_name || 'Subject'}
                      </Text>
                    </View>
                    <View style={[styles.setupPill, { backgroundColor: '#faf5ff' }]}>
                      <Ionicons name="time-outline" size={12} color="#7c3aed" />
                      <Text style={[styles.setupPillText, { color: '#7c3aed' }]}>
                        {curr.estimated_periods || 120} Periods Est.
                      </Text>
                    </View>
                  </View>

                  {/* Progress Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
                      {curr.total_chapters || chList.length || 0} Chapters · {curr.total_topics || 0} Topics
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0b57d0' }}>{pct}% Complete</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(3, pct))}%`, backgroundColor: '#0b57d0' }]} />
                  </View>

                  {/* Card Actions */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.setupBtn, { backgroundColor: isExpanded ? '#334155' : '#0b57d0', flex: 1.4 }]}
                      onPress={() => toggleExpandCurriculum(curr.id)}
                    >
                      <Ionicons name={isExpanded ? 'chevron-up' : 'list-outline'} size={14} color="#ffffff" />
                      <Text style={styles.setupBtnText}>{isExpanded ? 'Hide Chapters' : 'View Chapters'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.setupBtn, { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', flex: 1 }]}
                      onPress={() => {
                        setEditingCurriculumId(curr.id);
                        setChapterForm({
                          id: null,
                          chapter_no: chList.length + 1,
                          title: '',
                          estimated_periods: '8',
                          weightage: '10',
                          description: '',
                          learning_outcomes: '',
                        });
                        setShowChapterModal(true);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={14} color="#0b57d0" />
                      <Text style={[styles.setupBtnText, { color: '#0b57d0' }]}>+ Chapter</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.setupBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}
                      onPress={() => {
                        setCopyCurriculumId(curr.id);
                        setShowCopyModal(true);
                      }}
                    >
                      <Ionicons name="copy-outline" size={14} color="#475569" />
                      <Text style={[styles.setupBtnText, { color: '#475569' }]}>Copy</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded Chapters Section */}
                  {isExpanded && (
                    <View style={styles.expandedChaptersBox}>
                      {loadingDetailId === curr.id ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#0b57d0" />
                          <Text style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>Loading chapters & topics...</Text>
                        </View>
                      ) : chList.length > 0 ? (
                        chList.map((ch, idx) => (
                          <View key={ch.id || idx} style={styles.chapterItemBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <View style={styles.chapterNumberPill}>
                                  <Text style={styles.chapterNumberText}>{ch.chapter_no || idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.chapterTitleText} numberOfLines={1}>{ch.title}</Text>
                                  <Text style={styles.chapterSubText}>
                                    {ch.estimated_periods || 1} Periods · Weightage: {ch.weightage || 0}%
                                  </Text>
                                </View>
                              </View>

                              {/* Chapter Actions */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity
                                  style={styles.chapterActionBtn}
                                  onPress={() => {
                                    setEditingCurriculumId(curr.id);
                                    setChapterForm({
                                      id: ch.id,
                                      chapter_no: ch.chapter_no,
                                      title: ch.title,
                                      estimated_periods: String(ch.estimated_periods || 1),
                                      weightage: String(ch.weightage || 0),
                                      description: ch.description || '',
                                      learning_outcomes: ch.learning_outcomes || '',
                                    });
                                    setShowChapterModal(true);
                                  }}
                                >
                                  <Ionicons name="pencil" size={13} color="#475569" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.chapterActionBtn}
                                  onPress={() => handleDeleteChapter(ch.id, curr.id)}
                                >
                                  <Ionicons name="trash-outline" size={13} color="#dc2626" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.chapterActionBtn, { backgroundColor: '#eff6ff' }]}
                                  onPress={() => {
                                    setTargetChapterId(ch.id);
                                    setTargetCurriculumId(curr.id);
                                    setTopicForm({
                                      topic_no: (ch.topics || []).length + 1,
                                      title: '',
                                      estimated_periods: '1',
                                      description: '',
                                    });
                                    setShowTopicModal(true);
                                  }}
                                >
                                  <Ionicons name="add" size={14} color="#0b57d0" />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Topics List under Chapter */}
                            {Array.isArray(ch.topics) && ch.topics.length > 0 && (
                              <View style={styles.topicsIndentBox}>
                                {ch.topics.map((top, topIdx) => (
                                  <View key={top.id || topIdx} style={styles.topicItemRow}>
                                    <Ionicons
                                      name={top.status === 'COMPLETED' ? 'checkmark-circle' : 'ellipse-outline'}
                                      size={14}
                                      color={top.status === 'COMPLETED' ? '#16a34a' : '#94a3b8'}
                                    />
                                    <Text style={[styles.topicTitleText, top.status === 'COMPLETED' && { textDecorationLine: 'line-through', color: '#94a3b8' }]} numberOfLines={1}>
                                      {top.topic_no ? `${top.topic_no}. ` : ''}{top.title}
                                    </Text>
                                    <Text style={styles.topicPeriodsText}>{top.estimated_periods || 1}p</Text>
                                    <TouchableOpacity
                                      onPress={() => handleDeleteTopic(top.id, curr.id)}
                                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                      <Ionicons name="close-circle-outline" size={14} color="#94a3b8" />
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))
                      ) : (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: '#64748b' }}>No chapters created yet for this book.</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="library-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Curriculums Configured</Text>
              <Text style={styles.emptySub}>
                Set up textbooks and chapter structures for session {setupSession}.
              </Text>
              <TouchableOpacity
                style={[styles.submitBtn, { paddingHorizontal: 20, marginTop: 14 }]}
                onPress={() => setShowAddBookModal(true)}
              >
                <Text style={styles.submitBtnText}>+ Create Book / Curriculum</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TAB 3: DIARY HISTORY ── */}
      {activeTab === 'history' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHistory()} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search past logs by topic, subject, or class..."
              placeholderTextColor="#94a3b8"
              value={historySearch}
              onChangeText={setHistorySearch}
            />
          </View>

          {loadingHistory ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Fetching historical teaching entries...</Text>
            </View>
          ) : filteredHistory.length > 0 ? (
            filteredHistory.map((item, idx) => (
              <View key={item.id || idx} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyDateBadge}>
                    <Text style={styles.historyDateText}>{item.date || 'Past'}</Text>
                  </View>
                  <Text style={styles.historyPeriodText}>Period {item.period_no || '—'}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.historyStatusBadge}>
                    <Text style={styles.historyStatusText}>Logged</Text>
                  </View>
                </View>

                <Text style={styles.historySubjectText}>{item.subject_name || 'Subject'}</Text>
                <Text style={styles.historyClassText}>
                  Class {item.class_name || 'N/A'} {item.teacher_name ? `• ${item.teacher_name}` : ''}
                </Text>

                <View style={styles.historyBody}>
                  <Text style={styles.historyTopic}>
                    📖 <Text style={{ fontWeight: '700' }}>Topic:</Text> {item.subtopic_title || item.topic_title || 'N/A'}
                  </Text>
                  {Boolean(item.classwork_summary) && (
                    <Text style={styles.historyClasswork}>
                      📌 <Text style={{ fontWeight: '700' }}>Classwork:</Text> {item.classwork_summary}
                    </Text>
                  )}
                  {Boolean(item.homework_title) && (
                    <Text style={styles.historyHomework}>
                      📝 <Text style={{ fontWeight: '700' }}>Homework:</Text> {item.homework_title}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Recorded History Found</Text>
              <Text style={styles.emptySub}>Past teaching entries will be archived here as daily diaries are submitted.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── MODAL: LOG DIARY ENTRY ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {selectedPeriod?.subject_name || 'Period Diary'} · P{selectedPeriod?.period_no || 1}
                </Text>
                <Text style={styles.modalSub}>
                  {selectedPeriod?.class_name ? `Class ${selectedPeriod.class_name}` : 'Lecture Log'} · {selectedDate}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.fieldLabel}>Topic / Subtopic Covered Today *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chapter 4: Quadratic Equations - Factoring Method"
                placeholderTextColor="#94a3b8"
                value={topicCovered}
                onChangeText={setTopicCovered}
              />

              <Text style={styles.fieldLabel}>Classwork Summary & Exercises</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                placeholder="Solved Ex 4.2 questions 1-5 on board. Explained discriminant formula."
                placeholderTextColor="#94a3b8"
                multiline
                value={classworkSummary}
                onChangeText={setClassworkSummary}
              />

              <Text style={styles.fieldLabel}>Teaching Methodology</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {PEDAGOGY_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.methodChip, methodology === opt && styles.methodChipActive]}
                      onPress={() => setMethodology(opt)}
                    >
                      <Text style={[styles.methodChipText, methodology === opt && styles.methodChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Homework Toggle */}
              <TouchableOpacity
                style={styles.homeworkToggleRow}
                onPress={() => setHasHomework(!hasHomework)}
              >
                <Ionicons name={hasHomework ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <Text style={styles.homeworkToggleLabel}>Assign Homework / Practice Questions</Text>
              </TouchableOpacity>

              {hasHomework && (
                <>
                  <Text style={styles.fieldLabel}>Homework Assignment Task</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Complete Exercise 4.2 questions 6 to 10 in homework notebook"
                    placeholderTextColor="#94a3b8"
                    value={homeworkTitle}
                    onChangeText={setHomeworkTitle}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitDiary}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Post Teaching Log & Homework</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: CHAPTER DRILLDOWN ── */}
      <Modal visible={drilldownModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {selectedCurriculum?.subject_name || 'Subject Chapters'}
                </Text>
                <Text style={styles.modalSub}>
                  Class {selectedCurriculum?.class_name || 'N/A'} · Syllabus Outline
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDrilldownModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingDrilldown ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching chapter topics...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {drilldownChapters.length > 0 ? (
                  drilldownChapters.map((ch, idx) => (
                    <View key={ch.id || idx} style={styles.chapterCard}>
                      <View style={styles.chapterHeader}>
                        <View style={styles.chapterIndexPill}>
                          <Text style={styles.chapterIndexText}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chapterTitle}>{ch.name || ch.title || `Chapter ${idx + 1}`}</Text>
                          <Text style={styles.chapterPeriods}>
                            Est. Periods: {ch.estimated_periods || ch.periods || 6}
                          </Text>
                        </View>
                        <View style={[
                          styles.chapterBadge,
                          ch.status === 'COMPLETED' ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#eff6ff' }
                        ]}>
                          <Text style={[
                            styles.chapterBadgeText,
                            ch.status === 'COMPLETED' ? { color: '#16a34a' } : { color: '#0b57d0' }
                          ]}>
                            {ch.status || (ch.is_completed ? 'Completed' : 'In Progress')}
                          </Text>
                        </View>
                      </View>

                      {/* Topics inside chapter */}
                      {Array.isArray(ch.topics) && ch.topics.length > 0 && (
                        <View style={styles.topicsBox}>
                          {ch.topics.map((top, tIdx) => (
                            <View key={top.id || tIdx} style={styles.topicRow}>
                              <Ionicons
                                name={top.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={top.is_completed ? '#16a34a' : '#94a3b8'}
                              />
                              <Text style={[styles.topicName, top.is_completed && styles.topicNameDone]}>
                                {top.title || top.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="document-text-outline" size={40} color="#94a3b8" />
                    <Text style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>
                      No chapters registered for this curriculum.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      {/* ── MODAL: ADD BOOK / CURRICULUM ── */}
      <Modal visible={showAddBookModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Book & Curriculum</Text>
                <Text style={styles.modalSub}>Configure syllabus structure for {setupSession}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddBookModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.fieldLabel}>Select Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {classesList.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.modalPill, String(bookForm.class_id) === String(c.id) && styles.modalPillActive]}
                      onPress={() => setBookForm(prev => ({ ...prev, class_id: String(c.id) }))}
                    >
                      <Text style={[styles.modalPillText, String(bookForm.class_id) === String(c.id) && styles.modalPillTextActive]}>
                        Class {c.name}{c.section ? ` (${c.section})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Select Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {subjectsList.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.modalPill, String(bookForm.subject_id) === String(s.id) && styles.modalPillActive]}
                      onPress={() => setBookForm(prev => ({ ...prev, subject_id: String(s.id) }))}
                    >
                      <Text style={[styles.modalPillText, String(bookForm.subject_id) === String(s.id) && styles.modalPillTextActive]}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Book / Curriculum Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mathematics - Part 1 (NCERT)"
                placeholderTextColor="#94a3b8"
                value={bookForm.book_name}
                onChangeText={(v) => setBookForm(prev => ({ ...prev, book_name: v }))}
              />

              <Text style={styles.fieldLabel}>Publisher</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. NCERT / Oxford / Pearson"
                placeholderTextColor="#94a3b8"
                value={bookForm.publisher}
                onChangeText={(v) => setBookForm(prev => ({ ...prev, publisher: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Book Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. MATH-10-P1"
                    placeholderTextColor="#94a3b8"
                    value={bookForm.book_code}
                    onChangeText={(v) => setBookForm(prev => ({ ...prev, book_code: v }))}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Est. Periods</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="120"
                    placeholderTextColor="#94a3b8"
                    value={bookForm.estimated_periods}
                    onChangeText={(v) => setBookForm(prev => ({ ...prev, estimated_periods: v }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Generate Skeleton Chapters (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Number of chapters to auto-create (e.g. 12)"
                placeholderTextColor="#94a3b8"
                value={bookForm.num_skeleton_chapters}
                onChangeText={(v) => setBookForm(prev => ({ ...prev, num_skeleton_chapters: v }))}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingBook && { opacity: 0.7 }]}
                onPress={handleAddBook}
                disabled={submittingBook}
              >
                {submittingBook ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Book & Curriculum</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: ADD / EDIT CHAPTER ── */}
      <Modal visible={showChapterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{chapterForm.id ? 'Edit Chapter' : 'Add New Chapter'}</Text>
                <Text style={styles.modalSub}>Define title, estimated periods, and weightage</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChapterModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 90 }}>
                  <Text style={styles.fieldLabel}>Chapter #</Text>
                  <TextInput
                    style={styles.input}
                    value={String(chapterForm.chapter_no)}
                    onChangeText={(v) => setChapterForm(prev => ({ ...prev, chapter_no: v }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Chapter Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Real Numbers & Functions"
                    placeholderTextColor="#94a3b8"
                    value={chapterForm.title}
                    onChangeText={(v) => setChapterForm(prev => ({ ...prev, title: v }))}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Estimated Periods</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="8"
                    placeholderTextColor="#94a3b8"
                    value={chapterForm.estimated_periods}
                    onChangeText={(v) => setChapterForm(prev => ({ ...prev, estimated_periods: v }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Exam Weightage (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor="#94a3b8"
                    value={chapterForm.weightage}
                    onChangeText={(v) => setChapterForm(prev => ({ ...prev, weightage: v }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Overview of this unit or chapter..."
                placeholderTextColor="#94a3b8"
                multiline
                value={chapterForm.description}
                onChangeText={(v) => setChapterForm(prev => ({ ...prev, description: v }))}
              />

              <Text style={styles.fieldLabel}>Learning Outcomes</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Expected competencies upon completion..."
                placeholderTextColor="#94a3b8"
                multiline
                value={chapterForm.learning_outcomes}
                onChangeText={(v) => setChapterForm(prev => ({ ...prev, learning_outcomes: v }))}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingChapter && { opacity: 0.7 }]}
                onPress={handleSaveChapter}
                disabled={submittingChapter}
              >
                {submittingChapter ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{chapterForm.id ? 'Save Changes' : 'Create Chapter'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: ADD TOPIC ── */}
      <Modal visible={showTopicModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Topic to Chapter</Text>
                <Text style={styles.modalSub}>Detailed syllabus micro-concept</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopicModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 80 }}>
                <Text style={styles.fieldLabel}>Topic #</Text>
                <TextInput
                  style={styles.input}
                  value={String(topicForm.topic_no)}
                  onChangeText={(v) => setTopicForm(prev => ({ ...prev, topic_no: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Topic Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Fundamental Theorem of Arithmetic"
                  placeholderTextColor="#94a3b8"
                  value={topicForm.title}
                  onChangeText={(v) => setTopicForm(prev => ({ ...prev, title: v }))}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Estimated Periods (hrs)</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor="#94a3b8"
              value={topicForm.estimated_periods}
              onChangeText={(v) => setTopicForm(prev => ({ ...prev, estimated_periods: v }))}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Key sub-points and theorem statements..."
              placeholderTextColor="#94a3b8"
              multiline
              value={topicForm.description}
              onChangeText={(v) => setTopicForm(prev => ({ ...prev, description: v }))}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submittingTopic && { opacity: 0.7 }]}
              onPress={handleSaveTopic}
              disabled={submittingTopic}
            >
              {submittingTopic ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Add Topic</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: COPY TO SESSION ── */}
      <Modal visible={showCopyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Copy to Next Session</Text>
                <Text style={styles.modalSub}>Duplicate syllabus and chapters into new academic year</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCopyModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Target Academic Session *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2027-28"
              placeholderTextColor="#94a3b8"
              value={copyTargetSession}
              onChangeText={setCopyTargetSession}
            />

            <TouchableOpacity
              style={[styles.submitBtn, copyingSession && { opacity: 0.7 }]}
              onPress={handleCopySession}
              disabled={copyingSession}
            >
              {copyingSession ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Duplicate to Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  todayPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  todayPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: '#0b57d0' },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#ffffff' },
  scrollContent: { padding: 14, paddingBottom: 40 },

  // Date Control Bar
  dateControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenterText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  todayBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#16a34a',
  },

  // Teacher Filter
  teacherFilterBox: {
    marginBottom: 12,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  teacherChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  teacherChipActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  teacherChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  teacherChipTextActive: {
    color: '#ffffff',
  },

  // Day KPIs Banner
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },

  // Diary Card
  diaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  periodPill: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillText: { fontSize: 14, fontWeight: '900', color: '#0b57d0' },
  subjectName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  classMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  teacherSubMeta: { fontSize: 11, color: '#0b57d0', marginTop: 1, fontWeight: '600' },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusTagDone: { backgroundColor: '#dcfce7' },
  statusTagPending: { backgroundColor: '#fef3c7' },
  statusTagText: { fontSize: 11, fontWeight: '800' },
  loggedDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  topicTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  classworkText: { fontSize: 12, color: '#475569' },
  homeworkText: { fontSize: 12, color: '#0284c7', fontWeight: '600' },
  methodologyText: { fontSize: 11, color: '#7c3aed' },
  pendingHint: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginVertical: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0b57d0',
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 4,
  },
  actionBtnEdit: { backgroundColor: '#475569' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },

  // Empty Box
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },

  // Coverage Tab
  coverageFilterRow: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#ffffff' },
  coverageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  coveragePctText: { fontSize: 14, fontWeight: '900' },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  coverageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coverageStats: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  // History Tab
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  historyDateBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyDateText: { fontSize: 11, fontWeight: '800', color: '#0b57d0' },
  historyPeriodText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  historyStatusBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyStatusText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },
  historySubjectText: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  historyClassText: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  historyBody: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, gap: 4 },
  historyTopic: { fontSize: 12, color: '#1e293b' },
  historyClasswork: { fontSize: 12, color: '#475569' },
  historyHomework: { fontSize: 12, color: '#0284c7' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1e293b',
  },
  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodChipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  methodChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  methodChipTextActive: { color: '#ffffff' },
  homeworkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  homeworkToggleLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  submitBtn: {
    backgroundColor: '#0b57d0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },

  // Drilldown Modal
  chapterCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chapterIndexPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterIndexText: { fontSize: 12, fontWeight: '900', color: '#0b57d0' },
  chapterTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  chapterPeriods: { fontSize: 11, color: '#64748b' },
  chapterBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  chapterBadgeText: { fontSize: 10, fontWeight: '800' },
  topicsBox: { marginTop: 8, paddingLeft: 38, gap: 4 },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topicName: { fontSize: 12, color: '#334155' },
  topicNameDone: { textDecorationLine: 'line-through', color: '#94a3b8' },

  // Setup Styles
  sessionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sessionChipActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  sessionChipTextActive: {
    color: '#ffffff',
  },
  setupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  setupBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  setupBookMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  setupSessionBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  setupSessionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b57d0',
  },
  setupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setupPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  setupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  expandedChaptersBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  chapterItemBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chapterNumberPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterNumberText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b57d0',
  },
  chapterTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  chapterSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  chapterActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicsIndentBox: {
    marginTop: 8,
    paddingTop: 6,
    paddingLeft: 34,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 6,
  },
  topicItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topicTitleText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
  },
  topicPeriodsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    backgroundColor: '#faf5ff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modalPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalPillActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  modalPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalPillTextActive: {
    color: '#ffffff',
  },
});
