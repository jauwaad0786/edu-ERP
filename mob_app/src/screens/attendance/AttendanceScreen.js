// mob_app/src/screens/attendance/AttendanceScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator,
  StyleSheet, TouchableOpacity, Alert, TextInput, Modal,
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
import ProgressRing from '../../components/common/ProgressRing';

const C = {
  primary: '#0b57d0',
  primaryDark: '#0842a0',
  primaryLight: '#eff6ff',
  success: '#16a34a',
  successBg: '#dcfce7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  warning: '#d97706',
  warningBg: '#fef3c7',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

// Helper: Format date string YYYY-MM-DD into readable label
function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Helper: Add days to date string YYYY-MM-DD
function shiftDateStr(dateStr, days) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  } catch {
    return dateStr;
  }
}

export default function AttendanceScreen({ navigation, route }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isStaff = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const isParent = role === 'PARENT';
  const isStudent = role === 'STUDENT';

  // Tabs for Staff: 'overview' | 'mark' | 'qr_scan' | 'staff_register'
  const [activeTab, setActiveTab] = useState('overview');

  // Handle incoming route params (e.g. from drawer or notifications)
  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  // Selected Date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [customDateInput, setCustomDateInput] = useState(todayStr);

  // Overview Data (Staff)
  const [summary, setSummary] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Mark Attendance Data (Staff)
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [markStudents, setMarkStudents] = useState([]);
  const [existingRecordsMap, setExistingRecordsMap] = useState({});
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [markSearchText, setMarkSearchText] = useState('');

  // QR / Fast Scan States
  const [scanQuery, setScanQuery] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [quickTestStudents, setQuickTestStudents] = useState([]);

  // Staff Attendance Register States
  const [staffDashboard, setStaffDashboard] = useState(null);
  const [staffTodayList, setTodayStaffList] = useState([]);
  const [staffRosterFilter, setStaffRosterFilter] = useState('ALL');
  const [myPunchStatus, setMyPunchStatus] = useState(null);
  const [punching, setPunching] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Student / Parent Personal View Data
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [personalData, setPersonalData] = useState(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 1. Staff: Load Overview (School-wide summary + class breakdown)
  // ─────────────────────────────────────────────────────────────
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
      // Graceful fallback
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingOverview(false);
    }
  }, [isStaff, selectedDate]);

  // ─────────────────────────────────────────────────────────────
  // 2. Staff: Load Classes for Selection
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 3. Staff: Load Students for Marking & Pre-populate existing status
  // ─────────────────────────────────────────────────────────────
  const loadClassStudents = useCallback(async (classId, dateStr) => {
    if (!classId) return;
    setLoadingStudents(true);
    try {
      // 1. Fetch class students
      // 2. Fetch existing saved attendance for this class and date
      const [stuRes, attRes] = await Promise.all([
        client.get('/principal/students', {
          params: { class_id: classId, per_page: 150 },
        }).catch(() => null),
        client.get(`/teacher/attendance/${classId}`, {
          params: { date: dateStr },
        }).catch(() => ({ data: [] })),
      ]);

      const raw = stuRes?.data;
      const studentList = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (raw?.students || []));

      // Build map of existing attendance: student_id -> status
      const existingList = Array.isArray(attRes.data) ? attRes.data : [];
      const statusMap = {};
      existingList.forEach((att) => {
        if (att.student_id) {
          statusMap[att.student_id] = att.status;
        }
      });
      setExistingRecordsMap(statusMap);
      setIsAlreadyMarked(existingList.length > 0);

      // Pre-fill student roster
      setMarkStudents(
        studentList.map((s) => {
          const savedStatus = statusMap[s.id];
          const initialStatus = savedStatus || (s.status === 'ABSENT' ? 'ABSENT' : s.status === 'LATE' ? 'LATE' : 'PRESENT');
          return {
            id: s.id,
            name: s.name || s.student_name || 'Student',
            admission_no: s.admission_no || s.admission_number || '',
            roll_no: s.roll_no || s.roll_number || '',
            status: initialStatus,
          };
        })
      );
    } catch {
      setMarkStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 4. Student / Parent: Load Attendance & Children List
  // ─────────────────────────────────────────────────────────────
  const loadPersonalAttendance = useCallback(async (isRefresh = false, childId = null) => {
    if (isRefresh) setRefreshing(true); else setLoadingPersonal(true);
    try {
      if (isParent) {
        // Parent: Fetch linked children first if not fetched
        let currentChildId = childId || selectedChildId;
        if (!currentChildId) {
          const childrenRes = await client.get('/student/children').catch(() => ({ data: [] }));
          const childList = Array.isArray(childrenRes.data) ? childrenRes.data : [];
          setChildren(childList);
          if (childList.length > 0) {
            currentChildId = childList[0].id;
            setSelectedChildId(currentChildId);
          }
        }
        const endpoint = currentChildId ? `/student/attendance?student_id=${currentChildId}` : '/student/attendance';
        const res = await client.get(endpoint).catch(() => ({ data: null }));
        setPersonalData(res.data);
      } else {
        // Student or self-record
        const endpoint = role === 'TEACHER' ? '/staff-attendance/my-status' : '/student/attendance';
        const res = await client.get(endpoint).catch(() => ({ data: null }));
        setPersonalData(res.data);
      }
    } catch {
      setPersonalData(null);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoadingPersonal(false);
    }
  }, [isParent, role, selectedChildId]);

  // Initial Data Load
  useEffect(() => {
    if (isStaff) {
      loadOverview();
      loadClasses();
    } else {
      loadPersonalAttendance();
    }
  }, [isStaff, loadOverview, loadClasses, loadPersonalAttendance]);

  // Reload students when class or date changes in Mark tab
  useEffect(() => {
    if (activeTab === 'mark' && selectedClassId) {
      loadClassStudents(selectedClassId, selectedDate);
    }
  }, [activeTab, selectedClassId, selectedDate, loadClassStudents]);

  // Date controls
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const handleStepDate = (days) => {
    const nextDate = shiftDateStr(selectedDate, days);
    setSelectedDate(nextDate);
  };

  // Toggle single student status
  const setStudentStatus = (studentId, status) => {
    setMarkStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Mark all students as PRESENT, ABSENT, or LATE
  const markAll = (status) => {
    setMarkStudents((prev) => prev.map((s) => ({ ...s, status })));
  };

  // Submit attendance to backend (Full parity with Web POST /principal/attendance/mark)
  const handleSubmitAttendance = async () => {
    if (!selectedClassId) {
      Alert.alert('Selection Required', 'Please select a class first.');
      return;
    }
    if (markStudents.length === 0) {
      Alert.alert('No Students', 'No students found in this class to record.');
      return;
    }

    setSavingAttendance(true);
    try {
      const payload = {
        class_id: selectedClassId,
        date: selectedDate,
        records: markStudents.map((s) => ({
          student_id: s.id,
          status: s.status,
        })),
      };

      // Try principal endpoint first, fallback to teacher endpoint
      try {
        await client.post('/principal/attendance/mark', payload);
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 404) {
          await client.post('/teacher/attendance', payload);
        } else {
          throw err;
        }
      }

      setIsAlreadyMarked(true);
      Alert.alert(
        'Attendance Saved ✓',
        `Successfully saved attendance records for ${markStudents.length} students on ${formatDateLabel(selectedDate)}.`
      );
      loadOverview();
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err.response?.data?.error || 'Could not record attendance. Please check network and permissions.'
      );
    } finally {
      setSavingAttendance(false);
    }
  };

  // Quick jump to student detail screen
  const navigateToStudent = (studentId) => {
    if (!studentId) return;
    try {
      navigation.navigate('StudentDetail', { student_id: studentId });
    } catch {
      // Screen may not be in current navigator stack
    }
  };

  // Staff Attendance Loader & Handlers
  const loadStaffData = useCallback(async () => {
    if (!isStaff) return;
    setLoadingStaff(true);
    try {
      const [dashRes, todayRes, myRes] = await Promise.all([
        client.get(`/staff-attendance/dashboard?date=${selectedDate}`).catch(() => ({ data: null })),
        client.get(`/staff-attendance/today?date=${selectedDate}`).catch(() => ({ data: [] })),
        client.get('/staff-attendance/my-status').catch(() => ({ data: null })),
      ]);
      setStaffDashboard(dashRes.data);
      const rawList = Array.isArray(todayRes.data)
        ? todayRes.data
        : todayRes.data?.records || todayRes.data?.data || todayRes.data?.items || [];
      setTodayStaffList(rawList);
      setMyPunchStatus(myRes.data);
    } catch {
      // Graceful fallback
    } finally {
      setLoadingStaff(false);
    }
  }, [isStaff, selectedDate]);

  const handleStaffPunchIn = async () => {
    setPunching(true);
    try {
      await client.post('/staff-attendance/check-in', { device: 'MOBILE_APP' });
      Alert.alert('Checked In ✅', 'Your check-in attendance has been recorded successfully.');
      loadStaffData();
    } catch (err) {
      Alert.alert('Check-In Failed', err.response?.data?.error || 'Could not record check-in.');
    } finally {
      setPunching(false);
    }
  };

  const handleStaffPunchOut = async () => {
    setPunching(true);
    try {
      await client.post('/staff-attendance/check-out', { device: 'MOBILE_APP' });
      Alert.alert('Checked Out 🚪', 'Your check-out attendance has been recorded successfully.');
      loadStaffData();
    } catch (err) {
      Alert.alert('Check-Out Failed', err.response?.data?.error || 'Could not record check-out.');
    } finally {
      setPunching(false);
    }
  };

  // Preload quick-test students from classes
  useEffect(() => {
    if (classes.length > 0 && quickTestStudents.length === 0) {
      client.get('/principal/students', { params: { class_id: classes[0].id, per_page: 8 } })
        .then((res) => {
          const raw = res.data;
          const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (raw?.students || []));
          setQuickTestStudents(list.map((s) => ({
            id: s.id,
            name: s.name || s.student_name || 'Student',
            admission_no: s.admission_no || s.admission_number || '',
            roll_no: s.roll_no || s.roll_number || '',
          })));
        })
        .catch(() => {});
    }
  }, [classes, quickTestStudents.length]);

  // Load staff data when tab is staff_register or on date change
  useEffect(() => {
    if (activeTab === 'staff_register') {
      loadStaffData();
    }
  }, [activeTab, loadStaffData]);

  // Fast Scan / QR lookup and auto-attendance recording
  const handleFastScan = async (codeToScan) => {
    const code = (codeToScan || scanQuery || '').trim();
    if (!code) {
      Alert.alert('Input Required', 'Please enter student Admission Number, Roll No, or Student ID.');
      return;
    }
    setScanLoading(true);
    try {
      // 1. Search student via principal students endpoint
      const searchRes = await client.get('/principal/students', {
        params: { search: code, per_page: 5 },
      });
      const raw = searchRes.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (raw?.students || []));
      
      let matchedStudent = list[0];
      // If numeric, also try direct ID match
      if (!matchedStudent && /^\d+$/.test(code)) {
        try {
          const directRes = await client.get(`/principal/students/${code}`);
          matchedStudent = directRes.data?.student || directRes.data;
        } catch {}
      }

      if (!matchedStudent) {
        Alert.alert('Student Not Found', `No student found matching "${code}". Please verify ID or Admission Number.`);
        return;
      }

      // 2. Automatically record attendance as PRESENT
      const classId = matchedStudent.class_id;
      const payload = {
        class_id: classId,
        date: selectedDate,
        records: [{ student_id: matchedStudent.id, status: 'PRESENT' }],
      };

      try {
        await client.post('/principal/attendance/mark', payload);
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 404) {
          await client.post('/teacher/attendance', payload);
        } else {
          throw err;
        }
      }

      const scanRecord = {
        id: matchedStudent.id,
        name: matchedStudent.name || matchedStudent.student_name || 'Student',
        roll_no: matchedStudent.roll_no || matchedStudent.roll_number || '—',
        admission_no: matchedStudent.admission_no || matchedStudent.admission_number || code,
        class_name: matchedStudent.class_name || (matchedStudent.class ? matchedStudent.class.name : 'Enrolled Class'),
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        status: 'PRESENT',
      };

      setLastScannedResult(scanRecord);
      setRecentScans((prev) => [scanRecord, ...prev.filter((item) => item.id !== matchedStudent.id)]);
      setScanQuery('');
      
      // Also refresh overview numbers in background
      loadOverview();
    } catch (err) {
      Alert.alert('Scan Failed', err.response?.data?.error || err.message || 'Failed to record QR attendance.');
    } finally {
      setScanLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     STUDENT & PARENT VIEW (PORTAL WITH MULTI-CHILD SWITCHER & JOURNAL)
     ═══════════════════════════════════════════════════════════════ */
  if (!isStaff) {
    const records = Array.isArray(personalData?.records) ? personalData.records : [];
    const attPct = personalData?.percentage != null
      ? Math.round(personalData.percentage)
      : personalData?.present && personalData?.total_days
      ? Math.round((personalData.present / personalData.total_days) * 100)
      : null;

    const presentDays = Number(personalData?.present ?? personalData?.total_present ?? 0);
    const absentDays = Number(personalData?.absent ?? personalData?.total_absent ?? 0);
    const lateDays = Number(personalData?.late ?? 0);
    const totalDays = Number(personalData?.total_days ?? personalData?.total ?? (presentDays + absentDays + lateDays));

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
            title={isParent ? 'Ward Attendance' : 'My Attendance'}
            subtitle={formatDateLabel(todayStr)}
            avatarText={user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            gradientColors={['#0b57d0', '#0284c7']}
          />

          {/* Parent Child Switcher (If multiple children exist) */}
          {isParent && children.length > 1 && (
            <View style={styles.childrenSwitcherCard}>
              <Text style={styles.switcherLabel}>Select Student:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {children.map((child) => {
                  const isSel = selectedChildId === child.id;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[styles.childChip, isSel && styles.childChipActive]}
                      onPress={() => {
                        setSelectedChildId(child.id);
                        loadPersonalAttendance(false, child.id);
                      }}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={16}
                        color={isSel ? '#fff' : C.primary}
                      />
                      <Text style={[styles.childChipText, isSel && styles.childChipTextActive]}>
                        {child.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {loadingPersonal ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Overall Progress Donut & Metrics */}
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.donutRow}>
                  <ProgressRing
                    size={84}
                    strokeWidth={8}
                    percentage={attPct ?? 0}
                    color={attPct >= 75 ? C.success : C.danger}
                    trackColor={attPct >= 75 ? C.successBg : C.dangerBg}
                  />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.donutTitle}>Attendance Rate</Text>
                    <Text style={styles.donutSubtitle}>Cumulative Academic Term</Text>
                    <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge
                        label={attPct >= 75 ? 'Optimal (≥75%)' : 'Attendance Shortage'}
                        variant={attPct >= 75 ? 'success' : 'error'}
                      />
                    </View>
                  </View>
                </View>

                {/* Status Notice Alert */}
                <View style={[
                  styles.thresholdBanner,
                  { backgroundColor: attPct >= 75 ? '#f0fdf4' : '#fef2f2', borderColor: attPct >= 75 ? '#bbf7d0' : '#fecaca' }
                ]}>
                  <Ionicons
                    name={attPct >= 75 ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={attPct >= 75 ? C.success : C.danger}
                  />
                  <Text style={[styles.thresholdText, { color: attPct >= 75 ? '#166534' : '#991b1b' }]}>
                    {totalDays === 0
                      ? 'No attendance records logged for the current term.'
                      : attPct >= 75
                      ? 'Awesome! You are maintaining the required 75% attendance threshold.'
                      : `Low attendance (${attPct}%). Maintain at least 75% to be eligible for examinations.`}
                  </Text>
                </View>
              </View>

              {/* KPI Cards Grid */}
              <View style={[styles.kpiRow, { marginTop: 12 }]}>
                <KPICard
                  label="Present Days"
                  value={presentDays}
                  sublabel="Verified in Class"
                  icon="checkmark-done-circle-outline"
                  accentColor={C.success}
                />
                <KPICard
                  label="Absent Days"
                  value={absentDays}
                  sublabel="Leave or Absent"
                  icon="close-circle-outline"
                  accentColor={C.danger}
                />
              </View>

              <View style={[styles.kpiRow, { marginTop: 10 }]}>
                <KPICard
                  label="Late Marks"
                  value={lateDays}
                  sublabel="Recorded Tardies"
                  icon="time-outline"
                  accentColor={C.warning}
                />
                <KPICard
                  label="Total Working Days"
                  value={totalDays}
                  sublabel="Class Days Count"
                  icon="calendar-outline"
                  accentColor={C.primary}
                />
              </View>

              {/* Attendance Log Journal */}
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="journal-outline" size={18} color={C.primary} />
                  <Text style={styles.cardTitle}>Daily Attendance Journal ({records.length})</Text>
                </View>

                {records.length > 0 ? (
                  records.map((rec, i) => {
                    const statusStr = String(rec.status || 'PRESENT').toUpperCase();
                    const isPres = statusStr === 'PRESENT';
                    const isAbs = statusStr === 'ABSENT';
                    const isLate = statusStr === 'LATE';

                    return (
                      <View key={rec.id || i} style={styles.dailyRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={[
                            styles.statusDot,
                            { backgroundColor: isPres ? C.success : isAbs ? C.danger : isLate ? C.warning : '#cbd5e1' }
                          ]}>
                            <Ionicons
                              name={isPres ? 'checkmark' : isAbs ? 'close' : 'time'}
                              size={12}
                              color="#fff"
                            />
                          </View>
                          <View>
                            <Text style={styles.dailyDate}>{formatDateLabel(rec.date)}</Text>
                            <Text style={styles.dailyDay}>Recorded attendance verification</Text>
                          </View>
                        </View>
                        <Badge
                          label={statusStr}
                          variant={isPres ? 'success' : isAbs ? 'error' : 'warning'}
                        />
                      </View>
                    );
                  })
                ) : (
                  <EmptyState
                    icon="calendar-clear-outline"
                    title="No Attendance Logs"
                    subtitle="No daily attendance records have been posted yet."
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     PRINCIPAL & TEACHER VIEW (FULL WEB PARITY: OVERVIEW & MARK TABS)
     ═══════════════════════════════════════════════════════════════ */
  const totalStudents = summary?.total_students ?? summary?.total ?? 0;
  const presentCount = summary?.present ?? summary?.total_present ?? 0;
  const absentCount = summary?.absent ?? summary?.total_absent ?? 0;
  const lateCount = summary?.late ?? 0;
  const notMarkedCount = summary?.not_marked ?? Math.max(0, totalStudents - (presentCount + absentCount + lateCount));
  const ratePct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Counts for mark tab
  const markPresentCount = markStudents.filter((s) => s.status === 'PRESENT').length;
  const markAbsentCount = markStudents.filter((s) => s.status === 'ABSENT').length;
  const markLateCount = markStudents.filter((s) => s.status === 'LATE').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top App Bar ── */}
      <View style={styles.staffHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {navigation?.canGoBack() && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.staffHeaderTitle}>Attendance Management</Text>
              <Text style={styles.staffHeaderSub}>
                School Register · {formatDateLabel(selectedDate)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerDateBadge}
            onPress={() => {
              setCustomDateInput(selectedDate);
              setShowDatePickerModal(true);
            }}
          >
            <Ionicons name="calendar-outline" size={14} color="#fff" />
            <Text style={styles.headerDateText}>Date</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: Overview, Mark Class, QR / Fast Scan, Staff Register */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Ionicons name="stats-chart" size={15} color={activeTab === 'overview' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'mark' && styles.tabBtnActive]}
            onPress={() => setActiveTab('mark')}
          >
            <Ionicons name="create" size={15} color={activeTab === 'mark' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'mark' && styles.tabTextActive]}>Mark Class</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'qr_scan' && styles.tabBtnActive]}
            onPress={() => setActiveTab('qr_scan')}
          >
            <Ionicons name="qr-code" size={15} color={activeTab === 'qr_scan' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'qr_scan' && styles.tabTextActive]}>QR / Fast Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'staff_register' && styles.tabBtnActive]}
            onPress={() => setActiveTab('staff_register')}
          >
            <Ionicons name="people" size={15} color={activeTab === 'staff_register' ? C.primary : '#fff'} />
            <Text style={[styles.tabText, activeTab === 'staff_register' && styles.tabTextActive]}>Staff Register</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Interactive Date Navigator Bar ── */}
      <View style={styles.dateNavigatorBar}>
        <TouchableOpacity style={styles.dateNavArrow} onPress={() => handleStepDate(-1)}>
          <Ionicons name="chevron-back" size={18} color={C.text} />
          <Text style={styles.dateNavArrowText}>Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateNavCenter}
          onPress={() => {
            setCustomDateInput(selectedDate);
            setShowDatePickerModal(true);
          }}
        >
          <Ionicons name="calendar" size={15} color={C.primary} />
          <Text style={styles.dateNavCenterText}>{formatDateLabel(selectedDate)}</Text>
          {selectedDate === todayStr && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>TODAY</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {selectedDate !== todayStr && (
            <TouchableOpacity style={styles.resetTodayBtn} onPress={() => handleDateChange(todayStr)}>
              <Text style={styles.resetTodayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dateNavArrow} onPress={() => handleStepDate(1)}>
            <Text style={styles.dateNavArrowText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════
         TAB 1: OVERVIEW TAB (FULL PARITY WITH WEB OVERVIEW)
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadOverview(true)}
              colors={[C.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {loadingOverview ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* 4 Stat Cards */}
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
                  sublabel="Unverified Absences"
                  icon="close-circle-outline"
                  accentColor={C.danger}
                />
                <KPICard
                  label="Late Arrivals"
                  value={lateCount}
                  sublabel="Tardy Registrations"
                  icon="time-outline"
                  accentColor={C.warning}
                />
              </View>

              {/* Overall Progress Bar Card (Direct Web Parity) */}
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.overallHeaderRow}>
                  <Text style={styles.overallTitle}>Overall Turnout — {formatDateLabel(selectedDate)}</Text>
                  <Text style={[styles.overallPctText, { color: ratePct >= 75 ? C.success : ratePct >= 50 ? C.warning : C.danger }]}>
                    {ratePct}%
                  </Text>
                </View>

                {/* Progress bar fill */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(ratePct, 100)}%`,
                        backgroundColor: ratePct >= 75 ? C.success : ratePct >= 50 ? C.warning : C.danger,
                      },
                    ]}
                  />
                </View>

                {/* Turnout Numbers breakdown */}
                <View style={styles.turnoutStatsRow}>
                  <View style={styles.turnoutStatItem}>
                    <View style={[styles.statusMiniDot, { backgroundColor: C.success }]} />
                    <Text style={styles.turnoutStatText}>
                      Present: <Text style={{ fontWeight: '700', color: C.success }}>{presentCount}</Text>
                    </Text>
                  </View>
                  <View style={styles.turnoutStatItem}>
                    <View style={[styles.statusMiniDot, { backgroundColor: C.danger }]} />
                    <Text style={styles.turnoutStatText}>
                      Absent: <Text style={{ fontWeight: '700', color: C.danger }}>{absentCount}</Text>
                    </Text>
                  </View>
                  <View style={styles.turnoutStatItem}>
                    <View style={[styles.statusMiniDot, { backgroundColor: '#94a3b8' }]} />
                    <Text style={styles.turnoutStatText}>
                      Not Marked: <Text style={{ fontWeight: '700', color: C.muted }}>{notMarkedCount}</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* Class-wise Attendance Section */}
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Class-Wise Attendance</Text>
                    <Text style={styles.sectionSubTitle}>{classSummary.length} Classes Enrolled</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.quickMarkPill}
                    onPress={() => setActiveTab('mark')}
                  >
                    <Ionicons name="create-outline" size={14} color="#fff" />
                    <Text style={styles.quickMarkPillText}>Mark Attendance</Text>
                  </TouchableOpacity>
                </View>

                {classSummary.length > 0 ? (
                  classSummary.map((cls, idx) => {
                    const cTotal = cls.total ?? cls.students_count ?? 0;
                    const cPres = cls.present ?? 0;
                    const cAbs = cls.absent ?? (cTotal > cPres ? cTotal - cPres : 0);
                    const cLate = cls.late ?? 0;
                    const cNotMarked = cls.not_marked ?? Math.max(0, cTotal - (cPres + cAbs + cLate));
                    const cPct = cls.present_pct ?? (cTotal > 0 ? Math.round((cPres / cTotal) * 100) : 0);
                    const isExpanded = expandedClassId === cls.class_id;
                    const studentsList = Array.isArray(cls.students) ? cls.students : [];

                    return (
                      <View key={cls.class_id || idx} style={styles.classCardWrapper}>
                        {/* Class Header Row */}
                        <TouchableOpacity
                          style={styles.classCardItem}
                          onPress={() => setExpandedClassId(isExpanded ? null : cls.class_id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.classCardName}>
                                {cls.class_name} {cls.section ? `— Section ${cls.section}` : ''}
                              </Text>
                              <View style={styles.totalBadge}>
                                <Text style={styles.totalBadgeText}>{cTotal} Total</Text>
                              </View>
                            </View>

                            {/* Counts row */}
                            <Text style={styles.classCardMeta}>
                              Present: <Text style={{ color: C.success, fontWeight: '700' }}>{cPres}</Text> · Absent: <Text style={{ color: C.danger, fontWeight: '700' }}>{cAbs}</Text>
                              {cLate > 0 ? <Text> · Late: <Text style={{ color: C.warning, fontWeight: '700' }}>{cLate}</Text></Text> : null}
                              {cNotMarked > 0 ? <Text> · Not Marked: <Text style={{ color: C.muted, fontWeight: '700' }}>{cNotMarked}</Text></Text> : null}
                            </Text>

                            {/* Mini Progress Bar */}
                            <View style={styles.miniProgressTrack}>
                              <View
                                style={[
                                  styles.miniProgressFill,
                                  {
                                    width: `${Math.min(cPct, 100)}%`,
                                    backgroundColor: cPct >= 75 ? C.success : cPct >= 50 ? C.warning : C.danger,
                                  },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                            <View style={[styles.percentBadge, { backgroundColor: cPct >= 75 ? '#ecfdf5' : '#fef2f2' }]}>
                              <Text style={[styles.percentText, { color: cPct >= 75 ? C.success : C.danger }]}>
                                {cPct}%
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 }}>
                              <Text style={styles.expandToggleText}>{isExpanded ? 'Hide' : 'Details'}</Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={C.primary}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* ── Expandable Student Detail Roster (Direct Web Parity) ── */}
                        {isExpanded && (
                          <View style={styles.expandedStudentsContainer}>
                            <View style={styles.expandedHeaderRow}>
                              <Text style={styles.expandedTitle}>
                                👥 Students Roster ({studentsList.length})
                              </Text>
                              <TouchableOpacity
                                style={styles.markThisClassBtn}
                                onPress={() => {
                                  setSelectedClassId(cls.class_id);
                                  setActiveTab('mark');
                                }}
                              >
                                <Ionicons name="create-outline" size={13} color={C.primary} />
                                <Text style={styles.markThisClassBtnText}>Mark / Edit</Text>
                              </TouchableOpacity>
                            </View>

                            {studentsList.length > 0 ? (
                              studentsList.map((stu, sIdx) => {
                                const st = String(stu.status || 'NOT_MARKED').toUpperCase();
                                const isP = st === 'PRESENT';
                                const isA = st === 'ABSENT';
                                const isL = st === 'LATE';

                                return (
                                  <TouchableOpacity
                                    key={stu.student_id || sIdx}
                                    style={styles.expandedStudentItem}
                                    onPress={() => navigateToStudent(stu.student_id)}
                                  >
                                    <View style={[
                                      styles.studentStatusAvatar,
                                      {
                                        backgroundColor: isP ? C.successBg : isA ? C.dangerBg : isL ? C.warningBg : '#f1f5f9',
                                        borderColor: isP ? '#a3d9a5' : isA ? '#f9c9c0' : isL ? '#fde8b0' : C.border,
                                      }
                                    ]}>
                                      <Text style={{ fontSize: 13 }}>
                                        {isP ? '✅' : isA ? '❌' : isL ? '🕐' : '—'}
                                      </Text>
                                    </View>

                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                      <Text style={styles.expandedStudentName} numberOfLines={1}>
                                        {stu.student_name || 'Student'}
                                      </Text>
                                      <Text style={styles.expandedStudentRoll}>
                                        Roll: {stu.roll_number || '—'}
                                      </Text>
                                    </View>

                                    <Badge
                                      label={st}
                                      variant={isP ? 'success' : isA ? 'error' : isL ? 'warning' : 'neutral'}
                                    />
                                  </TouchableOpacity>
                                );
                              })
                            ) : (
                              <Text style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', paddingVertical: 8 }}>
                                No student details found for this class.
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Ionicons name="clipboard-outline" size={32} color={C.muted} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 8 }}>
                      Attendance Not Marked
                    </Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2, textAlign: 'center' }}>
                      No class registers have been submitted for {formatDateLabel(selectedDate)}.
                    </Text>
                    <TouchableOpacity
                      style={[styles.quickMarkPill, { marginTop: 12 }]}
                      onPress={() => setActiveTab('mark')}
                    >
                      <Text style={styles.quickMarkPillText}>Take Attendance Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB 2: MARK ATTENDANCE TAB (DIRECT WEB PARITY)
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'mark' && (
        <View style={{ flex: 1 }}>
          {/* Class Selector Chips */}
          <View style={styles.chipsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={styles.chipHeader}>Select Class to Mark:</Text>
              <Text style={styles.chipCountMeta}>{classes.length} classes available</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
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

          {/* Status Indicator Banner (Already marked vs New) */}
          <View style={[
            styles.markedStatusBanner,
            { backgroundColor: isAlreadyMarked ? '#eff6ff' : '#fefce8', borderColor: isAlreadyMarked ? '#bfdbfe' : '#fef08a' }
          ]}>
            <Ionicons
              name={isAlreadyMarked ? 'checkmark-circle' : 'alert-circle-outline'}
              size={16}
              color={isAlreadyMarked ? C.primary : C.warning}
            />
            <Text style={[styles.markedStatusText, { color: isAlreadyMarked ? C.primaryDark : '#854d0e' }]}>
              {isAlreadyMarked
                ? `Attendance already recorded for ${formatDateLabel(selectedDate)}. Changes will update existing records.`
                : `New register for ${formatDateLabel(selectedDate)}. Defaulting to Present.`}
            </Text>
          </View>

          {/* Quick Mark All Buttons & Counter Bar */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: C.successBg, borderColor: '#a3d9a5' }]}
              onPress={() => markAll('PRESENT')}
            >
              <Ionicons name="checkmark-done" size={15} color={C.success} />
              <Text style={[styles.quickBtnText, { color: C.success }]}>All Present</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: C.dangerBg, borderColor: '#f9c9c0' }]}
              onPress={() => markAll('ABSENT')}
            >
              <Ionicons name="close" size={15} color={C.danger} />
              <Text style={[styles.quickBtnText, { color: C.danger }]}>All Absent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { backgroundColor: C.warningBg, borderColor: '#fde8b0' }]}
              onPress={() => markAll('LATE')}
            >
              <Ionicons name="time-outline" size={15} color={C.warning} />
              <Text style={[styles.quickBtnText, { color: C.warning }]}>All Late</Text>
            </TouchableOpacity>

            <View style={styles.rosterCountBox}>
              <Text style={styles.rosterCountText}>
                {markPresentCount}P / {markAbsentCount}A / {markLateCount}L
              </Text>
            </View>
          </View>

          {/* Student Filter / Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={16} color={C.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter by name, roll no, or admission no..."
              placeholderTextColor={C.muted}
              value={markSearchText}
              onChangeText={setMarkSearchText}
              autoCapitalize="none"
            />
            {markSearchText.length > 0 && (
              <TouchableOpacity onPress={() => setMarkSearchText('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Student Roster List */}
          {loadingStudents ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={{ marginTop: 10, color: C.muted, fontSize: 13 }}>
                Loading class students & records...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 110 }}
              showsVerticalScrollIndicator={false}
            >
              {markStudents
                .filter((stu) => {
                  if (!markSearchText.trim()) return true;
                  const q = markSearchText.toLowerCase();
                  return (
                    (stu.name && stu.name.toLowerCase().includes(q)) ||
                    (stu.roll_no && String(stu.roll_no).includes(q)) ||
                    (stu.admission_no && String(stu.admission_no).toLowerCase().includes(q))
                  );
                })
                .length > 0 ? (
                markStudents
                  .filter((stu) => {
                    if (!markSearchText.trim()) return true;
                    const q = markSearchText.toLowerCase();
                    return (
                      (stu.name && stu.name.toLowerCase().includes(q)) ||
                      (stu.roll_no && String(stu.roll_no).includes(q)) ||
                      (stu.admission_no && String(stu.admission_no).toLowerCase().includes(q))
                    );
                  })
                  .map((stu) => {
                  const isPresent = stu.status === 'PRESENT';
                  const isAbsent = stu.status === 'ABSENT';
                  const isLate = stu.status === 'LATE';

                  return (
                    <View
                      key={stu.id}
                      style={[
                        styles.studentRowCard,
                        {
                          borderColor: isPresent ? '#bbf7d0' : isAbsent ? '#fecaca' : '#fed7aa',
                          backgroundColor: isPresent ? '#f0fdf4' : isAbsent ? '#fef2f2' : '#fffbeb',
                        },
                      ]}
                    >
                      {/* Avatar initial */}
                      <TouchableOpacity
                        style={styles.studentAvatarBox}
                        onPress={() => navigateToStudent(stu.id)}
                      >
                        <Text style={styles.studentAvatarText}>
                          {(stu.name || '?').charAt(0).toUpperCase()}
                        </Text>
                      </TouchableOpacity>

                      {/* Info */}
                      <TouchableOpacity
                        style={{ flex: 1, marginHorizontal: 10 }}
                        onPress={() => navigateToStudent(stu.id)}
                      >
                        <Text style={styles.studentRowName} numberOfLines={1}>
                          {stu.name}
                        </Text>
                        <Text style={styles.studentRowMeta}>
                          {stu.roll_no ? `Roll: ${stu.roll_no}` : ''}
                          {stu.admission_no ? ` · Adm: #${stu.admission_no}` : ''}
                        </Text>
                      </TouchableOpacity>

                      {/* Status Toggle Buttons: P, A, L */}
                      <View style={styles.statusButtonsGroup}>
                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isPresent && styles.presentActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'PRESENT')}
                        >
                          <Text style={[styles.statusToggleText, isPresent && styles.statusToggleTextActive]}>
                            P
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isAbsent && styles.absentActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'ABSENT')}
                        >
                          <Text style={[styles.statusToggleText, isAbsent && styles.statusToggleTextActive]}>
                            A
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusToggleBtn, isLate && styles.lateActiveBtn]}
                          onPress={() => setStudentStatus(stu.id, 'LATE')}
                        >
                          <Text style={[styles.statusToggleText, isLate && styles.statusToggleTextActive]}>
                            L
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <EmptyState
                  icon="people-outline"
                  title="No Students in Class"
                  subtitle="Select another class from above or verify class enrollment."
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
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      Save Attendance ({markStudents.length} Students)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB 3: QR & FAST SCAN ATTENDANCE
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'qr_scan' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Scan Banner */}
          <View style={styles.qrHeroCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.qrHeroIcon}>
                <Ionicons name="qr-code-outline" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrHeroTitle}>Student Fast Check-In</Text>
                <Text style={styles.qrHeroSubtitle}>
                  Scan student ID card barcode, QR code or enter Admission No.
                </Text>
              </View>
            </View>

            {/* Input Bar */}
            <View style={styles.qrInputRow}>
              <View style={styles.qrInputContainer}>
                <Ionicons name="barcode-outline" size={20} color={C.muted} />
                <TextInput
                  style={styles.qrTextInput}
                  placeholder="Enter Admission No, Roll No, or Student ID..."
                  placeholderTextColor={C.muted}
                  value={scanQuery}
                  onChangeText={setScanQuery}
                  onSubmitEditing={() => handleFastScan()}
                  returnKeyType="done"
                  autoCapitalize="none"
                />
                {scanQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setScanQuery('')}>
                    <Ionicons name="close-circle" size={18} color={C.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.qrScanActionBtn, scanLoading && { opacity: 0.6 }]}
                onPress={() => handleFastScan()}
                disabled={scanLoading}
              >
                {scanLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#fff" />
                    <Text style={styles.qrScanActionText}>Mark Present</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick Test Demo Chips */}
            {quickTestStudents.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.quickTestLabel}>⚡ Quick Tap to Test Instant Scan:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
                  {quickTestStudents.slice(0, 8).map((stu) => (
                    <TouchableOpacity
                      key={stu.id}
                      style={styles.quickTestChip}
                      onPress={() => handleFastScan(stu.admission_no || String(stu.id))}
                    >
                      <Text style={styles.quickTestChipText}>
                        {stu.name} {stu.roll_no ? `(${stu.roll_no})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Last Scanned Confirmation Card */}
          {lastScannedResult && (
            <View style={styles.lastScannedCard}>
              <View style={styles.lastScannedHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.verifiedCheckBadge}>
                    <Ionicons name="checkmark-circle" size={26} color={C.success} />
                  </View>
                  <View>
                    <Text style={styles.lastScannedTitle}>Attendance Confirmed!</Text>
                    <Text style={styles.lastScannedTime}>Recorded at {lastScannedResult.timestamp}</Text>
                  </View>
                </View>
                <Badge variant="success" size="md">PRESENT</Badge>
              </View>

              <View style={styles.lastScannedStudentInfo}>
                <View style={styles.lastScannedAvatar}>
                  <Text style={styles.lastScannedAvatarText}>
                    {(lastScannedResult.name || 'S').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lastScannedName}>{lastScannedResult.name}</Text>
                  <Text style={styles.lastScannedMeta}>
                    Adm #{lastScannedResult.admission_no} · Roll #{lastScannedResult.roll_no}
                  </Text>
                  <Text style={styles.lastScannedClass}>{lastScannedResult.class_name}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Today's Scanned Log Feed */}
          <View style={styles.scannedFeedCard}>
            <View style={styles.scannedFeedHeader}>
              <View>
                <Text style={styles.scannedFeedTitle}>Today's Fast Scans</Text>
                <Text style={styles.scannedFeedSub}>Real-time automated student check-in records</Text>
              </View>
              <View style={styles.scannedCounterBadge}>
                <Text style={styles.scannedCounterText}>{recentScans.length} Scanned</Text>
              </View>
            </View>

            {recentScans.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                {recentScans.map((item, idx) => (
                  <View key={item.id + '-' + idx} style={styles.feedRow}>
                    <View style={styles.feedStatusIndicator}>
                      <Ionicons name="checkmark" size={14} color={C.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedStudentName}>{item.name}</Text>
                      <Text style={styles.feedStudentMeta}>
                        {item.class_name} · Adm #{item.admission_no}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.feedTimestamp}>{item.timestamp}</Text>
                      <Text style={styles.feedStatusTag}>PRESENT</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Ionicons name="scan-outline" size={40} color={C.muted} />
                <Text style={{ marginTop: 8, fontSize: 13, color: C.muted, fontWeight: '600' }}>
                  No students fast-scanned yet today.
                </Text>
                <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 4 }}>
                  Scan a QR card or type an Admission number above to register attendance.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB 4: TEACHER / STAFF REGISTER
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff_register' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
          refreshControl={
            <RefreshControl
              refreshing={loadingStaff}
              onRefresh={loadStaffData}
              colors={[C.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Current User Quick Punch Card */}
          <View style={styles.staffPunchCard}>
            <View style={styles.staffPunchHeader}>
              <View>
                <Text style={styles.staffPunchTitle}>Teacher / Staff Self-Punch</Text>
                <Text style={styles.staffPunchSub}>
                  {formatDateLabel(selectedDate)} · Institutional Geo-fence Active
                </Text>
              </View>
              <View style={[
                styles.punchStatusBadge,
                myPunchStatus?.check_in_time ? styles.punchStatusPresent : styles.punchStatusPending
              ]}>
                <Text style={[
                  styles.punchStatusBadgeText,
                  myPunchStatus?.check_in_time ? { color: '#059669' } : { color: '#d97706' }
                ]}>
                  {myPunchStatus?.status || (myPunchStatus?.check_in_time ? 'PRESENT' : 'NOT PUNCHED')}
                </Text>
              </View>
            </View>

            <View style={styles.staffPunchMetrics}>
              <View style={styles.punchMetricCol}>
                <Ionicons name="enter-outline" size={18} color="#16a34a" />
                <Text style={styles.punchMetricLabel}>In Time</Text>
                <Text style={styles.punchMetricVal}>
                  {myPunchStatus?.check_in_time ? new Date(myPunchStatus.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                </Text>
              </View>
              <View style={styles.punchMetricDivider} />
              <View style={styles.punchMetricCol}>
                <Ionicons name="exit-outline" size={18} color="#ea580c" />
                <Text style={styles.punchMetricLabel}>Out Time</Text>
                <Text style={styles.punchMetricVal}>
                  {myPunchStatus?.check_out_time ? new Date(myPunchStatus.check_out_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                </Text>
              </View>
              <View style={styles.punchMetricDivider} />
              <View style={styles.punchMetricCol}>
                <Ionicons name="time-outline" size={18} color="#7c3aed" />
                <Text style={styles.punchMetricLabel}>Duration</Text>
                <Text style={styles.punchMetricVal}>
                  {myPunchStatus?.working_minutes ? `${Math.round(myPunchStatus.working_minutes / 60)}h ${myPunchStatus.working_minutes % 60}m` : (myPunchStatus?.check_in_time ? 'Active' : '—')}
                </Text>
              </View>
            </View>

            <View style={styles.punchActionRow}>
              {!myPunchStatus?.check_in_time ? (
                <TouchableOpacity
                  style={[styles.staffPunchBtn, { backgroundColor: '#16a34a' }, punching && { opacity: 0.6 }]}
                  onPress={handleStaffPunchIn}
                  disabled={punching}
                >
                  {punching ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="finger-print" size={18} color="#fff" />
                      <Text style={styles.staffPunchBtnText}>Punch In Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : !myPunchStatus?.check_out_time ? (
                <TouchableOpacity
                  style={[styles.staffPunchBtn, { backgroundColor: '#ea580c' }, punching && { opacity: 0.6 }]}
                  onPress={handleStaffPunchOut}
                  disabled={punching}
                >
                  {punching ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="log-out-outline" size={18} color="#fff" />
                      <Text style={styles.staffPunchBtnText}>Punch Out (End Day)</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.punchedCompleteBanner}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#059669" />
                  <Text style={styles.punchedCompleteText}>Full Day Punch Recorded</Text>
                </View>
              )}
            </View>
          </View>

          {/* School Staff Today Turnout KPIs */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionHeaderTitle}>Faculty & Staff Turnout</Text>
            <View style={styles.kpiRow}>
              <View style={{ flex: 1 }}>
                <KPICard
                  title="Total Staff"
                  value={staffDashboard?.total_employees ?? '—'}
                  icon="people"
                  color="#2563eb"
                  bg="#eff6ff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <KPICard
                  title="Present"
                  value={staffDashboard?.present_today ?? '—'}
                  icon="checkmark-circle"
                  color="#16a34a"
                  bg="#dcfce7"
                />
              </View>
            </View>
            <View style={[styles.kpiRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <KPICard
                  title="Absent"
                  value={staffDashboard?.absent_today ?? '—'}
                  icon="close-circle"
                  color="#dc2626"
                  bg="#fee2e2"
                />
              </View>
              <View style={{ flex: 1 }}>
                <KPICard
                  title="Late Arrivals"
                  value={staffDashboard?.late_today ?? '—'}
                  icon="time"
                  color="#d97706"
                  bg="#fef3c7"
                />
              </View>
            </View>
          </View>

          {/* Staff Roster Filter Pills */}
          <View style={styles.staffFilterRow}>
            {['ALL', 'PRESENT', 'ABSENT', 'LATE'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.staffFilterChip, staffRosterFilter === f && styles.staffFilterChipActive]}
                onPress={() => setStaffRosterFilter(f)}
              >
                <Text style={[styles.staffFilterChipText, staffRosterFilter === f && styles.staffFilterChipTextActive]}>
                  {f === 'ALL' ? 'All Staff' : f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Staff Roster List */}
          <View style={styles.staffRosterCard}>
            <View style={styles.staffRosterHeader}>
              <Text style={styles.staffRosterTitle}>Today's Staff Register</Text>
              <TouchableOpacity onPress={() => navigation.navigate('StaffAttendance')}>
                <Text style={styles.seeFullLink}>Open Full HRMS →</Text>
              </TouchableOpacity>
            </View>

            {staffTodayList.length > 0 ? (
              staffTodayList
                .filter((s) => staffRosterFilter === 'ALL' || (s.status || '').toUpperCase() === staffRosterFilter)
                .map((staff, idx) => (
                  <View key={staff.id || idx} style={styles.staffRosterRow}>
                    <View style={styles.staffAvatar}>
                      <Text style={styles.staffAvatarText}>
                        {(staff.user_name || staff.name || 'T').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.staffNameText} numberOfLines={1}>
                        {staff.user_name || staff.name || 'Staff Member'}
                      </Text>
                      <Text style={styles.staffMetaText}>
                        {staff.role || 'Teacher'} · Emp #{staff.employee_id || staff.user_id || idx + 1}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Badge
                        variant={
                          (staff.status || '').toUpperCase() === 'PRESENT'
                            ? 'success'
                            : (staff.status || '').toUpperCase() === 'ABSENT'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {staff.status || 'ABSENT'}
                      </Badge>
                      <Text style={styles.staffCheckInTime}>
                        {staff.check_in_time ? new Date(staff.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'No punch'}
                      </Text>
                    </View>
                  </View>
                ))
            ) : (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.muted }}>No staff records found for this date.</Text>
              </View>
            )}
          </View>

          {/* Action Links to Analytics & Settings */}
          <View style={styles.hubActionsContainer}>
            <TouchableOpacity
              style={styles.hubActionBtn}
              onPress={() => navigation.navigate('StaffAttendanceAnalytics')}
            >
              <Ionicons name="bar-chart-outline" size={20} color={C.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.hubActionTitle}>Staff Attendance Analytics</Text>
                <Text style={styles.hubActionSub}>Monthly trends, heatmaps, overtime & rankings</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hubActionBtn, { marginTop: 10 }]}
              onPress={() => navigation.navigate('StaffAttendanceSettings')}
            >
              <Ionicons name="settings-outline" size={20} color="#0d9488" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.hubActionTitle}>Geo-fencing & Shift Policies</Text>
                <Text style={styles.hubActionSub}>Radius, start/end times, grace periods & rules</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── Custom Date Input Modal ── */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Attendance Date</Text>
              <TouchableOpacity onPress={() => setShowDatePickerModal(false)}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInstruction}>
              Enter date in YYYY-MM-DD format (e.g. 2026-09-26):
            </Text>

            <TextInput
              style={styles.modalInput}
              value={customDateInput}
              onChangeText={setCustomDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={styles.modalPillBtn}
                onPress={() => setCustomDateInput(todayStr)}
              >
                <Text style={styles.modalPillBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPillBtn}
                onPress={() => setCustomDateInput(shiftDateStr(todayStr, -1))}
              >
                <Text style={styles.modalPillBtnText}>Yesterday</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(customDateInput)) {
                    setSelectedDate(customDateInput);
                    setShowDatePickerModal(false);
                  } else {
                    Alert.alert('Invalid Format', 'Please enter date as YYYY-MM-DD.');
                  }
                }}
              >
                <Text style={styles.modalApplyBtnText}>Apply Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, paddingBottom: 36 },

  // Staff Header
  staffHeader: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  staffHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  staffHeaderSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  headerDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  headerDateText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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

  // Date Navigator Bar
  dateNavigatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dateNavArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  dateNavArrowText: { fontSize: 12, fontWeight: '700', color: C.text },
  dateNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateNavCenterText: { fontSize: 13, fontWeight: '700', color: C.text },
  todayPill: {
    backgroundColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayPillText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  resetTodayBtn: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resetTodayBtnText: { fontSize: 11, fontWeight: '700', color: C.text },

  // Cards & Layout
  kpiRow: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Overall Progress Bar (Web Parity)
  overallHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overallTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  overallPctText: { fontSize: 18, fontWeight: '900' },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  turnoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  turnoutStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  turnoutStatText: {
    fontSize: 12,
    color: C.muted,
  },

  // Class Breakdown
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  sectionSubTitle: { fontSize: 11, color: C.muted, marginTop: 2 },
  quickMarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickMarkPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  classCardWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  classCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classCardName: { fontSize: 14, fontWeight: '700', color: C.text },
  totalBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  totalBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },
  classCardMeta: { fontSize: 12, color: C.muted, marginTop: 3 },
  miniProgressTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  percentText: { fontSize: 13, fontWeight: '800' },
  expandToggleText: { fontSize: 11, fontWeight: '700', color: C.primary },

  // Expanded student roster inside class
  expandedStudentsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expandedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expandedTitle: { fontSize: 12, fontWeight: '800', color: C.text },
  markThisClassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  markThisClassBtnText: { fontSize: 11, fontWeight: '700', color: C.primary },
  expandedStudentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  studentStatusAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  expandedStudentName: { fontSize: 12, fontWeight: '700', color: C.text },
  expandedStudentRoll: { fontSize: 10, color: C.muted },

  // Mark Tab Styles
  chipsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chipHeader: { fontSize: 11, fontWeight: '800', color: C.text, textTransform: 'uppercase' },
  chipCountMeta: { fontSize: 11, color: C.muted },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  chipText: { fontSize: 13, fontWeight: '700', color: C.muted },
  chipTextActive: { color: '#fff' },

  markedStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  markedStatusText: { fontSize: 12, fontWeight: '600', flex: 1 },

  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 11, fontWeight: '800' },
  rosterCountBox: { marginLeft: 'auto' },
  rosterCountText: { fontSize: 11, fontWeight: '800', color: C.muted },

  // Student row card in Mark tab
  studentRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1.5,
  },
  studentAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: { fontSize: 14, fontWeight: '800', color: C.primary },
  studentRowName: { fontSize: 14, fontWeight: '700', color: C.text },
  studentRowMeta: { fontSize: 11, color: C.muted, marginTop: 2 },

  statusButtonsGroup: { flexDirection: 'row', gap: 6 },
  statusToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  presentActiveBtn: { backgroundColor: C.success, borderColor: '#15803d' },
  absentActiveBtn: { backgroundColor: C.danger, borderColor: '#b91c1c' },
  lateActiveBtn: { backgroundColor: C.warning, borderColor: '#b45309' },
  statusToggleText: { fontSize: 14, fontWeight: '900', color: C.muted },
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
    shadowOffset: { width: 0, height: -3 },
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

  // Parent Multi-Child Switcher
  childrenSwitcherCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  switcherLabel: { fontSize: 11, fontWeight: '800', color: C.muted, textTransform: 'uppercase', marginBottom: 6 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  childChipActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  childChipText: { fontSize: 12, fontWeight: '700', color: C.text },
  childChipTextActive: { color: '#fff' },

  // Student / Parent Donut & Notice
  donutRow: { flexDirection: 'row', alignItems: 'center' },
  donutTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  donutSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  thresholdText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },

  // Student Daily Journal
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
  statusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyDate: { fontSize: 13, fontWeight: '700', color: C.text },
  dailyDay: { fontSize: 11, color: C.muted, marginTop: 1 },

  // Date Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  modalInstruction: { fontSize: 12, color: C.muted, marginBottom: 10 },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
  modalPillBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalPillBtnText: { fontSize: 12, fontWeight: '700', color: C.text },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalCancelBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
  modalApplyBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalApplyBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Search input in Mark Tab
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    marginLeft: 8,
    paddingVertical: 0,
  },

  // QR / Fast Scan Styles
  qrHeroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  qrHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeroTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  qrHeroSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  qrInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    alignItems: 'center',
  },
  qrInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 44,
  },
  qrTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  qrScanActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
  },
  qrScanActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  quickTestLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  quickTestChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickTestChipText: { fontSize: 11, color: '#e2e8f0', fontWeight: '600' },

  lastScannedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  lastScannedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  verifiedCheckBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastScannedTitle: { fontSize: 15, fontWeight: '800', color: '#166534' },
  lastScannedTime: { fontSize: 11, color: '#15803d', marginTop: 1 },
  lastScannedStudentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  lastScannedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastScannedAvatarText: { fontSize: 18, fontWeight: '800', color: '#166534' },
  lastScannedName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  lastScannedMeta: { fontSize: 12, color: '#475569', marginTop: 1 },
  lastScannedClass: { fontSize: 12, fontWeight: '700', color: C.primary, marginTop: 2 },

  scannedFeedCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  scannedFeedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  scannedFeedTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  scannedFeedSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  scannedCounterBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scannedCounterText: { fontSize: 11, fontWeight: '700', color: C.text },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  feedStatusIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedStudentName: { fontSize: 13, fontWeight: '700', color: C.text },
  feedStudentMeta: { fontSize: 11, color: C.muted, marginTop: 1 },
  feedTimestamp: { fontSize: 11, fontWeight: '700', color: C.text },
  feedStatusTag: { fontSize: 10, fontWeight: '800', color: C.success, marginTop: 1 },

  // Staff Register Styles
  staffPunchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  staffPunchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  staffPunchTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  staffPunchSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  punchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  punchStatusBadgeText: { fontSize: 11, fontWeight: '800' },
  staffPunchMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  punchMetricCol: { flex: 1, alignItems: 'center' },
  punchMetricLabel: { fontSize: 11, color: C.muted, marginTop: 3 },
  punchMetricVal: { fontSize: 13, fontWeight: '800', color: C.text, marginTop: 2 },
  punchMetricDivider: { width: 1, height: 28, backgroundColor: C.border },
  staffPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    marginTop: 14,
  },
  staffPunchBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  punchedCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  punchedCompleteText: { fontSize: 13, fontWeight: '700', color: '#166534' },

  sectionHeaderTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 10 },
  staffFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  staffFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
  },
  staffFilterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  staffFilterChipText: { fontSize: 12, fontWeight: '700', color: C.muted },
  staffFilterChipTextActive: { color: '#fff' },

  staffRosterCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  staffRosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  staffRosterTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  seeFullLink: { fontSize: 12, fontWeight: '700', color: C.primary },
  staffRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: { fontSize: 14, fontWeight: '800', color: '#4338ca' },
  staffNameText: { fontSize: 13, fontWeight: '700', color: C.text },
  staffMetaText: { fontSize: 11, color: C.muted, marginTop: 1 },
  staffCheckInTime: { fontSize: 10, color: C.muted, marginTop: 2 },

  hubActionsContainer: {
    marginBottom: 24,
  },
  hubActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  hubActionTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  hubActionSub: { fontSize: 11, color: C.muted, marginTop: 1 },
});
