// mob_app/src/screens/dashboard/AdminDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator,
  TouchableOpacity, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import KPICard from '../../components/common/KPICard';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

export default function AdminDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await client.get('/admin/platform-dashboard')
        .catch(() => client.get('/admin/dashboard').catch(() => ({ data: null })));
      setStats(r.data);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Platform Admin...</Text>
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
        <GradientHero
          tagline="SUPER ADMINISTRATOR"
          title={user?.name || 'Platform Admin'}
          subtitle="EduERP 1P360 Cloud Platform Governance"
          avatarText={user?.name || 'A'}
          gradientColors={colors.adminGradient}
        />

        {stats ? (
          <View>
            <View style={styles.gridRow}>
              <KPICard
                label="Onboarded Schools"
                value={stats.total_schools ?? '—'}
                sublabel="Active instances"
                icon="business-outline"
                accentColor={colors.primary}
                onPress={() => navigation?.navigate('Schools')}
              />
              <KPICard
                label="Active Subscriptions"
                value={stats.active_subscriptions || stats.total_active || stats.total_schools || '—'}
                sublabel="Licensed plans"
                icon="shield-checkmark-outline"
                accentColor={colors.success}
              />
            </View>

            <View style={styles.gridRow}>
              <KPICard
                label="Total Students"
                value={stats.total_students ? Number(stats.total_students).toLocaleString() : '—'}
                sublabel="Across all schools"
                icon="people-outline"
                accentColor="#7c3aed"
                onPress={() => navigation?.navigate('Users')}
              />
              <KPICard
                label="Total Teachers"
                value={stats.total_teachers ? Number(stats.total_teachers).toLocaleString() : '—'}
                sublabel="Faculty strength"
                icon="school-outline"
                accentColor={colors.warning}
                onPress={() => navigation?.navigate('Users')}
              />
            </View>
          </View>
        ) : null}

        <Card padding={16}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="apps-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Platform Administration Hub</Text>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Schools')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="business" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Schools</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Users')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="person-add" size={20} color={colors.success} />
              </View>
              <Text style={styles.actionLabel}>All Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation?.navigate('Support')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="help-buoy" size={20} color={colors.warning} />
              </View>
              <Text style={styles.actionLabel}>Support</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Button
          title="Sign Out Platform Admin"
          variant="secondary"
          icon="log-out-outline"
          onPress={() =>
            Alert.alert('Sign Out', 'Sign out of admin portal?', [
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
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
