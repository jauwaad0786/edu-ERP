// mob_app/src/screens/fees/ReceiptsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, Linking, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const PAYMENT_MODES = ['ALL', 'CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER'];

export default function ReceiptsScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMode, setSelectedMode] = useState('ALL');

  // Detail Modal
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Cancel Modal
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Load Payments History
  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/fees-finance/payments', {
        params: { session: '2026-27', per_page: 100 },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.payments || res.data?.data || [];
      setPayments(list);
    } catch {
      setPayments([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    return payments.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (p.receipt_no && p.receipt_no.toLowerCase().includes(q)) ||
        (p.student_name && p.student_name.toLowerCase().includes(q)) ||
        (p.admission_no && p.admission_no.toLowerCase().includes(q));

      const matchMode = selectedMode === 'ALL' || (p.payment_mode || '').toUpperCase() === selectedMode;
      return matchSearch && matchMode;
    });
  }, [payments, search, selectedMode]);

  // Open PDF Download
  const handleOpenPdf = (paymentId) => {
    const baseUrl = client.defaults.baseURL || 'https://edu-erp-backend-xoas.onrender.com/api';
    const pdfUrl = `${baseUrl}/fees-finance/payments/${paymentId}/receipt-pdf`;
    Linking.openURL(pdfUrl).catch(() => {
      Alert.alert('Notice', 'Unable to open PDF link. Please check device browser.');
    });
  };

  // WhatsApp Share Receipt
  const handleShareWhatsApp = (item) => {
    const amt = item.amount_paid || item.amount || 0;
    const recNo = item.receipt_no || `REC-${item.id}`;
    const name = item.student_name || 'Student';
    const msg = `Dear Parent, Official Fee Receipt ${recNo} for ${name} amounting to ₹${amt.toLocaleString()} has been generated. Thank you!`;
    const waUrl = item.parent_phone
      ? `https://wa.me/91${item.parent_phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(waUrl).catch(() => {
      Share.share({ message: msg });
    });
  };

  // Cancel Receipt Handler
  const handleCancelReceipt = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Required', 'Please enter a cancellation reason.');
      return;
    }

    setCancelling(true);
    try {
      await client.post(`/fees-finance/payments/${selectedReceipt.id}/cancel`, {
        cancel_reason: cancelReason.trim(),
      });
      Alert.alert('Receipt Voided', 'Receipt has been cancelled and student financial dues reversed.');
      setCancelModalVisible(false);
      setDetailModalVisible(false);
      setCancelReason('');
      loadPayments();
    } catch (err) {
      Alert.alert('Cancellation Error', err?.response?.data?.error || 'Failed to cancel receipt.');
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Receipts & Audit</Text>
          <Text style={styles.headerSub}>Transaction logs, reprint & reversal</Text>
        </View>
        <TouchableOpacity
          style={styles.collectBtn}
          onPress={() => navigation?.navigate ? navigation.navigate('CollectPayment') : null}
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.collectBtnText}>Collect</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by receipt no, student name..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Payment Mode Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {PAYMENT_MODES.map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.filterChip, selectedMode === mode && styles.filterChipActive]}
              onPress={() => setSelectedMode(mode)}
            >
              <Text style={[styles.filterChipText, selectedMode === mode && styles.filterChipTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Receipts List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching payment audit trail...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPayments(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredReceipts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Receipts Found</Text>
              <Text style={styles.emptySub}>No collection transactions match your filter criteria.</Text>
            </View>
          ) : (
            filteredReceipts.map(item => {
              const amt = item.amount_paid || item.amount || 0;
              const isCancelled = item.status === 'CANCELLED' || item.is_cancelled;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.receiptCard, isCancelled && styles.receiptCardCancelled]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedReceipt(item);
                    setDetailModalVisible(true);
                  }}
                >
                  <View style={styles.receiptTop}>
                    <View style={styles.recNoRow}>
                      <Ionicons name="document-text" size={16} color={isCancelled ? '#94a3b8' : '#0b57d0'} />
                      <Text style={[styles.receiptNo, isCancelled && styles.strikeText]}>
                        {item.receipt_no || `REC-${item.id}`}
                      </Text>
                    </View>
                    <View style={[styles.modeBadge, isCancelled && styles.cancelledBadge]}>
                      <Text style={[styles.modeBadgeText, isCancelled && { color: '#dc2626' }]}>
                        {isCancelled ? 'CANCELLED' : (item.payment_mode || 'CASH')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.receiptMiddle}>
                    <View>
                      <Text style={styles.studentName}>{item.student_name || 'Student'}</Text>
                      <Text style={styles.studentClass}>
                        {item.class_name ? `Class ${item.class_name}` : 'Enrolled'} • Adm: {item.admission_no || '—'}
                      </Text>
                    </View>
                    <Text style={[styles.amountText, isCancelled && styles.strikeText]}>
                      {formatCurrency(amt)}
                    </Text>
                  </View>

                  <View style={styles.receiptBottom}>
                    <Text style={styles.dateText}>
                      {item.payment_date ? item.payment_date.split('T')[0] : (item.created_at?.split('T')[0] || 'Today')}
                    </Text>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleShareWhatsApp(item)}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => handleOpenPdf(item.id)}
                      >
                        <Ionicons name="download-outline" size={16} color="#0b57d0" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Receipt Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReceipt && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Receipt Breakdown</Text>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 360 }}>
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>Receipt Number</Text>
                    <Text style={styles.summaryVal}>{selectedReceipt.receipt_no || `REC-${selectedReceipt.id}`}</Text>
                    <Text style={[styles.summaryLabel, { marginTop: 8 }]}>Student</Text>
                    <Text style={styles.summaryVal}>{selectedReceipt.student_name} ({selectedReceipt.admission_no})</Text>
                    <Text style={[styles.summaryLabel, { marginTop: 8 }]}>Amount Paid</Text>
                    <Text style={[styles.summaryVal, { color: '#16a34a', fontSize: 18, fontWeight: '800' }]}>
                      {formatCurrency(selectedReceipt.amount_paid || selectedReceipt.amount)}
                    </Text>
                    <Text style={[styles.summaryLabel, { marginTop: 8 }]}>Payment Channel</Text>
                    <Text style={styles.summaryVal}>{selectedReceipt.payment_mode || 'CASH'}</Text>
                  </View>

                  {/* Head-wise allocations */}
                  {selectedReceipt.allocations && selectedReceipt.allocations.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.allocTitle}>FEE HEAD ALLOCATIONS</Text>
                      {selectedReceipt.allocations.map((a, i) => (
                        <View key={i} style={styles.allocRow}>
                          <Text style={styles.allocHead}>{a.fee_head_name || 'Fee Head'}</Text>
                          <Text style={styles.allocAmt}>{formatCurrency(a.allocated_amount || a.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Modal Actions */}
                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalPdfBtn}
                    onPress={() => handleOpenPdf(selectedReceipt.id)}
                  >
                    <Ionicons name="document-text" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalPdfBtnText}>Open PDF Receipt</Text>
                  </TouchableOpacity>

                  {selectedReceipt.status !== 'CANCELLED' && !selectedReceipt.is_cancelled && (
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => setCancelModalVisible(true)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={cancelModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 20 }]}>
            <Text style={styles.cancelTitle}>Void / Cancel Receipt</Text>
            <Text style={styles.cancelSub}>
              This will mark the receipt as CANCELLED and restore student ledger dues. Please state the reason:
            </Text>

            <TextInput
              style={styles.cancelInput}
              placeholder="e.g. Incorrect fee head / Cheque bounced"
              placeholderTextColor="#94a3b8"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />

            <View style={styles.cancelBtnRow}>
              <TouchableOpacity
                style={styles.cancelBackBtn}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.cancelBackBtnText}>Keep Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={handleCancelReceipt}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.cancelConfirmBtnText}>Confirm Reversal</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#bfdbfe',
    marginTop: 1,
  },
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  collectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1e293b',
  },
  filterWrapper: {
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  receiptCardCancelled: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptNo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b57d0',
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  cancelledBadge: {
    backgroundColor: '#fee2e2',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  receiptMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  studentClass: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16a34a',
  },
  receiptBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  allocTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  allocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  allocHead: {
    fontSize: 13,
    color: '#334155',
  },
  allocAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalPdfBtn: {
    flex: 1,
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalPdfBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCancelBtn: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 6,
  },
  cancelSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  cancelInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    minHeight: 60,
    marginBottom: 14,
  },
  cancelBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBackBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  cancelConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  cancelConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
