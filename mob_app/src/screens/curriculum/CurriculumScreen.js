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

export default function CurriculumScreen({ navigation }) {
  const { user } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeTab, setActiveTab] = useState('diary'); // 'diary' | 'coverage'

  // Diary State
  const [scheduleData, setScheduleData] = useState({ schedule: [], summary: {} });
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Coverage State
  const [coverageData, setCoverageData] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Modal Entry State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [topicCovered, setTopicCovered] = useState('');
  const [classworkSummary, setClassworkSummary] = useState('');
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [methodology, setMethodology] = useState('Interactive / Discussion');
  const [hasHomework, setHasHomework] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Today's Teaching Diary Schedule
  const loadSchedule = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingSchedule(true);
    try {
      const res = await client.get('/curriculum/teaching-diary/today', {
        params: { date: selectedDate, session: '2026-27' },
      }).catch(() => null);

      if (res?.data) {
        setScheduleData(res.data);
      } else {
        // Fallback: mock structure from timetable periods
        const fallback = await client.get('/teacher/timetable').catch(() => null);
        const pList = Array.isArray(fallback?.data) ? fallback.data : [];
        setScheduleData({ schedule: pList, summary: {} });
      }
    } catch {
      setScheduleData({ schedule: [], summary: {} });
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingSchedule(false);
    }
  }, [selectedDate]);

  // 2. Fetch Syllabus Coverage Tracker
  const loadCoverage = useCallback(async () => {
    setLoadingCoverage(true);
    try {
      const res = await client.get('/curriculum/syllabus/coverage').catch(() => null);
      if (res?.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data?.coverage || res.data?.subjects || []);
        setCoverageData(list);
      } else {
        setCoverageData([]);
      }
    } catch {
      setCoverageData([]);
    } finally {
      setLoadingCoverage(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'diary') {
      loadSchedule();
    } else {
      loadCoverage();
    }
  }, [activeTab, loadSchedule, loadCoverage]);

  // Open Log Diary Modal
  const openLogModal = (period) => {
    setSelectedPeriod(period);
    setTopicCovered(period.topic_title || period.subtopic_title || '');
    setClassworkSummary(period.classwork_summary || '');
    setHomeworkTitle(period.homework_title || '');
    setMethodology(period.teaching_methodology || 'Interactive / Discussion');
    setHasHomework(Boolean(period.homework_title));
    setModalVisible(true);
  };

  // Submit Diary Entry
  const handleSubmitDiary = async () => {
    if (!topicCovered.trim()) {
      Alert.alert('Validation Error', 'Please enter the topic covered in today\'s lecture.');
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

      Alert.alert('Diary Recorded', 'Teaching log and homework successfully posted.');
      setModalVisible(false);
      loadSchedule();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Could not record teaching diary.');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduleList = scheduleData.schedule || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Curriculum & Diary</Text>
            <Text style={styles.headerSub}>Teaching Progress · {selectedDate}</Text>
          </View>
        </View>
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'diary' && styles.tabBtnActive]}
          onPress={() => setActiveTab('diary')}
        >
          <Ionicons name="book-outline" size={16} color={activeTab === 'diary' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'diary' && styles.tabBtnTextActive]}>Today's Diary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'coverage' && styles.tabBtnActive]}
          onPress={() => setActiveTab('coverage')}
        >
          <Ionicons name="pie-chart-outline" size={16} color={activeTab === 'coverage' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabBtnText, activeTab === 'coverage' && styles.tabBtnTextActive]}>Syllabus % Coverage</Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1: TEACHING DIARY ── */}
      {activeTab === 'diary' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSchedule(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {loadingSchedule ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Fetching today's teaching periods...</Text>
            </View>
          ) : scheduleList.length > 0 ? (
            scheduleList.map((period, idx) => {
              const pNo = period.period_no || idx + 1;
              const hasLogged = Boolean(period.diary_id || period.subtopic_title);

              return (
                <View key={period.id || idx} style={styles.diaryCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.periodPill}>
                      <Text style={styles.periodPillText}>P{pNo}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>{period.subject_name || period.subject || 'Subject'}</Text>
                      <Text style={styles.classMeta}>
                        Class: {period.class_name || period.class_grade || 'Class 10'} · {period.time || '10:00 AM'}
                      </Text>
                    </View>

                    <View style={[styles.statusTag, hasLogged ? styles.statusTagDone : styles.statusTagPending]}>
                      <Text style={[styles.statusTagText, hasLogged ? { color: '#16a34a' } : { color: '#d97706' }]}>
                        {hasLogged ? 'Logged' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {hasLogged ? (
                    <View style={styles.loggedDetailsBox}>
                      <Text style={styles.topicTitle}>📖 Topic: {period.subtopic_title || period.topic_title}</Text>
                      {Boolean(period.homework_title) && (
                        <Text style={styles.homeworkText}>📝 Homework: {period.homework_title}</Text>
                      )}
                      {Boolean(period.teaching_methodology) && (
                        <Text style={styles.methodologyText}>💡 {period.teaching_methodology}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.pendingHint}>Daily lecture notes and homework have not been posted.</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, hasLogged && styles.actionBtnEdit]}
                    onPress={() => openLogModal(period)}
                  >
                    <Ionicons name={hasLogged ? 'create-outline' : 'add-circle-outline'} size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>{hasLogged ? 'Edit Teaching Entry' : 'Log Period Diary'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Assigned Classes Today</Text>
              <Text style={styles.emptySub}>No scheduled periods require diary entries for {selectedDate}.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── TAB 2: SYLLABUS COVERAGE ── */}
      {activeTab === 'coverage' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loadingCoverage ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Calculating syllabus progress...</Text>
            </View>
          ) : coverageData.length > 0 ? (
            coverageData.map((item, idx) => {
              const pct = Number(item.percentage_completed || item.coverage_pct || 0);
              const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#0b57d0' : '#d97706';

              return (
                <View key={item.id || idx} style={styles.coverageCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={styles.subjectName}>{item.subject_name || item.name}</Text>
                      <Text style={styles.classMeta}>Class: {item.class_name || 'All Sections'}</Text>
                    </View>
                    <Text style={[styles.coveragePctText, { color }]}>{pct}%</Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
                  </View>

                  <View style={styles.coverageFooter}>
                    <Text style={styles.coverageStats}>
                      Chapters: {item.completed_chapters || 0} / {item.total_chapters || 0} Done
                    </Text>
                    <Text style={styles.coverageStats}>
                      Topics: {item.completed_topics || 0} / {item.total_topics || 0}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="pie-chart-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Syllabus Tracking Ready</Text>
              <Text style={styles.emptySub}>Curriculum chapters will reflect progress as daily diaries are submitted.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Diary Entry Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPeriod?.subject_name || 'Teaching Diary'} · P{selectedPeriod?.period_no || 1}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Topic / Subtopic Covered Today *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Chapter 4: Quadratic Equations - Factoring Method"
                placeholderTextColor="#94a3b8"
                value={topicCovered}
                onChangeText={setTopicCovered}
              />

              <Text style={styles.fieldLabel}>Classwork Summary / Activities Done</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Solved Exercise 4.2 questions 1-5 on board. Group discussion on discriminant."
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
                <Text style={styles.homeworkToggleLabel}>Assign Homework to Students</Text>
              </TouchableOpacity>

              {hasHomework && (
                <>
                  <Text style={styles.fieldLabel}>Homework Assignment Details</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Complete Exercise 4.2 questions 6 to 10 in homework notebook"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
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
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  diaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  periodPill: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillText: { fontSize: 14, fontWeight: '900', color: colors.primary },
  subjectName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  classMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTagDone: { backgroundColor: '#dcfce7' },
  statusTagPending: { backgroundColor: '#fef3c7' },
  statusTagText: { fontSize: 11, fontWeight: '800' },
  loggedDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  topicTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  homeworkText: { fontSize: 12, color: '#0b57d0', fontWeight: '600' },
  methodologyText: { fontSize: 11, color: '#64748b', fontStyle: 'italic' },
  pendingHint: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnEdit: { backgroundColor: '#475569' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  coverageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coveragePctText: { fontSize: 20, fontWeight: '900' },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginVertical: 12,
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  coverageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coverageStats: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  methodChipActive: { backgroundColor: colors.primary },
  methodChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  methodChipTextActive: { color: '#ffffff' },
  homeworkToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  homeworkToggleLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
