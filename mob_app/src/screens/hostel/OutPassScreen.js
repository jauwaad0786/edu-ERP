// mob_app/src/screens/hostel/OutPassScreen.js
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

const PASS_TYPES = ['DAY_OUTING', 'WEEKEND', 'HOLIDAY', 'EMERGENCY'];

const STATUS_CONFIG = {
  REQUESTED: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  APPROVED:  { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
  OUT:       { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' },
  RETURNED:  { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' },
  REJECTED:  { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
};

export default function OutPassScreen({ navigation }) {
  const { user } = useAuth();
  const isStudent = (user?.role === 'STUDENT');
  const canApprove = ['HOSTEL', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Request Modal State (for students)
  const [requestModal, setRequestModal] = useState(false);
  const [passType, setPassType] = useState('DAY_OUTING');
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [outDate, setOutDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Reject Modal State (for wardens)
  const [rejectModal, setRejectModal] = useState(false);
  const [targetPassId, setTargetPassId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Load passes
  const loadPasses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hostel/out-passes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.out_passes || res.data?.data || []);
      setPasses(list);
    } catch {
      setPasses([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPasses();
  }, [loadPasses]);

  // Request Pass (Student)
  const handleRequestPass = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a reason for out-pass.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Required', 'Please specify destination.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/hostel/out-passes', {
        pass_type: passType,
        reason: reason.trim(),
        destination: destination.trim(),
        guardian_contact: guardianContact.trim(),
        out_time: `${outDate}T09:00:00`,
        expected_return: `${returnDate}T18:00:00`,
      });

      Alert.alert('Permit Requested', 'Out-pass application sent to hostel warden for approval.');
      setRequestModal(false);
      setReason('');
      setDestination('');
      setGuardianContact('');
      loadPasses(true);
    } catch (err) {
      Alert.alert('Failed', err?.response?.data?.error || 'Could not submit out-pass request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Status (Warden / Admin)
  const handleUpdateStatus = async (passId, newStatus, reasonText = '') => {
    try {
      await client.patch(`/hostel/out-passes/${passId}/status`, {
        status: newStatus,
        rejection_reason: reasonText,
      });

      Alert.alert('Pass Updated', `Out pass status marked as ${newStatus}.`);
      loadPasses(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update pass.');
    }
  };

  // Reject Submit
  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Required', 'Please enter reason for rejection.');
      return;
    }

    setRejecting(true);
    try {
      await handleUpdateStatus(targetPassId, 'REJECTED', rejectionReason.trim());
      setRejectModal(false);
      setTargetPassId(null);
      setRejectionReason('');
    } finally {
      setRejecting(false);
    }
  };

  // KPIs
  const totalCount = passes.length;
  const requestedCount = passes.filter(p => p.status === 'REQUESTED').length;
  const approvedCount = passes.filter(p => p.status === 'APPROVED').length;
  const outCount = passes.filter(p => p.status === 'OUT').length;

  // Filtered List
  const filteredPasses = passes.filter(p => {
    if (activeFilter === 'ALL') return true;
    return p.status === activeFilter;
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
            <Text style={styles.headerTitle}>Hostel Out-Passes</Text>
            <Text style={styles.headerSub}>Gate Permits, Weekend Leaves & Consents</Text>
          </View>
        </View>

        {isStudent && (
          <TouchableOpacity style={styles.applyBtn} onPress={() => setRequestModal(true)}>
            <Ionicons name="add" size={16} color="#3730a3" />
            <Text style={styles.applyBtnText}>Apply Pass</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiValue}>{totalCount}</Text>
          <Text style={styles.kpiLabel}>TOTAL PASSES</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#d97706' }]}>{requestedCount}</Text>
          <Text style={styles.kpiLabel}>PENDING</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{approvedCount}</Text>
          <Text style={styles.kpiLabel}>APPROVED</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{outCount}</Text>
          <Text style={styles.kpiLabel}>OUT AT GATE</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { key: 'ALL', label: `All (${totalCount})` },
            { key: 'REQUESTED', label: `Pending (${requestedCount})` },
            { key: 'APPROVED', label: `Approved (${approvedCount})` },
            { key: 'OUT', label: `Out at Gate (${outCount})` },
            { key: 'RETURNED', label: 'Returned' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3730a3" />
          <Text style={styles.loadingText}>Fetching gate permits...</Text>
        </View>
      ) : filteredPasses.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPasses(true)} colors={['#3730a3']} />}
        >
          <Ionicons name="exit-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Out-Passes Found</Text>
          <Text style={styles.emptySub}>No gate permit requests matching current filter.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPasses(true)} colors={['#3730a3']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredPasses.map((p, idx) => {
            const conf = STATUS_CONFIG[p.status] || STATUS_CONFIG.REQUESTED;
            const isPending = p.status === 'REQUESTED';
            const isApproved = p.status === 'APPROVED';
            const isOut = p.status === 'OUT';

            return (
              <View key={p.id || idx} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{p.student_name || 'Resident Student'}</Text>
                    <Text style={styles.cardSub}>
                      Room #{p.room_number || '—'} • Bed #{p.bed_number || '1'}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: conf.bg, borderColor: conf.border }]}>
                    <Text style={[styles.statusBadgeText, { color: conf.text }]}>
                      {p.status}
                    </Text>
                  </View>
                </View>

                {/* Reason & Destination */}
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>PURPOSE & DESTINATION</Text>
                  <Text style={styles.reasonText}>{p.reason || 'General Outing'}</Text>
                  {p.destination ? (
                    <Text style={styles.destText}>📍 {p.destination}</Text>
                  ) : null}
                </View>

                {/* Schedule times */}
                <View style={styles.timeGrid}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>EXPECTED DEPARTURE</Text>
                    <Text style={styles.timeVal}>
                      {p.out_time ? new Date(p.out_time).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeLabel}>EXPECTED RETURN</Text>
                    <Text style={styles.timeVal}>
                      {p.expected_return ? new Date(p.expected_return).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>

                {p.guardian_contact ? (
                  <Text style={styles.guardianText}>
                    Emergency/Guardian Contact: {p.guardian_contact}
                  </Text>
                ) : null}

                {/* Actions for Wardens */}
                {canApprove && (
                  <View style={styles.actionRow}>
                    {isPending ? (
                      <>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleUpdateStatus(p.id, 'APPROVED')}
                        >
                          <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() => {
                            setTargetPassId(p.id);
                            setRejectModal(true);
                          }}
                        >
                          <Ionicons name="close-circle" size={15} color="#dc2626" />
                          <Text style={styles.rejectBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </>
                    ) : isApproved ? (
                      <TouchableOpacity
                        style={styles.outBtn}
                        onPress={() => handleUpdateStatus(p.id, 'OUT')}
                      >
                        <Ionicons name="exit" size={14} color="#ffffff" />
                        <Text style={styles.outBtnText}>Log Gate Exit (Student Left)</Text>
                      </TouchableOpacity>
                    ) : isOut ? (
                      <TouchableOpacity
                        style={styles.returnedBtn}
                        onPress={() => handleUpdateStatus(p.id, 'RETURNED')}
                      >
                        <Ionicons name="enter" size={14} color="#ffffff" />
                        <Text style={styles.returnedBtnText}>Log Return to Campus</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Apply Out-Pass Modal (Student) */}
      <Modal
        visible={requestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Apply Hostel Out-Pass</Text>
                <Text style={styles.modalSub}>Gate permit request for warden approval</Text>
              </View>
              <TouchableOpacity onPress={() => setRequestModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>PERMIT CATEGORY</Text>
              <View style={styles.typeSelectorRow}>
                {PASS_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, passType === t && styles.typeChipActive]}
                    onPress={() => setPassType(t)}
                  >
                    <Text style={[styles.typeText, passType === t && styles.typeTextActive]}>
                      {t.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>DESTINATION (LOCATION / ADDRESS) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Home, Market, Doctor appointment"
                placeholderTextColor="#94a3b8"
                value={destination}
                onChangeText={setDestination}
              />

              <Text style={styles.inputLabel}>REASON FOR PASS *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Family function over the weekend"
                placeholderTextColor="#94a3b8"
                value={reason}
                onChangeText={setReason}
              />

              <Text style={styles.inputLabel}>PARENT / GUARDIAN CONTACT *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={guardianContact}
                onChangeText={setGuardianContact}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>DEPARTURE DATE</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={outDate}
                    onChangeText={setOutDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>RETURN DATE</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={returnDate}
                    onChangeText={setReturnDate}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleRequestPass}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Submit Application</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reject Modal (Warden) */}
      <Modal
        visible={rejectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Decline Out-Pass</Text>
                <Text style={styles.modalSub}>Provide justification for rejecting permit</Text>
              </View>
              <TouchableOpacity onPress={() => setRejectModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Incomplete parent consent / Exam schedule pending"
              placeholderTextColor="#94a3b8"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />

            <TouchableOpacity
              style={[styles.rejectConfirmBtn, rejecting && { opacity: 0.7 }]}
              onPress={handleRejectConfirm}
              disabled={rejecting}
            >
              {rejecting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.rejectConfirmBtnText}>Decline Permit</Text>
              )}
            </TouchableOpacity>
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
    justifyContent: 'space-between',
    backgroundColor: '#3730a3',
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
    color: '#c7d2fe',
    marginTop: 1,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730a3',
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
  filterSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3730a3',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reasonBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  destText: {
    fontSize: 11,
    color: '#4338ca',
    marginTop: 2,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  timeCol: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  timeVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  guardianText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 4,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  outBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    borderRadius: 8,
  },
  outBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  returnedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 9,
    borderRadius: 8,
  },
  returnedBtnText: {
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
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipActive: {
    backgroundColor: '#3730a3',
    borderColor: '#3730a3',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  typeTextActive: {
    color: '#ffffff',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3730a3',
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
  rejectConfirmBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  rejectConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
