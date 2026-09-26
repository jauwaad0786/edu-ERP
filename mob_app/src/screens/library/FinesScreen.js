// mob_app/src/screens/library/FinesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER'];

export default function FinesScreen({ navigation }) {
  const { user } = useAuth();
  const canManage = ['LIBRARIAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('OUTSTANDING'); // 'ALL' | 'OUTSTANDING' | 'PAID' | 'WAIVED'

  // Collect Modal
  const [collectModal, setCollectModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [submittingCollect, setSubmittingCollect] = useState(false);

  // Waive Modal
  const [waiveModal, setWaiveModal] = useState(false);
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [submittingWaive, setSubmittingWaive] = useState(false);

  // Load Fines
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await client.get('/library/fines').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.fines || []);
      setFines(list);
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Collect Modal
  const openCollect = (fine) => {
    setSelectedFine(fine);
    setCollectAmount(String(fine.outstanding_amount || fine.amount || 0));
    setPaymentMode('CASH');
    setCollectRemarks('');
    setCollectModal(true);
  };

  // Submit Collect
  const handleCollectFine = async () => {
    if (!selectedFine) return;
    const amt = parseFloat(collectAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Required', 'Please enter a valid payment amount.');
      return;
    }

    setSubmittingCollect(true);
    try {
      await client.post(`/library/fines/${selectedFine.id}/collect`, {
        amount: amt,
        payment_mode: paymentMode,
        remarks: collectRemarks.trim(),
      });

      Alert.alert('Payment Collected', `₹${amt} collected successfully via ${paymentMode}`);
      setCollectModal(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Collection Failed', err?.response?.data?.error || 'Failed to collect payment.');
    } finally {
      setSubmittingCollect(false);
    }
  };

  // Open Waive Modal
  const openWaive = (fine) => {
    setSelectedFine(fine);
    setWaiveAmount(String(fine.outstanding_amount || fine.amount || 0));
    setWaiveReason('');
    setWaiveModal(true);
  };

  // Submit Waive
  const handleWaiveFine = async () => {
    if (!selectedFine) return;
    if (!waiveReason.trim()) {
      Alert.alert('Required', 'Please provide an official justification for fine waiver.');
      return;
    }

    setSubmittingWaive(true);
    try {
      await client.post(`/library/fines/${selectedFine.id}/waive`, {
        waived_amount: parseFloat(waiveAmount) || undefined,
        waive_reason: waiveReason.trim(),
      });

      Alert.alert('Fine Waived', 'Penalty has been waived with recorded reason.');
      setWaiveModal(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to waive fine.');
    } finally {
      setSubmittingWaive(false);
    }
  };

  // KPIs
  const totalOutstanding = fines.reduce((sum, f) => sum + Number(f.outstanding_amount || 0), 0);
  const totalPaid = fines.reduce((sum, f) => sum + Number(f.amount_paid || (f.status === 'PAID' ? f.amount : 0)), 0);
  const totalWaived = fines.reduce((sum, f) => sum + Number(f.waived_amount || (f.status === 'WAIVED' ? f.amount : 0)), 0);

  // Filtered List
  const filteredFines = fines.filter(f => {
    const q = search.trim().toLowerCase();
    const mName = (f.member_name || f.member?.user?.name || '').toLowerCase();
    const bTitle = (f.book_title || f.issue?.book?.title || '').toLowerCase();
    const reason = (f.fine_type || f.reason || '').toLowerCase();
    const matchesSearch = !q || mName.includes(q) || bTitle.includes(q) || reason.includes(q);

    if (!matchesSearch) return false;

    if (filterStatus === 'OUTSTANDING') return (f.outstanding_amount || 0) > 0 && f.status !== 'WAIVED' && f.status !== 'PAID';
    if (filterStatus === 'PAID') return f.status === 'PAID' || (f.outstanding_amount === 0 && Number(f.amount_paid) > 0);
    if (filterStatus === 'WAIVED') return f.status === 'WAIVED' || Number(f.waived_amount) > 0;

    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Library Fines & Dues</Text>
            <Text style={styles.headerSub}>Penalties, Overdue Charges & Waivers</Text>
          </View>
        </View>
      </View>

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
            ₹{Math.round(totalOutstanding).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiLabel}>OUTSTANDING</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
            ₹{Math.round(totalPaid).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiLabel}>COLLECTED</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#64748b' }]}>
            ₹{Math.round(totalWaived).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.kpiLabel}>WAIVED</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by borrower, book title, or reason..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'OUTSTANDING', label: 'Due / Unpaid' },
            { key: 'ALL', label: `All (${fines.length})` },
            { key: 'PAID', label: 'Settled' },
            { key: 'WAIVED', label: 'Waived' },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, filterStatus === t.key && styles.tabBtnActive]}
              onPress={() => setFilterStatus(t.key)}
            >
              <Text style={[styles.tabBtnText, filterStatus === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0891b2" />
          <Text style={styles.loadingText}>Fetching library fines...</Text>
        </View>
      ) : filteredFines.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
        >
          <Ionicons name="cash-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Fines Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No fine records match your search.' : 'No outstanding library dues pending.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredFines.map((f, idx) => {
            const mName = f.member_name || f.member?.user?.name || 'Borrower';
            const bTitle = f.book_title || f.issue?.book?.title || 'Library Book';
            const fineType = f.fine_type || f.reason || 'OVERDUE';
            const outAmt = Number(f.outstanding_amount ?? f.amount ?? 0);
            const isSettled = outAmt <= 0 || f.status === 'PAID';
            const isWaived = f.status === 'WAIVED';

            return (
              <View key={f.id || idx} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardMemberName}>{mName}</Text>
                    <Text style={styles.cardBookTitle}>"{bTitle}"</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{fineType}</Text>
                      </View>
                      <Text style={styles.dateText}>
                        Date: {f.created_at?.split('T')[0] || f.date || 'Recent'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountValue}>₹{outAmt > 0 ? outAmt : f.amount}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isWaived
                          ? { backgroundColor: '#f1f5f9' }
                          : isSettled
                          ? { backgroundColor: '#dcfce7' }
                          : { backgroundColor: '#fee2e2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isWaived
                            ? { color: '#64748b' }
                            : isSettled
                            ? { color: '#16a34a' }
                            : { color: '#dc2626' },
                        ]}
                      >
                        {isWaived ? 'WAIVED' : isSettled ? 'PAID' : 'OUTSTANDING'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions for Outstanding Fines */}
                {canManage && outAmt > 0 && !isWaived && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.waiveBtn}
                      onPress={() => openWaive(f)}
                    >
                      <Ionicons name="gift-outline" size={14} color="#64748b" />
                      <Text style={styles.waiveBtnText}>Waive</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.collectBtn}
                      onPress={() => openCollect(f)}
                    >
                      <Ionicons name="cash" size={14} color="#ffffff" />
                      <Text style={styles.collectBtnText}>Collect Payment</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Collect Fine Modal */}
      <Modal
        visible={collectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCollectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Collect Library Fine</Text>
                <Text style={styles.modalSub}>{selectedFine?.member_name || 'Member'}</Text>
              </View>
              <TouchableOpacity onPress={() => setCollectModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>AMOUNT TO COLLECT (₹) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Amount"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={collectAmount}
                onChangeText={setCollectAmount}
              />

              <Text style={styles.inputLabel}>PAYMENT MODE</Text>
              <View style={styles.modeRow}>
                {PAYMENT_MODES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeChip, paymentMode === m && styles.modeChipActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text style={[styles.modeText, paymentMode === m && styles.modeTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>REMARKS / RECEIPT NOTE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Overdue charges settled at counter"
                placeholderTextColor="#94a3b8"
                value={collectRemarks}
                onChangeText={setCollectRemarks}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingCollect && { opacity: 0.7 }]}
                onPress={handleCollectFine}
                disabled={submittingCollect}
              >
                {submittingCollect ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Confirm Collection</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Waive Fine Modal */}
      <Modal
        visible={waiveModal}
        animationType="slide"
        transparent
        onRequestClose={() => setWaiveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Waive Library Fine</Text>
                <Text style={styles.modalSub}>Administrative forgiveness of penalty</Text>
              </View>
              <TouchableOpacity onPress={() => setWaiveModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>WAIVE AMOUNT (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Full amount by default"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={waiveAmount}
                onChangeText={setWaiveAmount}
              />

              <Text style={styles.inputLabel}>REASON FOR WAIVER *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Medical leave approved by Principal / Replacement copy supplied"
                placeholderTextColor="#94a3b8"
                value={waiveReason}
                onChangeText={setWaiveReason}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitWaiveBtn, submittingWaive && { opacity: 0.7 }]}
                onPress={handleWaiveFine}
                disabled={submittingWaive}
              >
                {submittingWaive ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="gift" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Confirm Waiver</Text>
                  </>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0891b2',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#cffafe',
    marginTop: 1,
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  kpiTile: {
    flex: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 2,
  },
  tabRow: {
    flexDirection: 'row',
    marginVertical: 10,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: '#0891b2',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardBookTitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  amountValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  waiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  waiveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  collectBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#16a34a',
  },
  collectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeChipActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  submitWaiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#64748b',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
