// mob_app/src/screens/fees/CollectPaymentScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = {
  primary: '#16a34a',
  primaryDark: '#15803d',
  green: '#16a34a',
  blue: '#0b57d0',
  warning: '#d97706',
  error: '#dc2626',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

const PAYMENT_MODES = [
  { id: 'CASH', label: 'Cash', icon: 'cash-outline' },
  { id: 'UPI', label: 'UPI / QR', icon: 'qr-code-outline' },
  { id: 'CARD', label: 'Card / POS', icon: 'card-outline' },
  { id: 'CHEQUE', label: 'Cheque', icon: 'document-text-outline' },
  { id: 'BANK_TRANSFER', label: 'NetBanking', icon: 'business-outline' },
];

export default function CollectPaymentScreen({ navigation, route }) {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dueRecords, setDueRecords] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('UPI');
  const [txnRef, setTxnRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const searchStudent = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelectedStudent(null);
    setReceiptData(null);
    try {
      // Try fees-finance first, then principal search
      let res = await client.get('/fees-finance/students/search', { params: { search: query.trim() } }).catch(() => null);
      if (res?.data?.students && res.data.students.length > 0) {
        setStudents(res.data.students);
      } else {
        const fallback = await client.get('/principal/fees/student-search', { params: { q: query.trim() } });
        setStudents(Array.isArray(fallback.data) ? fallback.data : []);
      }
    } catch {
      setStudents([]);
    } finally {
      setSearching(false);
    }
  };

  const selectStudent = async (stu) => {
    setSelectedStudent(stu);
    setStudents([]);
    setReceiptData(null);
    setLoadingLedger(true);
    try {
      // 1. Try modern fees-finance ledger
      const ledgerRes = await client.get(`/fees-finance/students/${stu.id}/ledger`).catch(() => null);
      if (ledgerRes?.data) {
        const ldata = ledgerRes.data;
        const pendingBills = ldata.pending_bills || ldata.bills?.filter(b => (b.balance_due || 0) > 0) || [];
        const pendingItems = [];
        let total = 0;

        pendingBills.forEach(b => {
          b.items?.forEach(it => {
            const bal = (it.balance_amount !== undefined && it.balance_amount !== null) ? Number(it.balance_amount) : Number(it.net_amount || 0);
            if (bal > 0) {
              pendingItems.push({
                bill_id: b.id,
                bill_no: b.bill_no,
                bill_item_id: it.id,
                fee_head_name: it.fee_head_name || 'Tuition Fee',
                amount: bal,
              });
              total += bal;
            }
          });
        });

        setDueRecords(pendingItems);
        setTotalDue(total);
        setAmount(total > 0 ? String(total) : '');
        return;
      }

      // 2. Fallback to principal student-records
      const recRes = await client.get(`/principal/fees/student-records/${stu.id}`);
      const recs = Array.isArray(recRes.data) ? recRes.data : recRes.data?.records || [];
      const unpaid = recs.filter(r => r.status !== 'PAID');
      setDueRecords(unpaid);

      const calculatedDue = unpaid.reduce((sum, r) => {
        const val = typeof r.effective_due === 'number'
          ? r.effective_due
          : (r.amount_due ? Number(r.amount_due) - Number(r.amount_paid || 0) : 0);
        return sum + Math.max(0, val);
      }, 0);

      setTotalDue(calculatedDue);
      setAmount(calculatedDue > 0 ? String(calculatedDue) : '');
    } catch {
      setDueRecords([]);
      setTotalDue(0);
      setAmount('');
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleCollect = async () => {
    const payAmount = Number(amount);
    if (!selectedStudent || !payAmount || payAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount greater than ₹0');
      return;
    }

    setCollecting(true);
    try {
      let receiptInfo = null;

      // Primary: Modern POS collection endpoint
      try {
        const res = await client.post('/fees-finance/payments/collect', {
          student_id: selectedStudent.id,
          amount_paid: payAmount,
          amount: payAmount,
          payment_mode: mode,
          transaction_ref: txnRef.trim() || undefined,
          remarks: remarks.trim() || 'Mobile POS counter collection',
          department: 'ACCOUNTS',
        });
        receiptInfo = res.data;
      } catch (centralErr) {
        // Fallback: Principal single fee record collection
        if (dueRecords.length > 0 && dueRecords[0].id) {
          const res = await client.post('/principal/fees/collect', {
            record_id: dueRecords[0].id,
            amount_paid: payAmount,
            payment_mode: mode,
            remarks: remarks.trim() || 'Mobile POS collection',
          });
          receiptInfo = res.data;
        } else {
          throw centralErr;
        }
      }

      const receiptNo = receiptInfo?.receipt_no || receiptInfo?.payment?.receipt_no || `REC-${Date.now().toString().slice(-6)}`;
      const paymentId = receiptInfo?.payment_id || receiptInfo?.id;

      setReceiptData({
        receiptNo,
        paymentId,
        studentName: selectedStudent.name,
        admissionNo: selectedStudent.admission_no,
        className: selectedStudent.class_name || selectedStudent.class?.name || '—',
        amount: payAmount,
        mode,
        txnRef: txnRef.trim(),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      });

      // Clear input fields
      setAmount('');
      setTxnRef('');
      setRemarks('');
      setDueRecords([]);
    } catch (err) {
      Alert.alert('Collection Failed', err.response?.data?.error || err.message || 'Payment processing failed');
    } finally {
      setCollecting(false);
    }
  };

  const handleShareReceipt = async () => {
    if (!receiptData) return;
    const msg = `*OFFICIAL FEE RECEIPT*\n` +
      `Receipt No: ${receiptData.receiptNo}\n` +
      `Student: ${receiptData.studentName} (Adm: ${receiptData.admissionNo})\n` +
      `Class: ${receiptData.className}\n` +
      `Amount Paid: ₹${Number(receiptData.amount).toLocaleString('en-IN')}\n` +
      `Mode: ${receiptData.mode}${receiptData.txnRef ? ` (Ref: ${receiptData.txnRef})` : ''}\n` +
      `Date: ${receiptData.date}\n` +
      `Status: Payment Confirmed\n\n` +
      `School Accounts Department`;

    try {
      await Share.share({ message: msg });
    } catch {
      // ignore
    }
  };

  const handleDownloadReceiptPdf = () => {
    if (!receiptData?.paymentId) {
      Alert.alert('Receipt', 'PDF receipt is being generated on the server.');
      return;
    }
    const pdfUrl = `${client.defaults.baseURL}/fees-finance/payments/${receiptData.paymentId}/receipt-pdf`;
    Linking.openURL(pdfUrl).catch(() => {
      Alert.alert('Download', 'Could not open receipt URL on this device.');
    });
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setReceiptData(null);
    setDueRecords([]);
    setTotalDue(0);
    setAmount('');
    setTxnRef('');
    setRemarks('');
    setQuery('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Collect Fee</Text>
            <Text style={styles.headerSub}>Point of Sale (POS) Counter</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Receipt Success Card */}
        {receiptData ? (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <View style={styles.successIconBadge}>
                <Ionicons name="checkmark-circle" size={36} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Payment Collected Successfully!</Text>
              <Text style={styles.successSubtitle}>Official institutional receipt generated</Text>
            </View>

            <View style={styles.receiptBox}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Receipt Number</Text>
                <Text style={[styles.receiptVal, { color: C.primary, fontWeight: '800' }]}>{receiptData.receiptNo}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Student</Text>
                <Text style={styles.receiptVal}>{receiptData.studentName}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Admission No / Class</Text>
                <Text style={styles.receiptVal}>#{receiptData.admissionNo} · {receiptData.className}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Mode</Text>
                <Text style={styles.receiptVal}>{receiptData.mode} {receiptData.txnRef ? `(${receiptData.txnRef})` : ''}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Date</Text>
                <Text style={styles.receiptVal}>{receiptData.date}</Text>
              </View>
              <View style={[styles.receiptRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 }]}>
                <Text style={[styles.receiptLabel, { fontSize: 14, fontWeight: '800' }]}>Total Amount Paid</Text>
                <Text style={[styles.receiptVal, { fontSize: 18, fontWeight: '900', color: C.primary }]}>
                  ₹{Number(receiptData.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.receiptActionBtn, { backgroundColor: '#f1f5f9' }]} onPress={handleShareReceipt}>
                <Ionicons name="share-social-outline" size={18} color={C.text} />
                <Text style={[styles.receiptActionText, { color: C.text }]}>Share Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.receiptActionBtn, { backgroundColor: '#e0f2fe' }]} onPress={handleDownloadReceiptPdf}>
                <Ionicons name="download-outline" size={18} color="#0284c7" />
                <Text style={[styles.receiptActionText, { color: "#0284c7" }]}>Download PDF</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newCollectBtn} onPress={resetForm}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.newCollectText}>Collect Another Payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Student Search Box */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>1. Search Student</Text>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Enter Student Name or Admission No..."
                  placeholderTextColor={C.muted}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={searchStudent}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchBtn} onPress={searchStudent} disabled={searching}>
                  {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Student Dropdown / Search Results */}
              {students.length > 0 && !selectedStudent && (
                <View style={styles.resultsBox}>
                  <Text style={styles.resultsHeader}>Select a matching student:</Text>
                  {students.map((s) => (
                    <TouchableOpacity key={s.id} style={styles.studentItem} onPress={() => selectStudent(s)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        <Text style={styles.studentMeta}>
                          Adm #{s.admission_no || s.admission_number || '—'} · Class: {s.class_name || s.class?.name || '—'}
                          {s.father_name ? ` · S/o ${s.father_name}` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={C.muted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Selected Student Ledger & Payment Entry */}
            {loadingLedger && (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 24, marginTop: 14 }]}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ marginTop: 10, fontSize: 13, color: C.muted, fontWeight: '600' }}>Fetching student ledger...</Text>
              </View>
            )}

            {selectedStudent && !loadingLedger && (
              <View style={[styles.card, { marginTop: 14 }]}>
                {/* Student Info Banner */}
                <View style={styles.studentSelectedHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{selectedStudent.name}</Text>
                    <Text style={styles.selectedSub}>
                      Adm #{selectedStudent.admission_no} · Class {selectedStudent.class_name || selectedStudent.class?.name || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.changeBtn}>
                    <Text style={styles.changeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>

                {/* Outstanding Dues Summary */}
                <View style={styles.duesBox}>
                  <View>
                    <Text style={styles.duesLabel}>Current Outstanding Dues</Text>
                    <Text style={styles.duesAmount}>₹{totalDue.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.badge, totalDue > 0 ? styles.badgeDue : styles.badgeClear]}>
                    <Text style={totalDue > 0 ? styles.badgeTextDue : styles.badgeTextClear}>
                      {totalDue > 0 ? 'Pending Dues' : 'Fees Cleared'}
                    </Text>
                  </View>
                </View>

                {/* Itemized Fee Breakdown */}
                {dueRecords.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.cardSectionTitle}>Pending Fee Items</Text>
                    {dueRecords.map((r, idx) => (
                      <View key={idx} style={styles.feeItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.feeItemTitle}>{r.fee_head_name || r.fee_type || 'Tuition Fee'}</Text>
                          {r.bill_no && <Text style={styles.feeItemSub}>Bill: #{r.bill_no}</Text>}
                        </View>
                        <Text style={styles.feeItemAmount}>
                          ₹{Number(r.amount || r.amount_due || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Amount Input */}
                <Text style={styles.fieldLabel}>Amount to Collect (₹) *</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />

                {/* Payment Mode Pills */}
                <Text style={styles.fieldLabel}>Payment Mode *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {PAYMENT_MODES.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                        onPress={() => setMode(m.id)}
                      >
                        <Ionicons name={m.icon} size={16} color={mode === m.id ? '#fff' : C.muted} />
                        <Text style={[styles.modeBtnText, mode === m.id && styles.modeBtnTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Transaction / Reference ID (for UPI, Cheque, Card) */}
                {mode !== 'CASH' && (
                  <>
                    <Text style={styles.fieldLabel}>
                      {mode === 'CHEQUE' ? 'Cheque No. & Bank Name' : 'Transaction / UTR / Reference ID'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={mode === 'CHEQUE' ? 'e.g., CHQ-982144 (HDFC Bank)' : 'e.g., UPI Ref / Card Txn ID'}
                      placeholderTextColor={C.muted}
                      value={txnRef}
                      onChangeText={setTxnRef}
                    />
                  </>
                )}

                {/* Remarks */}
                <Text style={styles.fieldLabel}>Notes / Remarks (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
                  placeholder="e.g., First installment paid by father"
                  placeholderTextColor={C.muted}
                  multiline
                  value={remarks}
                  onChangeText={setRemarks}
                />

                {/* Confirm Button */}
                <TouchableOpacity
                  style={[styles.submitBtn, collecting && { opacity: 0.7 }]}
                  onPress={handleCollect}
                  disabled={collecting}
                >
                  {collecting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="receipt-outline" size={20} color="#fff" />
                      <Text style={styles.submitBtnText}>Confirm Fee Collection</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.primaryDark,
  },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
  },
  searchBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  resultsHeader: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  studentName: { fontSize: 14, fontWeight: '700', color: C.text },
  studentMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  studentSelectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  selectedName: { fontSize: 17, fontWeight: '800', color: C.text },
  selectedSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  changeBtn: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fee2e2', borderRadius: 6 },
  changeBtnText: { fontSize: 12, fontWeight: '700', color: C.error },
  duesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  duesLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },
  duesAmount: { fontSize: 20, fontWeight: '900', color: C.text, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeDue: { backgroundColor: '#fef3c7' },
  badgeClear: { backgroundColor: '#dcfce7' },
  badgeTextDue: { fontSize: 11, fontWeight: '800', color: C.warning },
  badgeTextClear: { fontSize: 11, fontWeight: '800', color: C.green },
  feeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  feeItemTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  feeItemSub: { fontSize: 11, color: C.muted },
  feeItemAmount: { fontSize: 13, fontWeight: '700', color: C.text },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase' },
  amountInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '900',
    color: C.text,
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.text,
    marginBottom: 14,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeBtnActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: C.text },
  modeBtnTextActive: { color: '#ffffff' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  successCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  successHeader: { alignItems: 'center', marginBottom: 16 },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: { fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center' },
  successSubtitle: { fontSize: 12, color: C.muted, marginTop: 4 },
  receiptBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  receiptLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  receiptVal: { fontSize: 13, color: C.text, fontWeight: '700' },
  receiptActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  receiptActionText: { fontSize: 13, fontWeight: '700' },
  newCollectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    marginTop: 14,
  },
  newCollectText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
