// mob_app/src/screens/leaves/LeavesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function LeavesScreen({ navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipalOrAdmin = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'HR'].includes(role);

  // Common States
  const [filter, setFilter] = useState(isPrincipalOrAdmin ? 'PENDING' : 'ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin States
  const [requests, setRequests] = useState([]);

  // Staff States
  const [myBalances, setMyBalances] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Apply Leave Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Review Modal State (Admin Reject with Remarks)
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [targetReqId, setTargetReqId] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isPrincipalOrAdmin) {
        const params = filter === 'ALL' ? {} : { status: filter };
        const res = await client.get('/hrms/leaves/requests', { params }).catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : res.data?.requests || [];
        setRequests(list);
      } else {
        const [myRes, typeRes] = await Promise.all([
          client.get('/hrms/my/leaves').catch(() => ({ data: {} })),
          client.get('/hrms/leaves/types').catch(() => ({ data: [] })),
        ]);

        const bal = myRes.data?.balances || [];
        const reqs = myRes.data?.requests || (Array.isArray(myRes.data) ? myRes.data : []);
        setMyBalances(bal);
        setMyRequests(reqs);

        const types = Array.isArray(typeRes.data) ? typeRes.data : typeRes.data?.types || [];
        setLeaveTypes(types);
        if (types.length > 0 && !selectedTypeId) {
          setSelectedTypeId(types[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load leaves:', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isPrincipalOrAdmin, filter, selectedTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply for Leave (Staff)
  const handleApplyLeave = async () => {
    if (!selectedTypeId || !fromDate.trim() || !toDate.trim() || !reason.trim()) {
      Alert.alert('Validation Error', 'Please select a leave type, enter From & To dates (YYYY-MM-DD), and state the reason.');
      return;
    }

    setSubmittingLeave(true);
    try {
      await client.post('/hrms/leaves/requests', {
        leave_type_id: selectedTypeId,
        from_date: fromDate.trim(),
        to_date: toDate.trim(),
        reason: reason.trim(),
        is_half_day: isHalfDay,
      });

      Alert.alert('Application Submitted', 'Your leave request has been submitted for principal approval.');
      setShowApplyModal(false);
      setFromDate('');
      setToDate('');
      setReason('');
      setIsHalfDay(false);
      loadData(true);
    } catch (err) {
      Alert.alert('Submission Failed', err.response?.data?.error || 'Could not submit leave application.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Review Leave Request (Admin Approve)
  const handleApprove = (req) => {
    Alert.alert(
      'Approve Leave Request',
      `Approve leave for ${req.employee_name || req.user_name || 'Staff Member'} from ${req.from_date} to ${req.to_date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await client.post(`/hrms/leaves/requests/${req.id}/review`, {
                approve: true,
              });
              Alert.alert('Approved', 'Leave request has been approved.');
              loadData(true);
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to approve leave.');
            }
          },
        },
      ]
    );
  };

  // Review Leave Request (Admin Reject with remarks)
  const handleRejectSubmit = async () => {
    if (!targetReqId) return;
    setReviewing(true);
    try {
      await client.post(`/hrms/leaves/requests/${targetReqId}/review`, {
        approve: false,
        remarks: reviewRemarks.trim() || 'Leave request declined by administrator.',
      });
      Alert.alert('Rejected', 'Leave request has been declined.');
      setReviewModalVisible(false);
      setReviewRemarks('');
      setTargetReqId(null);
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to reject leave.');
    } finally {
      setReviewing(false);
    }
  };

  const displayList = isPrincipalOrAdmin ? requests : myRequests;

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
            <Text style={styles.headerTitle}>Leave Applications</Text>
            <Text style={styles.headerSub}>Quota balances & approvals</Text>
          </View>
        </View>

        {!isPrincipalOrAdmin && (
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => setShowApplyModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.applyBtnText}>Apply Leave</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Staff Leave Balances Ribbon */}
      {!isPrincipalOrAdmin && myBalances.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.balanceRibbon}
        >
          {myBalances.map(b => (
            <View key={b.id} style={styles.balanceCard}>
              <Text style={styles.balanceCode}>{b.leave_type_code || 'LV'}</Text>
              <Text style={styles.balanceRemaining}>{b.remaining_days ?? b.quota ?? 0}</Text>
              <Text style={styles.balanceName}>{b.leave_type_name || 'Leave'}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Status Filter Tabs (For Admin) */}
      {isPrincipalOrAdmin && (
        <View style={styles.filterRow}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => {
            const sel = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, sel && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, sel && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Main Request List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching leave applications...</Text>
        </View>
      ) : (
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
          {displayList.length > 0 ? (
            <View style={{ gap: 12 }}>
              {displayList.map((r, i) => {
                const status = (r.status || 'PENDING').toUpperCase();
                const isPending = status === 'PENDING';
                const isApproved = status === 'APPROVED';
                const isRejected = status === 'REJECTED';

                return (
                  <View key={r.id || i} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.applicantName}>
                          {r.employee_name || r.user_name || user?.name || 'Staff Member'}
                        </Text>
                        <Text style={styles.leaveType}>
                          {r.leave_type || r.leave_type_name || 'General Leave'} • {r.days_count || 1} day(s)
                          {r.is_half_day ? ' (Half-Day)' : ''}
                        </Text>
                      </View>

                      <View style={[
                        styles.statusPill,
                        isApproved ? styles.statusPillApproved :
                        isPending ? styles.statusPillPending : styles.statusPillRejected
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          isApproved ? { color: '#059669' } :
                          isPending ? { color: '#d97706' } : { color: '#dc2626' }
                        ]}>
                          {status}
                        </Text>
                      </View>
                    </View>

                    {/* Dates */}
                    <View style={styles.periodRow}>
                      <Ionicons name="calendar-outline" size={14} color="#64748b" />
                      <Text style={styles.periodText}>
                        {r.from_date}  →  {r.to_date}
                      </Text>
                    </View>

                    {/* Reason */}
                    {r.reason && (
                      <View style={styles.reasonBox}>
                        <Text style={styles.reasonText}>"{r.reason}"</Text>
                      </View>
                    )}

                    {/* Review Remarks if any */}
                    {r.review_remarks && (
                      <View style={styles.remarksBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                        <Text style={styles.remarksText}>Admin Remark: {r.review_remarks}</Text>
                      </View>
                    )}

                    {/* Admin Actions for Pending */}
                    {isPrincipalOrAdmin && isPending && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleApprove(r)}
                        >
                          <Ionicons name="checkmark-outline" size={15} color="#fff" />
                          <Text style={styles.actionBtnText}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => {
                            setTargetReqId(r.id);
                            setReviewModalVisible(true);
                          }}
                        >
                          <Ionicons name="close-outline" size={15} color="#fff" />
                          <Text style={styles.actionBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Leave Applications</Text>
              <Text style={styles.emptyCardText}>There are no {filter.toLowerCase()} leave requests.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Apply Leave Modal */}
      <Modal
        visible={showApplyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApplyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Leave Type selector */}
              <Text style={styles.inputLabel}>Select Leave Category *</Text>
              <View style={styles.typeGrid}>
                {leaveTypes.map(t => {
                  const sel = selectedTypeId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, sel && styles.typeChipSel]}
                      onPress={() => setSelectedTypeId(t.id)}
                    >
                      <Text style={[styles.typeChipText, sel && styles.typeChipTextSel]}>
                        {t.name || t.code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={fromDate}
                    onChangeText={setFromDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={toDate}
                    onChangeText={setToDate}
                  />
                </View>
              </View>

              {/* Half Day Option */}
              <TouchableOpacity
                style={styles.halfDayRow}
                onPress={() => setIsHalfDay(!isHalfDay)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isHalfDay ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isHalfDay ? '#0284c7' : '#94a3b8'}
                />
                <Text style={styles.halfDayLabel}>Apply as Half-Day Leave</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Reason / Remarks *</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Reason for requesting leave..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={reason}
                onChangeText={setReason}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, submittingLeave && { opacity: 0.6 }]}
              onPress={handleApplyLeave}
              disabled={submittingLeave}
            >
              {submittingLeave ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.modalSubmitBtnText}>Submit Leave Application</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Review Remarks Modal (Admin Reject) */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decline Leave Application</Text>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
              Specify the reason for declining this request:
            </Text>

            <TextInput
              style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="e.g. Critical examination duties on requested dates..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={reviewRemarks}
              onChangeText={setReviewRemarks}
            />

            <TouchableOpacity
              style={[styles.rejectSubmitBtn, reviewing && { opacity: 0.6 }]}
              onPress={handleRejectSubmit}
              disabled={reviewing}
            >
              {reviewing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color="#fff" />
                  <Text style={styles.modalSubmitBtnText}>Confirm Decline</Text>
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
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  balanceRibbon: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  balanceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    minWidth: 80,
  },
  balanceCode: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  balanceRemaining: { fontSize: 18, fontWeight: '800', color: '#0284c7', marginVertical: 1 },
  balanceName: { fontSize: 10, color: '#475569' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  filterBtnActive: { backgroundColor: '#0284c7' },
  filterText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  applicantName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  leaveType: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillApproved: { backgroundColor: '#ecfdf5' },
  statusPillPending: { backgroundColor: '#fef3c7' },
  statusPillRejected: { backgroundColor: '#fef2f2' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  periodText: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  reasonBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reasonText: { fontSize: 12, color: '#475569', fontStyle: 'italic' },
  remarksBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  remarksText: { fontSize: 11, color: '#92400e' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtn: { backgroundColor: '#16a34a' },
  rejectBtn: { backgroundColor: '#dc2626' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipSel: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  typeChipText: { fontSize: 12, color: '#475569' },
  typeChipTextSel: { color: '#fff', fontWeight: '600' },
  halfDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  halfDayLabel: { fontSize: 13, color: '#334155' },
  modalSubmitBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  modalSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rejectSubmitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
});
