// mob_app/src/screens/attendance/AttendanceScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator,
  StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import KPICard from '../../components/common/KPICard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';

const C = {
  primary: '#0b57d0',
  primaryDark: '#0842a0',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

export default function AttendanceScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isStaff = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  // Tabs for Staff
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'mark'

  // Date
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Overview Data
  const [summary, setSummary] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mark Attendance Data
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [markStudents, setMarkStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Student / Parent Personal View Data
  const [personalData, setPersonalData] = useState(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  // 1. Load Overview (Staff)
  const loadOverview = useCallback(async (isRefresh = false) => {
    if (!isStaff) return;
    if (isRefresh) setRefreshing(true); else setLoadingOverview(true);
    try {
      const [sumRes, clsRes] = await Promise.all([
        client.get('/principal/attendance/summary', { params: { date: selectedDate } }).catch(() => ({ data: null })),
        client.get('/principal/attendance/class-summary', { params: { date: selectedDate } }).catch(() => ({ data: [] })),
      ]);
      setSummary(sumRes.data);
      setClassSummary(Array.isArray(clsRes.data) ? clsRes.data : []);
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingOverview(false);
    }
  }, [isStaff, selectedDate]);

  // 2. Load Classes list for Mark tab
  const loadClasses = useCallback(async () => {
    if (!isStaff) return;
    try {
      const res = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
    } catch {
      setClasses([]);
    }
  }, [isStaff, selectedClassId]);

  // 3. Load Class Students for Marking
  const loadClassStudents = useCallback(async (classId) => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      const res = await client.get('/principal/students', {
        params: { class_id: classId, per_page: 100 },
      }).catch(() => null);

      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (raw?.students || []));

      setMarkStudents(list.map(s => ({
        id: s.id,
        name: s.name,
        admission_no: s.admission_no || s.admission_number || '',
        roll_no: s.roll_no || '',
        status: s.status === 'ABSENT' ? 'ABSENT' : (s.status === 'LATE' ? 'LATE' : 'PRESENT'),
      })));
    } catch {
      setMarkStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // 4. Load Personal Attendance (Student / Parent / Teacher self)
  const loadPersonalAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingPersonal(true);
    try {
      let endpoint = '/student/attendance';
      if (role === 'TEACHER') {
        endpoint = '/staff-attendance/my-status';
      }
      const res = await client.get(endpoint).catch(() => ({ data: null }));
      setPersonalData(res.data);
    } catch {
      setPersonalData(null);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingPersonal(false);
    }
  }, [role]);

  useEffect(() => {
    if (isStaff) {
      loadOverview();
      loadClasses();
    } else {
      loadPersonalAttendance();
    }
  }, [isStaff, loadOverview, loadClasses, loadPersonalAttendance]);

  useEffect(() => {
    if (activeTab === 'mark' && selectedClassId) {
      loadClassStudents(selectedClassId);
    }
  }, [activeTab, selectedClassId, loadClassStudents]);

  // Toggle student status
  const setStudentStatus = (studentId, status) => {
    setMarkStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Mark all students Present or Absent
  const markAll = (status) => {
    setMarkStudents(prev => prev.map(s => ({ ...s, status })));
  };

  // Submit attendance to backend
  const handleSubmitAttendance = async () => {
    if (!selectedClassId) {
      Alert.alert('Selection Required', 'Please select a class first.');
      return;
    }
    if (markStudents.length === 0) {
      Alert.alert('No Students', 'No students available in this class to mark.');
      return;
    }

    setSavingAttendance(true);
    try {
      await client.post('/principal/attendance/mark', {
        class_id: selectedClassId,
        date: selectedDate,
        records: markStudents.map(s => ({
          student_id: s.id,
          status: s.status,
        })),
      });

      Alert.alert('Attendance Saved', `Successfully recorded attendance for ${markStudents.length} students on ${selectedDate}.`);
      loadOverview();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Could not record attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     STUDENT & PARENT VIEW
     ═══════════════════════════════════════════════════════════════ */
  if (!isStaff) {
    const records = Array.isArray(personalData?.records) ? personalData.records : [];
    const attPct = personalData?.percentage != null
      ? Math.round(personalData.percentage)
      : personalData?.present && personalData?.total_days
      ? Math.round((personalData.present / personalData.total_days) * 100)
      : null;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPersonalAttendance(true)}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <GradientHero
            tagline="ATTENDANCE REGISTRY"
            title="My Attendance"
            subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            avatarText={user?.name || 'S'}
            gradientColors={['#0b57d0', '#0284c7']}
          />

          {loadingPersonal ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {personalData && (
                <View style={styles.kpiRow}>
                  <KPICard
                    label="Attendance Rate"
                    value={attPct != null ? `${attPct}%` : '—'}
                    sublabel="Cumulative Term"
                    icon="pie-chart-outline"
                    accentColor={attPct >= 75 ? C.success : C.danger}
                    badgeText={attPct >= 75 ? 'Optimal' : 'Shortage'}
                  />
                  <KPICard
                    label="Present Days"
                    value={personalData.present ?? personalData.total_present ?? '—'}
                    sublabel={`Out of ${personalData.total_days ?? personalData.total ?? '—'} days`}
                    icon="checkmark-done-circle-outline"
                    accentColor={C.primary}
                  />
                </View>
              )}

              {records.length > 0 ? (
                <Card padding={16}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="calendar-outline" size={18} color={C.primary} />
                    <Text style={styles.cardTitle}>Daily Records Log ({records.length})</Text>
                  </View>

                  {records.slice(0, 30).map((rec, i) => {
                    const statusStr = String(rec.status || 'PRESENT').toUpperCase();
                    const isPresent = statusStr === 'PRESENT';
                    const isAbsent = statusStr === 'ABSENT';

                    return (
                      <View key={rec.id || i} style={styles.dailyRow}>
                        <View>
                          <Text style={styles.dailyDate}>{rec.date || `Day ${i + 1}`}</Text>
                          <Text style={styles.dailyDay}>Recorded verification</Text>
                        </View>
                        <Badge
                          label={statusStr}
                          variant={isPresent ? 'success' : isAbsent ? 'error' : 'warning'}
                        />
                      </View>
                    );
                  })}
                </Card>
              ) : (
                <EmptyState
                  icon="calendar-clear-outline"
                  title="No Attendance Logs"
                  subtitle="No attendance logs have been posted for this term."
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     PRINCIPAL & TEACHER VIEW (FULL PARITY WITH WEB ATTENDANCE PAGE)
     ═══════════════════════════════════════════════════════════════ */
  const totalStudents = summary?.total_students ?? summary?.total ?? 0;
  const presentCount = summary?.present ?? summary?.total_present ?? 0;
  const absentCount = summary?.absent ?? summary?.total_absent ?? 0;
  const ratePct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.staffHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {navigation?.canGoBack() && (
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.staffHeaderTitle}>Attendance Management</Text>
              <Text style={styles.staffHeaderSub}>Classroom Register · {selectedDate}</Text>
            </View>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Ionicons name="stats-chart" size={16} color={activeTab === 'overview' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'mark' && styles.tabBtnActive]}
            onPress={() => setActiveTab('mark')}
          >
            <Ionicons name="create" size={16} color={activeTab === 'mark' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'mark' && styles.tabTextActive]}>Mark Attendance</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOverview(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {loadingOverview ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Summary KPIs */}
              <View style={styles.kpiRow}>
                <KPICard
                  label="Total Students"
                  value={totalStudents}
                  sublabel="Active Enrollment"
                  icon="people-outline"
                  accentColor={C.primary}
                />
                <KPICard
                  label="Present Today"
                  value={presentCount}
                  sublabel={`${ratePct}% Turnout`}
                  icon="checkmark-done-circle-outline"
                  accentColor={C.success}
                />
              </View>

              <View style={[styles.kpiRow, { marginTop: 10 }]}>
                <KPICard
                  label="Absent Today"
                  value={absentCount}
                  sublabel="Unverified absences"
                  icon="close-circle-outline"
                  accentColor={C.danger}
                />
                <KPICard
                  label="Attendance Rate"
                  value={`${ratePct}%`}
                  sublabel="Daily Rate"
                  icon="pie-chart-outline"
                  accentColor={ratePct >= 75 ? C.success : C.warning}
                />
              </View>

              {/* Class-wise Breakdown */}
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Class-Wise Attendance Breakdown</Text>
                  <TouchableOpacity onPress={() => setActiveTab('mark')}>
                    <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>Mark Now →</Text>
                  </TouchableOpacity>
                </View>

                {classSummary.length > 0 ? (
                  classSummary.map((cls, idx) => {
                    const cTotal = cls.total ?? cls.students_count ?? 0;
                    const cPres = cls.present ?? 0;
                    const cAbs = cls.absent ?? (cTotal > cPres ? cTotal - cPres : 0);
                    const cPct = cTotal > 0 ? Math.round((cPres / cTotal) * 100) : 0;

                    return (
                      <TouchableOpacity
                        key={cls.class_id || idx}
                        style={styles.classCardItem}
                        onPress={() => {
                          setSelectedClassId(cls.class_id);
                          setActiveTab('mark');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.classCardName}>{cls.class_name || `Class ${idx + 1}`}</Text>
                          <Text style={styles.classCardMeta}>
                            Present: <Text style={{ color: C.success, fontWeight: '700' }}>{cPres}</Text> · Absent: <Text style={{ color: C.danger, fontWeight: '700' }}>{cAbs}</Text> · Total: {cTotal}
                          </Text>
                        </View>
                        <View style={styles.percentBadge}>
                          <Text style={styles.percentText}>{cPct}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', paddingVertical: 16 }}>
                    No class attendance logged for today. Tap "Mark Attendance" to record.
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── TAB 2: MARK ATTENDANCE ── */}
      {activeTab === 'mark' && (
        <View style={{ flex: 1 }}>
          {/* Class Selector Horizontal Chips */}
          <View style={styles.chipsContainer}>
            <Text style={styles.chipHeader}>Select Class:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {classes.map((c) => {
                const isSel = selectedClassId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, isSel && styles.chipActive]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Quick Mark All Buttons */}
          <View style={styles.quickBar}>
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#dcfce7' }]} onPress={() => markAll('PRESENT')}>
              <Ionicons name="checkmark-done" size={16} color={C.success} />
              <Text style={[styles.quickBtnText, { color: C.success }]}>All Present</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#fee2e2' }]} onPress={() => markAll('ABSENT')}>
              <Ionicons name="close" size={16} color={C.danger} />
              <Text style={[styles.quickBtnText, { color: C.danger }]}>All Absent</Text>
            </TouchableOpacity>

            <View style={styles.rosterCountBox}>
              <Text style={styles.rosterCountText}>{markStudents.length} Students</Text>
            </View>
          </View>

          {/* Student Roster List */}
          {loadingStudents ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ marginTop: 10, color: C.muted, fontSize: 13 }}>Loading class roster...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}>
              {markStudents.length > 0 ? (
                markStudents.map((stu) => {
                  const isPresent = stu.status === 'PRESENT';
                  const isAbsent = stu.status === 'ABSENT';
                  const isLate = stu.status === 'LATE';

                  return (
                    <View key={stu.id} style={styles.studentRowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentRowName}>{stu.name}</Text>
                        <Text style={styles.studentRowMeta}>
                          {stu.admission_no ? `Adm: #${stu.admission_no}` : ''}
                          {stu.roll_no ? ` · Roll: ${stu.roll_no}` : ''}
                        </Text>
                      </View>

                      {/* Status Toggle Buttons */}
                      <View style={styles.statusButtonsGroup}>
                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isPresent && styles.presentActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'PRESENT')}
                        >
                          <Text style={[styles.statusToggleText, isPresent && styles.statusToggleTextActive]}>P</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isAbsent && styles.absentActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'ABSENT')}
                        >
                          <Text style={[styles.statusToggleText, isAbsent && styles.statusToggleTextActive]}>A</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isLate && styles.lateActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'LATE')}
                        >
                          <Text style={[styles.statusToggleText, isLate && styles.statusToggleTextActive]}>L</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState
                  icon="people-outline"
                  title="No Students in Class"
                  subtitle="Select another class or enroll new students."
                />
              )}
            </ScrollView>
          )}

          {/* Sticky Bottom Save Button */}
          {markStudents.length > 0 && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[styles.saveBtn, savingAttendance && { opacity: 0.7 }]}
                onPress={handleSubmitAttendance}
                disabled={savingAttendance}
              >
                {savingAttendance ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Attendance Register</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, paddingBottom: 32 },
  staffHeader: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  staffHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  staffHeaderSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 4,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tabTextActive: { color: C.primary },
  kpiRow: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.text, textTransform: 'uppercase' },
  classCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  classCardName: { fontSize: 15, fontWeight: '700', color: C.text },
  classCardMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  percentBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentText: { fontSize: 13, fontWeight: '800', color: C.primary },
  chipsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chipHeader: { fontSize: 11, fontWeight: '700', color: C.muted, paddingHorizontal: 16, marginBottom: 6, textTransform: 'uppercase' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primaryDark,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: C.muted },
  chipTextActive: { color: '#fff' },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickBtnText: { fontSize: 12, fontWeight: '800' },
  rosterCountBox: { marginLeft: 'auto' },
  rosterCountText: { fontSize: 12, fontWeight: '700', color: C.muted },
  studentRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  studentRowName: { fontSize: 14, fontWeight: '700', color: C.text },
  studentRowMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  statusButtonsGroup: { flexDirection: 'row', gap: 6 },
  statusToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  presentActiveBtn: { backgroundColor: '#16a34a', borderColor: '#15803d' },
  absentActiveBtn: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
  lateActiveBtn: { backgroundColor: '#d97706', borderColor: '#b45309' },
  statusToggleText: { fontSize: 13, fontWeight: '800', color: C.muted },
  statusToggleTextActive: { color: '#ffffff' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dailyDate: { fontSize: 14, fontWeight: '700', color: C.text },
  dailyDay: { fontSize: 11, color: C.muted, marginTop: 1 },
});
