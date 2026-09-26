// mob_app/src/screens/marks/MarksScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

function computeGrade(obt, max) {
  if (!max || max <= 0) return '—';
  const pct = (Number(obt || 0) / Number(max)) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

export default function MarksScreen({ route, navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipal = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN'].includes(role);

  const initialExamId = route?.params?.examId || null;
  const initialClassId = route?.params?.classId || null;
  const initialSubjectId = route?.params?.subjectId || null;

  const [activeMainTab, setActiveMainTab] = useState('Entry'); // 'Entry' | 'Toppers'

  // Dropdown lists
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Selected filters
  const [selectedClass, setSelectedClass] = useState(initialClassId);
  const [selectedExam, setSelectedExam] = useState(initialExamId);
  const [selectedSubject, setSelectedSubject] = useState(initialSubjectId);

  // Roster & Meta
  const [roster, setRoster] = useState([]);
  const [maxMarks, setMaxMarks] = useState(100);
  const [passMarks, setPassMarks] = useState(33);
  const [isLocked, setIsLocked] = useState(false);
  const [subjectStatus, setSubjectStatus] = useState(null);

  // Form State: { [studentId]: { marks: '', isAbsent: false, remarks: '' } }
  const [studentEntries, setStudentEntries] = useState({});

  // Loading states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Toppers State
  const [topperScope, setTopperScope] = useState('school'); // 'school' | 'class' | 'subject'
  const [toppersList, setToppersList] = useState([]);
  const [loadingToppers, setLoadingToppers] = useState(false);

  // 1. Load initial dropdowns
  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingInitial(true);
    try {
      const [clsRes, exRes, subRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/exams').catch(() => ({ data: [] })),
        client.get('/principal/subjects').catch(() => ({ data: [] })),
      ]);

      const clsList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      const exList = Array.isArray(exRes.data) ? exRes.data : exRes.data?.exams || [];
      const subList = Array.isArray(subRes.data) ? subRes.data : subRes.data?.subjects || [];

      setClasses(clsList);
      setExams(exList);
      setSubjects(subList);

      if (clsList.length > 0 && !selectedClass) setSelectedClass(clsList[0].id);
      if (exList.length > 0 && !selectedExam) setSelectedExam(exList[0].id);
      if (subList.length > 0 && !selectedSubject) setSelectedSubject(subList[0].id);
    } catch (err) {
      console.warn('Failed to load initial marks data:', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingInitial(false);
    }
  }, [selectedClass, selectedExam, selectedSubject]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Filter subjects for the selected class if class has subject list
  const filteredSubjects = useMemo(() => {
    if (!selectedClass) return subjects;
    const clsObj = classes.find(c => c.id === selectedClass);
    if (clsObj?.subjects && Array.isArray(clsObj.subjects) && clsObj.subjects.length > 0) {
      return clsObj.subjects;
    }
    const matched = subjects.filter(s => s.class_id === selectedClass);
    return matched.length > 0 ? matched : subjects;
  }, [subjects, selectedClass, classes]);

  useEffect(() => {
    if (filteredSubjects.length > 0 && (!selectedSubject || !filteredSubjects.some(s => s.id === selectedSubject))) {
      setSelectedSubject(filteredSubjects[0].id);
    }
  }, [filteredSubjects, selectedSubject]);

  // 2. Load roster when filters change
  const loadRoster = useCallback(async () => {
    if (!selectedClass || !selectedExam || !selectedSubject) return;
    setLoadingRoster(true);
    try {
      const res = await client.get('/marks/roster', {
        params: {
          class_id: selectedClass,
          exam_id: selectedExam,
          subject_id: selectedSubject,
        },
      });

      const data = res.data || {};
      const studentsList = data.students || (Array.isArray(data) ? data : []);
      const maxM = Number(data.max_marks || 100);
      const passM = Number(data.pass_marks || 33);
      const locked = Boolean(data.is_locked);

      setRoster(studentsList);
      setMaxMarks(maxM);
      setPassMarks(passM);
      setIsLocked(locked);

      // Pre-fill entries
      const initialMap = {};
      studentsList.forEach(s => {
        const sid = s.student_id || s.id;
        initialMap[sid] = {
          marks: s.marks_obtained != null ? String(s.marks_obtained) : '',
          isAbsent: Boolean(s.is_absent),
          remarks: s.remarks || '',
        };
      });
      setStudentEntries(initialMap);
    } catch (err) {
      console.warn('Failed to load marks roster:', err);
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedClass, selectedExam, selectedSubject]);

  useEffect(() => {
    if (activeMainTab === 'Entry') {
      loadRoster();
    }
  }, [activeMainTab, loadRoster]);

  // 3. Load Toppers
  const loadToppers = useCallback(async () => {
    if (!selectedExam) return;
    setLoadingToppers(true);
    try {
      let endpoint = `/marks/toppers/${topperScope}?exam_id=${selectedExam}`;
      if (topperScope === 'class' && selectedClass) {
        endpoint += `&class_id=${selectedClass}`;
      } else if (topperScope === 'subject' && selectedSubject) {
        endpoint += `&subject_id=${selectedSubject}`;
        if (selectedClass) endpoint += `&class_id=${selectedClass}`;
      }

      const res = await client.get(endpoint);
      const list = Array.isArray(res.data) ? res.data : [];
      setToppersList(list);
    } catch (err) {
      console.warn('Failed to load toppers:', err);
      setToppersList([]);
    } finally {
      setLoadingToppers(false);
    }
  }, [selectedExam, topperScope, selectedClass, selectedSubject]);

  useEffect(() => {
    if (activeMainTab === 'Toppers') {
      loadToppers();
    }
  }, [activeMainTab, loadToppers]);

  // Entry updates
  const handleScoreChange = (sid, val) => {
    setStudentEntries(prev => ({
      ...prev,
      [sid]: { ...prev[sid], marks: val, isAbsent: false },
    }));
  };

  const handleToggleAbsent = (sid) => {
    setStudentEntries(prev => {
      const curr = prev[sid] || {};
      const newAbsent = !curr.isAbsent;
      return {
        ...prev,
        [sid]: {
          ...curr,
          isAbsent: newAbsent,
          marks: newAbsent ? '0' : curr.marks === '0' ? '' : curr.marks,
        },
      };
    });
  };

  // Save Marks Draft
  const handleSaveMarks = async () => {
    if (!selectedClass || !selectedExam || !selectedSubject) {
      Alert.alert('Notice', 'Please select Class, Exam, and Subject.');
      return;
    }

    const entries = roster.map(s => {
      const sid = s.student_id || s.id;
      const state = studentEntries[sid] || {};
      const isAb = Boolean(state.isAbsent);
      const numScore = isAb ? 0 : Number(state.marks || 0);

      return {
        student_id: sid,
        marks_obtained: numScore,
        max_marks: maxMarks,
        is_absent: isAb,
        remarks: state.remarks || 'Saved via Mobile ERP',
      };
    });

    setSaving(true);
    try {
      await client.post('/marks/save', {
        class_id: selectedClass,
        exam_id: selectedExam,
        subject_id: selectedSubject,
        entries,
      });
      Alert.alert('Success', `Saved marks for ${entries.length} students.`);
      loadRoster();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Could not save marks.');
    } finally {
      setSaving(false);
    }
  };

  // Submit to Principal (RMS Workflow)
  const handleSubmitToPrincipal = async () => {
    if (!selectedClass || !selectedExam || !selectedSubject) return;

    Alert.alert(
      'Submit Marks for Review',
      'Once submitted, the Principal will review and approve these marks. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              // Pehle save karo
              await handleSaveMarks();
              // Fir submit endpoint call karo
              await client.post('/results/submit', {
                exam_id: selectedExam,
                class_id: selectedClass,
                subject_id: selectedSubject,
              }).catch(() => {});

              Alert.alert('Submitted', 'Marks have been submitted to the Principal for verification.');
              loadRoster();
            } catch (err) {
              Alert.alert('Submission Error', err.response?.data?.error || 'Failed to submit marks.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {navigation?.canGoBack?.() && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Marks Evaluation</Text>
              <Text style={styles.headerSub}>Grading roster & topper analytics</Text>
            </View>
          </View>

          {activeMainTab === 'Entry' && roster.length > 0 && !isLocked && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.saveHeaderBtn}
                onPress={handleSaveMarks}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={15} color="#fff" />
                    <Text style={styles.saveHeaderBtnText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitHeaderBtn}
                onPress={handleSubmitToPrincipal}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={styles.saveHeaderBtnText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Main Tab Switcher */}
        <View style={styles.mainTabs}>
          <TouchableOpacity
            style={[styles.mainTab, activeMainTab === 'Entry' && styles.mainTabActive]}
            onPress={() => setActiveMainTab('Entry')}
          >
            <Ionicons name="create-outline" size={15} color={activeMainTab === 'Entry' ? '#fff' : '#94a3b8'} />
            <Text style={[styles.mainTabText, activeMainTab === 'Entry' && styles.mainTabTextActive]}>
              Marks Entry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTab, activeMainTab === 'Toppers' && styles.mainTabActive]}
            onPress={() => setActiveMainTab('Toppers')}
          >
            <Ionicons name="trophy-outline" size={15} color={activeMainTab === 'Toppers' ? '#fff' : '#94a3b8'} />
            <Text style={[styles.mainTabText, activeMainTab === 'Toppers' && styles.mainTabTextActive]}>
              Toppers & Ranks
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Class Row */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Class:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {classes.map(c => {
              const sel = selectedClass === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, sel && styles.pillActive]}
                  onPress={() => setSelectedClass(c.id)}
                >
                  <Text style={[styles.pillText, sel && styles.pillTextActive]}>
                    Class {c.name}{c.section ? ` (${c.section})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Exam Row */}
        {exams.length > 0 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Exam:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {exams.map(e => {
                const sel = selectedExam === e.id;
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.pill, sel && styles.pillActive]}
                    onPress={() => setSelectedExam(e.id)}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextActive]}>
                      {e.exam_name || e.name || `Exam ${e.id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Subject Row (for Entry or Subject Topper) */}
        {(activeMainTab === 'Entry' || topperScope === 'subject') && filteredSubjects.length > 0 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Subject:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {filteredSubjects.map(sub => {
                const sel = selectedSubject === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.pill, sel && styles.pillActive]}
                    onPress={() => setSelectedSubject(sub.id)}
                  >
                    <Text style={[styles.pillText, sel && styles.pillTextActive]}>
                      {sub.name || sub.subject_name || `Subject ${sub.id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main Body */}
      {loadingInitial ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching assessment parameters...</Text>
        </View>
      ) : activeMainTab === 'Entry' ? (
        /* MARKS ENTRY TAB */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                loadInitialData(true);
                loadRoster();
              }}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Marks Meta Banner */}
          <View style={styles.metaBanner}>
            <View style={styles.metaCol}>
              <Text style={styles.metaTitle}>Max Marks</Text>
              <Text style={styles.metaVal}>{maxMarks}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={styles.metaTitle}>Pass Marks</Text>
              <Text style={styles.metaVal}>{passMarks}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={styles.metaTitle}>Students</Text>
              <Text style={styles.metaVal}>{roster.length}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={styles.metaTitle}>Status</Text>
              <Text style={[styles.metaVal, isLocked ? { color: '#dc2626' } : { color: '#16a34a' }]}>
                {isLocked ? 'Locked' : 'Open'}
              </Text>
            </View>
          </View>

          {isLocked && (
            <View style={styles.lockedNotice}>
              <Ionicons name="lock-closed" size={16} color="#dc2626" />
              <Text style={styles.lockedNoticeText}>
                Marks are locked by the Principal. No further edits are allowed.
              </Text>
            </View>
          )}

          {loadingRoster ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading student roster...</Text>
            </View>
          ) : roster.length > 0 ? (
            <View style={styles.rosterCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="list-outline" size={18} color="#0284c7" />
                <Text style={styles.cardTitle}>Student Grading Roster ({roster.length})</Text>
              </View>

              {roster.map((s, idx) => {
                const sid = s.student_id || s.id;
                const sName = s.name || s.user?.name || `Student ${idx + 1}`;
                const sRoll = s.roll_number || s.roll_no || idx + 1;
                const state = studentEntries[sid] || {};
                const isAb = Boolean(state.isAbsent);
                const score = state.marks ?? '';
                const grade = isAb ? 'AB' : computeGrade(score, maxMarks);
                const isOverMax = Number(score) > maxMarks;

                return (
                  <View
                    key={sid}
                    style={[
                      styles.studentRow,
                      idx === roster.length - 1 && { borderBottomWidth: 0 },
                      isAb && styles.studentRowAbsent,
                    ]}
                  >
                    <View style={[styles.avatarCircle, isAb && { backgroundColor: '#fee2e2' }]}>
                      <Text style={[styles.avatarInitial, isAb && { color: '#dc2626' }]}>
                        {isAb ? '✕' : sName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.nameText} numberOfLines={1}>{sName}</Text>
                      <Text style={styles.subText}>Roll #{sRoll}</Text>
                    </View>

                    {/* Absent Toggle Button */}
                    <TouchableOpacity
                      style={[styles.absentToggle, isAb && styles.absentToggleActive]}
                      onPress={() => !isLocked && handleToggleAbsent(sid)}
                      disabled={isLocked}
                    >
                      <Text style={[styles.absentToggleText, isAb && styles.absentToggleTextActive]}>
                        {isAb ? 'ABSENT' : 'Present'}
                      </Text>
                    </TouchableOpacity>

                    {/* Marks Input */}
                    <View style={[styles.scoreInputWrapper, isOverMax && { borderColor: '#dc2626' }]}>
                      <TextInput
                        style={[styles.scoreInput, isAb && { color: '#94a3b8' }]}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        value={isAb ? '0' : score}
                        editable={!isAb && !isLocked}
                        onChangeText={(val) => handleScoreChange(sid, val)}
                      />
                      <Text style={styles.maxMarkText}>/{maxMarks}</Text>
                    </View>

                    {/* Grade Chip */}
                    <View style={[
                      styles.gradeChip,
                      grade === 'A+' || grade === 'A' ? styles.gradeA :
                      grade === 'B+' || grade === 'B' ? styles.gradeB :
                      grade === 'C' ? styles.gradeC :
                      grade === 'AB' ? styles.gradeAB : styles.gradeFail
                    ]}>
                      <Text style={styles.gradeChipText}>{grade}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Students Found</Text>
              <Text style={styles.emptyCardText}>Select a valid Class, Exam, and Subject to view the grading roster.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* TOPPERS & RANKINGS TAB */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadToppers}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Scope Selector Subtabs */}
          <View style={styles.scopeTabs}>
            <TouchableOpacity
              style={[styles.scopeTab, topperScope === 'school' && styles.scopeTabActive]}
              onPress={() => setTopperScope('school')}
            >
              <Ionicons name="ribbon" size={14} color={topperScope === 'school' ? '#fff' : '#64748b'} />
              <Text style={[styles.scopeTabText, topperScope === 'school' && styles.scopeTabTextActive]}>
                School Toppers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeTab, topperScope === 'class' && styles.scopeTabActive]}
              onPress={() => setTopperScope('class')}
            >
              <Ionicons name="school" size={14} color={topperScope === 'class' ? '#fff' : '#64748b'} />
              <Text style={[styles.scopeTabText, topperScope === 'class' && styles.scopeTabTextActive]}>
                Class Toppers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeTab, topperScope === 'subject' && styles.scopeTabActive]}
              onPress={() => setTopperScope('subject')}
            >
              <Ionicons name="book" size={14} color={topperScope === 'subject' ? '#fff' : '#64748b'} />
              <Text style={[styles.scopeTabText, topperScope === 'subject' && styles.scopeTabTextActive]}>
                Subject Toppers
              </Text>
            </TouchableOpacity>
          </View>

          {loadingToppers ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Calculating rankings...</Text>
            </View>
          ) : toppersList.length > 0 ? (
            <View style={{ gap: 12 }}>
              {toppersList.map((t, idx) => {
                const rank = t.rank || idx + 1;
                const medalColor = rank === 1 ? '#eab308' : rank === 2 ? '#94a3b8' : '#b45309';
                const medalBg = rank === 1 ? '#fef9c3' : rank === 2 ? '#f1f5f9' : '#ffedd5';

                return (
                  <View key={t.student_id || idx} style={styles.topperCard}>
                    <View style={[styles.rankBadge, { backgroundColor: medalBg }]}>
                      <Ionicons name="trophy" size={16} color={medalColor} />
                      <Text style={[styles.rankText, { color: medalColor }]}>#{rank}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.topperName}>{t.name || 'Student'}</Text>
                      <Text style={styles.topperSub}>
                        Roll: {t.roll_number || '—'} {t.class_name ? ` • ${t.class_name}` : ''}
                      </Text>
                      {t.subject_name && (
                        <Text style={{ fontSize: 11, color: '#0284c7', fontWeight: '600', marginTop: 2 }}>
                          {t.subject_name}
                        </Text>
                      )}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.topperPct}>{t.percentage}%</Text>
                      <Text style={styles.topperMarks}>
                        {t.total_obtained != null ? `${t.total_obtained} / ${t.total_max}` : `${t.marks_obtained} / ${t.max_marks}`}
                      </Text>
                      <View style={styles.topperGradePill}>
                        <Text style={styles.topperGradeText}>{t.grade || 'A'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Toppers Data Available</Text>
              <Text style={styles.emptyCardText}>Marks have not yet been recorded or published for this scope.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  submitHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mainTabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    gap: 4,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mainTabActive: { backgroundColor: '#0284c7' },
  mainTabText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  mainTabTextActive: { color: '#fff' },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  filterLabel: { width: 56, fontSize: 11, fontWeight: '700', color: '#64748b' },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  pillActive: { backgroundColor: '#0284c7' },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  metaBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  metaCol: { flex: 1, alignItems: 'center' },
  metaTitle: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '600' },
  metaVal: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  metaDivider: { width: 1, backgroundColor: '#f1f5f9', marginVertical: 2 },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  lockedNoticeText: { fontSize: 12, color: '#dc2626', fontWeight: '600', flex: 1 },
  rosterCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  studentRowAbsent: { opacity: 0.7 },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
  nameText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  subText: { fontSize: 11, color: '#64748b', marginTop: 1 },
  absentToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  absentToggleActive: { backgroundColor: '#fee2e2' },
  absentToggleText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  absentToggleTextActive: { color: '#dc2626' },
  scoreInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    width: 76,
    height: 34,
  },
  scoreInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'right',
    paddingVertical: 0,
  },
  maxMarkText: { fontSize: 10, color: '#94a3b8', marginLeft: 2 },
  gradeChip: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    width: 32,
    alignItems: 'center',
  },
  gradeA: { backgroundColor: '#ecfdf5' },
  gradeB: { backgroundColor: '#eff6ff' },
  gradeC: { backgroundColor: '#fffbeb' },
  gradeFail: { backgroundColor: '#fef2f2' },
  gradeAB: { backgroundColor: '#f1f5f9' },
  gradeChipText: { fontSize: 10, fontWeight: '800', color: '#334155' },
  scopeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  scopeTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scopeTabActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  scopeTabText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  scopeTabTextActive: { color: '#fff' },
  topperCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rankText: { fontSize: 11, fontWeight: '800' },
  topperName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  topperSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  topperPct: { fontSize: 16, fontWeight: '800', color: '#0284c7' },
  topperMarks: { fontSize: 11, color: '#64748b', marginTop: 1 },
  topperGradePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 3,
  },
  topperGradeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
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
});
