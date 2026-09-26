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

const EXAM_TYPES = [
  { id: 'MID_TERM', label: 'Mid Term' },
  { id: 'FINAL', label: 'Final' },
  { id: 'UNIT_TEST', label: 'Unit Test' },
  { id: 'ANNUAL', label: 'Annual' },
  { id: 'HALF_YEARLY', label: 'Half Yearly' },
];

export default function ExaminationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Exam Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('MID_TERM');
  const [session, setSession] = useState('2026-27');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  const loadExams = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let res = await client.get('/principal/exams').catch(() => null);
      if (!res || !res.data) {
        res = await client.get('/results/terms').catch(() => null);
      }
      if (!res || !res.data) {
        res = await client.get('/marks/exams').catch(() => null);
      }

      const list = Array.isArray(res?.data)
        ? res.data
        : res?.data?.exams || res?.data?.terms || res?.data?.data || [];
      setExams(list);
    } catch (err) {
      console.warn('Failed to fetch exams:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const handleCreateExam = async () => {
    if (!examName.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Validation Error', 'Please enter Exam Name, Start Date (YYYY-MM-DD), and End Date (YYYY-MM-DD).');
      return;
    }

    setCreating(true);
    try {
      await client.post('/principal/exams', {
        exam_name: examName.trim(),
        exam_type: examType,
        session: session.trim() || '2026-27',
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        grading_system: 'STANDARD',
      });

      Alert.alert('Success', `Exam schedule "${examName.trim()}" created successfully.`);
      setModalVisible(false);
      setExamName('');
      setStartDate('');
      setEndDate('');
      loadExams();
    } catch (err) {
      Alert.alert('Creation Failed', err.response?.data?.error || 'Could not create exam schedule.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadAdmitCards = (examId) => {
    if (!examId) {
      if (exams.length > 0) examId = exams[0].id;
      else {
        Alert.alert('Notice', 'No exams available to generate admit cards.');
        return;
      }
    }
    const url = `${client.defaults.baseURL}/principal/exams/${examId}/admit-cards/bulk`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open admit cards download URL on this device.');
    });
  };

  const displayList = useMemo(() => {
    return exams.map((e, i) => {
      const rawStatus = (e.status || 'Upcoming').toLowerCase();
      const status = rawStatus === 'ongoing' ? 'Ongoing' : rawStatus === 'completed' || rawStatus === 'archived' ? 'Completed' : 'Upcoming';
      return {
        id: e.id || i,
        rawId: e.id,
        title: e.name || e.exam_name || e.title || e.term_name || `Exam ${i + 1}`,
        dates: e.start_date ? `${e.start_date}${e.end_date ? ' - ' + e.end_date : ''}` : 'Scheduled',
        classes: e.classes ? `Classes: ${Array.isArray(e.classes) ? e.classes.join(', ') : e.classes}` : 'All Classes',
        status: status,
        icon: status === 'Upcoming' ? 'calendar' : status === 'Ongoing' ? 'document-text' : 'ribbon',
        color: status === 'Upcoming' ? '#0284c7' : status === 'Ongoing' ? '#16a34a' : '#7c3aed',
        bg: status === 'Upcoming' ? '#e0f2fe' : status === 'Ongoing' ? '#dcfce7' : '#ede9fe',
      };
    });
  }, [exams]);

  const filteredExams = useMemo(() => {
    return displayList.filter(e => e.status.toLowerCase() === activeTab.toLowerCase());
  }, [displayList, activeTab]);

  const TABS = ['Upcoming', 'Ongoing', 'Completed'];

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
          <Text style={styles.headerTitle}>Examinations</Text>
        </View>

        <TouchableOpacity
          style={styles.addExamBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addExamBtnText}>New Exam</Text>
        </TouchableOpacity>
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
          <View style={{ gap: 12, marginBottom: 24 }}>
            {filteredExams.length > 0 ? (
              filteredExams.map(exam => (
                <View key={exam.id} style={styles.examCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.examIconCircle, { backgroundColor: exam.bg }]}>
                      <Ionicons name={exam.icon} size={22} color={exam.color} />
                    </View>

                    <View style={styles.examInfoCol}>
                      <Text style={styles.examTitle}>{exam.title}</Text>
                      <Text style={styles.examDates}>{exam.dates}</Text>
                      <Text style={styles.examClasses}>{exam.classes}</Text>
                    </View>

                    <View style={[
                      styles.statusPill,
                      exam.status === 'Upcoming' && styles.statusUpcoming,
                      exam.status === 'Ongoing' && styles.statusOngoing,
                      exam.status === 'Completed' && styles.statusCompleted,
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        exam.status === 'Upcoming' && { color: '#0284c7' },
                        exam.status === 'Ongoing' && { color: '#ea580c' },
                        exam.status === 'Completed' && { color: '#16a34a' },
                      ]}>
                        {exam.status}
                      </Text>
                    </View>
                  </View>

                  {/* Card Action Row */}
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      style={styles.cardActionChip}
                      onPress={() => navigation?.navigate?.('Marks', { examId: exam.rawId })}
                    >
                      <Ionicons name="create-outline" size={14} color="#0b57d0" />
                      <Text style={[styles.cardActionChipText, { color: '#0b57d0' }]}>Enter Marks</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cardActionChip}
                      onPress={() => handleDownloadAdmitCards(exam.rawId)}
                    >
                      <Ionicons name="card-outline" size={14} color="#7c3aed" />
                      <Text style={[styles.cardActionChipText, { color: '#7c3aed' }]}>Admit Cards</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cardActionChip}
                      onPress={() => {
                        try {
                          navigation?.navigate?.('Result', { examId: exam.rawId });
                        } catch {
                          navigation?.navigate?.('Results', { examId: exam.rawId });
                        }
                      }}
                    >
                      <Ionicons name="ribbon-outline" size={14} color="#16a34a" />
                      <Text style={[styles.cardActionChipText, { color: '#16a34a' }]}>Results</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyCardText}>No {activeTab.toLowerCase()} exams found</Text>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionHeading}>Quick Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => setModalVisible(true)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="calendar-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionLabel}>Create Exam Schedule</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => handleDownloadAdmitCards()}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="card-outline" size={18} color="#7c3aed" />
              </View>
              <Text style={styles.actionLabel}>Generate Admit Cards (PDF)</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('Marks')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="create-outline" size={18} color="#16a34a" />
              </View>
              <Text style={styles.actionLabel}>Enter / View Marks</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                try {
                  navigation?.navigate?.('Result');
                } catch {
                  navigation?.navigate?.('Results');
                }
              }}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="trophy-outline" size={18} color="#d97706" />
              </View>
              <Text style={styles.actionLabel}>Result Cards & Performance</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Create Exam Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Exam Term</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Exam Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Annual Examinations 2026-27"
                placeholderTextColor="#94a3b8"
                value={examName}
                onChangeText={setExamName}
              />

              <Text style={styles.modalLabel}>Exam Type *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {EXAM_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, examType === t.id && styles.typeChipActive]}
                    onPress={() => setExamType(t.id)}
                  >
                    <Text style={[styles.typeChipText, examType === t.id && styles.typeChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Academic Session</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-27"
                placeholderTextColor="#94a3b8"
                value={session}
                onChangeText={setSession}
              />

              <Text style={styles.modalLabel}>Start Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-10-15"
                placeholderTextColor="#94a3b8"
                value={startDate}
                onChangeText={setStartDate}
              />

              <Text style={styles.modalLabel}>End Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-10-30"
                placeholderTextColor="#94a3b8"
                value={endDate}
                onChangeText={setEndDate}
              />

              <TouchableOpacity
                style={[styles.modalSubmitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateExam}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Create Exam Schedule</Text>
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
  headerBackBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  addExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addExamBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabBtnTextActive: { color: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 36 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  examCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  examIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  examInfoCol: { flex: 1 },
  examTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  examDates: { fontSize: 12, color: '#0284c7', fontWeight: '600', marginTop: 2 },
  examClasses: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusUpcoming: { backgroundColor: '#e0f2fe' },
  statusOngoing: { backgroundColor: '#ffedd5' },
  statusCompleted: { backgroundColor: '#dcfce7' },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardActionChipText: { fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardText: { marginTop: 8, fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 12, textTransform: 'uppercase' },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1e293b' },
  actionRowDivider: { height: 1, backgroundColor: '#f1f5f9' },
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  modalInput: {
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
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  typeChipTextActive: { color: '#ffffff' },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
