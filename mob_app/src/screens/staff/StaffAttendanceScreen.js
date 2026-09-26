// mob_app/src/screens/staff/StaffAttendanceScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

export default function StaffAttendanceScreen({ navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipalOrHR = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'HR'].includes(role);

  const [activeTab, setActiveTab] = useState(isPrincipalOrHR ? 'Overview' : 'MyPunch'); // 'Overview' | 'MyPunch'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Self Punch States
  const [myTodayStatus, setMyTodayStatus] = useState(null);
  const [punching, setPunching] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);

  // Principal Overview States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [todayStaffList, setTodayStaffList] = useState([]);
  const [rosterFilter, setRosterFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'

  // 1. Load Self Punch Data
  const loadSelfStatus = useCallback(async () => {
    try {
      const [statusRes, monthRes] = await Promise.all([
        client.get('/staff-attendance/my-status').catch(() => ({ data: null })),
        client.get('/staff-attendance/monthly-summary').catch(() => ({ data: null })),
      ]);
      setMyTodayStatus(statusRes.data);
      setMonthlySummary(monthRes.data);
    } catch (err) {
      console.warn('Failed to load my attendance:', err);
    }
  }, []);

  // 2. Load Principal Dashboard Overview
  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, todayRes] = await Promise.all([
        client.get(`/staff-attendance/dashboard?date=${selectedDate}`).catch(() => ({ data: null })),
        client.get(`/staff-attendance/today?date=${selectedDate}`).catch(() => ({ data: [] })),
      ]);
      setDashboardMetrics(dashRes.data);
      const rawList = Array.isArray(todayRes.data) ? todayRes.data : todayRes.data?.records || todayRes.data?.data || [];
      setTodayStaffList(rawList);
    } catch (err) {
      console.warn('Failed to load staff attendance dashboard:', err);
    }
  }, [selectedDate]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      await Promise.all([
        loadSelfStatus(),
        isPrincipalOrHR ? loadDashboard() : Promise.resolve(),
      ]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [loadSelfStatus, loadDashboard, isPrincipalOrHR]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Punch In
  const handleCheckIn = async () => {
    setPunching(true);
    try {
      await client.post('/staff-attendance/check-in', {
        device: 'MOBILE_APP',
      });
      Alert.alert('Checked In', 'Your check-in attendance has been recorded successfully.');
      loadSelfStatus();
      if (isPrincipalOrHR) loadDashboard();
    } catch (err) {
      Alert.alert('Check-In Failed', err.response?.data?.error || 'Could not record check-in.');
    } finally {
      setPunching(false);
    }
  };

  // Handle Punch Out
  const handleCheckOut = async () => {
    setPunching(true);
    try {
      await client.post('/staff-attendance/check-out', {});
      Alert.alert('Checked Out', 'Your check-out attendance has been recorded successfully.');
      loadSelfStatus();
      if (isPrincipalOrHR) loadDashboard();
    } catch (err) {
      Alert.alert('Check-Out Failed', err.response?.data?.error || 'Could not record check-out.');
    } finally {
      setPunching(false);
    }
  };

  // Change Date
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filteredRoster = useMemo(() => {
    if (rosterFilter === 'ALL') return todayStaffList;
    return todayStaffList.filter(s => (s.status || '').toUpperCase() === rosterFilter);
  }, [todayStaffList, rosterFilter]);

  const hasCheckedIn = Boolean(myTodayStatus?.check_in_time);
  const hasCheckedOut = Boolean(myTodayStatus?.check_out_time);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Staff Attendance & Punch</Text>
            <Text style={styles.headerSub}>Biometric, GPS & Daily Turnout</Text>
          </View>
        </View>

        {isPrincipalOrHR && (
          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'Overview' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('Overview')}
            >
              <Text style={[styles.toggleText, activeTab === 'Overview' && styles.toggleTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'MyPunch' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('MyPunch')}
            >
              <Text style={[styles.toggleText, activeTab === 'MyPunch' && styles.toggleTextActive]}>
                My Punch
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : activeTab === 'MyPunch' ? (
        /* MY ATTENDANCE SELF-SERVICE */
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
          {/* Today's Punch Card */}
          <View style={styles.punchCard}>
            <View style={styles.punchCardHeader}>
              <View>
                <Text style={styles.punchCardDay}>Today's Attendance</Text>
                <Text style={styles.punchCardDate}>
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              <View style={[
                styles.punchStatusBadge,
                hasCheckedIn ? styles.punchStatusPresent : styles.punchStatusPending
              ]}>
                <Text style={[
                  styles.punchStatusText,
                  hasCheckedIn ? { color: '#059669' } : { color: '#d97706' }
                ]}>
                  {myTodayStatus?.status || (hasCheckedIn ? 'PRESENT' : 'NOT PUNCHED')}
                </Text>
              </View>
            </View>

            {/* In / Out Times Grid */}
            <View style={styles.punchGrid}>
              <View style={styles.punchCol}>
                <Ionicons name="enter-outline" size={20} color="#16a34a" />
                <Text style={styles.punchLabel}>Punch In</Text>
                <Text style={styles.punchTime}>{fmtTime(myTodayStatus?.check_in_time)}</Text>
              </View>

              <View style={styles.punchDivider} />

              <View style={styles.punchCol}>
                <Ionicons name="exit-outline" size={20} color="#ea580c" />
                <Text style={styles.punchLabel}>Punch Out</Text>
                <Text style={styles.punchTime}>{fmtTime(myTodayStatus?.check_out_time)}</Text>
              </View>

              <View style={styles.punchDivider} />

              <View style={styles.punchCol}>
                <Ionicons name="time-outline" size={20} color="#7c3aed" />
                <Text style={styles.punchLabel}>Duration</Text>
                <Text style={styles.punchTime}>
                  {myTodayStatus?.duration_hours ? `${myTodayStatus.duration_hours} hrs` : (hasCheckedIn && !hasCheckedOut ? 'In Progress' : '—')}
                </Text>
              </View>
            </View>

            {/* Punch Action Buttons */}
            <View style={styles.punchActionRow}>
              {!hasCheckedIn ? (
                <TouchableOpacity
                  style={[styles.punchBtn, styles.punchInBtn, punching && { opacity: 0.6 }]}
                  onPress={handleCheckIn}
                  disabled={punching}
                >
                  {punching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={20} color="#fff" />
                      <Text style={styles.punchBtnText}>Record Punch In</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : !hasCheckedOut ? (
                <TouchableOpacity
                  style={[styles.punchBtn, styles.punchOutBtn, punching && { opacity: 0.6 }]}
                  onPress={handleCheckOut}
                  disabled={punching}
                >
                  {punching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={20} color="#fff" />
                      <Text style={styles.punchBtnText}>Record Punch Out</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.completedNotice}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.completedNoticeText}>Attendance completed for today!</Text>
                </View>
              )}
            </View>
          </View>

          {/* Monthly Attendance Breakdown */}
          {monthlySummary && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>This Month's Attendance Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryBox, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.summaryVal, { color: '#16a34a' }]}>{monthlySummary.present_days ?? 0}</Text>
                  <Text style={styles.summaryLbl}>Present</Text>
                </View>
                <View style={[styles.summaryBox, { backgroundColor: '#fef2f2' }]}>
                  <Text style={[styles.summaryVal, { color: '#dc2626' }]}>{monthlySummary.absent_days ?? 0}</Text>
                  <Text style={styles.summaryLbl}>Absent</Text>
                </View>
                <View style={[styles.summaryBox, { backgroundColor: '#fffbeb' }]}>
                  <Text style={[styles.summaryVal, { color: '#d97706' }]}>{monthlySummary.late_days ?? 0}</Text>
                  <Text style={styles.summaryLbl}>Late</Text>
                </View>
                <View style={[styles.summaryBox, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[styles.summaryVal, { color: '#0284c7' }]}>{monthlySummary.leave_days ?? 0}</Text>
                  <Text style={styles.summaryLbl}>Leaves</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      ) : (
        /* PRINCIPAL & HR DASHBOARD OVERVIEW */
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
          {/* Date Navigator */}
          <View style={styles.dateBar}>
            <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateShiftBtn}>
              <Ionicons name="chevron-back" size={20} color="#0284c7" />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.dateBarVal}>
                {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.dateBarSub}>{selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : 'Historical'}</Text>
            </View>

            <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateShiftBtn}>
              <Ionicons name="chevron-forward" size={20} color="#0284c7" />
            </TouchableOpacity>
          </View>

          {/* Turnout KPI Cards */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { borderLeftColor: '#0284c7' }]}>
              <Text style={styles.metricVal}>{dashboardMetrics?.total_employees ?? todayStaffList.length}</Text>
              <Text style={styles.metricLbl}>Total Staff</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#16a34a' }]}>
              <Text style={[styles.metricVal, { color: '#16a34a' }]}>{dashboardMetrics?.present ?? 0}</Text>
              <Text style={styles.metricLbl}>Present</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={[styles.metricVal, { color: '#dc2626' }]}>{dashboardMetrics?.absent ?? 0}</Text>
              <Text style={styles.metricLbl}>Absent</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#d97706' }]}>
              <Text style={[styles.metricVal, { color: '#d97706' }]}>{dashboardMetrics?.late ?? 0}</Text>
              <Text style={styles.metricLbl}>Late</Text>
            </View>
          </View>

          {/* Roster Filter Tabs */}
          <View style={styles.filterTabs}>
            {['ALL', 'PRESENT', 'ABSENT', 'LATE'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, rosterFilter === f && styles.filterTabActive]}
                onPress={() => setRosterFilter(f)}
              >
                <Text style={[styles.filterTabText, rosterFilter === f && styles.filterTabTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Today Staff Attendance List */}
          <Text style={styles.sectionTitle}>Staff Attendance Roster ({filteredRoster.length})</Text>
          {filteredRoster.length > 0 ? (
            <View style={{ gap: 8 }}>
              {filteredRoster.map((item, idx) => {
                const name = item.user_name || item.name || `Staff ${idx + 1}`;
                const status = (item.status || 'PRESENT').toUpperCase();
                const inTime = fmtTime(item.check_in_time);
                const outTime = fmtTime(item.check_out_time);

                return (
                  <View key={item.id || idx} style={styles.rosterCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.rosterName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.rosterSub}>
                        {item.role || item.department || 'Faculty'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[
                        styles.statusPill,
                        status === 'PRESENT' ? styles.statusPillPresent :
                        status === 'LATE' ? styles.statusPillLate : styles.statusPillAbsent
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          status === 'PRESENT' ? { color: '#059669' } :
                          status === 'LATE' ? { color: '#d97706' } : { color: '#dc2626' }
                        ]}>
                          {status}
                        </Text>
                      </View>
                      <Text style={styles.timeMeta}>In: {inTime} {item.check_out_time ? `• Out: ${outTime}` : ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyCardText}>No staff attendance records for this date/filter.</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#0284c7' },
  toggleText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  toggleTextActive: { color: '#fff' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  punchCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  punchCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  punchCardDay: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  punchCardDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  punchStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  punchStatusPresent: { backgroundColor: '#ecfdf5' },
  punchStatusPending: { backgroundColor: '#fef3c7' },
  punchStatusText: { fontSize: 11, fontWeight: '700' },
  punchGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  punchCol: { flex: 1, alignItems: 'center', gap: 2 },
  punchLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '600' },
  punchTime: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  punchDivider: { width: 1, backgroundColor: '#e2e8f0' },
  punchActionRow: { marginTop: 4 },
  punchBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  punchInBtn: { backgroundColor: '#16a34a' },
  punchOutBtn: { backgroundColor: '#ea580c' },
  punchBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 10,
  },
  completedNoticeText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryBox: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '800' },
  summaryLbl: { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: '600' },
  dateBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  dateShiftBtn: { padding: 6, backgroundColor: '#f0f9ff', borderRadius: 8 },
  dateBarVal: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  dateBarSub: { fontSize: 10, color: '#64748b' },
  metricsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  metricVal: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  metricLbl: { fontSize: 10, color: '#64748b', marginTop: 2 },
  filterTabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#0284c7' },
  filterTabText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  rosterCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
  rosterName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  rosterSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusPillPresent: { backgroundColor: '#ecfdf5' },
  statusPillLate: { backgroundColor: '#fffbeb' },
  statusPillAbsent: { backgroundColor: '#fef2f2' },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  timeMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardText: { fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
});
