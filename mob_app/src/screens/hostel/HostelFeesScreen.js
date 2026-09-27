// mob_app/src/screens/hostel/HostelFeesScreen.js
// Hostel Monthly Fee Demands & Collection — 100% mirrors Web ERP HostelFees.jsx
// Handles automated billing generation, payment logs, and central finance ledger sync.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const getCurrentMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthName = (ym) => {
  if (!ym) return '';
  try {
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch (e) {
    return ym;
  }
};

const getAdjacentMonth = (ym, delta) => {
  if (!ym) return getCurrentMonth();
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function HostelFeesScreen({ navigation }) {
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate Modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genFreq, setGenFreq] = useState('MONTHLY');
  const [generating, setGenerating] = useState(false);

  // Collect Payment Modal
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedDue, setSelectedDue] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payRemarks, setPayRemarks] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchDues = useCallback(async () => {
    try {
      setLoading(true);
      const params = { month: monthFilter };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await client.get('/hostel/fees/dues', { params });
      setDues(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load hostel fee dues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthFilter, statusFilter, search]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  // Aggregate KPIs
  const totalBilled = dues.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
  const totalCollected = dues.reduce((acc, d) => acc + (parseFloat(d.paid_amount) || 0), 0);
  const totalOutstanding = dues.reduce((acc, d) => acc + (parseFloat(d.outstanding) || 0), 0);

  const handleGenerateBills = async () => {
    try {
      setGenerating(true);
      const res = await client.post('/hostel/fees/generate-monthly', {
        month: monthFilter,
        frequency: genFreq,
      });
      Alert.alert(
        'Billing Demands Generated',
        res.data?.message || `Hostel billing demands created for ${formatMonthName(monthFilter)}`
      );
      setShowGenModal(false);
      fetchDues();
    } catch (err) {
      Alert.alert('Generation Failed', err.response?.data?.error || 'Failed to generate hostel bills');
    } finally {
      setGenerating(false);
    }
  };

  const openCollect = (item) => {
    setSelectedDue(item);
    setPayAmount((item.outstanding || item.amount || 0).toString());
    setPayMode('CASH');
    setPayRemarks('');
    setShowCollectModal(true);
  };

  const handleCollectPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      Alert.alert('Required', 'Please enter a valid payment amount.');
      return;
    }
    try {
      setSubmittingPayment(true);
      await client.post('/hostel/fees/collect', {
        record_id: selectedDue.record_id,
        amount_paid: parseFloat(payAmount),
        payment_mode: payMode,
        remarks: payRemarks,
      });
      Alert.alert('Payment Recorded', `₹${payAmount} collected & ledger synced successfully.`);
      setShowCollectModal(false);
      fetchDues();
    } catch (err) {
      Alert.alert('Payment Failed', err.response?.data?.error || 'Payment recording failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const renderDueItem = ({ item }) => {
    const isPaid = (item.status || '').toUpperCase() === 'PAID';
    const isPartial = (item.status || '').toUpperCase() === 'PARTIAL';
    const badgeBg = isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2';
    const badgeColor = isPaid ? '#15803d' : isPartial ? '#b45309' : '#dc2626';

    return (
      <View style={styles.dueCard}>
        <View style={styles.dueHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{item.student_name}</Text>
            <Text style={styles.roomSub}>
              {item.hostel_name || 'Hostel'} • R-{item.room_number || '—'} (Bed {item.bed_number || '—'})
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status || 'PENDING'}</Text>
          </View>
        </View>

        <View style={styles.financialRow}>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>TOTAL DUE</Text>
            <Text style={styles.finVal}>₹{item.amount || 0}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>PAID</Text>
            <Text style={[styles.finVal, { color: '#15803d' }]}>₹{item.paid_amount || 0}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>OUTSTANDING</Text>
            <Text style={[styles.finVal, { color: '#dc2626' }]}>₹{item.outstanding || 0}</Text>
          </View>
        </View>

        <View style={styles.cardBottomRow}>
          <Text style={styles.dueDateText}>
            Billing Month: <Text style={{ fontWeight: '700' }}>{formatMonthName(item.month || monthFilter)}</Text>
          </Text>
          {!isPaid ? (
            <TouchableOpacity style={styles.collectBtn} onPress={() => openCollect(item)}>
              <Ionicons name="card-outline" size={14} color="#fff" />
              <Text style={styles.collectBtnText}>Collect Payment</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.clearedBadge}>
              <Ionicons name="checkmark-done" size={14} color="#15803d" />
              <Text style={styles.clearedText}>Cleared</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hostel Monthly Fees</Text>
          <Text style={styles.headerSubtitle}>Rent Demands, Receipts & Collection</Text>
        </View>
        <TouchableOpacity style={styles.generateHeaderBtn} onPress={() => setShowGenModal(true)}>
          <Ionicons name="calculator-outline" size={16} color="#fff" />
          <Text style={styles.generateHeaderBtnText}>Generate</Text>
        </TouchableOpacity>
      </View>

      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity
          style={styles.monthArrow}
          onPress={() => setMonthFilter(prev => getAdjacentMonth(prev, -1))}
        >
          <Ionicons name="chevron-back" size={18} color="#4338ca" />
        </TouchableOpacity>
        <View style={styles.monthCenter}>
          <Ionicons name="calendar-outline" size={16} color="#4338ca" style={{ marginRight: 6 }} />
          <Text style={styles.monthText}>{formatMonthName(monthFilter)}</Text>
        </View>
        <TouchableOpacity
          style={styles.monthArrow}
          onPress={() => setMonthFilter(prev => getAdjacentMonth(prev, 1))}
        >
          <Ionicons name="chevron-forward" size={18} color="#4338ca" />
        </TouchableOpacity>
      </View>

      {/* KPI Overview Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Total Billed</Text>
          <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>₹{totalBilled.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Collected</Text>
          <Text style={[styles.kpiValue, { color: '#15803d' }]}>₹{totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.kpiLabel, { color: '#b91c1c' }]}>Outstanding</Text>
          <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>₹{totalOutstanding.toLocaleString()}</Text>
        </View>
      </View>

      {/* Filter Tabs & Search */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search resident or room..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4338ca" />
          <Text style={styles.loadingText}>Loading fee demands...</Text>
        </View>
      ) : (
        <FlatList
          data={dues}
          keyExtractor={(item, index) => item.record_id?.toString() || index.toString()}
          renderItem={renderDueItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchDues();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Fee Records For {formatMonthName(monthFilter)}</Text>
              <Text style={styles.emptySubtitle}>
                Tap the "Generate" button above to auto-create demands for all residents.
              </Text>
            </View>
          }
        />
      )}

      {/* Generate Bills Modal */}
      <Modal visible={showGenModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="calculator" size={24} color="#4338ca" />
              <Text style={styles.modalTitle}>Generate Hostel Fees</Text>
            </View>
            <Text style={styles.modalBody}>
              Generate monthly fee demands for all active hostel residents for{' '}
              <Text style={{ fontWeight: '700' }}>{formatMonthName(monthFilter)}</Text>.
            </Text>

            <Text style={styles.modalFieldLabel}>Frequency:</Text>
            <View style={styles.freqOptions}>
              {[
                { key: 'MONTHLY', label: '1 Month' },
                { key: 'QUARTERLY', label: '3 Months' },
                { key: 'HALF_YEARLY', label: '6 Months' },
                { key: 'YEARLY', label: '1 Year' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.freqChip, genFreq === f.key && styles.freqChipActive]}
                  onPress={() => setGenFreq(f.key)}
                >
                  <Text style={[styles.freqChipText, genFreq === f.key && styles.freqChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowGenModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                disabled={generating}
                onPress={handleGenerateBills}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Generate Demands</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal visible={showCollectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="card" size={24} color="#15803d" />
              <Text style={styles.modalTitle}>Collect Hostel Fee</Text>
            </View>
            <Text style={styles.modalBody}>
              Recording receipt for <Text style={{ fontWeight: '700' }}>{selectedDue?.student_name}</Text>{' '}
              (Outstanding: ₹{selectedDue?.outstanding || 0})
            </Text>

            <Text style={styles.modalFieldLabel}>Amount (₹):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="Enter amount..."
              placeholderTextColor="#94a3b8"
              value={payAmount}
              onChangeText={setPayAmount}
            />

            <Text style={styles.modalFieldLabel}>Payment Mode:</Text>
            <View style={styles.modeRow}>
              {['CASH', 'UPI', 'ONLINE', 'CHEQUE'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeChip, payMode === m && styles.modeChipActive]}
                  onPress={() => setPayMode(m)}
                >
                  <Text style={[styles.modeChipText, payMode === m && styles.modeChipTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalFieldLabel}>Remarks / Reference No:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. UPI Ref / Cash receipt no..."
              placeholderTextColor="#94a3b8"
              value={payRemarks}
              onChangeText={setPayRemarks}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCollectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: '#15803d' }]}
                disabled={submittingPayment}
                onPress={handleCollectPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm & Sync</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  generateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4338ca',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  generateHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  monthArrow: {
    backgroundColor: '#e0e7ff',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: { flexDirection: 'row', alignItems: 'center' },
  monthText: { fontSize: 15, fontWeight: '700', color: '#1e293b' },

  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  kpiValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },

  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#4338ca', borderColor: '#4338ca' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },

  dueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dueHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  roomSub: { fontSize: 12, color: '#64748b', marginTop: 1 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  financialRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  finCol: { flex: 1 },
  finLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  finVal: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },

  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dueDateText: { fontSize: 12, color: '#64748b' },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  collectBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  clearedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearedText: { fontSize: 12, fontWeight: '700', color: '#15803d' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalBody: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 14 },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  freqOptions: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  freqChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  freqChipActive: { backgroundColor: '#4338ca' },
  freqChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  freqChipTextActive: { color: '#fff' },

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  modeChipActive: { backgroundColor: '#15803d' },
  modeChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  modeChipTextActive: { color: '#fff' },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modalConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4338ca',
  },
  modalConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
