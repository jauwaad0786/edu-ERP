// mob_app/src/screens/classes/ClassDetailScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function ClassDetailScreen({ navigation, route }) {
  const classId = route?.params?.classId;
  const initialClassName = route?.params?.className || 'Class Details';

  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'subjects' | 'timetable'
  const [data, setData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search in students
  const [searchStudent, setSearchStudent] = useState('');

  // Assign Teacher Modal
  const [teacherModalVisible, setTeacherModalVisible] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [assigningTeacher, setAssigningTeacher] = useState(false);

  // Add Subject Modal
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [submittingSubject, setSubmittingSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    teacher_id: '',
    max_marks: '100',
    pass_marks: '33',
  });

  const loadData = useCallback(async (isRefresh = false) => {
    if (!classId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [detailRes, tchRes, subjRes, ttRes] = await Promise.all([
        client.get(`/principal/classes/${classId}/detail`).catch(() => ({ data: null })),
        client.get('/principal/teachers').catch(() => ({ data: [] })),
        client.get('/principal/subjects', { params: { class_id: classId } }).catch(() => ({ data: [] })),
        client.get('/principal/timetables', { params: { class_id: classId } }).catch(() => ({ data: [] })),
      ]);

      setData(detailRes.data);

      const tList = Array.isArray(tchRes.data) ? tchRes.data : tchRes.data?.teachers || [];
      setTeachers(tList);

      const sList = Array.isArray(subjRes.data) ? subjRes.data : subjRes.data?.subjects || [];
      setSubjects(sList);

      const ttList = Array.isArray(ttRes.data) ? ttRes.data : [];
      if (ttList.length > 0) {
        setTimetable(ttList[0]);
        const pRes = await client.get(`/principal/timetables/${ttList[0].id}/periods`).catch(() => ({ data: [] }));
        setPeriods(Array.isArray(pRes.data) ? pRes.data : []);
      } else {
        setTimetable(null);
        setPeriods([]);
      }

      if (detailRes.data?.class_teacher?.teacher_id) {
        setSelectedTeacherId(detailRes.data.class_teacher.teacher_id);
      }
    } catch (err) {
      console.warn('Failed to load class details:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Assign Class Teacher
  const handleAssignTeacher = async () => {
    if (!selectedTeacherId) {
      Alert.alert('Required', 'Please select a teacher from the list.');
      return;
    }
    setAssigningTeacher(true);
    try {
      await client.post(`/principal/classes/${classId}/assign-teacher`, {
        teacher_id: parseInt(selectedTeacherId, 10),
      });
      Alert.alert('Success', 'Class teacher assigned successfully.');
      setTeacherModalVisible(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to assign class teacher.');
    } finally {
      setAssigningTeacher(false);
    }
  };

  // Add Subject to this Class
  const handleCreateSubject = async () => {
    if (!subjectForm.name.trim()) {
      Alert.alert('Required', 'Please enter a Subject Name.');
      return;
    }
    setSubmittingSubject(true);
    try {
      await client.post('/principal/subjects', {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase() || subjectForm.name.trim().slice(0, 4).toUpperCase(),
        class_id: parseInt(classId, 10),
        teacher_id: subjectForm.teacher_id ? parseInt(subjectForm.teacher_id, 10) : null,
        max_marks: parseInt(subjectForm.max_marks, 10) || 100,
        pass_marks: parseInt(subjectForm.pass_marks, 10) || 33,
      });

      Alert.alert('Subject Added', `Subject "${subjectForm.name}" created for this class!`);
      setSubjectModalVisible(false);
      setSubjectForm({ name: '', code: '', teacher_id: '', max_marks: '100', pass_marks: '33' });
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add subject.');
    } finally {
      setSubmittingSubject(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = (subj) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to remove "${subj.name}" from this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/subjects/${subj.id}`);
              Alert.alert('Deleted', 'Subject removed successfully.');
              loadData(true);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete subject.');
            }
          },
        },
      ]
    );
  };

  const clsInfo = data?.class || {};
  const studentsList = data?.students || [];

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!searchStudent.trim()) return studentsList;
    const q = searchStudent.toLowerCase();
    return studentsList.filter(s => {
      const name = (s.user?.name || s.name || '').toLowerCase();
      const roll = String(s.roll_number || '').toLowerCase();
      const adm = String(s.admission_number || '').toLowerCase();
      return name.includes(q) || roll.includes(q) || adm.includes(q);
    });
  }, [studentsList, searchStudent]);

  const totalStudents = studentsList.length;
  const attPct = data?.attendance?.rate != null ? Number(data.attendance.rate) : 92.5;
  const feeSummary = data?.fee_summary || {};
  const feeCleared = feeSummary.total_due > 0
    ? Math.min(100, Math.round(((feeSummary.total_paid || 0) / feeSummary.total_due) * 100))
    : 100;
  const topper = data?.topper;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Class {clsInfo.name || initialClassName} {clsInfo.section ? `(${clsInfo.section})` : ''}
          </Text>
          <Text style={styles.headerSubtitle}>
            Session: {clsInfo.session || '2026-27'} · Room: {clsInfo.room || 'A-101'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'students' && styles.tabBtnActive]}
          onPress={() => setActiveTab('students')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'students' ? '#ffffff' : '#64748b'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'students' && styles.tabBtnTextActive]}>
            Students ({totalStudents})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'subjects' && styles.tabBtnActive]}
          onPress={() => setActiveTab('subjects')}
        >
          <Ionicons
            name="book-outline"
            size={16}
            color={activeTab === 'subjects' ? '#ffffff' : '#64748b'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'subjects' && styles.tabBtnTextActive]}>
            Subjects ({subjects.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'timetable' && styles.tabBtnActive]}
          onPress={() => setActiveTab('timetable')}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'timetable' ? '#ffffff' : '#64748b'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, activeTab === 'timetable' && styles.tabBtnTextActive]}>
            Timetable
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading class records...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header KPI Cards */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{totalStudents}</Text>
              <Text style={styles.kpiLabel}>Enrolled</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{attPct}%</Text>
              <Text style={styles.kpiLabel}>Attendance</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiVal, { color: '#0284c7' }]}>{feeCleared}%</Text>
              <Text style={styles.kpiLabel}>Fee Cleared</Text>
            </View>
            {topper ? (
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiVal, { color: '#d97706' }]} numberOfLines={1}>
                  {topper.percentage != null ? `${topper.percentage}%` : 'Top'}
                </Text>
                <Text style={styles.kpiLabel} numberOfLines={1}>
                  {topper.name?.split(' ')[0] || 'Topper'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Class Teacher Card */}
          <View style={styles.teacherCard}>
            <View style={styles.teacherLeftBox}>
              <View style={styles.teacherAvatar}>
                <Ionicons name="person" size={20} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teacherRoleLabel}>CLASS TEACHER</Text>
                <Text style={styles.teacherName}>
                  {data?.class_teacher?.name || clsInfo.class_teacher_name || clsInfo.teacher_name || 'Not assigned yet'}
                </Text>
                <Text style={styles.teacherMeta}>
                  {data?.class_teacher?.phone || data?.class_teacher?.email || 'Tap to assign faculty'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => setTeacherModalVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color="#0284c7" />
              <Text style={styles.assignBtnText}>Assign</Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: STUDENTS */}
          {activeTab === 'students' && (
            <>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter by student name or roll number..."
                  placeholderTextColor="#94a3b8"
                  value={searchStudent}
                  onChangeText={setSearchStudent}
                />
                {searchStudent ? (
                  <TouchableOpacity onPress={() => setSearchStudent('')}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {filteredStudents.length > 0 ? (
                filteredStudents.map((s, i) => {
                  const sName = s.user?.name || s.name || `Student #${s.id}`;
                  const rollNo = s.roll_number || `${i + 1}`;
                  const admNo = s.admission_number || s.id;

                  return (
                    <TouchableOpacity
                      key={s.id || i}
                      style={styles.studentCard}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('StudentDetail', { studentId: s.id, studentName: sName })}
                    >
                      <View style={styles.rollCircle}>
                        <Text style={styles.rollText}>{rollNo}</Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.studentName}>{sName}</Text>
                        <Text style={styles.studentMeta}>Adm #{admNo} · Gender: {s.gender || '—'}</Text>
                        <Text style={styles.studentContact}>
                          Parent: {s.parent_name || 'Father'} · {s.parent_phone || 'No phone'}
                        </Text>
                      </View>

                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Students Found</Text>
                  <Text style={styles.emptySub}>No students enrolled or matching search in this class.</Text>
                </View>
              )}
            </>
          )}

          {/* TAB 2: SUBJECTS */}
          {activeTab === 'subjects' && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Curriculum Subjects ({subjects.length})</Text>
                <TouchableOpacity
                  style={styles.addSubjectBtn}
                  onPress={() => setSubjectModalVisible(true)}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={styles.addSubjectBtnText}>Add Subject</Text>
                </TouchableOpacity>
              </View>

              {subjects.length > 0 ? (
                subjects.map(subj => (
                  <View key={subj.id} style={styles.subjectCard}>
                    <View style={styles.subjectLeftBox}>
                      <View style={styles.subjectIconBox}>
                        <Ionicons name="book-outline" size={20} color="#7c3aed" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subjectName}>{subj.name}</Text>
                        <Text style={styles.subjectCode}>CODE: {subj.code || 'SUBJ'} · Max: {subj.max_marks || 100} / Pass: {subj.pass_marks || 33}</Text>
                        <Text style={styles.subjectTeacher}>
                          Teacher: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{subj.teacher_name || 'Not assigned'}</Text>
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteSubject(subj)}
                      style={styles.subjectDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="book-outline" size={42} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Subjects Assigned</Text>
                  <Text style={styles.emptySub}>Assign curriculum subjects to this class to manage periods and exams.</Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setSubjectModalVisible(true)}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.emptyActionText}>Add Subject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* TAB 3: TIMETABLE */}
          {activeTab === 'timetable' && (
            <>
              <View style={styles.timetablePreviewCard}>
                <View style={styles.ttHeaderRow}>
                  <View>
                    <Text style={styles.ttTitle}>{timetable?.title || 'Weekly Class Timetable'}</Text>
                    <Text style={styles.ttStatus}>
                      Status: {timetable?.status || 'DRAFT'} · {periods.length} Periods configured
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openTtBtn}
                    onPress={() => navigation?.navigate?.('Timetable', { selectedClassId: classId })}
                  >
                    <Text style={styles.openTtBtnText}>Full Editor</Text>
                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {periods.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.periodsHeading}>TODAY'S SCHEDULE PREVIEW</Text>
                    {periods.slice(0, 6).map((p, idx) => (
                      <View key={p.id || idx} style={styles.ttPeriodRow}>
                        <View style={styles.periodPill}>
                          <Text style={styles.periodPillText}>P{p.period_no}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.ttSubjName}>
                            {p.is_break ? (p.break_label || 'Recess') : (p.subject_name || 'Subject')}
                          </Text>
                          <Text style={styles.ttTime}>
                            {p.start_time || '09:00 AM'} - {p.end_time || '09:45 AM'} · Room: {p.room || 'A-101'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#64748b' }}>
                      No periods configured yet for this class.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ASSIGN TEACHER MODAL */}
      <Modal visible={teacherModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Class Teacher</Text>
              <TouchableOpacity onPress={() => setTeacherModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {teachers.map(t => {
                const isSel = String(selectedTeacherId) === String(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teacherPickRow, isSel && styles.teacherPickRowActive]}
                    onPress={() => setSelectedTeacherId(t.id)}
                  >
                    <View style={styles.teacherAvatar}>
                      <Ionicons name="person" size={18} color="#0284c7" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.teacherPickName, isSel && styles.teacherPickNameActive]}>
                        {t.name || `Faculty #${t.id}`}
                      </Text>
                      <Text style={styles.teacherPickMeta}>
                        Dept: {t.department || 'Academic'} · {t.phone || t.email || 'Active'}
                      </Text>
                    </View>
                    {isSel && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                onPress={handleAssignTeacher}
                disabled={assigningTeacher}
              >
                {assigningTeacher ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Save Class Teacher</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADD SUBJECT MODAL */}
      <Modal visible={subjectModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Subject to Class</Text>
              <TouchableOpacity onPress={() => setSubjectModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Subject Name *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Mathematics"
                placeholderTextColor="#94a3b8"
                value={subjectForm.name}
                onChangeText={t => setSubjectForm(f => ({ ...f, name: t, code: f.code || t.slice(0, 4).toUpperCase() }))}
              />

              <Text style={styles.fieldLabel}>Subject Code</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. MATH10"
                placeholderTextColor="#94a3b8"
                value={subjectForm.code}
                onChangeText={t => setSubjectForm(f => ({ ...f, code: t.toUpperCase() }))}
              />

              <Text style={styles.fieldLabel}>Assign Subject Teacher</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {teachers.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.smallChip, String(subjectForm.teacher_id) === String(t.id) && styles.smallChipActive]}
                    onPress={() => setSubjectForm(f => ({ ...f, teacher_id: String(t.id) }))}
                  >
                    <Text style={[styles.smallChipText, String(subjectForm.teacher_id) === String(t.id) && styles.smallChipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Max Marks</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="100"
                    placeholderTextColor="#94a3b8"
                    value={subjectForm.max_marks}
                    onChangeText={t => setSubjectForm(f => ({ ...f, max_marks: t }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Pass Marks</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="33"
                    placeholderTextColor="#94a3b8"
                    value={subjectForm.pass_marks}
                    onChangeText={t => setSubjectForm(f => ({ ...f, pass_marks: t }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                onPress={handleCreateSubject}
                disabled={submittingSubject}
              >
                {submittingSubject ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Create Subject</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  teacherCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  teacherLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teacherAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherRoleLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  teacherMeta: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  assignBtnText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  studentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rollCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  studentMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  studentContact: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  addSubjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addSubjectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  subjectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  subjectIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  subjectCode: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  subjectTeacher: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  subjectDeleteBtn: {
    padding: 6,
  },
  timetablePreviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ttHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  ttTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  ttStatus: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  openTtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  openTtBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  periodsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ttPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  periodPill: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  ttSubjName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  ttTime: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  smallChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  teacherPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  teacherPickRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdf4',
  },
  teacherPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  teacherPickNameActive: {
    color: colors.primary,
  },
  teacherPickMeta: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  saveSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
