// mob_app/src/screens/hr/PayrollScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, Linking, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollScreen({ navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipalOrAccountant = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'HR'].includes(role);

  const [activeTab, setActiveTab] = useState(isPrincipalOrAccountant ? 'Runs' : 'MySlips');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin Payroll Runs States
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runSlips, setRunSlips] = useState([]);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);

  // Staff Personal Slips States
  const [mySlips, setMySlips] = useState([]);

  // Calculate Payroll Modal State
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcMonth, setCalcMonth] = useState(String(new Date().getMonth() + 1));
  const [calcYear, setCalcYear] = useState(String(new Date().getFullYear()));
  const [calculating, setCalculating] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isPrincipalOrAccountant) {
        const res = await client.get('/hrms/payroll/runs').catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : res.data?.runs || [];
        setPayrollRuns(list);
      } else {
        const res = await client.get('/hrms/my/payslips').catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : res.data?.slips || [];
        setMySlips(list);
      }
    } catch (err) {
      console.warn('Failed to load payroll data:', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isPrincipalOrAccountant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load details of a specific payroll run
  const openRunDetail = async (run) => {
    setSelectedRun(run);
    setLoadingRunDetail(true);
    try {
      const res = await client.get(`/hrms/payroll/runs/${run.id}`);
      const data = res.data;
      const slips = data?.slips || (Array.isArray(data) ? data : []);
      setRunSlips(slips);
    } catch (err) {
      console.warn('Failed to load run slips:', err);
      setRunSlips([]);
    } finally {
      setLoadingRunDetail(false);
    }
  };

  // Calculate Monthly Payroll Batch
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    try {
      const res = await client.post('/hrms/payroll/calculate', {
        month: Number(calcMonth),
        year: Number(calcYear),
      });

      Alert.alert('Payroll Calculated', 'Monthly salary calculations and draft slips generated successfully.');
      setShowCalcModal(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Calculation Failed', err.response?.data?.error || 'Could not calculate payroll.');
    } finally {
      setCalculating(false);
    }
  };

  // Approve Payroll Run
  const handleApproveRun = (runId) => {
    Alert.alert(
      'Approve Payroll Batch',
      'Approve this monthly payroll run? This will finalize salary calculations for all employees.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await client.post(`/hrms/payroll/runs/${runId}/approve`);
              Alert.alert('Approved', 'Payroll run approved successfully.');
              loadData(true);
              if (selectedRun?.id === runId) {
                openRunDetail({ ...selectedRun, status: 'APPROVED' });
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to approve payroll run.');
            }
          },
        },
      ]
    );
  };

  // Pay All Slips in Batch
  const handlePayAll = (runId) => {
    Alert.alert(
      'Disburse All Salaries',
      'Are you sure you want to mark all slips in this payroll batch as PAID?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disburse All',
          onPress: async () => {
            try {
              await client.post(`/hrms/payroll/runs/${runId}/pay-all`);
              Alert.alert('Salaries Disbursed', 'All employee salary slips marked as PAID.');
              loadData(true);
              if (selectedRun?.id === runId) {
                openRunDetail({ ...selectedRun, status: 'PAID' });
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to disburse salaries.');
            }
          },
        },
      ]
    );
  };

  // Mark Individual Slip as Paid
  const handlePaySlip = async (slipId) => {
    try {
      await client.post(`/hrms/payroll/slips/${slipId}/pay`, {
        payment_method: 'BANK_TRANSFER',
      });
      Alert.alert('Paid', 'Salary slip recorded as PAID.');
      if (selectedRun) openRunDetail(selectedRun);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to record payment.');
    }
  };

  // Download PDF Salary Slip
  const handleDownloadSlipPdf = (slipId) => {
    const url = `${client.defaults.baseURL}/hrms/payroll/slips/${slipId}/pdf`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open payslip PDF link on this device.');
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Payroll & Salaries</Text>
            <Text style={styles.headerSub}>Monthly compensation & salary slips</Text>
          </View>
        </View>

        {isPrincipalOrAccountant && (
          <TouchableOpacity
            style={styles.calcBtn}
            onPress={() => setShowCalcModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calculator-outline" size={16} color="#fff" />
            <Text style={styles.calcBtnText}>Run Payroll</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching payroll records...</Text>
        </View>
      ) : isPrincipalOrAccountant ? (
        /* PRINCIPAL & ACCOUNTANT VIEW */
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
          <Text style={styles.sectionTitle}>Monthly Payroll Runs ({payrollRuns.length})</Text>
          {payrollRuns.length > 0 ? (
            <View style={{ gap: 12 }}>
              {payrollRuns.map((r, i) => {
                const status = (r.status || 'DRAFT').toUpperCase();
                const isPaid = status === 'PAID';
                const isApproved = status === 'APPROVED';
                const isDraft = status === 'DRAFT';

                return (
                  <View key={r.id || i} style={styles.runCard}>
                    <View style={styles.runHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.runTitle}>
                          {r.month_name ? `${r.month_name} ${r.year}` : (r.month_year || `Batch #${r.id}`)}
                        </Text>
                        <Text style={styles.runMeta}>
                          {r.employee_count ? `${r.employee_count} Employees Enrolled` : 'All School Employees'}
                        </Text>
                      </View>

                      <View style={[
                        styles.statusBadge,
                        isPaid ? styles.statusPaid : isApproved ? styles.statusApproved : styles.statusDraft
                      ]}>
                        <Text style={[
                          styles.statusText,
                          isPaid ? { color: '#059669' } : isApproved ? { color: '#0284c7' } : { color: '#d97706' }
                        ]}>
                          {status}
                        </Text>
                      </View>
                    </View>

                    {/* Amount Tile */}
                    <View style={styles.amountTile}>
                      <View>
                        <Text style={styles.amountLabel}>Total Net Payroll</Text>
                        <Text style={styles.amountVal}>
                          ₹{Number(r.total_net_amount || r.total_amount || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      {r.total_gross_amount && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.amountLabel}>Gross Total</Text>
                          <Text style={styles.grossVal}>₹{Number(r.total_gross_amount).toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.actionBtnOutline}
                        onPress={() => openRunDetail(r)}
                      >
                        <Ionicons name="list-outline" size={14} color="#0284c7" />
                        <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>View Slips</Text>
                      </TouchableOpacity>

                      {isDraft && (
                        <TouchableOpacity
                          style={styles.actionBtnSolid}
                          onPress={() => handleApproveRun(r.id)}
                        >
                          <Ionicons name="checkmark-outline" size={14} color="#fff" />
                          <Text style={styles.actionBtnSolidText}>Approve</Text>
                        </TouchableOpacity>
                      )}

                      {isApproved && (
                        <TouchableOpacity
                          style={[styles.actionBtnSolid, { backgroundColor: '#059669' }]}
                          onPress={() => handlePayAll(r.id)}
                        >
                          <Ionicons name="cash-outline" size={14} color="#fff" />
                          <Text style={styles.actionBtnSolidText}>Disburse All</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Payroll Runs Generated</Text>
              <Text style={styles.emptyCardText}>Tap "Run Payroll" to calculate this month's faculty salaries.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* TEACHER & STAFF PERSONAL PAYSLIPS VIEW */
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
          <Text style={styles.sectionTitle}>My Official Payslips ({mySlips.length})</Text>
          {mySlips.length > 0 ? (
            <View style={{ gap: 10 }}>
              {mySlips.map((slip, idx) => (
                <View key={slip.id || idx} style={styles.slipCard}>
                  <View style={styles.slipCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slipMonth}>
                        {slip.month_name || `Salary Slip #${slip.id}`}
                      </Text>
                      <Text style={styles.slipYear}>Net Disbursed: ₹{Number(slip.net_salary || slip.amount || 0).toLocaleString('en-IN')}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.downloadSlipBtn}
                      onPress={() => handleDownloadSlipPdf(slip.id)}
                    >
                      <Ionicons name="download" size={15} color="#fff" />
                      <Text style={styles.downloadSlipBtnText}>PDF Slip</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.slipDetailsRow}>
                    <Text style={styles.slipDetailText}>Basic: ₹{Number(slip.basic_salary || 0).toLocaleString('en-IN')}</Text>
                    <Text style={styles.slipDetailText}>Allowances: ₹{Number(slip.total_allowances || 0).toLocaleString('en-IN')}</Text>
                    <Text style={styles.slipDetailText}>Deductions: ₹{Number(slip.total_deductions || 0).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Salary Slips Issued</Text>
              <Text style={styles.emptyCardText}>Your monthly salary slips will appear here once finalized by HR.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Run Detail Modal (Admin) */}
      <Modal
        visible={Boolean(selectedRun)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRun(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {selectedRun?.month_name ? `${selectedRun.month_name} ${selectedRun.year}` : 'Payroll Slips'}
                </Text>
                <Text style={styles.modalSub}>
                  Total: ₹{Number(selectedRun?.total_net_amount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedRun(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {loadingRunDetail ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : runSlips.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {runSlips.map((s, idx) => {
                    const isPaid = s.status === 'PAID';
                    return (
                      <View key={s.id || idx} style={styles.employeeSlipRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empSlipName}>{s.employee_name || s.user_name || `Employee ${idx + 1}`}</Text>
                          <Text style={styles.empSlipSub}>Net: ₹{Number(s.net_salary || 0).toLocaleString('en-IN')}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.pdfIconBtn}
                            onPress={() => handleDownloadSlipPdf(s.id)}
                          >
                            <Ionicons name="document-text-outline" size={16} color="#7c3aed" />
                          </TouchableOpacity>

                          {!isPaid ? (
                            <TouchableOpacity
                              style={styles.payChipBtn}
                              onPress={() => handlePaySlip(s.id)}
                            >
                              <Text style={styles.payChipBtnText}>Pay</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.paidBadge}>
                              <Text style={styles.paidBadgeText}>PAID</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginVertical: 30 }}>
                  No slips found in this run batch.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calculate Payroll Modal */}
      <Modal
        visible={showCalcModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalcModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Run Monthly Payroll</Text>
              <TouchableOpacity onPress={() => setShowCalcModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              Generate automatic monthly salary calculations, allowances, and attendance deductions for all active staff:
            </Text>

            <Text style={styles.inputLabel}>Select Month *</Text>
            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((m, idx) => {
                const mNum = String(idx + 1);
                const sel = calcMonth === mNum;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthChip, sel && styles.monthChipSel]}
                    onPress={() => setCalcMonth(mNum)}
                  >
                    <Text style={[styles.monthChipText, sel && styles.monthChipTextSel]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Year *</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={calcYear}
              onChangeText={setCalcYear}
            />

            <TouchableOpacity
              style={[styles.calcSubmitBtn, calculating && { opacity: 0.6 }]}
              onPress={handleCalculatePayroll}
              disabled={calculating}
            >
              {calculating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={16} color="#fff" />
                  <Text style={styles.calcSubmitBtnText}>Calculate & Generate Batch</Text>
                </>
              )}
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
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  calcBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  runCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  runHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  runTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  runMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPaid: { backgroundColor: '#ecfdf5' },
  statusApproved: { backgroundColor: '#e0f2fe' },
  statusDraft: { backgroundColor: '#fef3c7' },
  statusText: { fontSize: 10, fontWeight: '800' },
  amountTile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },
  amountLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase' },
  amountVal: { fontSize: 16, fontWeight: '800', color: '#0284c7', marginTop: 2 },
  grossVal: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 2 },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  actionBtnSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionBtnSolidText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  slipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  slipCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slipMonth: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  slipYear: { fontSize: 12, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  downloadSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  downloadSlipBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  slipDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  slipDetailText: { fontSize: 11, color: '#64748b' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptyCardText: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  employeeSlipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  empSlipName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  empSlipSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  pdfIconBtn: {
    padding: 6,
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  payChipBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payChipBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  paidBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paidBadgeText: { color: '#059669', fontSize: 10, fontWeight: '800' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 48,
    alignItems: 'center',
  },
  monthChipSel: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  monthChipText: { fontSize: 11, color: '#475569' },
  monthChipTextSel: { color: '#fff', fontWeight: '700' },
  calcSubmitBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  calcSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
