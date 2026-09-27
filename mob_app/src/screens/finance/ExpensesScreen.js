// mob_app/src/screens/finance/ExpensesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

function lastNMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const CATEGORIES = [
  'ALL',
  'OPERATIONAL',
  'MAINTENANCE',
  'UTILITIES',
  'ELECTRICITY',
  'TRANSPORT_FUEL',
  'SPORTS_EQUIPMENT',
  'COMPUTER_LAB',
  'SCIENCE_LAB',
  'MARKETING',
  'EVENTS',
  'STATIONERY',
  'MISCELLANEOUS',
];

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

export default function ExpensesScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STAFF';
  const isPrincipal = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  const months = useMemo(() => lastNMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'OPERATIONAL',
    amount: '',
    vendor_name: '',
    invoice_number: '',
    payment_method: 'CASH',
    payment_date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // Rejection Note Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadExpenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { month: selectedMonth };
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;

      const [expRes, sumRes] = await Promise.all([
        client.get('/finance/expenses', { params }).catch(() => ({ data: { data: [] } })),
        client.get('/finance/expenses/summary', { params: { month: selectedMonth } }).catch(() => ({ data: null })),
      ]);

      const list = expRes.data?.data || (Array.isArray(expRes.data) ? expRes.data : []);
      setExpenses(list);
      setSummary(sumRes.data);
    } catch (err) {
      console.warn('Failed to load expenses:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedMonth, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingId(null);
    setForm({
      title: '',
      category: 'OPERATIONAL',
      amount: '',
      vendor_name: '',
      invoice_number: '',
      payment_method: 'CASH',
      payment_date: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setModalVisible(true);
  };

  // Open Edit Modal
  const openEditModal = (exp) => {
    setEditingId(exp.id);
    setForm({
      title: exp.title || '',
      category: exp.category || 'OPERATIONAL',
      amount: String(exp.amount || ''),
      vendor_name: exp.vendor_name || '',
      invoice_number: exp.invoice_number || '',
      payment_method: exp.payment_method || 'CASH',
      payment_date: exp.payment_date || new Date().toISOString().split('T')[0],
      remarks: exp.remarks || '',
    });
    setModalVisible(true);
  };

  // Save Expense (1:1 with Web ERP)
  const handleSaveExpense = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation Error', 'Please enter an expense title.');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        amount: amt,
        vendor_name: form.vendor_name.trim(),
        invoice_number: form.invoice_number.trim(),
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        status: isPrincipal ? 'PAID' : 'PENDING_APPROVAL',
        remarks: form.remarks.trim(),
        department: 'ACCOUNTS',
      };

      if (editingId) {
        await client.put(`/finance/expenses/${editingId}`, payload);
        Alert.alert('Updated', 'Expense record updated successfully.');
      } else {
        await client.post('/finance/expenses', payload);
        Alert.alert('Success', isPrincipal ? 'Expense recorded and cleared.' : 'Expense submitted for Principal approval.');
      }

      setModalVisible(false);
      loadExpenses(true);
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Action (1:1 with Web ERP)
  const handleApprove = async (id) => {
    Alert.alert(
      'Approve Expense',
      'Authorize this disbursement and mark as approved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await client.post(`/finance/expenses/${id}/approve`);
              Alert.alert('Approved', 'Expense disbursement approved.');
              loadExpenses(true);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Approval failed.');
            }
          },
        },
      ]
    );
  };

  // Reject Action (1:1 with Web ERP)
  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Validation Error', 'Please provide a rejection reason.');
      return;
    }
    try {
      await client.post(`/finance/expenses/${rejectingId}/reject`, { reason: rejectReason.trim() });
      setRejectModalVisible(false);
      Alert.alert('Rejected', 'Expense rejected with note.');
      loadExpenses(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Rejection failed.');
    }
  };

  // Delete Action (1:1 with Web ERP)
  const handleDelete = (id) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to permanently delete this expense record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/finance/expenses/${id}`);
              Alert.alert('Deleted', 'Expense record removed.');
              loadExpenses(true);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Delete failed.');
            }
          },
        },
      ]
    );
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        e.title?.toLowerCase().includes(s) ||
        e.vendor_name?.toLowerCase().includes(s) ||
        e.invoice_number?.toLowerCase().includes(s) ||
        e.category?.toLowerCase().includes(s)
      );
    });
  }, [expenses, search]);

  const renderExpenseItem = ({ item }) => {
    const isPaid = item.status === 'PAID';
    const isPending = item.status === 'PENDING_APPROVAL';
    const isApproved = item.status === 'APPROVED';
    const isRejected = item.status === 'REJECTED';

    const statusBg = isPaid ? '#dcfce7' : isPending ? '#fef3c7' : isApproved ? '#e0f2fe' : '#fee2e2';
    const statusColor = isPaid ? '#15803d' : isPending ? '#b45309' : isApproved ? '#0369a1' : '#dc2626';

    return (
      <View style={styles.expenseCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expTitle}>{item.title}</Text>
            <Text style={styles.expSub}>
              {item.category} {item.vendor_name ? `· Vendor: ${item.vendor_name}` : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status || 'RECORDED'}</Text>
          </View>
        </View>

        <View style={styles.cardDetailsRow}>
          <View>
            <Text style={styles.amountLabel}>AMOUNT DISBURSED</Text>
            <Text style={styles.amountVal}>₹{Number(item.amount || 0).toLocaleString()}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dateLabel}>DATE</Text>
            <Text style={styles.dateVal}>{item.payment_date || 'Recent'}</Text>
          </View>
        </View>

        {item.remarks ? (
          <Text style={styles.remarksText}>Note: {item.remarks}</Text>
        ) : null}

        {/* Action Buttons: Parity with Web ERP */}
        <View style={styles.actionsRow}>
          {isPrincipal && isPending && (
            <>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#15803d" />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => openRejectModal(item.id)}>
                <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
            <Ionicons name="pencil-outline" size={14} color="#0b57d0" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>

          {isPrincipal && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={14} color="#dc2626" />
            </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Central Expenditure</Text>
            <Text style={styles.headerSub}>Disbursements, Approvals & Outlays</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addExpBtn} onPress={openAddModal}>
          <Ionicons name="add" size={17} color="#fff" />
          <Text style={styles.addExpBtnText}>+ Record</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Overview Summary (1:1 with Web ERP) */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Total Outlay</Text>
          <Text style={[styles.kpiVal, { color: '#1d4ed8' }]}>
            ₹{Number(summary?.total_amount || 0).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Approved / Paid</Text>
          <Text style={[styles.kpiVal, { color: '#15803d' }]}>
            ₹{Number(summary?.paid_amount || summary?.approved_amount || 0).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
          <Text style={[styles.kpiLabel, { color: '#b45309' }]}>Pending Approval</Text>
          <Text style={[styles.kpiVal, { color: '#b45309' }]}>
            {summary?.pending_count || 0} bills
          </Text>
        </View>
      </View>

      {/* Month Selector Carousel */}
      <View style={styles.monthBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {months.map(m => {
            const isSel = selectedMonth === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.monthChip, isSel && styles.monthChipActive]}
                onPress={() => setSelectedMonth(m)}
              >
                <Text style={[styles.monthChipText, isSel && styles.monthChipTextActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Category Chips Bar */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {CATEGORIES.map(c => {
            const isSel = selectedCategory === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, isSel && styles.catChipActive]}
                onPress={() => setSelectedCategory(c)}
              >
                <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Status Chips */}
      <View style={styles.statusBar}>
        {STATUS_FILTERS.map(s => {
          const isSel = selectedStatus === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.statusChip, isSel && styles.statusChipActive]}
              onPress={() => setSelectedStatus(s.key)}
            >
              <Text style={[styles.statusChipText, isSel && styles.statusChipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, vendor, or invoice..."
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

      {/* Expenses FlatList */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading expense records...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderExpenseItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => loadExpenses(true)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Expenses Recorded</Text>
              <Text style={styles.emptySubtitle}>Tap "+ Record" above to add new school expenditure.</Text>
            </View>
          }
        />
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 1: RECORD / EDIT EXPENSE                  */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>{editingId ? 'Edit Expense' : 'Record Expense'}</Text>
                <Text style={styles.modalSheetSub}>Central disbursement & voucher entry</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Expense Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Campus Generator Diesel Refill"
                placeholderTextColor="#94a3b8"
                value={form.title}
                onChangeText={v => setForm({ ...form, title: v })}
              />

              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={form.amount}
                onChangeText={v => setForm({ ...form, amount: v })}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {CATEGORIES.filter(c => c !== 'ALL').map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.modalChip, form.category === cat && styles.modalChipActive]}
                      onPress={() => setForm({ ...form, category: cat })}
                    >
                      <Text style={[styles.modalChipText, form.category === cat && styles.modalChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Vendor / Payee Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bharat Petroleum / ABC Traders"
                placeholderTextColor="#94a3b8"
                value={form.vendor_name}
                onChangeText={v => setForm({ ...form, vendor_name: v })}
              />

              <Text style={styles.fieldLabel}>Invoice / Voucher No.</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., INV-89210"
                placeholderTextColor="#94a3b8"
                value={form.invoice_number}
                onChangeText={v => setForm({ ...form, invoice_number: v })}
              />

              <Text style={styles.fieldLabel}>Payment Method</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modalChip, { flex: 1, alignItems: 'center' }, form.payment_method === m && styles.modalChipActive]}
                    onPress={() => setForm({ ...form, payment_method: m })}
                  >
                    <Text style={[styles.modalChipText, form.payment_method === m && styles.modalChipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Payment Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={form.payment_date}
                onChangeText={v => setForm({ ...form, payment_date: v })}
              />

              <Text style={styles.fieldLabel}>Remarks / Justification</Text>
              <TextInput
                style={styles.input}
                placeholder="Approval notes or breakdown"
                placeholderTextColor="#94a3b8"
                value={form.remarks}
                onChangeText={v => setForm({ ...form, remarks: v })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={handleSaveExpense}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingId ? 'Update Expense' : isPrincipal ? 'Save & Authorize' : 'Submit for Approval'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 2: REJECT REASON MODAL                    */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <Text style={styles.rejectModalTitle}>Reject Expense Outlay</Text>
            <Text style={styles.rejectModalSub}>Provide a reason for turning down this reimbursement request:</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 10 }]}
              placeholder="e.g., Original receipt missing, or exceeds budget limit"
              placeholderTextColor="#94a3b8"
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.cancelRejectBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelRejectBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRejectBtn}
                onPress={submitReject}
              >
                <Text style={styles.confirmRejectBtnText}>Reject Outlay</Text>
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
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  addExpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addExpBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  kpiContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  kpiCard: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1 },
  kpiLabel: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase' },
  kpiVal: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  monthBar: { backgroundColor: '#fff', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthChipText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  monthChipTextActive: { color: '#ffffff' },
  categoryBar: { backgroundColor: '#fff', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  catChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  catChipTextActive: { color: '#ffffff' },
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
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  expSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
  },
  amountLabel: { fontSize: 9.5, fontWeight: '800', color: '#64748b' },
  amountVal: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginTop: 2 },
  dateLabel: { fontSize: 9.5, fontWeight: '800', color: '#64748b' },
  dateVal: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  remarksText: { fontSize: 11.5, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  approveBtnText: { fontSize: 11.5, fontWeight: '700', color: '#15803d' },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectBtnText: { fontSize: 11.5, fontWeight: '700', color: '#dc2626' },
  editBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  editBtnText: { fontSize: 11.5, fontWeight: '700', color: '#0b57d0' },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
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
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalChipText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  modalChipTextActive: { color: '#ffffff' },
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
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18 },
  rejectModalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  rejectModalSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cancelRejectBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelRejectBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  confirmRejectBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#dc2626' },
  confirmRejectBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
});
