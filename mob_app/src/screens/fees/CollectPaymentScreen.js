// mob_app/src/screens/fees/CollectPaymentScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Share, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { handlePdfActionMenu, printPdf } from '../../utils/pdfHelper';

const C = {
  primary: '#0b57d0',
  primaryDark: '#032d60',
  green: '#16a34a',
  greenDark: '#15803d',
  warning: '#d97706',
  error: '#dc2626',
  text: '#0f172a',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI / QR', icon: 'qr-code-outline' },
  { id: 'CASH', label: 'Cash Counter', icon: 'cash-outline' },
  { id: 'CARD', label: 'Card / POS', icon: 'card-outline' },
  { id: 'CHEQUE', label: 'Cheque / DD', icon: 'document-text-outline' },
  { id: 'BANK_TRANSFER', label: 'NetBanking', icon: 'business-outline' },
];

export default function CollectPaymentScreen({ navigation, route }) {
  // Search & Filter State
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [query, setQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [students, setStudents] = useState([]);
  const [searching, setSearching] = useState(false);

  // Selected Student & Financial Ledger
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { ... } }
  const [totalDue, setTotalDue] = useState(0);

  // Multi-Month Package State (1, 3, 6, 12 Months & Custom)
  const [collectionTab, setCollectionTab] = useState('MULTI_MONTH'); // 'MULTI_MONTH' | 'ITEMIZED'
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [activePreset, setActivePreset] = useState('1_month');
  const [multiMonthPayingAmount, setMultiMonthPayingAmount] = useState('');
  const [generatingNotice, setGeneratingNotice] = useState(false);

  // Payment Form State
  const [mode, setMode] = useState('UPI');
  const [txnRef, setTxnRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Instant Fee Waiver / Concession (Maafi) Modal State
  const [feeHeads, setFeeHeads] = useState([]);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverHeadId, setWaiverHeadId] = useState('');
  const [waiverType, setWaiverType] = useState('WAIVER'); // WAIVER or SCHOLARSHIP
  const [waiverDiscountType, setWaiverDiscountType] = useState('FIXED'); // FIXED or PERCENTAGE
  const [waiverAmount, setWaiverAmount] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [applyingWaiver, setApplyingWaiver] = useState(false);

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);

  // 1. Fetch Classes & Fee Heads on mount
  useEffect(() => {
    client.get('/principal/classes')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
        setClasses(list);
      })
      .catch(() => {});

    client.get('/fees-finance/heads')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : res.data?.heads || [];
        setFeeHeads(list);
      })
      .catch(() => {});
  }, []);

  // Handle passed route param student
  useEffect(() => {
    if (route?.params?.student) {
      loadStudentLedger(route.params.student);
    } else if (route?.params?.student_id) {
      loadStudentLedger({ id: route.params.student_id });
    }
  }, [route?.params?.student, route?.params?.student_id]);

  // 2. Fetch Students List with filter (1:1 with Web ERP)
  const fetchStudents = useCallback(async () => {
    setSearching(true);
    try {
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (query.trim()) params.search = query.trim();
      params.only_pending = onlyPending ? 'true' : 'false';

      const res = await client.get('/fees-finance/students/search', { params }).catch(() => null);
      if (res?.data?.students) {
        setStudents(res.data.students);
      } else {
        // Fallback to principal student search
        const fallback = await client.get('/principal/fees/student-search', {
          params: { q: query.trim() || undefined, class_id: selectedClassId || undefined }
        }).catch(() => ({ data: [] }));
        setStudents(Array.isArray(fallback.data) ? fallback.data : []);
      }
    } catch {
      setStudents([]);
    } finally {
      setSearching(false);
    }
  }, [selectedClassId, query, onlyPending]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // 3. Load Student Ledger & Populate Itemized Allocations (1:1 with Web ERP)
  const loadStudentLedger = async (stu) => {
    const studentId = stu.id || stu.student_id;
    if (!studentId) return;

    setSelectedStudent(stu);
    setReceiptData(null);
    setLoadingLedger(true);
    setLoadingSchedule(true);

    try {
      const [res, schedRes] = await Promise.allSettled([
        client.get(`/fees-finance/students/${studentId}/ledger`),
        client.get(`/fees-finance/students/${studentId}/multi-month-schedule`),
      ]);

      if (res.status === 'fulfilled') {
        const ldata = res.value.data || {};
        const studentInfo = ldata.student || stu;
        setSelectedStudent(studentInfo);

        // Populate bill items that have pending balance
        const initialSelection = {};
        let totalPendingAmt = 0;
        const pendingBills = ldata.pending_bills || ldata.bills?.filter(b => (b.balance_due || 0) > 0) || [];

        pendingBills.forEach(b => {
          b.items?.forEach(it => {
            const bal = (it.balance_amount !== undefined && it.balance_amount !== null)
              ? Number(it.balance_amount)
              : Number(it.net_amount || 0);

            if (bal > 0) {
              initialSelection[it.id] = {
                bill_id: b.id,
                bill_no: b.bill_no,
                bill_period: b.bill_period_label || b.bill_month,
                bill_item_id: it.id,
                fee_head_id: it.fee_head_id,
                fee_head_name: it.fee_head_name || 'Tuition Fee',
                department: it.department || 'ACCOUNTS',
                amount: bal,
                max: bal,
                selected: true,
              };
              totalPendingAmt += bal;
            }
          });

          // Previous dues / opening balance if any
          const prevDuesAmount = Number(b.previous_dues || 0);
          if (prevDuesAmount > 0) {
            const itemsPaid = (b.items || []).reduce((acc, it) => acc + Number(it.paid_amount || 0), 0);
            const totalPaidOnBill = Number(b.amount_paid || 0);
            const prevDuesPaid = Math.max(0, totalPaidOnBill - itemsPaid);
            const prevDuesBal = Math.max(0, prevDuesAmount - prevDuesPaid);
            if (prevDuesBal > 0) {
              const key = `prev_dues_${b.id}`;
              initialSelection[key] = {
                bill_id: b.id,
                bill_no: b.bill_no,
                bill_period: b.bill_period_label || b.bill_month,
                bill_item_id: null,
                fee_head_id: null,
                fee_head_name: 'Previous Dues / Opening Balance',
                department: 'ACCOUNTS',
                amount: prevDuesBal,
                max: prevDuesBal,
                selected: true,
              };
              totalPendingAmt += prevDuesBal;
            }
          }
        });

        setSelectedItems(initialSelection);
        setTotalDue(totalPendingAmt);
      }

      if (schedRes.status === 'fulfilled') {
        const sdata = schedRes.value.data || {};
        setScheduleData(sdata);
        if (sdata?.presets?.['1_month']?.months?.length) {
          setSelectedMonths(sdata.presets['1_month'].months);
          setActivePreset('1_month');
          setMultiMonthPayingAmount(String(sdata.presets['1_month'].amount_payable || 0));
        } else {
          const unpaid = (sdata.months || []).filter(m => m.balance > 0);
          if (unpaid.length) {
            setSelectedMonths([unpaid[0].month_code]);
            setActivePreset('custom');
            setMultiMonthPayingAmount(String(unpaid[0].balance));
          } else {
            setSelectedMonths([]);
            setActivePreset('custom');
            setMultiMonthPayingAmount('0');
          }
        }
      }
    } catch {
      setSelectedItems({});
      setTotalDue(0);
    } finally {
      setLoadingLedger(false);
      setLoadingSchedule(false);
    }
  };

  // Preset Selection Handler for Mobile
  const applyPreset = (presetKey) => {
    if (!scheduleData?.presets?.[presetKey]) return;
    const p = scheduleData.presets[presetKey];
    setActivePreset(presetKey);
    setSelectedMonths(p.months || []);
    setMultiMonthPayingAmount(String(p.amount_payable || 0));
  };

  // Toggle single month in custom mode
  const toggleMonth = (monthCode) => {
    setActivePreset('custom');
    let updated;
    if (selectedMonths.includes(monthCode)) {
      updated = selectedMonths.filter(m => m !== monthCode);
    } else {
      updated = [...selectedMonths, monthCode];
    }
    setSelectedMonths(updated);

    if (scheduleData?.months) {
      const selObjs = scheduleData.months.filter(m => updated.includes(m.month_code));
      const payable = selObjs.reduce((sum, m) => sum + (m.balance || 0), 0);
      setMultiMonthPayingAmount(String(payable));
    }
  };

  const selectedMonthsDetails = useMemo(() => {
    if (!scheduleData?.months) return [];
    return scheduleData.months.filter(m => selectedMonths.includes(m.month_code));
  }, [scheduleData, selectedMonths]);

  const multiMonthBase = selectedMonthsDetails.reduce((sum, m) => sum + (m.original_amount || 0), 0);
  const multiMonthDisc = selectedMonthsDetails.reduce((sum, m) => sum + (m.discount_amount || 0), 0);
  const multiMonthFine = selectedMonthsDetails.reduce((sum, m) => sum + (m.fine_amount || 0), 0);
  const multiMonthPayable = selectedMonthsDetails.reduce((sum, m) => sum + (m.balance || 0), 0);

  // Submit Multi-Month Payment on Mobile
  const handleCollectMultiMonthPayment = async () => {
    if (!selectedStudent) {
      Alert.alert('Selection Error', 'Please select a student first.');
      return;
    }
    if (selectedMonths.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one month to pay.');
      return;
    }
    const payAmt = parseFloat(multiMonthPayingAmount);
    if (!payAmt || payAmt <= 0) {
      Alert.alert('Validation Error', 'Payment amount must be greater than ₹0.');
      return;
    }

    setCollecting(true);
    try {
      const studentId = selectedStudent.id || selectedStudent.student_id;
      const idempotencyKey = `mob_mm_${studentId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        months: selectedMonths,
        amount_paid: payAmt,
        payment_mode: mode,
        transaction_ref: txnRef.trim(),
        remarks: remarks.trim() || `Mobile POS multi-month fee for ${selectedMonths.join(', ')}`,
        idempotency_key: idempotencyKey,
      };

      const res = await client.post(`/fees-finance/students/${studentId}/pay-multi-month`, payload);
      const data = res.data;
      const receiptNo = data.receipt_no || data.payment?.receipt_no || `REC-${Date.now().toString().slice(-6)}`;
      const paymentId = data.payment_id || data.payment?.id;

      setReceiptData({
        receiptNo,
        paymentId,
        studentName: selectedStudent.name,
        admissionNo: selectedStudent.admission_no || selectedStudent.admission_number || '—',
        className: selectedStudent.class_name || selectedStudent.class?.name || '—',
        amount: payAmt,
        mode,
        txnRef: txnRef.trim(),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        monthsCovered: selectedMonths,
        allocations: data.payment?.allocations || [],
      });

      setTxnRef('');
      setRemarks('');
      loadStudentLedger(selectedStudent);
      fetchStudents();
    } catch (err) {
      Alert.alert('Payment Failed', err.response?.data?.error || err.message || 'Payment processing failed.');
    } finally {
      setCollecting(false);
    }
  };

  // Generate Demand Bill / Notice on Mobile
  const handleGenerateDemandNotice = async () => {
    if (!selectedStudent) {
      Alert.alert('Selection Error', 'Please select a student first.');
      return;
    }
    if (selectedMonths.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one month for the demand notice.');
      return;
    }

    setGeneratingNotice(true);
    try {
      const studentId = selectedStudent.id || selectedStudent.student_id;
      const payload = {
        months: selectedMonths,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      };
      const res = await client.post(`/fees-finance/students/${studentId}/generate-demand-notice`, payload);
      Alert.alert('Demand Bill Generated', res.data?.message || `Official Payment Request notice generated for ${selectedMonths.length} month(s)! Notice status is ISSUED.`);
      loadStudentLedger(selectedStudent);
    } catch (err) {
      Alert.alert('Demand Bill Error', err.response?.data?.error || 'Failed to generate demand notice.');
    } finally {
      setGeneratingNotice(false);
    }
  };

  // Toggle item selection
  const toggleItem = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId].selected,
      },
    }));
  };

  // Update item custom amount
  const updateItemAmount = (itemId, val) => {
    const num = parseFloat(val) || 0;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        amount: Math.min(Math.max(0, num), prev[itemId].max),
      },
    }));
  };

  // Calculate live total to pay from selected items
  const totalToPay = useMemo(() => {
    return Object.values(selectedItems)
      .filter(it => it.selected)
      .reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  }, [selectedItems]);

  // 4. Collect Payment Action (1:1 with Web ERP)
  const handleCollectPayment = async () => {
    if (!selectedStudent) {
      Alert.alert('Selection Error', 'Please select a student first.');
      return;
    }
    if (totalToPay <= 0) {
      Alert.alert('Amount Required', 'Please select at least one fee head with amount greater than ₹0.');
      return;
    }

    setCollecting(true);
    try {
      const allocations = Object.values(selectedItems)
        .filter(it => it.selected && it.amount > 0)
        .map(it => ({
          bill_id: it.bill_id,
          bill_item_id: it.bill_item_id,
          fee_head_id: it.fee_head_id,
          amount: parseFloat(it.amount),
        }));

      const depts = new Set(
        Object.values(selectedItems)
          .filter(it => it.selected && it.amount > 0)
          .map(it => it.department || 'ACCOUNTS')
      );
      const chosenDept = depts.size === 1 ? Array.from(depts)[0] : 'ACCOUNTS';

      const payload = {
        student_id: selectedStudent.id,
        amount: totalToPay,
        amount_paid: totalToPay,
        total_amount: totalToPay,
        payment_mode: mode,
        transaction_ref: txnRef.trim() || undefined,
        remarks: remarks.trim() || 'Mobile POS counter collection',
        allocations,
        department: chosenDept,
      };

      let receiptInfo = null;
      try {
        const res = await client.post('/fees-finance/payments/collect', payload);
        receiptInfo = res.data;
      } catch (centralErr) {
        // Fallback to legacy single collect endpoint
        const firstRec = Object.values(selectedItems).find(it => it.selected && it.bill_id);
        if (firstRec) {
          const res = await client.post('/principal/fees/collect', {
            record_id: firstRec.bill_id,
            amount_paid: totalToPay,
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
        admissionNo: selectedStudent.admission_no || selectedStudent.admission_number || '—',
        className: selectedStudent.class_name || selectedStudent.class?.name || '—',
        amount: totalToPay,
        mode,
        txnRef: txnRef.trim(),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        allocations,
      });

      // Real-time live update: reload student ledger and clear inputs
      setTxnRef('');
      setRemarks('');
      loadStudentLedger(selectedStudent);
      fetchStudents();
    } catch (err) {
      Alert.alert('Collection Failed', err.response?.data?.error || err.message || 'Payment processing failed.');
    } finally {
      setCollecting(false);
    }
  };

  // 5. Apply Instant Concession / Fee Waiver (Maafi) Action (1:1 with Web ERP)
  const handleApplyWaiver = async () => {
    if (!selectedStudent) {
      Alert.alert('Selection Error', 'Please select a student first.');
      return;
    }
    const val = parseFloat(waiverAmount);
    if (!val || val <= 0) {
      Alert.alert('Validation Error', 'Enter a valid discount / fee waiver amount.');
      return;
    }
    if (!waiverReason.trim()) {
      Alert.alert('Validation Error', 'Please enter a reason or approval note.');
      return;
    }

    setApplyingWaiver(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        fee_head_id: waiverHeadId ? parseInt(waiverHeadId, 10) : null,
        concession_type: waiverType,
        discount_type: waiverDiscountType,
        discount_value: val,
        reason: waiverReason.trim(),
        session: '2026-27',
      };

      await client.post('/fees-finance/concessions', payload);
      Alert.alert('Success', 'Scholarship / Fee Waiver (Maafi) applied successfully!');
      setShowWaiverModal(false);
      setWaiverAmount('');
      setWaiverReason('');

      // Real-time refresh
      loadStudentLedger(selectedStudent);
      fetchStudents();
    } catch (err) {
      Alert.alert('Waiver Failed', err.response?.data?.error || 'Failed to apply fee waiver.');
    } finally {
      setApplyingWaiver(false);
    }
  };

  // 6. Share & Download PDF Receipt Handlers
  const handleShareReceipt = async () => {
    if (!receiptData) return;
    const msg = `*OFFICIAL INSTITUTIONAL FEE RECEIPT*\n` +
      `Receipt No: ${receiptData.receiptNo}\n` +
      `Student: ${receiptData.studentName} (Adm: ${receiptData.admissionNo})\n` +
      `Class: ${receiptData.className}\n` +
      `Amount Paid: ₹${Number(receiptData.amount).toLocaleString('en-IN')}\n` +
      `Payment Mode: ${receiptData.mode}${receiptData.txnRef ? ` (Ref: ${receiptData.txnRef})` : ''}\n` +
      `Date: ${receiptData.date}\n` +
      `Status: Payment Confirmed & Reconciled\n\n` +
      `School Accounts Department`;

    try {
      await Share.share({ message: msg });
    } catch {
      // ignore
    }
  };

  const handleDownloadReceiptPdf = () => {
    if (!receiptData?.paymentId) {
      Alert.alert('Receipt Notice', 'PDF receipt is being processed on the central server.');
      return;
    }
    handlePdfActionMenu({
      pathOrUrl: `/fees-finance/payments/${receiptData.paymentId}/receipt-pdf`,
      filename: `Official_Receipt_${receiptData.receiptNo}.pdf`,
      title: `Official Receipt #${receiptData.receiptNo}`,
    });
  };

  const handlePrintReceiptPdf = () => {
    if (!receiptData?.paymentId) {
      Alert.alert('Receipt Notice', 'PDF receipt is being processed on the central server.');
      return;
    }
    printPdf(
      `/fees-finance/payments/${receiptData.paymentId}/receipt-pdf`,
      `Official_Receipt_${receiptData.receiptNo}.pdf`,
      `Receipt #${receiptData.receiptNo}`
    );
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setReceiptData(null);
    setSelectedItems({});
    setTotalDue(0);
    setTxnRef('');
    setRemarks('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Collect Fee Payment</Text>
            <Text style={styles.headerSub}>Point of Sale (POS) Cashier Counter</Text>
          </View>
        </View>

        {selectedStudent && (
          <TouchableOpacity
            style={styles.waiverHeaderBtn}
            onPress={() => setShowWaiverModal(true)}
          >
            <Ionicons name="gift-outline" size={15} color="#d97706" />
            <Text style={styles.waiverHeaderBtnText}>+ Waiver</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Receipt Confirmation Modal / Banner */}
        {receiptData ? (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <View style={styles.successIconBadge}>
                <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Payment Collected Successfully!</Text>
              <Text style={styles.successSubtitle}>Institutional receipt generated & ledger updated</Text>
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
              {receiptData.monthsCovered && receiptData.monthsCovered.length > 0 && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Months Covered</Text>
                  <Text style={[styles.receiptVal, { color: C.primary, fontWeight: '700' }]}>
                    {receiptData.monthsCovered.join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Mode</Text>
                <Text style={styles.receiptVal}>{receiptData.mode} {receiptData.txnRef ? `(${receiptData.txnRef})` : ''}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Date</Text>
                <Text style={styles.receiptVal}>{receiptData.date}</Text>
              </View>
              <View style={[styles.receiptRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 }]}>
                <Text style={[styles.receiptLabel, { fontSize: 14, fontWeight: '800' }]}>Total Amount Collected</Text>
                <Text style={[styles.receiptVal, { fontSize: 18, fontWeight: '900', color: '#16a34a' }]}>
                  ₹{Number(receiptData.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Native Print & Share Buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={[styles.receiptActionBtn, { backgroundColor: '#f1f5f9' }]} onPress={handleShareReceipt}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.text} />
                <Text style={[styles.receiptActionText, { color: C.text }]}>Share Text</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.receiptActionBtn, { backgroundColor: '#eff6ff' }]} onPress={handlePrintReceiptPdf}>
                <Ionicons name="print-outline" size={16} color={C.primary} />
                <Text style={[styles.receiptActionText, { color: C.primary }]}>Print PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.receiptActionBtn, { backgroundColor: '#e0f2fe' }]} onPress={handleDownloadReceiptPdf}>
                <Ionicons name="share-outline" size={16} color="#0284c7" />
                <Text style={[styles.receiptActionText, { color: "#0284c7" }]}>Save/Share</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newCollectBtn} onPress={resetForm}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.newCollectText}>Collect Another Payment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Step 1: Student Search & Class Filter */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>1. Search Student</Text>

              {/* Class Chips Filter (1:1 with Web ERP) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.classChip, !selectedClassId && styles.classChipActive]}
                  onPress={() => setSelectedClassId('')}
                >
                  <Text style={[styles.classChipText, !selectedClassId && styles.classChipTextActive]}>All Classes</Text>
                </TouchableOpacity>
                {classes.map(c => {
                  const isSel = String(selectedClassId) === String(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.classChip, isSel && styles.classChipActive]}
                      onPress={() => setSelectedClassId(isSel ? '' : String(c.id))}
                    >
                      <Text style={[styles.classChipText, isSel && styles.classChipTextActive]}>
                        {c.name} {c.section ? `(${c.section})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Search Row & Only Pending Filter */}
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#94a3b8" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Student name, admission no, phone..."
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
                {query ? (
                  <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <TouchableOpacity
                  style={styles.togglePendingBtn}
                  onPress={() => setOnlyPending(!onlyPending)}
                >
                  <Ionicons
                    name={onlyPending ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={onlyPending ? colors.primary : '#94a3b8'}
                  />
                  <Text style={styles.togglePendingText}>Only Show Students with Pending Dues</Text>
                </TouchableOpacity>

                {searching && <ActivityIndicator size="small" color={colors.primary} />}
              </View>

              {/* Student Results List */}
              {students.length > 0 && !selectedStudent && (
                <View style={styles.resultsBox}>
                  <Text style={styles.resultsHeader}>Select matching student ({students.length}):</Text>
                  {students.slice(0, 10).map(s => {
                    const hasDues = (s.total_due || s.balance_due || s.effective_due || 0) > 0;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.studentItem}
                        onPress={() => loadStudentLedger(s)}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.studentName}>{s.name}</Text>
                            {hasDues && (
                              <View style={styles.miniDueBadge}>
                                <Text style={styles.miniDueBadgeText}>
                                  ₹{Number(s.total_due || s.balance_due || s.effective_due).toLocaleString()}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.studentMeta}>
                            Adm #{s.admission_no || s.admission_number || '—'} · Class {s.class_name || s.class?.name || '—'}
                            {s.father_name ? ` · F: ${s.father_name}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Step 2: Selected Student Financial Ledger */}
            {loadingLedger && (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: 28, marginTop: 14 }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, fontSize: 13, color: '#64748b', fontWeight: '600' }}>
                  Loading real-time financial ledger...
                </Text>
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
                      {selectedStudent.father_name ? ` · F: ${selectedStudent.father_name}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.changeBtn}>
                    <Text style={styles.changeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>

                {/* Total Outstanding Summary */}
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

                {/* Mode Selector Tabs (Multi-Month Package vs Itemized Dues) */}
                <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 14 }}>
                  <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, collectionTab === 'MULTI_MONTH' && { backgroundColor: colors.primary }]}
                    onPress={() => setCollectionTab('MULTI_MONTH')}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: '#64748b' }, collectionTab === 'MULTI_MONTH' && { color: '#ffffff' }]}>
                      Multi-Month (1, 3, 6, 12 Mo)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, collectionTab === 'ITEMIZED' && { backgroundColor: colors.primary }]}
                    onPress={() => setCollectionTab('ITEMIZED')}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: '#64748b' }, collectionTab === 'ITEMIZED' && { color: '#ffffff' }]}>
                      Itemized Dues ({Object.keys(selectedItems).length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {collectionTab === 'MULTI_MONTH' ? (
                  /* ── TAB 1: MULTI-MONTH PAYMENT WORKFLOW ── */
                  <View>
                    {/* Period Preset Options */}
                    <Text style={styles.fieldLabel}>Select Payment Period</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {[
                          { key: '1_month', label: '1 Month' },
                          { key: '3_months', label: '3 Mo (Quarter)' },
                          { key: '6_months', label: '6 Mo (Half-Yr)' },
                          { key: '12_months', label: '1 Year (Annual)' },
                          { key: 'custom', label: 'Custom' },
                        ].map(preset => {
                          const isActive = activePreset === preset.key;
                          const pData = scheduleData?.presets?.[preset.key];
                          const isDisabled = preset.key !== 'custom' && (!pData || !pData.is_available);
                          return (
                            <TouchableOpacity
                              key={preset.key}
                              disabled={isDisabled}
                              style={[
                                styles.modeBtn,
                                isActive && styles.modeBtnActive,
                                isDisabled && { opacity: 0.4 }
                              ]}
                              onPress={() => {
                                if (preset.key === 'custom') {
                                  setActivePreset('custom');
                                } else {
                                  applyPreset(preset.key);
                                }
                              }}
                            >
                              <Text style={[styles.modeBtnText, isActive && styles.modeBtnTextActive]}>
                                {preset.label}
                                {pData && pData.amount_payable > 0 ? ` (₹${pData.amount_payable.toLocaleString()})` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    {/* Schedule Months List */}
                    <Text style={styles.fieldLabel}>Academic Session Fee Months ({selectedMonths.length} Selected)</Text>
                    {loadingSchedule ? (
                      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Loading fee schedule...</Text>
                      </View>
                    ) : (scheduleData?.months || []).map(m => {
                      const isSel = selectedMonths.includes(m.month_code);
                      const isPaid = m.is_paid || m.balance <= 0;
                      return (
                        <TouchableOpacity
                          key={m.month_code}
                          disabled={isPaid}
                          style={[
                            styles.allocationCard,
                            isSel && styles.allocationCardSelected,
                            isPaid && { backgroundColor: '#f8fafc', opacity: 0.7 }
                          ]}
                          onPress={() => !isPaid && toggleMonth(m.month_code)}
                        >
                          <Ionicons
                            name={isPaid ? 'checkmark-circle' : isSel ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isPaid ? '#16a34a' : isSel ? colors.primary : '#94a3b8'}
                          />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.allocHeadName, isSel && { color: colors.primary }]}>
                                {m.month_label}
                              </Text>
                              <View style={[
                                styles.miniDueBadge,
                                isPaid ? { backgroundColor: '#dcfce7' } : m.is_partial ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#fee2e2' }
                              ]}>
                                <Text style={[
                                  styles.miniDueBadgeText,
                                  isPaid ? { color: '#16a34a' } : m.is_partial ? { color: '#d97706' } : { color: '#dc2626' }
                                ]}>
                                  {isPaid ? 'PAID' : m.is_partial ? 'PARTIAL' : m.status || 'DUE'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.allocPeriodText}>
                              Base: ₹{m.original_amount} {m.discount_amount > 0 ? `· Disc: -₹${m.discount_amount}` : ''} {m.fine_amount > 0 ? `· Fine: +₹${m.fine_amount}` : ''}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: m.balance > 0 ? '#dc2626' : '#16a34a' }}>
                            ₹{m.balance.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Multi-Month Financial Calculation Card */}
                    <View style={[styles.totalPayBanner, { flexDirection: 'column', alignItems: 'stretch', gap: 6, marginVertical: 12 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#1e40af' }}>Base Fee:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e40af' }}>₹{multiMonthBase.toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#16a34a' }}>Concessions / Maafi:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>-₹{multiMonthDisc.toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#dc2626' }}>Late Fines:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc2626' }}>+₹{multiMonthFine.toLocaleString()}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#bfdbfe', marginVertical: 2 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.totalPayLabel}>Total Payable:</Text>
                        <Text style={styles.totalPayValue}>₹{multiMonthPayable.toLocaleString('en-IN')}</Text>
                      </View>
                    </View>

                    {/* Amount to Collect Input */}
                    <Text style={styles.fieldLabel}>Amount to Collect (₹) *</Text>
                    <TextInput
                      style={[styles.input, { fontWeight: '800', fontSize: 16, color: '#16a34a' }]}
                      keyboardType="numeric"
                      value={multiMonthPayingAmount}
                      onChangeText={setMultiMonthPayingAmount}
                      placeholder="e.g. 5000"
                    />

                    {/* Payment Mode Pills */}
                    <Text style={styles.fieldLabel}>Payment Mode *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {PAYMENT_MODES.map(m => (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                            onPress={() => setMode(m.id)}
                          >
                            <Ionicons name={m.icon} size={16} color={mode === m.id ? '#fff' : '#64748b'} />
                            <Text style={[styles.modeBtnText, mode === m.id && styles.modeBtnTextActive]}>{m.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Transaction Ref */}
                    {mode !== 'CASH' && (
                      <>
                        <Text style={styles.fieldLabel}>Transaction / UTR Reference</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. UPI-9988776655"
                          placeholderTextColor="#94a3b8"
                          value={txnRef}
                          onChangeText={setTxnRef}
                        />
                      </>
                    )}

                    {/* Remarks */}
                    <Text style={styles.fieldLabel}>Counter Remarks / Notes</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Multi-month fee collected at cashier counter"
                      placeholderTextColor="#94a3b8"
                      value={remarks}
                      onChangeText={setRemarks}
                    />

                    {/* Dual Action Buttons: Collect vs Demand Notice */}
                    <View style={{ gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[
                          styles.collectBtn,
                          (collecting || selectedMonths.length === 0 || !multiMonthPayingAmount || parseFloat(multiMonthPayingAmount) <= 0) && { opacity: 0.6 }
                        ]}
                        disabled={collecting || selectedMonths.length === 0 || !multiMonthPayingAmount || parseFloat(multiMonthPayingAmount) <= 0}
                        onPress={handleCollectMultiMonthPayment}
                      >
                        {collecting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="card" size={20} color="#fff" />
                            <Text style={styles.collectBtnText}>
                              Collect ₹{Number(multiMonthPayingAmount || multiMonthPayable).toLocaleString('en-IN')} & Print
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modeBtn,
                          { justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f1f5f9' },
                          (generatingNotice || selectedMonths.length === 0) && { opacity: 0.6 }
                        ]}
                        disabled={generatingNotice || selectedMonths.length === 0}
                        onPress={handleGenerateDemandNotice}
                      >
                        {generatingNotice ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                              Issue Demand Bill / Notice ({selectedMonths.length} mo)
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── TAB 2: ITEMIZED DUES SELECTION WORKFLOW ── */
                  <View>
                    {/* Itemized Fee Breakdown with Checkboxes (1:1 with Web ERP) */}
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={styles.cardSectionTitle}>Fee Head Allocations</Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>Select items to collect</Text>
                      </View>

                      {Object.keys(selectedItems).length > 0 ? (
                        Object.entries(selectedItems).map(([key, item]) => (
                          <View key={key} style={[styles.allocationCard, item.selected && styles.allocationCardSelected]}>
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                              onPress={() => toggleItem(key)}
                            >
                              <Ionicons
                                name={item.selected ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={item.selected ? colors.primary : '#94a3b8'}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.allocHeadName, item.selected && { color: colors.primary }]}>
                                  {item.fee_head_name}
                                </Text>
                                <Text style={styles.allocPeriodText}>
                                  Bill: #{item.bill_no || 'Bill'} · Period: {item.bill_period || 'Current'}
                                </Text>
                              </View>
                            </TouchableOpacity>

                            {/* Editable amount input for partial collection */}
                            <View style={{ width: 100 }}>
                              <TextInput
                                style={[styles.allocAmountInput, !item.selected && { opacity: 0.5 }]}
                                keyboardType="numeric"
                                value={String(item.amount)}
                                onChangeText={val => updateItemAmount(key, val)}
                                editable={item.selected}
                              />
                              <Text style={styles.allocMaxText}>Max: ₹{item.max}</Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={styles.noDuesBox}>
                          <Ionicons name="checkmark-circle-outline" size={32} color="#16a34a" />
                          <Text style={styles.noDuesText}>No pending fee items on record!</Text>
                        </View>
                      )}
                    </View>

                    {/* Total To Pay Box */}
                    <View style={styles.totalPayBanner}>
                      <Text style={styles.totalPayLabel}>Total Payable Amount:</Text>
                      <Text style={styles.totalPayValue}>₹{totalToPay.toLocaleString('en-IN')}</Text>
                    </View>

                    {/* Step 3: Payment Mode Pills */}
                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Payment Mode *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {PAYMENT_MODES.map(m => (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                            onPress={() => setMode(m.id)}
                          >
                            <Ionicons name={m.icon} size={16} color={mode === m.id ? '#fff' : '#64748b'} />
                            <Text style={[styles.modeBtnText, mode === m.id && styles.modeBtnTextActive]}>{m.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Transaction / UTR / Cheque Ref ID */}
                    {mode !== 'CASH' && (
                      <>
                        <Text style={styles.fieldLabel}>
                          {mode === 'CHEQUE' ? 'Cheque No. & Bank Name *' : 'Transaction Ref / UTR / Auth Code *'}
                        </Text>
                        <TextInput
                          style={styles.input}
                          placeholder={mode === 'CHEQUE' ? 'e.g., CHQ-982144 (HDFC Bank)' : 'e.g., UPI Ref 382910482019'}
                          placeholderTextColor="#94a3b8"
                          value={txnRef}
                          onChangeText={setTxnRef}
                        />
                      </>
                    )}

                    {/* Remarks */}
                    <Text style={styles.fieldLabel}>Counter Remarks / Notes (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Paid at accounts window by parent"
                      placeholderTextColor="#94a3b8"
                      value={remarks}
                      onChangeText={setRemarks}
                    />

                    {/* Collect Button */}
                    <TouchableOpacity
                      style={[styles.collectBtn, (collecting || totalToPay <= 0) && { opacity: 0.6 }]}
                      disabled={collecting || totalToPay <= 0}
                      onPress={handleCollectPayment}
                    >
                      {collecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="card" size={20} color="#fff" />
                          <Text style={styles.collectBtnText}>
                            Collect ₹{totalToPay.toLocaleString('en-IN')} & Print Receipt
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL: SCHOLARSHIP / FEE WAIVER (MAAFI)         */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={showWaiverModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🎁 Scholarship / Fee Waiver (Maafi)</Text>
                <Text style={styles.modalSubtitle}>Apply instant discount or concession on student fee</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWaiverModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Fee Head Selector */}
              <Text style={styles.fieldLabel}>Target Fee Head</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.modalChip, !waiverHeadId && styles.modalChipActive]}
                    onPress={() => setWaiverHeadId('')}
                  >
                    <Text style={[styles.modalChipText, !waiverHeadId && styles.modalChipTextActive]}>All Fee Heads</Text>
                  </TouchableOpacity>
                  {feeHeads.map(h => (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.modalChip, waiverHeadId === String(h.id) && styles.modalChipActive]}
                      onPress={() => setWaiverHeadId(String(h.id))}
                    >
                      <Text style={[styles.modalChipText, waiverHeadId === String(h.id) && styles.modalChipTextActive]}>
                        {h.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Concession Type */}
              <Text style={styles.fieldLabel}>Concession Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['WAIVER', 'SCHOLARSHIP'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalChip, { flex: 1, alignItems: 'center' }, waiverType === t && styles.modalChipActive]}
                    onPress={() => setWaiverType(t)}
                  >
                    <Text style={[styles.modalChipText, waiverType === t && styles.modalChipTextActive]}>
                      {t === 'WAIVER' ? 'Fee Waiver (Maafi)' : 'Merit Scholarship'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Discount Value & Type */}
              <Text style={styles.fieldLabel}>Discount Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={waiverAmount}
                onChangeText={setWaiverAmount}
              />

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason / Principal Approval Note *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Principal approved sibling discount or economic hardship"
                placeholderTextColor="#94a3b8"
                value={waiverReason}
                onChangeText={setWaiverReason}
              />

              <TouchableOpacity
                style={[styles.submitWaiverBtn, applyingWaiver && { opacity: 0.6 }]}
                disabled={applyingWaiver}
                onPress={handleApplyWaiver}
              >
                {applyingWaiver ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitWaiverBtnText}>Apply Waiver & Update Ledger</Text>
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
  container: { flex: 1, backgroundColor: C.bg },
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
  waiverHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  waiverHeaderBtnText: { color: '#b45309', fontSize: 11, fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  classChipTextActive: { color: '#ffffff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 13, color: '#0f172a' },
  togglePendingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  togglePendingText: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  resultsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  resultsHeader: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  studentMeta: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  miniDueBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniDueBadgeText: { fontSize: 10, fontWeight: '800', color: '#dc2626' },
  studentSelectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectedName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  selectedSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  changeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#eff6ff' },
  changeBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  duesBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  duesLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  duesAmount: { fontSize: 18, fontWeight: '900', color: '#dc2626', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeDue: { backgroundColor: '#fee2e2' },
  badgeClear: { backgroundColor: '#dcfce7' },
  badgeTextDue: { color: '#dc2626', fontSize: 11, fontWeight: '800' },
  badgeTextClear: { color: '#16a34a', fontSize: 11, fontWeight: '800' },
  allocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  allocationCardSelected: { borderColor: colors.primary, backgroundColor: '#f0f7ff' },
  allocHeadName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  allocPeriodText: { fontSize: 10.5, color: '#94a3b8', marginTop: 2 },
  allocAmountInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    color: '#0f172a',
  },
  allocMaxText: { fontSize: 9, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
  noDuesBox: { alignItems: 'center', paddingVertical: 16 },
  noDuesText: { fontSize: 13, color: '#16a34a', fontWeight: '700', marginTop: 6 },
  totalPayBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  totalPayLabel: { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  totalPayValue: { fontSize: 20, fontWeight: '900', color: '#1d4ed8' },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  modeBtnTextActive: { color: '#ffffff' },
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
  collectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
  },
  collectBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successHeader: { alignItems: 'center', marginBottom: 16 },
  successIconBadge: { marginBottom: 6 },
  successTitle: { fontSize: 17, fontWeight: '800', color: '#15803d', textAlign: 'center' },
  successSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' },
  receiptBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  receiptLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  receiptVal: { fontSize: 12, color: '#0f172a', fontWeight: '700' },
  receiptActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  receiptActionText: { fontSize: 12, fontWeight: '700' },
  newCollectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  newCollectText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  modalChipTextActive: { color: '#ffffff' },
  submitWaiverBtn: {
    backgroundColor: '#d97706',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitWaiverBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
