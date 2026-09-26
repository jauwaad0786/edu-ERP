// mob_app/src/screens/examinations/ExaminationsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const EXAM_TYPES = [
  { id: 'MID_TERM', label: 'Mid Term' },
  { id: 'FINAL', label: 'Final' },
  { id: 'UNIT_TEST', label: 'Unit Test' },
  { id: 'ANNUAL', label: 'Annual' },
  { id: 'HALF_YEARLY', label: 'Half Yearly' },
];

export default function ExaminationsScreen({ navigation }) {
  const { user } = useAuth();
  const role = getattrRole(user);
  const isPrincipalOrAdmin = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'ADMIN'].includes(role);

  const [activeTab, setActiveTab] = useState('All');
  const [exams, setExams] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Expanded datesheet state per exam
  const [expandedTimetableId, setExpandedTimetableId] = useState(null);
  const [timetables, setTimetables] = useState({});
  const [loadingTimetableId, setLoadingTimetableId] = useState(null);

  // Add Exam Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('MID_TERM');
  const [session, setSession] = useState('2026-27');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [creating, setCreating] = useState(false);

  function getattrRole(u) {
    if (!u) return '';
    return typeof u.role === 'object' ? u.role?.value || '' : String(u.role || '');
  }

  const loadExams = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [examRes, clsRes] = await Promise.all([
        client.get('/principal/exams').catch(() => client.get('/results/terms').catch(() => ({ data: [] }))),
        client.get('/principal/classes').catch(() => ({ data: [] })),
      ]);

      const list = Array.isArray(examRes?.data)
        ? examRes.data
        : examRes?.data?.exams || examRes?.data?.terms || examRes?.data?.data || [];
      setExams(list);

      const cls = Array.isArray(clsRes?.data)
        ? clsRes.data
        : clsRes?.data?.classes || clsRes?.data?.data || [];
      setClassesList(cls);
    } catch (err) {
      console.warn('Failed to fetch exams:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const toggleTimetable = async (examId) => {
    if (expandedTimetableId === examId) {
      setExpandedTimetableId(null);
      return;
    }
    setExpandedTimetableId(examId);
    if (!timetables[examId]) {
      setLoadingTimetableId(examId);
      try {
        const res = await client.get(`/principal/exams/${examId}/timetable`);
        const tt = Array.isArray(res.data) ? res.data : [];
        setTimetables(prev => ({ ...prev, [examId]: tt }));
      } catch (err) {
        console.warn('Error fetching timetable:', err);
        setTimetables(prev => ({ ...prev, [examId]: [] }));
      } finally {
        setLoadingTimetableId(null);
      }
    }
  };

  const handleTogglePublish = (exam) => {
    const isPub = exam.is_published || exam.status === 'PUBLISHED';
    const actionText = isPub ? 'Unpublish' : 'Publish';
    Alert.alert(
      `${actionText} Examination`,
      `Are you sure you want to ${actionText.toLowerCase()} "${exam.exam_name || exam.name}"? ${isPub ? 'Students/Parents will no longer see published datesheet/results.' : 'This will make the exam schedule visible to students and parents.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isPub ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (isPub) {
                await client.post(`/principal/exams/${exam.id}/unpublish`);
              } else {
                await client.post(`/principal/exams/${exam.id}/publish`);
              }
              Alert.alert('Success', `Exam schedule ${actionText.toLowerCase()}ed successfully.`);
              loadExams();
            } catch (err) {
              Alert.alert('Action Failed', err.response?.data?.error || `Could not ${actionText.toLowerCase()} exam.`);
            }
          },
        },
      ]
    );
  };

  const handleDeleteExam = (exam) => {
    Alert.alert(
      'Delete Examination',
      `Are you sure you want to permanently delete "${exam.exam_name || exam.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/exams/${exam.id}`);
              Alert.alert('Deleted', 'Exam schedule removed successfully.');
              loadExams();
            } catch (err) {
              Alert.alert('Delete Failed', err.response?.data?.error || 'Could not delete exam.');
            }
          },
        },
      ]
    );
  };

  const handleCreateExam = async () => {
    if (!examName.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Validation Error', 'Please enter Exam Name, Start Date (YYYY-MM-DD), and End Date (YYYY-MM-DD).');
      return;
    }

    setCreating(true);
    try {
      const res = await client.post('/principal/exams', {
        exam_name: examName.trim(),
        exam_type: examType,
        session: session.trim() || '2026-27',
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        grading_system: 'STANDARD',
        class_ids: selectedClassIds.length > 0 ? selectedClassIds : undefined,
      });

      const newExamId = res.data?.id || res.data?.exam?.id;
      if (newExamId && selectedClassIds.length > 0) {
        // Also ensure classes are linked
        await client.post(`/principal/exams/${newExamId}/classes`, {
          class_ids: selectedClassIds,
        }).catch(() => {});
      }

      Alert.alert('Success', `Exam schedule "${examName.trim()}" created successfully.`);
      setModalVisible(false);
      setExamName('');
      setStartDate('');
      setEndDate('');
      setSelectedClassIds([]);
      loadExams();
    } catch (err) {
      Alert.alert('Creation Failed', err.response?.data?.error || 'Could not create exam schedule.');
    } finally {
      setCreating(false);
    }
  };

  const toggleClassSelect = (cid) => {
    setSelectedClassIds(prev =>
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]
    );
  };

  const displayList = useMemo(() => {
    return exams.map((e, i) => {
      const rawStatus = (e.status || (e.is_published ? 'PUBLISHED' : 'DRAFT')).toUpperCase();
      let statusLabel = 'Upcoming';
      if (rawStatus === 'ONGOING') statusLabel = 'Ongoing';
      else if (rawStatus === 'COMPLETED' || rawStatus === 'ARCHIVED') statusLabel = 'Completed';
      else if (rawStatus === 'PUBLISHED') statusLabel = 'Published';
      else if (rawStatus === 'DRAFT') statusLabel = 'Draft';

      const classesStr = e.classes && Array.isArray(e.classes)
        ? e.classes.join(', ')
        : e.participating_classes && Array.isArray(e.participating_classes)
        ? e.participating_classes.map(c => c.class_name || c.name || `Class ${c.class_id}`).join(', ')
        : 'All Classes';

      return {
        id: e.id || i,
        rawId: e.id,
        rawExam: e,
        title: e.exam_name || e.name || e.title || e.term_name || `Exam ${i + 1}`,
        examType: e.exam_type || 'EXAM',
        session: e.session || '2026-27',
        isPublished: Boolean(e.is_published || rawStatus === 'PUBLISHED'),
        startDate: e.start_date || '',
        endDate: e.end_date || '',
        dates: e.start_date ? `${e.start_date}${e.end_date ? '  →  ' + e.end_date : ''}` : 'Dates TBD',
        classes: classesStr,
        status: statusLabel,
        color: statusLabel === 'Published' ? '#16a34a' : statusLabel === 'Ongoing' ? '#d97706' : statusLabel === 'Completed' ? '#7c3aed' : '#0284c7',
        bg: statusLabel === 'Published' ? '#dcfce7' : statusLabel === 'Ongoing' ? '#fef3c7' : statusLabel === 'Completed' ? '#ede9fe' : '#e0f2fe',
      };
    });
  }, [exams]);

  const filteredExams = useMemo(() => {
    if (activeTab === 'All') return displayList;
    return displayList.filter(e => {
      if (activeTab === 'Upcoming') return e.status === 'Upcoming' || e.status === 'Draft';
      if (activeTab === 'Ongoing') return e.status === 'Ongoing' || e.status === 'Published';
      if (activeTab === 'Completed') return e.status === 'Completed';
      return true;
    });
  }, [displayList, activeTab]);

  const TABS = ['All', 'Upcoming', 'Ongoing', 'Completed'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => (navigation?.canGoBack() ? navigation.goBack() : null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerBackBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Examinations & Terms</Text>
            <Text style={styles.headerSubtitle}>Exam schedules, datesheets & terms</Text>
          </View>
        </View>

        {isPrincipalOrAdmin && (
          <TouchableOpacity
            style={styles.addExamBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addExamBtnText}>New Exam</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => {
          const isSel = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSel && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, isSel && styles.tabBtnTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading exam schedules...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadExams(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Exam Cards */}
          <View style={{ gap: 14, marginBottom: 24 }}>
            {filteredExams.length > 0 ? (
              filteredExams.map(exam => {
                const isExpanded = expandedTimetableId === exam.rawId;
                const ttList = timetables[exam.rawId] || [];
                const isLoadingTt = loadingTimetableId === exam.rawId;

                return (
                  <View key={exam.id} style={styles.examCard}>
                    {/* Top Row: Title, Session & Status */}
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.examTitle}>{exam.title}</Text>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{exam.examType.replace('_', ' ')}</Text>
                          </View>
                        </View>
                        <Text style={styles.sessionText}>Academic Session: {exam.session}</Text>
                      </View>

                      <View style={[styles.statusPill, { backgroundColor: exam.bg }]}>
                        <Text style={[styles.statusPillText, { color: exam.color }]}>
                          {exam.status}
                        </Text>
                      </View>
                    </View>

                    {/* Dates & Classes Row */}
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={15} color="#64748b" />
                        <Text style={styles.metaText}>{exam.dates}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="school-outline" size={15} color="#64748b" />
                        <Text style={styles.metaText} numberOfLines={1}>{exam.classes}</Text>
                      </View>
                    </View>

                    {/* Action Chips */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={[styles.cardActionChip, isExpanded && styles.cardActionChipActive]}
                        onPress={() => toggleTimetable(exam.rawId)}
                      >
                        <Ionicons name={isExpanded ? 'chevron-up' : 'calendar-number-outline'} size={14} color={isExpanded ? '#fff' : '#0284c7'} />
                        <Text style={[styles.cardActionChipText, isExpanded && { color: '#fff' }]}>
                          {isExpanded ? 'Hide Datesheet' : 'Datesheet'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionChip}
                        onPress={() => navigation?.navigate?.('Marks', { examId: exam.rawId })}
                      >
                        <Ionicons name="create-outline" size={14} color="#7c3aed" />
                        <Text style={[styles.cardActionChipText, { color: '#7c3aed' }]}>Marks</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionChip}
                        onPress={() => navigation?.navigate?.('AdmitCard', { examId: exam.rawId, examTitle: exam.title })}
                      >
                        <Ionicons name="card-outline" size={14} color="#059669" />
                        <Text style={[styles.cardActionChipText, { color: '#059669' }]}>Admit Cards</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionChip}
                        onPress={() => navigation?.navigate?.('Result', { examId: exam.rawId })}
                      >
                        <Ionicons name="ribbon-outline" size={14} color="#d97706" />
                        <Text style={[styles.cardActionChipText, { color: '#d97706' }]}>Results</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Expandable Timetable Section */}
                    {isExpanded && (
                      <View style={styles.timetableSection}>
                        <Text style={styles.timetableHeading}>Exam Datesheet & Papers</Text>
                        {isLoadingTt ? (
                          <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.smallLoadingText}>Loading datesheet slots...</Text>
                          </View>
                        ) : ttList.length > 0 ? (
                          <View style={{ gap: 8 }}>
                            {ttList.map((slot, idx) => (
                              <View key={slot.id || idx} style={styles.slotRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.slotSubject}>{slot.subject_name || slot.subject?.name || `Paper ${idx + 1}`}</Text>
                                  <Text style={styles.slotClass}>
                                    {slot.class_name ? `Class: ${slot.class_name}` : ''} {slot.room_number ? ` • Room: ${slot.room_number}` : ''}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text style={styles.slotDate}>{slot.exam_date || 'Date TBD'}</Text>
                                  <Text style={styles.slotTime}>{slot.start_time ? `${slot.start_time} - ${slot.end_time}` : 'Full Day'}</Text>
                                  <Text style={styles.slotMarks}>Max: {slot.max_marks || 100} • Pass: {slot.pass_marks || 33}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.noTimetableBox}>
                            <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                            <Text style={styles.noTimetableText}>No timetable papers scheduled yet for this exam.</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Principal Management Row (Publish, Unpublish, Delete) */}
                    {isPrincipalOrAdmin && (
                      <View style={styles.adminFooterRow}>
                        <TouchableOpacity
                          style={[styles.adminBtn, exam.isPublished ? styles.adminBtnWarning : styles.adminBtnSuccess]}
                          onPress={() => handleTogglePublish(exam.rawExam)}
                        >
                          <Ionicons name={exam.isPublished ? 'eye-off-outline' : 'checkmark-circle-outline'} size={14} color={exam.isPublished ? '#d97706' : '#16a34a'} />
                          <Text style={[styles.adminBtnText, { color: exam.isPublished ? '#d97706' : '#16a34a' }]}>
                            {exam.isPublished ? 'Unpublish' : 'Publish'}
                          </Text>
                        </TouchableOpacity>

                        {!exam.isPublished && (
                          <TouchableOpacity
                            style={[styles.adminBtn, styles.adminBtnDanger]}
                            onPress={() => handleDeleteExam(exam.rawExam)}
                          >
                            <Ionicons name="trash-outline" size={14} color="#dc2626" />
                            <Text style={[styles.adminBtnText, { color: '#dc2626' }]}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
                <Text style={styles.emptyCardTitle}>No Examinations Found</Text>
                <Text style={styles.emptyCardText}>No {activeTab.toLowerCase()} exams match this view.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Create Exam Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule New Examination</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.inputLabel}>Exam Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Mid-Term Assessment 2026"
                placeholderTextColor="#94a3b8"
                value={examName}
                onChangeText={setExamName}
              />

              <Text style={styles.inputLabel}>Exam Type *</Text>
              <View style={styles.typeGrid}>
                {EXAM_TYPES.map(t => {
                  const sel = examType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, sel && styles.typeChipSel]}
                      onPress={() => setExamType(t.id)}
                    >
                      <Text style={[styles.typeChipText, sel && styles.typeChipTextSel]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Academic Session *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-27"
                placeholderTextColor="#94a3b8"
                value={session}
                onChangeText={setSession}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                </View>
              </View>

              {classesList.length > 0 && (
                <>
                  <Text style={styles.inputLabel}>Participating Classes (Optional)</Text>
                  <View style={styles.classChipsWrap}>
                    {classesList.map(c => {
                      const sel = selectedClassIds.includes(c.id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.classChip, sel && styles.classChipSel]}
                          onPress={() => toggleClassSelect(c.id)}
                        >
                          <Text style={[styles.classChipText, sel && styles.classChipTextSel]}>
                            Class {c.name}{c.section ? `-${c.section}` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.createBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreateExam}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.createBtnText}>Create Exam Schedule</Text>
                </>
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
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBackBtn: { padding: 4 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  addExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addExamBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: '#0284c7' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  examCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  examTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  sessionText: { fontSize: 11, color: '#64748b', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  metaRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 12,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#475569', flex: 1 },
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  cardActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardActionChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  cardActionChipText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  timetableSection: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timetableHeading: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  slotSubject: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  slotClass: { fontSize: 11, color: '#64748b', marginTop: 2 },
  slotDate: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  slotTime: { fontSize: 11, color: '#64748b' },
  slotMarks: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  noTimetableBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  noTimetableText: { fontSize: 12, color: '#94a3b8' },
  smallLoadingText: { fontSize: 11, color: '#64748b', marginTop: 4 },
  adminFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  adminBtnSuccess: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  adminBtnWarning: { borderColor: '#fed7aa', backgroundColor: '#fffbeb' },
  adminBtnDanger: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  adminBtnText: { fontSize: 11, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptyCardText: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipSel: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeChipTextSel: { color: '#fff' },
  classChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  classChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  classChipSel: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  classChipText: { fontSize: 12, color: '#475569' },
  classChipTextSel: { color: '#fff', fontWeight: '600' },
  createBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
