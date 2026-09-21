// mob_app/src/screens/dashboard/StudentDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Alert, TouchableOpacity,
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
import Button from '../../components/common/Button';

export default function StudentDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [p, a, f] = await Promise.all([
        client.get('/student/profile').catch(() => ({ data: null })),
        client.get('/student/attendance').catch(() => ({ data: null })),
        client.get('/student/fees').catch(() => ({ data: null })),
      ]);
      setProfile(p.data);
      setAttendance(a.data);
      setFees(f.data);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const attPct = attendance?.percentage != null
    ? Math.round(attendance.percentage)
    : attendance
    ? Math.round((attendance.present / (attendance.total_days || attendance.total || 1)) * 100)
    : null;

  const dueAmount = Number(fees?.outstanding ?? fees?.balance ?? 0);
  const paidAmount = Number(fees?.total_paid ?? fees?.paid ?? 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Student Dashboard...</Text>
      </SafeAreaView>
    );
  }

  const studentName = profile?.name || user?.name || (role === 'PARENT' ? 'Parent' : 'Student');
  const classDisplay = profile?.class_name
    ? `Class ${profile.class_name}${profile.section ? ` · Sec ${profile.section}` : ''}`
    : 'Enrolled';

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
        {/* Modern Gradient Hero */}
        <GradientHero
          tagline={role === 'PARENT' ? 'PARENT PORTAL' : 'STUDENT PORTAL'}
          title={studentName}
          subtitle={`${classDisplay} • Roll #${profile?.roll_no || '—'}`}
          avatarText={studentName}
          gradientColors={colors.studentGradient}
        />

        {/* High-Impact KPI Stat Cards */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Attendance"
            value={attPct != null ? `${attPct}%` : '—'}
            sublabel={`Present: ${attendance?.present ?? 0} days`}
            icon="clipboard-outline"
            accentColor={attPct >= 75 ? colors.success : colors.error}
            badgeText={attPct != null ? (attPct >= 75 ? 'Good' : 'Attention') : null}
            onPress={() => navigation?.navigate('Attendance')}
          />

          <KPICard
            label="Fee Dues"
            value={`₹${dueAmount.toLocaleString('en-IN')}`}
            sublabel={`Paid: ₹${paidAmount.toLocaleString('en-IN')}`}
            icon="receipt-outline"
            accentColor={dueAmount > 0 ? colors.warning : colors.success}
            badgeText={dueAmount > 0 ? 'Due' : 'Cleared'}
            onPress={() => navigation?.navigate('Fees')}
          />
        </View>

        {/* Quick Academic Hub */}
        <Card padding={16}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Academic Hub</Text>
          </View>

          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation?.navigate('Attendance')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.success} />
              </View>
              <Text style={styles.quickLabel}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation?.navigate('Fees')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="card-outline" size={22} color={colors.warning} />
              </View>
              <Text style={styles.quickLabel}>Fee Receipts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation?.navigate('Result')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>Report Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation?.navigate('Notes')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="document-text-outline" size={22} color="#7c3aed" />
              </View>
              <Text style={styles.quickLabel}>Study Notes</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Attendance Breakdown Card */}
        {attendance ? (
          <Card padding={16}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconCircle, { backgroundColor: colors.successBg }]}>
                <Ionicons name="stats-chart-outline" size={16} color={colors.success} />
              </View>
              <Text style={styles.sectionTitle}>Attendance Overview</Text>
              <Badge
                label={attPct >= 75 ? 'Above 75%' : 'Low Attendance'}
                variant={attPct >= 75 ? 'success' : 'error'}
                style={{ marginLeft: 'auto' }}
              />
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(attPct || 0, 100)}%`,
                    backgroundColor: attPct >= 75 ? colors.success : colors.error,
                  },
                ]}
              />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Present</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {attendance.present ?? 0}
                </Text>
              </View>

              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Absent</Text>
                <Text style={[styles.statValue, { color: colors.error }]}>
                  {attendance.absent ?? 0}
                </Text>
              </View>

              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Total Days</Text>
                <Text style={styles.statValue}>
                  {attendance.total_days ?? attendance.total ?? 0}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Profile Card */}
        {profile ? (
          <Card padding={16}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Student Details</Text>
            </View>

            {[
              ['Admission No', profile.admission_no],
              ['Date of Birth', profile.dob],
              ['Guardian / Father', profile.guardian_name || profile.father_name],
              ['Contact Phone', profile.guardian_phone || profile.phone],
            ].filter(([, v]) => v).map(([lbl, val], idx, arr) => (
              <View
                key={lbl}
                style={[
                  styles.profileRow,
                  idx === arr.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.profileLabel}>{lbl}</Text>
                <Text style={styles.profileVal}>{val}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Logout Button */}
        <Button
          title="Sign Out from Portal"
          variant="danger"
          icon="log-out-outline"
          onPress={() =>
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out from the student portal?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: logout },
              ]
            )
          }
          style={{ marginTop: 8 }}
        />
      </ScrollView>
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
    padding: 16,
    paddingBottom: 32,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  quickItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  profileLabel: {
    fontSize: 12.5,
    color: colors.muted,
    fontWeight: '500',
  },
  profileVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text,
  },
});
