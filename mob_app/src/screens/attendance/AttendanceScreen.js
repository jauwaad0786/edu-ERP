// mob_app/src/screens/attendance/AttendanceScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet,
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

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let endpoint = '/student/attendance';
      if (role === 'TEACHER') {
        endpoint = '/staff-attendance/my-status';
      } else if (['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'HR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        endpoint = '/staff-attendance/dashboard';
      }

      const r = await client.get(endpoint).catch(() => ({ data: null }));
      setData(r.data);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching Attendance Logs...</Text>
      </SafeAreaView>
    );
  }

  const records = Array.isArray(data?.records) ? data.records : [];
  const attPct = data?.percentage != null
    ? Math.round(data.percentage)
    : data?.present && data?.total_days
    ? Math.round((data.present / data.total_days) * 100)
    : null;

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
        <GradientHero
          tagline="ATTENDANCE REGISTRY"
          title="Daily Verification"
          subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          avatarText={user?.name || 'A'}
          gradientColors={colors.primaryGradient}
        />

        {data && (
          <View style={styles.kpiRow}>
            <KPICard
              label="Attendance Rate"
              value={attPct != null ? `${attPct}%` : '—'}
              sublabel="Cumulative Term"
              icon="pie-chart-outline"
              accentColor={attPct >= 75 ? colors.success : colors.error}
              badgeText={attPct >= 75 ? 'Optimal' : 'Shortage'}
            />
            <KPICard
              label="Present Days"
              value={data.present ?? data.total_present ?? '—'}
              sublabel={`Out of ${data.total_days ?? data.total ?? '—'} days`}
              icon="checkmark-done-circle-outline"
              accentColor={colors.primary}
            />
          </View>
        )}

        {records.length > 0 ? (
          <Card padding={16}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Daily Records Log ({records.length})</Text>
            </View>

            {records.slice(0, 20).map((rec, i) => {
              const isPresent = String(rec.status).toUpperCase() === 'PRESENT';
              const isAbsent = String(rec.status).toUpperCase() === 'ABSENT';
              const isLate = String(rec.status).toUpperCase() === 'LATE';

              return (
                <View
                  key={rec.id || i}
                  style={[
                    styles.logRow,
                    i === Math.min(records.length, 20) - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.dateCol}>
                    <Text style={styles.logDate}>
                      {new Date(rec.date || rec.attendance_date || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', weekday: 'short',
                      })}
                    </Text>
                    {rec.remarks ? <Text style={styles.logRemark}>{rec.remarks}</Text> : null}
                  </View>

                  <Badge
                    label={rec.status || 'Marked'}
                    variant={isPresent ? 'success' : isAbsent ? 'error' : isLate ? 'warning' : 'neutral'}
                    showDot
                  />
                </View>
              );
            })}
          </Card>
        ) : !data ? (
          <EmptyState
            icon="calendar-outline"
            title="No Attendance Logs"
            description="Attendance logs for this academic calendar will populate here once marked."
          />
        ) : null}
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
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dateCol: {
    flex: 1,
  },
  logDate: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },
  logRemark: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
});
