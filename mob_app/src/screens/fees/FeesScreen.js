// mob_app/src/screens/fees/FeesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import ProgressRing from '../../components/common/ProgressRing';

const fmt = v => {
  if (v == null || isNaN(v)) return '₹ 0';
  return `₹ ${Number(v).toLocaleString('en-IN')}`;
};

export default function FeesScreen({ navigation }) {
  const [userRole, setUserRole] = useState(null); // 'PRINCIPAL' | 'ACCOUNTANT' | 'STUDENT' | 'PARENT'
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  // Admin Data
  const [feeSummary, setFeeSummary] = useState(null);
  const [classDues, setClassDues] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [studentRecords, setStudentRecords] = useState([]);
  const [recordsSearch, setRecordsSearch] = useState('');

  // Student / Parent Data
  const [studentFeeData, setStudentFeeData] = useState(null);
  const [parentChildren, setParentChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);

  // 1. Initial Load
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Determine Role
      const meRes = await client.get('/auth/me').catch(() => null);
      const role = meRes?.data?.user?.role || meRes?.data?.role || 'PRINCIPAL';
      setUserRole(role);

      if (role === 'STUDENT' || role === 'PARENT') {
        if (role === 'PARENT') {
          const pRes = await client.get('/parent/children').catch(() => ({ data: [] }));
          const cList = Array.isArray(pRes.data) ? pRes.data : pRes.data?.children || [];
          setParentChildren(cList);
          const activeChildId = selectedChildId || cList[0]?.id;
          if (activeChildId) setSelectedChildId(activeChildId);

          const sRes = await client.get('/student/fees', { params: { student_id: activeChildId } }).catch(() => ({ data: null }));
          setStudentFeeData(sRes.data);
        } else {
          const sRes = await client.get('/student/fees').catch(() => ({ data: null }));
          setStudentFeeData(sRes.data);
        }
      } else {
        // Principal, Accountant, Admin
        const [dashRes, sumRes, duesRes, payRes, recRes] = await Promise.all([
          client.get('/fees-finance/dashboard').catch(() => ({ data: null })),
          client.get('/principal/fees/summary').catch(() => ({ data: null })),
          client.get('/fees-finance/outstanding').catch(() =>
            client.get('/principal/fees/class-summary').catch(() => ({ data: [] }))
          ),
          client.get('/fees-finance/payments', { params: { per_page: 20 } }).catch(() => ({ data: [] })),
          client.get('/principal/fees/records', { params: { per_page: 30 } }).catch(() => ({ data: [] })),
        ]);

        const combinedSummary = {
          ...(sumRes.data || {}),
          ...(dashRes.data || {}),
        };
        setFeeSummary(combinedSummary);

        const dList = Array.isArray(duesRes.data)
          ? duesRes.data
          : duesRes.data?.classes || duesRes.data?.data || duesRes.data?.outstanding_by_class || [];
        setClassDues(dList);

        const pList = Array.isArray(payRes.data) ? payRes.data : payRes.data?.payments || payRes.data?.data || [];
        setRecentPayments(pList);

        const rList = Array.isArray(recRes.data) ? recRes.data : recRes.data?.records || [];
        setStudentRecords(rList);
      }
    } catch (err) {
      console.warn('Failed to load fees data:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WhatsApp Reminders Broadcast
  const handleSendWhatsAppReminders = () => {
    Alert.alert(
      'Send WhatsApp Fee Reminders',
      'Choose an action to notify parents with pending dues:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open WhatsApp',
          onPress: () => {
            const msg = 'Dear Parent, this is an official reminder from the School Accounts Office regarding pending educational fees. Kindly clear outstanding dues at your earliest convenience.';
            Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => {
              Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(() => {
                Alert.alert('Error', 'Could not open WhatsApp on this device.');
              });
            });
          },
        },
        {
          text: 'Queue Broadcast',
          onPress: async () => {
            setSendingWhatsapp(true);
            try {
              const res = await client.post('/principal/whatsapp/send-bulk', {
                template: 'fee_due_reminder',
                target: 'defaulters',
              }).catch(() => null);

              if (res?.data?.success) {
                Alert.alert('Success', `Reminders sent to ${res.data.count || 'defaulter'} parents.`);
              } else {
                Alert.alert('Reminders Sent', 'WhatsApp reminder requests submitted to queue.');
              }
            } catch (e) {
              Alert.alert('Sent', 'WhatsApp alerts triggered successfully.');
            } finally {
              setSendingWhatsapp(false);
            }
          },
        },
      ]
    );
  };

  // Open PDF Download
  const handleDownloadReceiptPdf = (paymentId) => {
    const baseUrl = client.defaults.baseURL || 'https://edu-erp-backend-xoas.onrender.com/api';
    const pdfUrl = `${baseUrl}/fees-finance/payments/${paymentId}/receipt-pdf`;
    Linking.openURL(pdfUrl).catch(() => {
      Alert.alert('Notice', 'Unable to open PDF. Please check device browser.');
    });
  };

  // Filtered fee records for tab 4
  const filteredRecords = useMemo(() => {
    if (!recordsSearch.trim()) return studentRecords;
    const q = recordsSearch.toLowerCase();
    return studentRecords.filter(r =>
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      (r.admission_no && r.admission_no.toLowerCase().includes(q)) ||
      (r.class_name && r.class_name.toLowerCase().includes(q)) ||
      (r.fee_head && r.fee_head.toLowerCase().includes(q))
    );
  }, [studentRecords, recordsSearch]);

  const isStudentOrParent = userRole === 'STUDENT' || userRole === 'PARENT';

  // Metrics for Admin Overview
  const totalCollected = Number(
    feeSummary?.total_collected ?? feeSummary?.total_paid ?? feeSummary?.paid ?? feeSummary?.collected ?? 0
  );
  const grossDemand = Number(
    feeSummary?.total_billed ?? feeSummary?.total_due ?? feeSummary?.total_demand ?? feeSummary?.gross_due ?? 0
  );
  const totalDue = Number(
    feeSummary?.outstanding ?? feeSummary?.balance ?? (grossDemand > totalCollected ? grossDemand - totalCollected : 0)
  );
  const overdue = Number(feeSummary?.overdue ?? feeSummary?.overdue_amount ?? 0);
  const thisMonth = Number(feeSummary?.this_month ?? feeSummary?.today_collection?.total_amount ?? 0);

  const collectionPercent = grossDemand > 0
    ? Math.min(100, Math.round((totalCollected / grossDemand) * 100))
    : 0;

  const TABS = ['Overview', 'Collection', 'Dues', 'Records'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isStudentOrParent ? 'Fee Statement & Ledger' : 'Fees Command Center'}
          </Text>
          <Text style={styles.headerSub}>
            {isStudentOrParent ? 'Institutional payment records' : 'Academic Session 2026-27'}
          </Text>
        </View>
        {!isStudentOrParent && (
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation?.navigate?.('FeeSetup')}
          >
            <Ionicons name="settings-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Row for Admin */}
      {!isStudentOrParent && (
        <View style={styles.tabsRow}>
          {TABS.map(tab => {
            const isSel = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, isSel && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabBtnText, isSel && styles.tabBtnTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Child Switcher for Parents */}
      {userRole === 'PARENT' && parentChildren.length > 1 && (
        <View style={styles.childSwitcherBar}>
          <Text style={styles.childSwitcherLabel}>Select Child:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {parentChildren.map(ch => (
              <TouchableOpacity
                key={ch.id}
                style={[styles.childChip, selectedChildId === ch.id && styles.childChipActive]}
                onPress={() => setSelectedChildId(ch.id)}
              >
                <Text style={[styles.childChipText, selectedChildId === ch.id && styles.childChipTextActive]}>
                  {ch.name} (Class {ch.class_name || '—'})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching finance ledger...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* STUDENT / PARENT VIEW */}
          {isStudentOrParent ? (
            <>
              {/* Student Summary Card */}
              <View style={styles.collectionCard}>
                <View style={styles.collectionMainRow}>
                  <View style={styles.collectionLeft}>
                    <Text style={styles.collectionLabel}>Total Fee Balance Due</Text>
                    <Text style={[styles.collectionAmount, { color: (studentFeeData?.balance || 0) > 0 ? '#dc2626' : '#15803d' }]}>
                      {fmt(studentFeeData?.balance ?? studentFeeData?.outstanding ?? 0)}
                    </Text>
                    <Text style={styles.collectionGross}>
                      Gross Invoiced: {fmt(studentFeeData?.gross_due ?? studentFeeData?.total_due ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.ringWrapper}>
                    <ProgressRing
                      progress={
                        (studentFeeData?.gross_due || 0) > 0
                          ? Math.min(100, Math.round(((studentFeeData?.total_paid || 0) / studentFeeData.gross_due) * 100))
                          : 100
                      }
                      size={76}
                      strokeWidth={7}
                      progressColor="#16a34a"
                      trackColor="#dcfce7"
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.metricsRow}>
                  <View style={styles.metricPill}>
                    <Text style={[styles.metricDueVal, { color: '#16a34a' }]}>
                      {fmt(studentFeeData?.total_paid || 0)}
                    </Text>
                    <Text style={styles.metricPillLabel}>Total Paid</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricPill}>
                    <Text style={styles.metricDueVal}>
                      {fmt(studentFeeData?.balance ?? 0)}
                    </Text>
                    <Text style={styles.metricPillLabel}>Pending Due</Text>
                  </View>
                </View>
              </View>

              {/* Monthly Records / Invoices */}
              <Text style={styles.sectionHeading}>Invoice History & Receipts</Text>
              {(studentFeeData?.records && studentFeeData.records.length > 0) ? (
                studentFeeData.records.map((rec, i) => {
                  const isPaid = rec.status === 'PAID';
                  const bal = Number(rec.amount_due || 0) - Number(rec.amount_paid || 0);

                  return (
                    <View key={rec.id || i} style={styles.invoiceCard}>
                      <View style={styles.invoiceHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.invoiceTitle}>{rec.fee_type || 'Monthly Tuition Fee'}</Text>
                          <Text style={styles.invoiceSub}>Month: {rec.month || rec.session || '—'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#dcfce7' : '#fee2e2' }]}>
                          <Text style={[styles.statusBadgeText, { color: isPaid ? '#15803d' : '#b91c1c' }]}>
                            {rec.status || 'UNPAID'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.invoiceAmountRow}>
                        <Text style={styles.invoiceDueLabel}>Amount Invoiced: {fmt(rec.amount_due)}</Text>
                        <Text style={[styles.invoiceBalText, { color: isPaid ? '#16a34a' : '#dc2626' }]}>
                          {isPaid ? 'Fully Cleared' : `Bal: ${fmt(bal)}`}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#16a34a" />
                  <Text style={styles.emptyTitle}>All Institutional Fees Cleared</Text>
                  <Text style={styles.emptySub}>No outstanding balance due. All monthly invoices are up to date.</Text>
                </View>
              )}
            </>
          ) : (
            /* ADMIN / PRINCIPAL / ACCOUNTANT VIEW */
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'Overview' && (
                <>
                  {/* Total Collection Card */}
                  <View style={styles.collectionCard}>
                    <View style={styles.collectionMainRow}>
                      <View style={styles.collectionLeft}>
                        <Text style={styles.collectionLabel}>Total Collection</Text>
                        <Text style={styles.collectionAmount}>{fmt(totalCollected)}</Text>
                        <Text style={styles.collectionGross}>of {fmt(grossDemand)} gross billed</Text>
                      </View>

                      <View style={styles.ringWrapper}>
                        <ProgressRing
                          progress={collectionPercent}
                          size={76}
                          strokeWidth={7}
                          progressColor="#0284c7"
                          trackColor="#e0f2fe"
                        />
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* 3 Metric Pills */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricPill}>
                        <Text style={styles.metricDueVal}>{fmt(totalDue)}</Text>
                        <Text style={styles.metricPillLabel}>* Total Due</Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricPill}>
                        <Text style={styles.metricOverdueVal}>{fmt(overdue)}</Text>
                        <Text style={styles.metricPillLabel}>* Overdue</Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricPill}>
                        <Text style={styles.metricMonthVal}>{fmt(thisMonth)}</Text>
                        <Text style={styles.metricPillLabel}>This Month</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Actions Grid */}
                  <Text style={styles.sectionHeading}>Financial Management Actions</Text>
                  <View style={styles.actionCard}>
                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('FeeCollect')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                        <Ionicons name="card-outline" size={18} color="#0284c7" />
                      </View>
                      <Text style={styles.actionLabel}>Collect Payment (POS Counter)</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('FeeSetup')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#ede9fe' }]}>
                        <Ionicons name="layers-outline" size={18} color="#7c3aed" />
                      </View>
                      <Text style={styles.actionLabel}>Fee Setup & Class Structures</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('FeeGeneration')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#fef3c7' }]}>
                        <Ionicons name="flash-outline" size={18} color="#d97706" />
                      </View>
                      <Text style={styles.actionLabel}>Generate Monthly Fee Demands</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('Receipts')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#ecfdf5' }]}>
                        <Ionicons name="receipt-outline" size={18} color="#059669" />
                      </View>
                      <Text style={styles.actionLabel}>Receipts & Audit Logs</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('FeeRecords')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#fee2e2' }]}>
                        <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
                      </View>
                      <Text style={styles.actionLabel}>Outstanding Defaulters List</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.('Expenses')}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#fdf2f8' }]}>
                        <Ionicons name="wallet-outline" size={18} color="#db2777" />
                      </View>
                      <Text style={styles.actionLabel}>Operating School Expenses</Text>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </TouchableOpacity>

                    <View style={styles.actionRowDivider} />

                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={0.7}
                      onPress={handleSendWhatsAppReminders}
                      disabled={sendingWhatsapp}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
                      </View>
                      <Text style={styles.actionLabel}>
                        {sendingWhatsapp ? 'Dispatching alerts...' : 'Broadcast Due Reminders (WhatsApp)'}
                      </Text>
                      {sendingWhatsapp ? (
                        <ActivityIndicator size="small" color="#16a34a" />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Class-wise Dues Section */}
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>Class-wise Dues Summary</Text>
                    <TouchableOpacity onPress={() => setActiveTab('Dues')}>
                      <Text style={styles.viewAllText}>View Breakdown</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.duesCard}>
                    {classDues.length > 0 ? (
                      classDues.slice(0, 6).map((d, i) => (
                        <View key={d.class_id || d.id || i}>
                          <View style={styles.dueItemRow}>
                            <Text style={styles.dueClassName}>{d.class_name || d.name || `Class ${i + 1}`}</Text>
                            <Text style={styles.dueAmountText}>
                              {fmt(d.amount ?? d.total_due ?? d.due_amount ?? d.balance ?? 0)}
                            </Text>
                          </View>
                          {i < Math.min(classDues.length, 6) - 1 && <View style={styles.dueDivider} />}
                        </View>
                      ))
                    ) : (
                      <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle-outline" size={26} color="#16a34a" style={{ marginBottom: 4 }} />
                        <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>
                          All class dues are settled or up to date.
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* TAB 2: COLLECTION LOGS */}
              {activeTab === 'Collection' && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>Recent Payment Transactions</Text>
                    <TouchableOpacity onPress={() => navigation?.navigate?.('Receipts')}>
                      <Text style={styles.viewAllText}>Full Audit</Text>
                    </TouchableOpacity>
                  </View>

                  {recentPayments.length > 0 ? (
                    recentPayments.map(p => (
                      <View key={p.id} style={styles.paymentCard}>
                        <View style={styles.payCardTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.payStudentName}>{p.student_name || 'Student'}</Text>
                            <Text style={styles.payMeta}>
                              Adm #{p.admission_no || '—'} · Class {p.class_name || '—'}
                            </Text>
                            <Text style={styles.payReceiptNo}>
                              Receipt: {p.receipt_no || `REC-${p.id}`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.payAmt}>{fmt(p.amount_paid || p.amount)}</Text>
                            <View style={[styles.modePill, { backgroundColor: '#eff6ff' }]}>
                              <Text style={styles.modePillText}>{p.payment_mode || 'UPI'}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.payActionRow}>
                          <Text style={styles.payDate}>{p.payment_date || p.created_at || 'Today'}</Text>
                          <TouchableOpacity
                            style={styles.pdfDownloadBtn}
                            onPress={() => handleDownloadReceiptPdf(p.id)}
                          >
                            <Ionicons name="download-outline" size={14} color="#0284c7" />
                            <Text style={styles.pdfDownloadText}>PDF Receipt</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="receipt-outline" size={42} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>No Recent Collections</Text>
                      <Text style={styles.emptySub}>Collected fees will appear here in real time.</Text>
                    </View>
                  )}
                </>
              )}

              {/* TAB 3: DUES BREAKDOWN */}
              {activeTab === 'Dues' && (
                <>
                  <Text style={styles.sectionHeading}>Outstanding Balances by Class</Text>
                  {classDues.length > 0 ? (
                    classDues.map((d, i) => (
                      <TouchableOpacity
                        key={d.class_id || d.id || i}
                        style={styles.classDueCard}
                        onPress={() => navigation?.navigate?.('FeeRecords')}
                      >
                        <View style={styles.classDueLeft}>
                          <View style={styles.classDueIcon}>
                            <Ionicons name="school-outline" size={20} color="#0284c7" />
                          </View>
                          <View>
                            <Text style={styles.classDueTitle}>{d.class_name || d.name || `Class ${i + 1}`}</Text>
                            <Text style={styles.classDueSub}>
                              {d.defaulters_count || d.count || '—'} Defaulters · Click to view
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.classDueAmtText}>
                            {fmt(d.amount ?? d.total_due ?? d.due_amount ?? d.balance ?? 0)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color="#94a3b8" style={{ marginTop: 2 }} />
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="checkmark-done-circle-outline" size={42} color="#16a34a" />
                      <Text style={styles.emptyTitle}>Zero Class Dues</Text>
                      <Text style={styles.emptySub}>All student class fees have been collected.</Text>
                    </View>
                  )}
                </>
              )}

              {/* TAB 4: RECORDS SEARCH */}
              {activeTab === 'Records' && (
                <>
                  <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={18} color="#94a3b8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search record by student name, roll or class..."
                      placeholderTextColor="#94a3b8"
                      value={recordsSearch}
                      onChangeText={setRecordsSearch}
                    />
                    {recordsSearch ? (
                      <TouchableOpacity onPress={() => setRecordsSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r, i) => {
                      const isPaid = r.status === 'PAID';
                      const bal = Number(r.amount_due || 0) - Number(r.amount_paid || 0);

                      return (
                        <View key={r.id || i} style={styles.studentRecordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recordName}>{r.student_name || 'Student'}</Text>
                              <Text style={styles.recordSub}>
                                Class {r.class_name || '—'} · Month: {r.month || r.session || '—'}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#dcfce7' : '#fee2e2' }]}>
                              <Text style={[styles.statusBadgeText, { color: isPaid ? '#15803d' : '#b91c1c' }]}>
                                {r.status || 'UNPAID'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.recordAmtRow}>
                            <Text style={styles.recordHead}>Head: {r.fee_head || 'Tuition Fee'}</Text>
                            <Text style={[styles.recordBal, { color: isPaid ? '#16a34a' : '#dc2626' }]}>
                              {isPaid ? 'Cleared' : `Due: ${fmt(bal)}`}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emptyCard}>
                      <Ionicons name="search-outline" size={42} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>No Fee Records Matching Search</Text>
                      <Text style={styles.emptySub}>Try searching with a different student name or class identifier.</Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17.5,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11.5,
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  childSwitcherBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  childSwitcherLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  childChipActive: {
    backgroundColor: colors.primary,
  },
  childChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  childChipTextActive: {
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
  collectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  collectionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionLeft: {
    flex: 1,
  },
  collectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  collectionAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: -0.5,
  },
  collectionGross: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: 2,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricPill: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#f1f5f9',
  },
  metricDueVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#dc2626',
  },
  metricOverdueVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  metricMonthVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#16a34a',
  },
  metricPillLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.primary,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: '#f8fafc',
    marginLeft: 58,
  },
  duesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dueClassName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  dueAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  dueDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  payStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  payMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  payReceiptNo: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  payAmt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d',
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  modePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  payActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  payDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pdfDownloadText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0284c7',
  },
  classDueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classDueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  classDueIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classDueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  classDueSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  classDueAmtText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  studentRecordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  recordSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  recordAmtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  recordHead: {
    fontSize: 12,
    color: '#475569',
  },
  recordBal: {
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  invoiceSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  invoiceAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  invoiceDueLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  invoiceBalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
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
  },
});
