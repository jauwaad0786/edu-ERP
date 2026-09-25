// mob_app/src/screens/dashboard/PrincipalDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import ProgressRing from '../../components/common/ProgressRing';
import DrawerMenuModal from '../menu/DrawerMenuModal';
import LogoutModal from '../menu/LogoutModal';

export default function PrincipalDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [fees, setFees] = useState(null);
  const [school, setSchool] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [statsRes, feesRes, schoolRes, notifCountRes, meetingsRes] = await Promise.all([
        client.get('/principal/dashboard').catch(() => ({ data: null })),
        client.get('/principal/fees/summary').catch(() => ({ data: null })),
        client.get('/principal/school/profile').catch(() => ({ data: null })),
        client.get('/notifications/unread-count').catch(() =>
          client.get('/support/notifications').catch(() => ({ data: [] }))
        ),
        client.get('/support/meetings').catch(() => ({ data: [] })),
      ]);

      setStats(statsRes.data);
      setFees(feesRes.data);
      setSchool(schoolRes.data);

      if (typeof notifCountRes?.data?.unread_count === 'number') {
        setUnreadCount(notifCountRes.data.unread_count);
      } else {
        const notifs = Array.isArray(notifCountRes.data)
          ? notifCountRes.data
          : notifCountRes.data?.notifications || [];
        const unread = notifs.filter(n => !n.is_read && !n.read).length;
        setUnreadCount(unread);
      }

      const meets = Array.isArray(meetingsRes.data)
        ? meetingsRes.data
        : meetingsRes.data?.meetings || meetingsRes.data?.data || [];
      setTodaySchedule(meets);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await logout();
    } catch (e) {}
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const principalName = user?.name || user?.email?.split('@')[0] || 'Principal';
  const schoolName = school?.name || user?.school?.name || user?.school_name || 'EduERP Institution';
  const academicYear = school?.current_session || user?.school?.current_session || school?.academic_year || '2024-25';

  // Dynamic Metrics strictly from Backend API (No hardcoded values)
  const totalStudents = stats?.total_students ?? 0;
  const totalTeachers = stats?.total_teachers ?? 0;
  const totalClasses = stats?.total_classes ?? 0;
  const attendanceRate = stats?.attendance_percentage != null
    ? Math.round(Number(stats.attendance_percentage))
    : (stats?.students_present && stats?.total_students
        ? Math.round((stats.students_present / stats.total_students) * 100)
        : 0);

  // Dynamic Fees strictly from Backend API (No hardcoded values)
  const feeIntel = stats?.fee_intelligence || {};
  const totalCollected = Number(
    fees?.total_paid ?? fees?.collected ?? fees?.total_collected ?? feeIntel.all_time_collected ?? 0
  );
  const totalDemand = Number(
    fees?.total_due ?? fees?.total_demand ?? fees?.gross_due ?? feeIntel.all_time_generated ?? 0
  );
  const totalDue = Number(
    fees?.outstanding ?? fees?.total_due ?? feeIntel.all_time_pending ?? 0
  );
  const overdueAmount = Number(fees?.overdue ?? 0);
  const thisMonthAmount = Number(fees?.this_month ?? feeIntel.month_collected ?? 0);
  const feeRate = totalDemand > 0 ? Math.min(100, Math.round((totalCollected / totalDemand) * 100)) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Connecting to School ERP...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Card Matching Mockup */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            {/* Principal Avatar - Tap opens full Drawer Menu */}
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>{principalName.charAt(0)}</Text>
              </View>
            </TouchableOpacity>

            {/* Greeting & Name */}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.principalNameText} numberOfLines={1}>
                {principalName} 👋
              </Text>
            </View>

            {/* AI Copilot Sparkle Button */}
            <TouchableOpacity
              style={[styles.bellBtn, { marginRight: 8, backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}
              onPress={() => navigation?.navigate('AIChat')}
              activeOpacity={0.75}
            >
              <Ionicons name="sparkles" size={18} color="#ffffff" />
            </TouchableOpacity>

            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation?.navigate('Notifications')}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications" size={20} color="#ffffff" />
              {unreadCount > 0 && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* School & Session Selector Pill */}
          <View style={styles.schoolPill}>
            <Ionicons name="business" size={15} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.schoolPillText} numberOfLines={1}>
              {schoolName}
            </Text>
            <Text style={styles.sessionDot}>·</Text>
            <Text style={styles.sessionText}>{academicYear}</Text>
            <Text style={styles.changeText}>• Change</Text>
          </View>

          {/* Search Input Bar */}
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color={colors.textSubtle} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search anything..."
              placeholderTextColor={colors.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (searchQuery.trim()) {
                  navigation?.navigate('Students', { query: searchQuery.trim() });
                }
              }}
            />
            <TouchableOpacity
              style={styles.searchActionBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (searchQuery.trim()) {
                  navigation?.navigate('Students', { query: searchQuery.trim() });
                }
              }}
            >
              <Ionicons name="search" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 KPI Stat Counters Row - Interactive Cards */}
        <View style={styles.kpiRow}>
          <TouchableOpacity
            style={styles.kpiBox}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Students')}
          >
            <View style={[styles.kpiIcon, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="school" size={18} color="#0284c7" />
            </View>
            <Text style={styles.kpiValue}>{Number(totalStudents).toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Students</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiBox}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Teachers')}
          >
            <View style={[styles.kpiIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="people" size={18} color="#7c3aed" />
            </View>
            <Text style={styles.kpiValue}>{Number(totalTeachers).toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Teachers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiBox}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Classes')}
          >
            <View style={[styles.kpiIcon, { backgroundColor: '#ccfbf1' }]}>
              <Ionicons name="book" size={18} color="#0d9488" />
            </View>
            <Text style={styles.kpiValue}>{Number(totalClasses).toLocaleString()}</Text>
            <Text style={styles.kpiLabel}>Classes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiBox}
            activeOpacity={0.8}
            onPress={() => navigation?.navigate('Attendance')}
          >
            <View style={[styles.kpiIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-done" size={18} color="#16a34a" />
            </View>
            <Text style={styles.kpiValue}>{attendanceRate}%</Text>
            <Text style={styles.kpiLabel}>Attendance</Text>
          </TouchableOpacity>
        </View>

        {/* Fee Collection Card with Circular Ring - Interactive */}
        <TouchableOpacity
          style={styles.feeCard}
          activeOpacity={0.9}
          onPress={() => navigation?.navigate('Fees')}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.feeCardTitle}>Fee Collection</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>

          <View style={styles.feeContentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeAmount}>
                ₹ {totalCollected.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.feeDemand}>
                of ₹ {totalDemand.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* Circular Progress Ring */}
            <ProgressRing
              size={76}
              strokeWidth={7.5}
              percentage={feeRate}
              color="#0284c7"
              trackColor="#e0f2fe"
            />
          </View>

          {/* 3 Mini Dues Pills */}
          <View style={styles.feePillsRow}>
            <View style={[styles.miniPill, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <View style={[styles.pillDot, { backgroundColor: '#dc2626' }]} />
              <Text style={[styles.miniPillText, { color: '#dc2626' }]}>
                ₹ {totalDue.toLocaleString('en-IN')} Total Due
              </Text>
            </View>

            <View style={[styles.miniPill, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <View style={[styles.pillDot, { backgroundColor: '#ea580c' }]} />
              <Text style={[styles.miniPillText, { color: '#ea580c' }]}>
                ₹ {overdueAmount.toLocaleString('en-IN')} Overdue
              </Text>
            </View>

            <View style={[styles.miniPill, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <View style={[styles.pillDot, { backgroundColor: '#16a34a' }]} />
              <Text style={[styles.miniPillText, { color: '#16a34a' }]}>
                ₹ {thisMonthAmount.toLocaleString('en-IN')} This Month
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Actions Grid */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionHeading}>Quick Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation?.navigate('AddStudent')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="person-add" size={20} color="#0284c7" />
              </View>
              <Text style={styles.actionItemLabel}>Add Student</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation?.navigate('Teachers')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="person-circle" size={20} color="#7c3aed" />
              </View>
              <Text style={styles.actionItemLabel}>Add Teacher</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation?.navigate('Attendance')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="checkbox" size={20} color="#16a34a" />
              </View>
              <Text style={styles.actionItemLabel}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation?.navigate('Reports')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#fce7f3' }]}>
                <Ionicons name="document-text" size={20} color="#db2777" />
              </View>
              <Text style={styles.actionItemLabel}>View Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation?.navigate('AIChat')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="sparkles" size={20} color="#2563eb" />
              </View>
              <Text style={styles.actionItemLabel}>ERP Copilot</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Schedule Timeline */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeaderRow}>
            <Text style={styles.sectionHeading}>Today's Schedule</Text>
            <TouchableOpacity onPress={() => navigation?.navigate('Examinations')} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {todaySchedule.length > 0 ? (
            todaySchedule.slice(0, 3).map((item, idx) => (
              <View key={item.id || idx} style={styles.scheduleCard}>
                <View style={styles.scheduleIconCircle}>
                  <Ionicons name="time" size={20} color="#7c3aed" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.scheduleTime}>
                    {item.meeting_time || item.time || (item.start_time ? item.start_time.slice(0, 5) : 'Today')}
                  </Text>
                  <Text style={styles.scheduleTitle}>
                    {item.title || item.name || item.purpose || 'Institutional Schedule'}
                  </Text>
                  <Text style={styles.scheduleRoom}>
                    {item.location || item.room || item.status || 'Campus'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
              </View>
            ))
          ) : (
            <View style={[styles.scheduleCard, { justifyContent: 'center', paddingVertical: 18 }]}>
              <Ionicons name="calendar-outline" size={24} color="#94a3b8" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                No meetings or schedule items for today
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Drawer Menu Modal with All Modules */}
      <DrawerMenuModal
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        user={user}
        onLogoutPress={() => setLogoutModalVisible(true)}
      />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        visible={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#0b57d0',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 24,
    shadowColor: '#0b57d0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  greetingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  principalNameText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0b57d0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  schoolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  schoolPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ffffff',
    maxWidth: 160,
  },
  sessionDot: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 4,
    fontSize: 14,
  },
  sessionText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  changeText: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: '700',
    marginLeft: 6,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    height: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.text,
  },
  searchActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0b57d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 1,
  },
  feeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  feeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  feeContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  feeAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  feeDemand: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  feePillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickActionsSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionItemLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scheduleSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  scheduleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTime: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 1,
  },
  scheduleRoom: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
});
