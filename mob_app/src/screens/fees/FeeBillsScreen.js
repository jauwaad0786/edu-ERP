// mob_app/src/screens/fees/FeeBillsScreen.js
// Fee Bills & Advance Demand Notices — 100% mirrors Web ERP FeeBillsPage.jsx
// Handles student demand generation, itemized fee breakdowns, and invoice receipts.

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

export default function FeeBillsScreen({ navigation }) {
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Itemized Breakdown Modal
  const [selectedBill, setSelectedBill] = useState(null);

  // Generate Bills Modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [genSession, setGenSession] = useState('2026-27');
  const [genCadence, setGenCadence] = useState('MONTHLY');
  const [genMonth, setGenMonth] = useState(getCurrentMonth());
  const [genDueDate, setGenDueDate] = useState(`${getCurrentMonth()}-10`);
  const [genClassId, setGenClassId] = useState('');
  const [generating, setGenerating] = useState(false);

  // Load Classes
  useEffect(() => {
    client.get('/principal/classes')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
        setClasses(list);
      })
      .catch(() => {});
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (selectedStatus) params.status = selectedStatus;

      const res = await client.get('/fees-finance/bills', { params });
      setBills(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load fee bills');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, selectedStatus]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Aggregate KPIs
  const totalBilled = bills.reduce((acc, b) => acc + (parseFloat(b.total_amount) || 0), 0);
  const totalCollected = bills.reduce((acc, b) => acc + (parseFloat(b.paid_amount) || 0), 0);
  const totalPending = bills.reduce((acc, b) => acc + (parseFloat(b.balance_amount || b.outstanding) || 0), 0);

  const handleGenerateBills = async () => {
    try {
      setGenerating(true);
      const payload = {
        session: genSession,
        billing_frequency: genCadence,
        bill_month: genMonth,
        due_date: genDueDate,
        class_id: genClassId ? parseInt(genClassId, 10) : null,
      };
      const res = await client.post('/fees-finance/bills/generate', payload);
      Alert.alert(
        'Billing Generated',
        `Generated ${res.data?.created_count || 0} demand bills (${res.data?.skipped_count || 0} existing/skipped).`
      );
      setShowGenModal(false);
      fetchBills();
    } catch (err) {
      Alert.alert('Generation Failed', err.response?.data?.error || 'Failed to generate fee bills');
    } finally {
      setGenerating(false);
    }
  };

  const filteredBills = bills.filter(b => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      b.student_name?.toLowerCase().includes(s) ||
      b.admission_no?.toLowerCase().includes(s) ||
      b.bill_no?.toLowerCase().includes(s)
    );
  });

  const renderBillItem = ({ item }) => {
    const isPaid = item.status === 'PAID';
    const isPartial = item.status === 'PARTIALLY_PAID' || item.status === 'PARTIAL';
    const isOverdue = item.status === 'OVERDUE';

    const badgeBg = isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : isOverdue ? '#fee2e2' : '#eff6ff';
    const badgeColor = isPaid ? '#15803d' : isPartial ? '#b45309' : isOverdue ? '#dc2626' : '#1d4ed8';

    return (
      <View style={styles.billCard}>
        <View style={styles.billCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{item.student_name}</Text>
            <Text style={styles.billSub}>
              Bill #{item.bill_no || `BILL-${item.id}`} • Class: {item.class_name || 'N/A'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status || 'ISSUED'}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>BILLED</Text>
            <Text style={styles.amountVal}>₹{item.total_amount || 0}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>COLLECTED</Text>
            <Text style={[styles.amountVal, { color: '#15803d' }]}>₹{item.paid_amount || 0}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>BALANCE DUE</Text>
            <Text style={[styles.amountVal, { color: '#dc2626' }]}>
              ₹{item.balance_amount || item.outstanding || 0}
            </Text>
          </View>
        </View>

        <View style={styles.dueRow}>
          <Text style={styles.dueText}>
            Billing Month: <Text style={{ fontWeight: '700' }}>{item.bill_month || 'Current'}</Text>
            {item.due_date ? ` • Due: ${item.due_date}` : ''}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.breakdownBtn}
            onPress={() => setSelectedBill(item)}
          >
            <Ionicons name="list-outline" size={14} color="#0b57d0" />
            <Text style={styles.breakdownBtnText}>Itemized Breakdown</Text>
          </TouchableOpacity>

          {!isPaid ? (
            <TouchableOpacity
              style={styles.collectBtn}
              onPress={() => navigation.navigate('CollectPayment', { student: item, student_id: item.student_id })}
            >
              <Ionicons name="card-outline" size={14} color="#fff" />
              <Text style={styles.collectBtnText}>Collect POS</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.paidDoneBadge}>
              <Ionicons name="checkmark-done" size={14} color="#15803d" />
              <Text style={styles.paidDoneText}>Cleared</Text>
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
          <Text style={styles.headerTitle}>Fee Bills & Demands</Text>
          <Text style={styles.headerSubtitle}>Advance demand notices & invoice ledger</Text>
        </View>
        <TouchableOpacity style={styles.genHeaderBtn} onPress={() => setShowGenModal(true)}>
          <Ionicons name="calculator-outline" size={15} color="#fff" />
          <Text style={styles.genHeaderBtnText}>Generate</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Overview Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Total Billed</Text>
          <Text style={[styles.kpiVal, { color: '#1d4ed8' }]}>₹{totalBilled.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Collected</Text>
          <Text style={[styles.kpiVal, { color: '#15803d' }]}>₹{totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fef2f2' }]}>
          <Text style={[styles.kpiLabel, { color: '#b91c1c' }]}>Pending</Text>
          <Text style={[styles.kpiVal, { color: '#b91c1c' }]}>₹{totalPending.toLocaleString()}</Text>
        </View>
      </View>

      {/* Class Chips */}
      <View style={styles.classBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.chip, !selectedClassId && styles.chipActive]}
            onPress={() => setSelectedClassId('')}
          >
            <Text style={[styles.chipText, !selectedClassId && styles.chipTextActive]}>All Classes</Text>
          </TouchableOpacity>
          {classes.map(c => {
            const active = selectedClassId === c.id.toString();
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedClassId(c.id.toString())}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Status Chips */}
      <View style={styles.statusBar}>
        {[
          { key: '', label: 'All Bills' },
          { key: 'UNPAID', label: 'Unpaid' },
          { key: 'PARTIALLY_PAID', label: 'Partial' },
          { key: 'PAID', label: 'Paid' },
          { key: 'OVERDUE', label: 'Overdue' },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.statusChip, selectedStatus === s.key && styles.statusChipActive]}
            onPress={() => setSelectedStatus(s.key)}
          >
            <Text style={[styles.statusChipText, selectedStatus === s.key && styles.statusChipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student, bill no, or admission no..."
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
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading fee demand bills...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderBillItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchBills();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Fee Bills Found</Text>
              <Text style={styles.emptySubtitle}>Tap "Generate" above to issue advance monthly demand notices.</Text>
            </View>
          }
        />
      )}

      {/* Generate Bills Modal */}
      <Modal visible={showGenModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Generate Demand Bills</Text>
                <Text style={styles.modalSheetSub}>Batch generate fee notices for students</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGenModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Academic Session:</Text>
              <TextInput
                style={styles.input}
                value={genSession}
                onChangeText={setGenSession}
              />

              <Text style={styles.fieldLabel}>Billing Frequency:</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['MONTHLY', 'QUARTERLY', 'ANNUAL'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqChip, genCadence === f && styles.freqChipActive]}
                    onPress={() => setGenCadence(f)}
                  >
                    <Text style={[styles.freqChipText, genCadence === f && styles.freqChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Billing Month (YYYY-MM):</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-09"
                placeholderTextColor="#94a3b8"
                value={genMonth}
                onChangeText={setGenMonth}
              />

              <Text style={styles.fieldLabel}>Due Date (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-09-10"
                placeholderTextColor="#94a3b8"
                value={genDueDate}
                onChangeText={setGenDueDate}
              />

              <TouchableOpacity
                style={[styles.submitBtn, generating && styles.submitBtnDisabled]}
                disabled={generating}
                onPress={handleGenerateBills}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Generate Bills & Demands</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Itemized Breakdown Modal */}
      <Modal visible={!!selectedBill} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalCenterHeader}>
              <Ionicons name="list" size={22} color="#0b57d0" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.modalCenterTitle}>{selectedBill?.student_name}</Text>
                <Text style={styles.modalCenterSub}>Bill #{selectedBill?.bill_no} • Itemized Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBill(null)}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.breakdownListBox}>
              {selectedBill?.items && selectedBill.items.length > 0 ? (
                selectedBill.items.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemHead}>{it.fee_head_name || 'Fee Component'}</Text>
                    <Text style={styles.itemAmount}>₹{it.amount || 0}</Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>Standard Monthly Tuition & Facilities: ₹{selectedBill?.total_amount}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Demand:</Text>
                <Text style={styles.totalValue}>₹{selectedBill?.total_amount || 0}</Text>
              </View>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },
  genHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  genHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  kpiContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  kpiCard: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  kpiVal: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  classBar: { backgroundColor: '#fff', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },

  statusBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, gap: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9' },
  statusChipActive: { backgroundColor: '#1e293b' },
  statusChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  statusChipTextActive: { color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },

  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  billSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  amountRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  amountCol: { flex: 1 },
  amountLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
  amountVal: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },

  dueRow: { marginBottom: 6 },
  dueText: { fontSize: 11, color: '#64748b' },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  breakdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  breakdownBtnText: { fontSize: 12, fontWeight: '600', color: '#0b57d0' },
  collectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  collectBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  paidDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  paidDoneText: { fontSize: 12, fontWeight: '700', color: '#15803d' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#64748b' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  freqChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6, backgroundColor: '#f1f5f9' },
  freqChipActive: { backgroundColor: '#0b57d0' },
  freqChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  freqChipTextActive: { color: '#fff' },

  submitBtn: {
    backgroundColor: '#0b57d0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalCenterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalCenterTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalCenterSub: { fontSize: 12, color: '#64748b' },
  breakdownListBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemHead: { fontSize: 13, color: '#334155' },
  itemAmount: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  totalValue: { fontSize: 15, fontWeight: '800', color: '#0b57d0' },
});
