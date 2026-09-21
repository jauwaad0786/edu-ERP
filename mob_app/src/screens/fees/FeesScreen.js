// mob_app/src/screens/fees/FeesScreen.js
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

const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '₹0';

export default function FeesScreen({ navigation }) {
  const { user } = useAuth();
  const [fees, setFees] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isStaff = ['PRINCIPAL', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const endpoint = isStaff ? '/principal/fees/summary' : '/student/fees';
      const f = await client.get(endpoint).catch(() => ({ data: null }));
      setFees(f.data);
      if (isStaff) {
        const rRecent = await client.get('/principal/fees/recent-collections').catch(() => ({ data: [] }));
        setTxns(Array.isArray(rRecent.data) ? rRecent.data : []);
      } else {
        setTxns(Array.isArray(f.data?.records) ? f.data.records : []);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching Fee Records...</Text>
      </SafeAreaView>
    );
  }

  const totalDemand = fees?.total_demand ?? fees?.total_due ?? fees?.gross_due;
  const totalPaid = fees?.paid ?? fees?.collected ?? fees?.total_collected ?? fees?.total_paid;
  const outstanding = fees?.outstanding ?? fees?.balance;

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
          tagline="FINANCIAL LEDGER"
          title={isStaff ? 'Institutional Fees' : 'My Fee Account'}
          subtitle={isStaff ? 'Collection reports and recent transaction audits' : 'Installment tracking and verified receipts'}
          avatarText={user?.name || 'F'}
          gradientColors={['#064e3b', '#047857', '#10b981']}
        />

        {fees && (
          <View style={styles.kpiRow}>
            <KPICard
              label="Total Demand"
              value={fmt(totalDemand)}
              sublabel="Gross Assessment"
              icon="document-text-outline"
              accentColor={colors.primary}
            />
            <KPICard
              label="Total Paid"
              value={fmt(totalPaid)}
              sublabel="Verified Receipts"
              icon="checkmark-circle-outline"
              accentColor={colors.success}
              badgeText="Paid"
            />
          </View>
        )}

        {outstanding != null && (
          <Card padding={16} leftAccentColor={outstanding > 0 ? colors.warning : colors.success}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: outstanding > 0 ? colors.warningBg : colors.successBg }]}>
                <Ionicons
                  name={outstanding > 0 ? 'alert-circle' : 'shield-checkmark'}
                  size={18}
                  color={outstanding > 0 ? colors.warning : colors.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Balance Outstanding</Text>
                <Text style={styles.cardSubtitle}>
                  {outstanding > 0 ? 'Payment due for current academic term' : 'All accounts settled'}
                </Text>
              </View>
              <Badge
                label={outstanding > 0 ? 'Due Pending' : 'Zero Balance'}
                variant={outstanding > 0 ? 'warning' : 'success'}
                showDot
              />
            </View>
            <Text style={[styles.outstandingText, { color: outstanding > 0 ? colors.warning : colors.success }]}>
              {fmt(outstanding)}
            </Text>
          </Card>
        )}

        {txns.length > 0 ? (
          <Card padding={16}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Transaction Records ({txns.length})</Text>
            </View>

            {txns.slice(0, 15).map((t, i) => (
              <View
                key={t.id || i}
                style={[
                  styles.txnRow,
                  i === Math.min(txns.length, 15) - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.txnIconCircle}>
                  <Ionicons name="card" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txnTitle}>
                    {t.student_name ? `${t.student_name} · ` : ''}{t.fee_head || t.description || 'Tuition Fee'}
                  </Text>
                  <Text style={styles.txnSub}>
                    {t.payment_date || t.paid_on || 'Recent'} • {t.payment_mode || t.mode || 'Online'}
                  </Text>
                </View>
                <Text style={styles.txnAmount}>{fmt(t.amount)}</Text>
              </View>
            ))}
          </Card>
        ) : !fees ? (
          <EmptyState
            icon="receipt-outline"
            title="No Fee Records"
            description="No fee assessments or transactions recorded for this account."
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
  cardSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
  },
  outstandingText: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  txnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },
  txnSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  txnAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.success,
  },
});
