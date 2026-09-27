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
  const initialTab = route?.params?.initialTab || 'diary';
  const [activeTab, setActiveTab] = useState(initialTab); // 'diary' | 'coverage' | 'history'

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

  // Sync tab loading
  useEffect(() => {
    if (activeTab === 'diary') {
      loadSchedule();
    } else if (activeTab === 'coverage') {
      loadCoverage();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadSchedule, loadCoverage, loadHistory]);

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
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'diary' && styles.tabBtnActive]}
          onPress={() => setActiveTab('diary')}
        >
          <Ionicons name="book-outline" size={15} color={activeTab === 'diary' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'diary' && styles.tabBtnTextActive]}>Daily Diary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'coverage' && styles.tabBtnActive]}
          onPress={() => setActiveTab('coverage')}
        >
          <Ionicons name="pie-chart-outline" size={15} color={activeTab === 'coverage' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'coverage' && styles.tabBtnTextActive]}>Syllabus %</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={15} color={activeTab === 'history' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>Logs History</Text>
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
});
