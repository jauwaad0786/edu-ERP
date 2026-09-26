// mob_app/src/screens/finance/ExpensesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const CATEGORIES = [
  'ALL',
  'ELECTRICITY',
  'WATER',
  'INTERNET',
  'RENT',
  'MAINTENANCE',
  'REPAIRS',
  'STATIONERY',
  'CLEANING',
  'TRANSPORT_FUEL',
  'SPORTS_EQUIPMENT',
  'COMPUTER_LAB',
  'SCIENCE_LAB',
  'MARKETING',
  'EVENTS',
  'FOOD',
  'MISCELLANEOUS',
];

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function ExpensesScreen({ navigation }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');

  // Record Expense Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'MAINTENANCE',
    amount: '',
    vendor_name: '',
    invoice_number: '',
    payment_method: 'CASH',
    payment_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const loadExpenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/finance/expenses', {
        params: { per_page: 50 },
      }).catch(() => ({ data: [] }));

      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.expenses || res.data?.data || [];
      setExpenses(list);
    } catch (err) {
      console.warn('Failed to load expenses:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Submit Expense
  const handleSaveExpense = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation Error', 'Please enter an expense title / description.');
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
        description: form.description.trim(),
      };

      const res = await client.post('/finance/expenses', payload);
      if (res.data) {
        Alert.alert('Success', 'Expense recorded successfully.');
        setModalVisible(false);
        setForm({
          title: '',
          category: 'MAINTENANCE',
          amount: '',
          vendor_name: '',
          invoice_number: '',
          payment_method: 'CASH',
          payment_date: new Date().toISOString().split('T')[0],
          description: '',
        });
        loadExpenses(true);
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const titleMatch = (e.title || '').toLowerCase().includes(q);
        const vendorMatch = (e.vendor_name || '').toLowerCase().includes(q);
        const numMatch = (e.expense_number || e.invoice_number || '').toLowerCase().includes(q);
        return titleMatch || vendorMatch || numMatch;
      }
      return true;
    });
  }, [expenses, selectedCategory, search]);

  const totalExpense = filtered.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const paidCount = filtered.filter(e => e.status === 'PAID' || e.status === 'APPROVED').length;
  const pendingCount = filtered.filter(e => e.status === 'PENDING_APPROVAL').length;

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
          <Text style={styles.headerTitle}>Operating Expenses</Text>
          <Text style={styles.headerSubtitle}>
            {filtered.length} Recorded · Total {fmt(totalExpense)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiAmt}>{fmt(totalExpense)}</Text>
          <Text style={styles.kpiLabel}>Total Recorded</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiAmt, { color: '#16a34a' }]}>{paidCount}</Text>
          <Text style={styles.kpiLabel}>Paid / Approved</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiAmt, { color: pendingCount > 0 ? '#ea580c' : '#64748b' }]}>
            {pendingCount}
          </Text>
          <Text style={styles.kpiLabel}>Pending Review</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by title, vendor, or invoice..."
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

      {/* Category Filter Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map(cat => {
            const isSel = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isSel && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, isSel && styles.categoryChipTextActive]}>
                  {cat.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading operational expenses...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadExpenses(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.length > 0 ? (
            filtered.map((e, i) => {
              const isApproved = e.status === 'APPROVED' || e.status === 'PAID';

              return (
                <View key={e.id || i} style={styles.expenseCard}>
                  <View style={styles.expenseTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expenseTitle}>{e.title || e.category || 'Expense'}</Text>
                      <Text style={styles.expenseSub}>
                        {e.category} · Vendor: {e.vendor_name || 'Direct'}
                      </Text>
                      <Text style={styles.expenseDate}>
                        Date: {e.payment_date || e.date || e.expense_date || '—'} · Ref: {e.invoice_number || e.expense_number || 'N/A'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.expenseAmount}>{fmt(e.amount)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: isApproved ? '#dcfce7' : '#fef3c7' }]}>
                        <Text style={[styles.statusBadgeText, { color: isApproved ? '#15803d' : '#b45309' }]}>
                          {e.status || 'PAID'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.expenseBottomRow}>
                    <View style={styles.paymentMethodPill}>
                      <Ionicons name="card-outline" size={12} color="#64748b" />
                      <Text style={styles.paymentMethodText}>{e.payment_method || 'CASH'}</Text>
                    </View>
                    {e.description ? (
                      <Text style={styles.expenseNotes} numberOfLines={1}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Expenses Found</Text>
              <Text style={styles.emptySub}>
                No expenses match the selected filter. Record a new operational expense to track institutional outflows.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setModalVisible(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>Record Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* RECORD EXPENSE MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Operational Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Expense Title / Purpose *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Chemistry Lab Reagents & Glassware"
                placeholderTextColor="#94a3b8"
                value={form.title}
                onChangeText={t => setForm(f => ({ ...f, title: t }))}
              />

              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                value={form.amount}
                onChangeText={t => setForm(f => ({ ...f, amount: t }))}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {CATEGORIES.filter(c => c !== 'ALL').map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.smallChip, form.category === cat && styles.smallChipActive]}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}
                  >
                    <Text style={[styles.smallChipText, form.category === cat && styles.smallChipTextActive]}>
                      {cat.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Payment Method</Text>
              <View style={styles.chipsSelectorRow}>
                {PAYMENT_METHODS.map(pm => (
                  <TouchableOpacity
                    key={pm}
                    style={[styles.smallChip, form.payment_method === pm && styles.smallChipActive]}
                    onPress={() => setForm(f => ({ ...f, payment_method: pm }))}
                  >
                    <Text style={[styles.smallChipText, form.payment_method === pm && styles.smallChipTextActive]}>
                      {pm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Vendor / Payee Name</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Apex Scientific Supplies"
                placeholderTextColor="#94a3b8"
                value={form.vendor_name}
                onChangeText={t => setForm(f => ({ ...f, vendor_name: t }))}
              />

              <Text style={styles.fieldLabel}>Invoice / Bill Number</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. INV-2026-884"
                placeholderTextColor="#94a3b8"
                value={form.invoice_number}
                onChangeText={t => setForm(f => ({ ...f, invoice_number: t }))}
              />

              <Text style={styles.fieldLabel}>Payment Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="2026-09-27"
                placeholderTextColor="#94a3b8"
                value={form.payment_date}
                onChangeText={t => setForm(f => ({ ...f, payment_date: t }))}
              />

              <Text style={styles.fieldLabel}>Notes / Description</Text>
              <TextInput
                style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Additional audit or ledger remarks..."
                placeholderTextColor="#94a3b8"
                value={form.description}
                onChangeText={t => setForm(f => ({ ...f, description: t }))}
                multiline
              />

              <TouchableOpacity
                style={styles.saveSubmitBtn}
                onPress={handleSaveExpense}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveSubmitBtnText}>Submit Expense</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiAmt: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  chipsContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  expenseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  expenseSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  expenseBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '700',
  },
  expenseNotes: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  chipsSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
    marginBottom: 6,
  },
  smallChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  smallChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  saveSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
