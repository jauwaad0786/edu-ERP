// mob_app/src/screens/fees/FeeBillsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const getCurrentMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const MONTH_OPTIONS = [
  '2026-04', '2026-05', '2026-06', '2026-07',
  '2026-08', '2026-09', '2026-10', '2026-11',
  '2026-12', '2027-01', '2027-02', '2027-03',
];

export default function FeeBillsScreen({ navigation }) {
  const [bills, setBills] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
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
  const [forceRegenerate, setForceRegenerate] = useState(false);
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

  const fetchBills = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedMonth) params.month = selectedMonth;

      const res = await client.get('/fees-finance/bills', { params });
      setBills(res.data || []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, selectedStatus, selectedMonth]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Aggregate KPIs
  const totalBilled = useMemo(() => {
    return bills.reduce((acc, b) => acc + (parseFloat(b.total_amount) || 0), 0);
  }, [bills]);

  const totalCollected = useMemo(() => {
    return bills.reduce((acc, b) => acc + (parseFloat(b.paid_amount) || 0), 0);
  }, [bills]);

  const totalPending = useMemo(() => {
    return bills.reduce((acc, b) => acc + (parseFloat(b.balance_amount || b.outstanding) || 0), 0);
  }, [bills]);

  // Generate Bills Handler (1:1 with Web ERP)
  const handleGenerateBills = async () => {
    setGenerating(true);
    try {
      const payload = {
        session: genSession,
        billing_frequency: genCadence,
        bill_month: genMonth,
        due_date: genDueDate,
        class_id: genClassId ? parseInt(genClassId, 10) : null,
        force_regenerate: forceRegenerate,
      };
      const res = await client.post('/fees-finance/bills/generate', payload);
      Alert.alert(
        'Billing Generated',
        `Generated ${res.data?.created_count || 0} demand bills (${res.data?.skipped_count || 0} existing/skipped).`
      );
      setShowGenModal(false);
      fetchBills(true);
    } catch (err) {
      Alert.alert('Generation Failed', err.response?.data?.error || 'Failed to generate fee bills.');
    } finally {
      setGenerating(false);
    }
  };

  // Download Bill PDF Handler
  const handleDownloadBillPdf = (bill) => {
    if (!bill?.id) return;
    const pdfUrl = `${client.defaults.baseURL}/fees-finance/bills/${bill.id}/pdf`;
    Linking.openURL(pdfUrl).catch(() => {
      Alert.alert('Download Error', 'Could not open bill PDF URL.');
    });
  };

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        b.student_name?.toLowerCase().includes(s) ||
        b.admission_no?.toLowerCase().includes(s) ||
        b.bill_no?.toLowerCase().includes(s)
      );
    });
  }, [bills, search]);

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
              Bill #{item.bill_no || `BILL-${item.id}`} · Class: {item.class_name || 'N/A'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status || 'ISSUED'}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>BILLED</Text>
            <Text style={styles.amountVal}>₹{Number(item.total_amount || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>COLLECTED</Text>
            <Text style={[styles.amountVal, { color: '#15803d' }]}>
              ₹{Number(item.paid_amount || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>BALANCE DUE</Text>
            <Text style={[styles.amountVal, { color: '#dc2626' }]}>
              ₹{Number(item.balance_amount || item.outstanding || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.dueRow}>
          <Text style={styles.dueText}>
            Billing Month: <Text style={{ fontWeight: '700' }}>{item.bill_month || 'Current'}</Text>
            {item.due_date ? ` · Due: ${item.due_date}` : ''}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.breakdownBtn}
            onPress={() => setSelectedBill(item)}
          >
            <Ionicons name="list-outline" size={14} color="#0b57d0" />
            <Text style={styles.breakdownBtnText}>Breakdown</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => handleDownloadBillPdf(item)}
          >
            <Ionicons name="document-text-outline" size={14} color="#64748b" />
            <Text style={styles.pdfBtnText}>PDF</Text>
          </TouchableOpacity>

          {!isPaid ? (
            <TouchableOpacity
              style={styles.collectBtn}
              onPress={() => navigation.navigate('CollectPayment', {
                student: {
                  id: item.student_id,
                  name: item.student_name,
                  admission_no: item.admission_no,
                  class_name: item.class_name,
                },
                student_id: item.student_id,
              })}
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
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Fee Demand Bills</Text>
            <Text style={styles.headerSubtitle}>Advance billing notices & ledger</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.genHeaderBtn} onPress={() => setShowGenModal(true)}>
          <Ionicons name="calculator-outline" size={16} color="#fff" />
          <Text style={styles.genHeaderBtnText}>+ Generate</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Overview Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Total Billed</Text>
          <Text style={[styles.kpiVal, { color: '#1d4ed8' }]}>₹{totalBilled.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Collected</Text>
          <Text style={[styles.kpiVal, { color: '#15803d' }]}>₹{totalCollected.toLocaleString()}</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
          <Text style={[styles.kpiLabel, { color: '#b91c1c' }]}>Pending</Text>
          <Text style={[styles.kpiVal, { color: '#b91c1c' }]}>₹{totalPending.toLocaleString()}</Text>
        </View>
      </View>

      {/* Class Selector Bar */}
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
                onPress={() => setSelectedClassId(active ? '' : c.id.toString())}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Month Filter Chips */}
      <View style={styles.monthBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          <TouchableOpacity
            style={[styles.monthChip, !selectedMonth && styles.monthChipActive]}
            onPress={() => setSelectedMonth('')}
          >
            <Text style={[styles.monthChipText, !selectedMonth && styles.monthChipTextActive]}>All Months</Text>
          </TouchableOpacity>
          {MONTH_OPTIONS.map(m => {
            const active = selectedMonth === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.monthChip, active && styles.monthChipActive]}
                onPress={() => setSelectedMonth(active ? '' : m)}
              >
                <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{m}</Text>
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

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student, bill no, admission no..."
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

      {/* Bills FlatList */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading fee demand bills...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderBillItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => fetchBills(true)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Fee Bills Found</Text>
              <Text style={styles.emptySubtitle}>Tap "+ Generate" to create demand notices for classes.</Text>
            </View>
          }
        />
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 1: GENERATE DEMAND BILLS                  */}
      {/* ═══════════════════════════════════════════════ */}
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
              {/* Target Class */}
              <Text style={styles.fieldLabel}>Target Class:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.freqChip, !genClassId && styles.freqChipActive]}
                    onPress={() => setGenClassId('')}
                  >
                    <Text style={[styles.freqChipText, !genClassId && styles.freqChipTextActive]}>All Classes</Text>
                  </TouchableOpacity>
                  {classes.map(c => {
                    const isSel = genClassId === String(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.freqChip, isSel && styles.freqChipActive]}
                        onPress={() => setGenClassId(String(c.id))}
                      >
                        <Text style={[styles.freqChipText, isSel && styles.freqChipTextActive]}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

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
                    style={[styles.freqChip, { flex: 1, alignItems: 'center' }, genCadence === f && styles.freqChipActive]}
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

              {/* Force Regenerate Toggle */}
              <TouchableOpacity
                style={styles.forceRegenRow}
                onPress={() => setForceRegenerate(!forceRegenerate)}
              >
                <Ionicons
                  name={forceRegenerate ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={forceRegenerate ? '#dc2626' : '#94a3b8'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.forceRegenTitle}>Force Regenerate Invoices</Text>
                  <Text style={styles.forceRegenSub}>Overwrites draft bills if already created</Text>
                </View>
              </TouchableOpacity>

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

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 2: ITEMIZED BREAKDOWN                     */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={!!selectedBill} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalCenterHeader}>
              <Ionicons name="list" size={22} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.modalCenterTitle}>{selectedBill?.student_name}</Text>
                <Text style={styles.modalCenterSub}>Bill #{selectedBill?.bill_no} · Itemized Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBill(null)}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.breakdownListBox}>
              {selectedBill?.items && selectedBill.items.length > 0 ? (
                selectedBill.items.map((it, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemHead}>{it.fee_head_name || 'Fee Component'}</Text>
                      {it.department && <Text style={styles.itemDept}>{it.department}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemAmount}>₹{Number(it.amount || 0).toLocaleString()}</Text>
                      {Number(it.paid_amount || 0) > 0 && (
                        <Text style={styles.itemPaid}>Paid: ₹{Number(it.paid_amount).toLocaleString()}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ padding: 12 }}>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>
                    Tuition & Standard Academic Services: ₹{Number(selectedBill?.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Demand:</Text>
                <Text style={styles.totalValue}>₹{Number(selectedBill?.total_amount || 0).toLocaleString()}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.downloadModalBtn}
              onPress={() => handleDownloadBillPdf(selectedBill)}
            >
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.downloadModalBtnText}>Download Demand PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  genHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  genHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  kpiContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  kpiCard: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1 },
  kpiLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  kpiVal: { fontSize: 15, fontWeight: '900', marginTop: 3 },
  classBar: { backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  monthBar: { backgroundColor: '#fff', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  monthChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  monthChipTextActive: { color: '#ffffff' },
  statusBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  statusChip: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9' },
  statusChipActive: { backgroundColor: colors.primary },
  statusChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  statusChipTextActive: { color: '#ffffff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  billSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
  },
  amountCol: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 9.5, fontWeight: '800', color: '#64748b' },
  amountVal: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  dueRow: { marginBottom: 10 },
  dueText: { fontSize: 11.5, color: '#64748b' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  breakdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  breakdownBtnText: { fontSize: 11.5, fontWeight: '700', color: '#0b57d0' },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  pdfBtnText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  collectBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  collectBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  paidDoneBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
  },
  paidDoneText: { fontSize: 11.5, fontWeight: '800', color: '#15803d' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalSheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  freqChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  freqChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  freqChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  freqChipTextActive: { color: '#ffffff' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  forceRegenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  forceRegenTitle: { fontSize: 12.5, fontWeight: '700', color: '#dc2626' },
  forceRegenSub: { fontSize: 10.5, color: '#991b1b', marginTop: 1 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18 },
  modalCenterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  modalCenterTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  modalCenterSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  breakdownListBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemHead: { fontSize: 12.5, fontWeight: '700', color: '#0f172a' },
  itemDept: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  itemAmount: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  itemPaid: { fontSize: 10, color: '#16a34a', marginTop: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  totalValue: { fontSize: 16, fontWeight: '900', color: colors.primary },
  downloadModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  downloadModalBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
});
