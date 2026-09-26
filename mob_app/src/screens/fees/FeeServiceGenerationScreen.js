// mob_app/src/screens/fees/FeeServiceGenerationScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const SERVICES = [
  { code: 'TUITION', name: 'Tuition Fee (Academic)', icon: 'school-outline', color: '#0284c7', bg: '#e0f2fe' },
  { code: 'TRANSPORT', name: 'Transport / Bus Fee', icon: 'bus-outline', color: '#ea580c', bg: '#ffedd5' },
  { code: 'HOSTEL', name: 'Hostel & Mess Fee', icon: 'bed-outline', color: '#7c3aed', bg: '#ede9fe' },
];

const MONTHS = [
  '2026-04', '2026-05', '2026-06', '2026-07',
  '2026-08', '2026-09', '2026-10', '2026-11',
  '2026-12', '2027-01', '2027-02', '2027-03',
];

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function FeeServiceGenerationScreen({ navigation }) {
  const [session, setSession] = useState('2026-27');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [selectedService, setSelectedService] = useState('TUITION');
  const [selectedClassId, setSelectedClassId] = useState('ALL');

  const [classes, setClasses] = useState([]);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load Status and Classes
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [clsRes, statRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/fees-finance/services/generation-status', {
          params: {
            month: selectedMonth,
            session,
            class_id: selectedClassId !== 'ALL' ? selectedClassId : undefined,
          },
        }).catch(() => ({ data: null })),
      ]);

      const cList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      setClasses(cList);
      setStatusData(statRes.data);
    } catch (err) {
      console.warn('Failed to load generation status:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedMonth, session, selectedClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Trigger Fee Generation
  const handleGenerateFees = () => {
    const sName = SERVICES.find(s => s.code === selectedService)?.name || selectedService;
    const cName = selectedClassId === 'ALL' ? 'All Classes' : (classes.find(c => String(c.id) === String(selectedClassId))?.name || 'Selected Class');

    Alert.alert(
      'Confirm Fee Generation',
      `Generate monthly billing demands for:\n\n• Service: ${sName}\n• Month: ${selectedMonth}\n• Target: ${cName}\n\nStudents who already have invoices will not be double-charged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate Now',
          style: 'default',
          onPress: async () => {
            setGenerating(true);
            try {
              const payload = {
                bill_month: selectedMonth,
                month: selectedMonth,
                due_date: `${selectedMonth}-10`,
                session,
                class_id: selectedClassId !== 'ALL' ? parseInt(selectedClassId, 10) : null,
                force_regenerate: false,
              };

              const res = await client.post(`/fees-finance/services/${selectedService}/generate`, payload);
              if (res.data) {
                const genCount = res.data.generated_count || res.data.result?.generated_count || 0;
                const skipCount = res.data.skipped_count || res.data.result?.skipped_count || 0;
                Alert.alert(
                  'Generation Complete',
                  `Successfully generated ${genCount} invoices.\n(${skipCount} already generated or skipped)`
                );
                loadData(true);
              }
            } catch (err) {
              Alert.alert('Generation Failed', err?.response?.data?.error || err?.response?.data?.message || 'Failed to generate fees.');
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const currentServiceInfo = SERVICES.find(s => s.code === selectedService);
  const totalEligible = statusData?.total_eligible || statusData?.eligible_students || 0;
  const alreadyGenerated = statusData?.already_generated || statusData?.billed_students || 0;
  const pendingCount = Math.max(0, totalEligible - alreadyGenerated);
  const totalDemandAmt = statusData?.total_demand || statusData?.demand_amount || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Generate Monthly Fees</Text>
          <Text style={styles.headerSubtitle}>Batch demand generation engine</Text>
        </View>
      </View>

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
        {/* Month Selector Horizontal Bar */}
        <Text style={styles.sectionTitle}>1. SELECT BILLING MONTH</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {MONTHS.map(m => {
            const isSel = selectedMonth === m;
            const [y, mon] = m.split('-');
            const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${monthNames[parseInt(mon, 10)]} '${y.slice(2)}`;

            return (
              <TouchableOpacity
                key={m}
                style={[styles.monthCard, isSel && styles.monthCardActive]}
                onPress={() => setSelectedMonth(m)}
              >
                <Text style={[styles.monthCardText, isSel && styles.monthCardTextActive]}>{label}</Text>
                <Text style={[styles.monthCardSub, isSel && styles.monthCardSubActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Service Type Selector */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>2. SELECT SERVICE MODULE</Text>
        <View style={styles.servicesGrid}>
          {SERVICES.map(s => {
            const isSel = selectedService === s.code;
            return (
              <TouchableOpacity
                key={s.code}
                style={[styles.serviceCard, isSel && styles.serviceCardActive]}
                onPress={() => setSelectedService(s.code)}
                activeOpacity={0.8}
              >
                <View style={[styles.serviceIconBox, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon} size={22} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, isSel && styles.serviceNameActive]}>{s.name}</Text>
                  <Text style={styles.serviceCode}>CODE: {s.code}</Text>
                </View>
                {isSel && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Class Filter Selector */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>3. TARGET ENROLLMENT CLASS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          <TouchableOpacity
            style={[styles.classChip, selectedClassId === 'ALL' && styles.classChipActive]}
            onPress={() => setSelectedClassId('ALL')}
          >
            <Text style={[styles.classChipText, selectedClassId === 'ALL' && styles.classChipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classes.map(c => {
            const isSel = String(selectedClassId) === String(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.classChip, isSel && styles.classChipActive]}
                onPress={() => setSelectedClassId(c.id)}
              >
                <Text style={[styles.classChipText, isSel && styles.classChipTextActive]}>
                  {c.name || `Class ${c.grade_level || c.id}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Live Generation Status Card */}
        <View style={styles.statusBox}>
          <View style={styles.statusHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="analytics-outline" size={20} color={colors.primary} />
              <Text style={styles.statusHeading}>Generation Status Matrix</Text>
            </View>
            <View style={styles.sessionBadge}>
              <Text style={styles.sessionBadgeText}>{session}</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.metricsRow}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricNumber}>{totalEligible}</Text>
                  <Text style={styles.metricLabel}>Total Students</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={[styles.metricNumber, { color: '#16a34a' }]}>{alreadyGenerated}</Text>
                  <Text style={styles.metricLabel}>Already Billed</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={[styles.metricNumber, { color: pendingCount > 0 ? '#ea580c' : '#64748b' }]}>
                    {pendingCount}
                  </Text>
                  <Text style={styles.metricLabel}>Pending</Text>
                </View>
              </View>

              {totalDemandAmt > 0 && (
                <View style={styles.demandAmtRow}>
                  <Text style={styles.demandAmtLabel}>Estimated Gross Demand:</Text>
                  <Text style={styles.demandAmtVal}>{fmt(totalDemandAmt)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={handleGenerateFees}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.generateBtnText}>Processing Batch Invoices...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flash-outline" size={20} color="#ffffff" />
              <Text style={styles.generateBtnText}>
                Generate Invoices for {currentServiceInfo?.code || 'TUITION'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Information Notice */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#0284c7" style={{ marginTop: 2 }} />
          <Text style={styles.infoText}>
            Generating fee demands assigns bill items to students ledger accounts based on their active class fee structure. Unpaid balances will immediately reflect on the parent app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  horizontalRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  monthCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 84,
  },
  monthCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  monthCardTextActive: {
    color: '#ffffff',
  },
  monthCardSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  monthCardSubActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  servicesGrid: {
    gap: 8,
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  serviceCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdf4',
  },
  serviceIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  serviceNameActive: {
    color: colors.primary,
  },
  serviceCode: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  classChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  statusBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  statusHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  sessionBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#f1f5f9',
  },
  demandAmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  demandAmtLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  demandAmtVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d',
  },
  generateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
});
