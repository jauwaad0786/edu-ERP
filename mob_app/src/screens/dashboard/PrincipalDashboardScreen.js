// mob_app/src/screens/dashboard/PrincipalDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert,
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

export default function PrincipalDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [s, f] = await Promise.all([
        client.get('/principal/dashboard').catch(() => ({ data: null })),
        client.get('/principal/fees/summary').catch(() => ({ data: null })),
      ]);
      setStats(s.data);
      setFees(f.data);
    } finally {
      if (isRefresh) setRefresh(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const presentPct = stats?.total_students
    ? Math.round((stats.students_present / stats.total_students) * 100)
    : null;
  const collectRate = fees?.total_demand
    ? Math.round((fees.collected / fees.total_demand) * 100)
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Executive Portal...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Executive Hero */}
        <GradientHero
          tagline="EXECUTIVE DASHBOARD"
          title={`${greeting}, ${user?.name || 'Principal'}`}
          subtitle={`${user?.school?.name || 'School ERP'} · Academic Leadership`}
          avatarText={user?.name || 'P'}
          gradientColors={colors.primaryGradient}
        />

        {/* 4-Stat Metric Grid */}
        <View style={styles.gridRow}>
          <KPICard
            label="Total Students"
            value={stats?.total_students ? Number(stats.total_students).toLocaleString() : '—'}
            sublabel="Enrolled"
            icon="people-outline"
            accentColor={colors.primary}
            onPress={() => navigation?.navigate('Students')}
          />
          <KPICard
            label="Student Att."
            value={presentPct != null ? `${presentPct}%` : '—'}
            sublabel="Present today"
            icon="clipboard-outline"
            accentColor={presentPct >= 80 ? colors.success : colors.warning}
            badgeText={presentPct >= 80 ? 'Healthy' : 'Monitor'}
            onPress={() => navigation?.navigate('Attendance')}
          />
        </View>

        <View style={styles.gridRow}>
          <KPICard
            label="Faculty & Staff"
            value={stats?.total_teachers ? Number(stats.total_teachers).toLocaleString() : '—'}
            sublabel="Active staff"
            icon="person-circle-outline"
            accentColor="#7c3aed"
            onPress={() => navigation?.navigate('Staff')}
          />
          <KPICard
            label="Collection Rate"
            value={collectRate != null ? `${collectRate}%` : '—'}
            sublabel="Fiscal target"
            icon="receipt-outline"
            accentColor={collectRate >= 75 ? colors.success : colors.warning}
            badgeText={collectRate >= 75 ? 'On Track' : 'Pending'}
            onPress={() => navigation?.navigate('Fees')}
          />
        </View>

        {/* Quick Operations Actions */}
        <Card padding={16}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="flash-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Executive Actions</Text>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Attendance')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark-done" size={20} color={colors.success} />
              </View>
              <Text style={styles.actionLabel}>Daily Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Fees')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="cash" size={20} color={colors.warning} />
              </View>
              <Text style={styles.actionLabel}>Fee Ledger</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Students')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="school" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Staff')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="people" size={20} color="#7c3aed" />
              </View>
              <Text style={styles.actionLabel}>Teachers</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Financial Overview */}
        {fees && (
          <Card padding={16}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.successBg }]}>
                <Ionicons name="wallet-outline" size={18} color={colors.success} />
              </View>
              <Text style={styles.cardTitle}>Institutional Fee Performance</Text>
            </View>

            {[
              ['Total Demand', `₹${Number(fees.total_demand || 0).toLocaleString('en-IN')}`, colors.text],
              ['Total Collected', `₹${Number(fees.collected || 0).toLocaleString('en-IN')}`, colors.success],
              ['Total Outstanding', `₹${Number(fees.outstanding || 0).toLocaleString('en-IN')}`, colors.warning],
            ].map(([lbl, val, col], i, arr) => (
              <View
                key={lbl}
                style={[
                  styles.infoRow,
                  i === arr.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.infoLabel}>{lbl}</Text>
                <Text style={[styles.infoVal, { color: col }]}>{val}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Sign Out */}
        <Button
          title="Sign Out from Executive Portal"
          variant="secondary"
          icon="log-out-outline"
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])
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
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 13.5,
    fontWeight: '800',
  },
});
