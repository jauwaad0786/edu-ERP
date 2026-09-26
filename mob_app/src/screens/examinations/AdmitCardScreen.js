// mob_app/src/screens/examinations/AdmitCardScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Alert, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function AdmitCardScreen({ route, navigation }) {
  const { user } = useAuth();
  const role = getattrRole(user);
  const isStudentOrParent = role === 'STUDENT' || role === 'PARENT';

  const initialExamId = route?.params?.examId || null;

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Student/Parent profile data
  const [studentProfile, setStudentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [timetable, setTimetable] = useState([]);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  // Preview modal for admin/teacher
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewTimetable, setPreviewTimetable] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  function getattrRole(u) {
    if (!u) return '';
    return typeof u.role === 'object' ? u.role?.value || '' : String(u.role || '');
  }

  // Load initial exams, classes, and student profile
  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isStudentOrParent) {
        const [examRes, profileRes] = await Promise.all([
          client.get('/principal/exams').catch(() => client.get('/results/terms').catch(() => ({ data: [] }))),
          client.get('/student/profile').catch(() => null),
        ]);

        const allExams = Array.isArray(examRes.data)
          ? examRes.data
          : examRes.data?.exams || examRes.data?.terms || [];
        setExams(allExams);

        if (allExams.length > 0 && !selectedExamId) {
          const defaultEx = allExams.find(e => e.status === 'PUBLISHED' || e.is_published) || allExams[0];
          setSelectedExamId(defaultEx.id);
        }

        if (profileRes?.data) {
          if (role === 'PARENT' && Array.isArray(profileRes.data.children)) {
            setChildren(profileRes.data.children);
            const firstChild = profileRes.data.children[0];
            setSelectedChildId(firstChild?.id || null);
            setStudentProfile(firstChild || null);
          } else {
            setStudentProfile(profileRes.data);
          }
        }
      } else {
        const [examRes, clsRes] = await Promise.all([
          client.get('/principal/exams').catch(() => ({ data: [] })),
          client.get('/principal/classes').catch(() => ({ data: [] })),
        ]);

        const allExams = Array.isArray(examRes.data) ? examRes.data : examRes.data?.exams || [];
        setExams(allExams);
        if (allExams.length > 0 && !selectedExamId) {
          const defaultEx = allExams.find(e => e.status === 'PUBLISHED' || e.is_published) || allExams[0];
          setSelectedExamId(defaultEx.id);
        }

        const cls = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
        setClasses(cls);
        if (cls.length > 0 && !selectedClassId) {
          setSelectedClassId(cls[0].id);
        }
      }
    } catch (err) {
      console.warn('Error loading admit card data:', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isStudentOrParent, role, selectedExamId, selectedClassId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load students for Admin/Teacher when class changes
  const fetchStudents = useCallback(async () => {
    if (isStudentOrParent || !selectedClassId) return;
    setLoadingStudents(true);
    try {
      const res = await client.get(`/principal/students?class_id=${selectedClassId}`);
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : raw?.students || []);
      setStudents(list);
    } catch (err) {
      console.warn('Failed to load students:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [isStudentOrParent, selectedClassId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Load Timetable for Student/Parent
  useEffect(() => {
    if (!isStudentOrParent || !selectedExamId) return;
    const effectiveClassId = studentProfile?.class_id || studentProfile?.class?.id;
    if (!effectiveClassId) return;

    setLoadingTimetable(true);
    client.get(`/principal/exams/${selectedExamId}/timetable?class_id=${effectiveClassId}`)
      .then(res => setTimetable(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTimetable([]))
      .finally(() => setLoadingTimetable(false));
  }, [isStudentOrParent, selectedExamId, studentProfile]);

  // Handle Child Switch (for Parent)
  const handleSelectChild = (child) => {
    setSelectedChildId(child.id);
    setStudentProfile(child);
  };

  // Preview Student Admit Card (Admin/Teacher)
  const openPreview = async (stu) => {
    setPreviewStudent(stu);
    setLoadingPreview(true);
    try {
      const cId = stu.class_id || stu.class?.id || selectedClassId;
      const res = await client.get(`/principal/exams/${selectedExamId}/timetable?class_id=${cId}`);
      setPreviewTimetable(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPreviewTimetable([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Download Individual Admit Card PDF
  const handleDownloadSingle = (studentId, studentName) => {
    if (!selectedExamId) {
      Alert.alert('Notice', 'Please select an examination first.');
      return;
    }
    const targetStudentId = studentId || studentProfile?.id;
    if (!targetStudentId) {
      Alert.alert('Error', 'Student record not found.');
      return;
    }

    const url = `${client.defaults.baseURL}/principal/admit-card/${targetStudentId}/${selectedExamId}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open admit card download link on this device.');
    });
  };

  // Bulk Download Class Admit Cards (Admin/Teacher)
  const handleBulkDownload = () => {
    if (!selectedExamId) {
      Alert.alert('Notice', 'Please select an examination.');
      return;
    }
    let url = `${client.defaults.baseURL}/principal/exams/${selectedExamId}/admit-cards/bulk`;
    if (selectedClassId) {
      url += `?class_id=${selectedClassId}`;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open bulk admit cards download URL.');
    });
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(s => {
      const name = (s.name || s.user?.name || '').toLowerCase();
      const roll = String(s.roll_number || s.roll_no || '').toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [students, searchQuery]);

  const selectedExam = exams.find(e => e.id === selectedExamId);

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
            <Text style={styles.headerTitle}>Examination Admit Cards</Text>
            <Text style={styles.headerSubtitle}>Hall ticket verification & schedules</Text>
          </View>
        </View>

        {!isStudentOrParent && (
          <TouchableOpacity
            style={styles.bulkBtn}
            onPress={handleBulkDownload}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.bulkBtnText}>Bulk PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Parent Multi-Child Switcher */}
      {role === 'PARENT' && children.length > 1 && (
        <View style={styles.childBar}>
          <Text style={styles.childBarLabel}>Select Student:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {children.map(ch => {
              const sel = selectedChildId === ch.id;
              return (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.childChip, sel && styles.childChipActive]}
                  onPress={() => handleSelectChild(ch)}
                >
                  <Ionicons name="person" size={13} color={sel ? '#fff' : '#64748b'} />
                  <Text style={[styles.childChipText, sel && styles.childChipTextActive]}>
                    {ch.name || ch.user?.name || `Child ${ch.id}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Exam Selector Carousel */}
      <View style={styles.filterSection}>
        <Text style={styles.filterSectionLabel}>Select Examination Term:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {exams.map(e => {
            const sel = selectedExamId === e.id;
            return (
              <TouchableOpacity
                key={e.id}
                style={[styles.examChip, sel && styles.examChipActive]}
                onPress={() => setSelectedExamId(e.id)}
              >
                <Ionicons name="ribbon-outline" size={14} color={sel ? '#fff' : '#0284c7'} />
                <Text style={[styles.examChipText, sel && styles.examChipTextActive]}>
                  {e.exam_name || e.name || `Exam ${e.id}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Class Selector for Admin/Teacher */}
        {!isStudentOrParent && classes.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.filterSectionLabel}>Select Class:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {classes.map(c => {
                const sel = selectedClassId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classChip, sel && styles.classChipActive]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.classChipText, sel && styles.classChipTextActive]}>
                      Class {c.name}{c.section ? ` (${c.section})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching admit card records...</Text>
        </View>
      ) : isStudentOrParent ? (
        /* Student/Parent Admit Card View */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadInitialData(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.admitCardBox}>
            {/* Card Header Banner */}
            <View style={styles.admitHeaderBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.schoolTitle}>OFFICIAL EXAMINATION HALL TICKET</Text>
                <Text style={styles.examBannerTitle}>{selectedExam?.exam_name || 'Academic Assessment'}</Text>
                <Text style={styles.examBannerSub}>Session: {selectedExam?.session || '2026-27'}</Text>
              </View>
              <View style={styles.admitBadge}>
                <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
                <Text style={styles.admitBadgeText}>VERIFIED</Text>
              </View>
            </View>

            {/* Student Info Details */}
            <View style={styles.studentDetailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Student Name:</Text>
                <Text style={styles.detailValue}>{studentProfile?.name || studentProfile?.user?.name || user?.name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Roll Number:</Text>
                <Text style={styles.detailValue}>{studentProfile?.roll_number || studentProfile?.roll_no || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class / Section:</Text>
                <Text style={styles.detailValue}>
                  {studentProfile?.class_name || (studentProfile?.class ? `${studentProfile.class.name} - ${studentProfile.class.section}` : '—')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Father / Guardian:</Text>
                <Text style={styles.detailValue}>{studentProfile?.father_name || studentProfile?.parent_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Exam Dates:</Text>
                <Text style={styles.detailValue}>
                  {selectedExam?.start_date ? `${selectedExam.start_date} to ${selectedExam.end_date}` : 'Dates TBD'}
                </Text>
              </View>
            </View>

            {/* Paper Schedule Table */}
            <View style={styles.timetableCard}>
              <Text style={styles.timetableTitle}>Scheduled Exam Papers</Text>
              {loadingTimetable ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : timetable.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {timetable.map((item, idx) => (
                    <View key={item.id || idx} style={styles.paperRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paperName}>{item.subject_name || item.subject?.name || `Paper ${idx + 1}`}</Text>
                        <Text style={styles.paperMeta}>
                          {item.room_number ? `Room: ${item.room_number} • ` : ''}Max: {item.max_marks || 100}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.paperDate}>{item.exam_date || 'Date TBD'}</Text>
                        <Text style={styles.paperTime}>{item.start_time ? `${item.start_time} - ${item.end_time}` : 'Scheduled'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noTimetable}>
                  <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                  <Text style={styles.noTimetableText}>No specific papers scheduled for this class yet.</Text>
                </View>
              )}
            </View>

            {/* General Instructions */}
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsTitle}>Candidate Instructions:</Text>
              <Text style={styles.instructionItem}>1. Candidates must arrive at the examination hall 15 minutes before start time.</Text>
              <Text style={styles.instructionItem}>2. Bring this official Admit Card along with your School ID card.</Text>
              <Text style={styles.instructionItem}>3. Electronic devices, smartwatches, and unauthorized materials are strictly prohibited.</Text>
            </View>

            {/* Download PDF Button */}
            <TouchableOpacity
              style={styles.downloadPdfBtn}
              onPress={() => handleDownloadSingle(studentProfile?.id, studentProfile?.name)}
              activeOpacity={0.8}
            >
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.downloadPdfBtnText}>Download Official Admit Card (PDF)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* Principal/Teacher Student Roster View */
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search student by name or roll number..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadInitialData(true)}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {loadingStudents ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading class students...</Text>
              </View>
            ) : filteredStudents.length > 0 ? (
              <View style={{ gap: 10 }}>
                {filteredStudents.map((s, idx) => {
                  const sName = s.name || s.user?.name || `Student ${idx + 1}`;
                  const sRoll = s.roll_number || s.roll_no || idx + 1;
                  return (
                    <View key={s.id || idx} style={styles.studentCard}>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentAvatarText}>{sName.charAt(0).toUpperCase()}</Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.studentName} numberOfLines={1}>{sName}</Text>
                        <Text style={styles.studentRoll}>Roll #{sRoll} {s.admission_number ? ` • Adm: ${s.admission_number}` : ''}</Text>
                      </View>

                      <View style={styles.studentActions}>
                        <TouchableOpacity
                          style={styles.previewBtn}
                          onPress={() => openPreview(s)}
                        >
                          <Ionicons name="eye-outline" size={16} color="#0284c7" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.downloadIconBtn}
                          onPress={() => handleDownloadSingle(s.id, sName)}
                        >
                          <Ionicons name="download-outline" size={16} color="#059669" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={44} color="#94a3b8" />
                <Text style={styles.emptyCardTitle}>No Students Found</Text>
                <Text style={styles.emptyCardText}>No students match this class or search query.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Admin/Teacher Preview Modal */}
      <Modal
        visible={Boolean(previewStudent)}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Admit Card Preview</Text>
                <Text style={styles.modalSubtitle}>{selectedExam?.exam_name || 'Exam Hall Ticket'}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewStudent(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.previewBox}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Candidate:</Text>
                  <Text style={styles.previewVal}>{previewStudent?.name || previewStudent?.user?.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Roll Number:</Text>
                  <Text style={styles.previewVal}>{previewStudent?.roll_number || previewStudent?.roll_no || '—'}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Father Name:</Text>
                  <Text style={styles.previewVal}>{previewStudent?.father_name || previewStudent?.parent_name || '—'}</Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 14, marginBottom: 8 }}>
                Timetable Slots
              </Text>
              {loadingPreview ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 14 }} />
              ) : previewTimetable.length > 0 ? (
                <View style={{ gap: 6 }}>
                  {previewTimetable.map((slot, i) => (
                    <View key={i} style={styles.previewSlotRow}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b', flex: 1 }}>
                        {slot.subject_name || slot.subject?.name || `Paper ${i + 1}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0284c7' }}>{slot.exam_date || 'TBD'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>No datesheet entries found for this class.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDownloadBtn}
              onPress={() => {
                handleDownloadSingle(previewStudent?.id, previewStudent?.name);
                setPreviewStudent(null);
              }}
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.modalDownloadBtnText}>Download PDF Admit Card</Text>
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
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  bulkBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  childBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  childBarLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  childChipActive: { backgroundColor: '#0284c7' },
  childChipText: { fontSize: 12, color: '#64748b' },
  childChipTextActive: { color: '#fff', fontWeight: '600' },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterSectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  examChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  examChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  examChipText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  examChipTextActive: { color: '#fff' },
  classChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: '#334155', borderColor: '#334155' },
  classChipText: { fontSize: 12, color: '#475569' },
  classChipTextActive: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  admitCardBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  admitHeaderBanner: {
    backgroundColor: '#0f172a',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  schoolTitle: { fontSize: 10, fontWeight: '800', color: '#38bdf8', letterSpacing: 0.5 },
  examBannerTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  examBannerSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  admitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  admitBadgeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  studentDetailsGrid: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: '#64748b' },
  detailValue: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  timetableCard: { padding: 16 },
  timetableTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  paperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  paperName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  paperMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  paperDate: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  paperTime: { fontSize: 11, color: '#64748b' },
  noTimetable: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  noTimetableText: { fontSize: 12, color: '#94a3b8' },
  instructionsBox: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  instructionsTitle: { fontSize: 12, fontWeight: '700', color: '#b45309', marginBottom: 4 },
  instructionItem: { fontSize: 11, color: '#92400e', lineHeight: 16 },
  downloadPdfBtn: {
    backgroundColor: '#0284c7',
    margin: 16,
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  downloadPdfBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: { color: '#0284c7', fontWeight: '700', fontSize: 14 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  studentRoll: { fontSize: 11, color: '#64748b', marginTop: 2 },
  studentActions: { flexDirection: 'row', gap: 6 },
  previewBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  downloadIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
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
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
  previewBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { fontSize: 12, color: '#64748b' },
  previewVal: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  previewSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalDownloadBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  modalDownloadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
