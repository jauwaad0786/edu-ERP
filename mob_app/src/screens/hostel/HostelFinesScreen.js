// mob_app/src/screens/hostel/HostelFinesScreen.js
// Hostel Fines & Disciplinary Penalties — 100% mirrors Web ERP HostelFines.jsx
// Handles disciplinary charges, damages, fine collections, and management waivers.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const REASON_LABELS = {
  FURNITURE_DAMAGE: 'Furniture / Asset Damage',
  LATE_ENTRY: 'Curfew / Late Entry',
  NOISE_VIOLATION: 'Noise / Disturbance',
  CLEANLINESS: 'Room Cleanliness Violation',
  SMOKING_ALCOHOL: 'Substance / Alcohol Policy',
  UNAUTHORIZED_GUEST: 'Unauthorized Overnight Guest',
  OTHER: 'General Disciplinary Penalty',
};

export default function HostelFinesScreen({ navigation }) {
  const [fines, setFines] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Levy Fine Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reason, setReason] = useState('FURNITURE_DAMAGE');
  const [fineAmount, setFineAmount] = useState('');
  const [fineDesc, setFineDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Collect Payment Modal
  const [collectTarget, setCollectTarget] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMode, setCollectMode] = useState('CASH');
  const [collectRemarks, setCollectRemarks] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Waive Modal
  const [waiveTarget, setWaiveTarget] = useState(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiving, setWaiving] = useState(false);

  const fetchFines = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await client.get('/hostel/fines', { params });
      setFines(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load hostel fine records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  // Search Eligible Resident Students for Fine
  useEffect(() => {
    if (!showCreateModal || selectedStudent || studentQuery.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await client.get('/hostel/admissions', { params: { search: studentQuery.trim() } });
        setStudentResults(res.data || []);
      } catch (e) {
        setStudentResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, showCreateModal, selectedStudent]);

  const handleCreateFine = async () => {
    if (!selectedStudent) {
      Alert.alert('Required', 'Please select a hostel resident.');
      return;
    }
    if (!fineAmount || parseFloat(fineAmount) <= 0) {
      Alert.alert('Required', 'Please enter a valid fine amount.');
      return;
    }
    try {
      setCreating(true);
      await client.post('/hostel/fines', {
        student_id: selectedStudent.student_id,
        reason,
        amount: parseFloat(fineAmount),
        description: fineDesc,
      });
      Alert.alert('Fine Levied', `₹${fineAmount} fine assessed against ${selectedStudent.student_name}.`);
      setShowCreateModal(false);
      setSelectedStudent(null);
      setFineAmount('');
      setFineDesc('');
      fetchFines();
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Failed to raise fine');
    } finally {
      setCreating(false);
    }
  };

  const handleCollectFine = async () => {
    if (!collectAmount || parseFloat(collectAmount) <= 0) {
      Alert.alert('Required', 'Please enter a valid payment amount.');
      return;
    }
    try {
      setCollecting(true);
      await client.post(`/hostel/fines/${collectTarget.id}/pay`, {
        amount: parseFloat(collectAmount),
        payment_mode: collectMode,
        remarks: collectRemarks,
      });
      Alert.alert('Payment Recorded', `₹${collectAmount} received for fine.`);
      setCollectTarget(null);
      fetchFines();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to record fine payment');
    } finally {
      setCollecting(false);
    }
  };

  const handleWaiveFine = async () => {
    try {
      setWaiving(true);
      await client.post(`/hostel/fines/${waiveTarget.id}/waive`, {
        reason: waiveReason || 'Discretionary waiver granted',
      });
      Alert.alert('Fine Waived', `Outstanding fine amount waived for ${waiveTarget.student_name}.`);
      setWaiveTarget(null);
      setWaiveReason('');
      fetchFines();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to waive fine');
    } finally {
      setWaiving(false);
    }
  };

  const renderFineCard = ({ item }) => {
    const isPaid = (item.status || '').toUpperCase() === 'PAID';
    const isWaived = (item.status || '').toUpperCase() === 'WAIVED';
    const isPending = !isPaid && !isWaived;

    const badgeBg = isPaid ? '#dcfce7' : isWaived ? '#f1f5f9' : '#fee2e2';
    const badgeColor = isPaid ? '#15803d' : isWaived ? '#64748b' : '#dc2626';

    return (
      <View style={styles.fineCard}>
        <View style={styles.fineHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{item.student_name || 'Resident'}</Text>
            <Text style={styles.fineReasonTag}>
              {REASON_LABELS[item.reason] || item.reason || 'Hostel Fine'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status || 'PENDING'}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.fineDesc}>"{item.description}"</Text>
        ) : null}

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>FINE LEVIED</Text>
            <Text style={styles.amountVal}>₹{item.amount || 0}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>PAID</Text>
            <Text style={[styles.amountVal, { color: '#15803d' }]}>₹{item.paid_amount || 0}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>DUE</Text>
            <Text style={[styles.amountVal, { color: '#dc2626' }]}>₹{item.outstanding_amount || 0}</Text>
          </View>
        </View>

        {isPending ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => {
                setCollectTarget(item);
                setCollectAmount((item.outstanding_amount || item.amount || 0).toString());
                setCollectRemarks('');
              }}
            >
              <Ionicons name="card-outline" size={14} color="#fff" />
              <Text style={styles.payBtnText}>Pay Fine</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.waiveBtn}
              onPress={() => {
                setWaiveTarget(item);
                setWaiveReason('');
              }}
            >
              <Ionicons name="cut-outline" size={14} color="#ca8a04" />
              <Text style={styles.waiveBtnText}>Waive</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resolvedRow}>
            <Ionicons
              name={isPaid ? 'checkmark-circle' : 'information-circle'}
              size={15}
              color={isPaid ? '#15803d' : '#64748b'}
            />
            <Text style={[styles.resolvedText, { color: isPaid ? '#15803d' : '#64748b' }]}>
              {isPaid ? 'Paid in Full' : 'Waived by Management'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hostel Fines & Penalties</Text>
          <Text style={styles.headerSubtitle}>Disciplinary charges, receipts & waivers</Text>
        </View>
        <TouchableOpacity style={styles.levyHeaderBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.levyHeaderBtnText}>Assess Fine</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {['ALL', 'PENDING', 'PAID', 'WAIVED'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4338ca" />
          <Text style={styles.loadingText}>Loading fine assessments...</Text>
        </View>
      ) : (
        <FlatList
          data={fines}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderFineCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchFines();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Fines on Record</Text>
              <Text style={styles.emptySubtitle}>All hostel residents have clear disciplinary logs.</Text>
            </View>
          }
        />
      )}

      {/* Assess Fine Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Assess Disciplinary Fine</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Resident Selection */}
              <Text style={styles.modalFieldLabel}>Select Resident Student:</Text>
              {selectedStudent ? (
                <View style={styles.selectedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{selectedStudent.student_name}</Text>
                    <Text style={styles.selectedSub}>
                      {selectedStudent.hostel_name} • R-{selectedStudent.room_number}, Bed {selectedStudent.bed_number}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchRowInput}
                      placeholder="Type student name or room..."
                      placeholderTextColor="#94a3b8"
                      value={studentQuery}
                      onChangeText={setStudentQuery}
                    />
                  </View>
                  {studentResults.length > 0 ? (
                    <View style={styles.resultsDrop}>
                      {studentResults.map(s => (
                        <TouchableOpacity
                          key={s.allocation_id || s.id}
                          style={styles.resultItem}
                          onPress={() => {
                            setSelectedStudent(s);
                            setStudentResults([]);
                            setStudentQuery('');
                          }}
                        >
                          <Text style={styles.resultTitle}>{s.student_name}</Text>
                          <Text style={styles.resultDesc}>Room {s.room_number} • Bed {s.bed_number}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              {/* Reason Selector */}
              <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>Infraction Reason:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {Object.keys(REASON_LABELS).map(rk => (
                  <TouchableOpacity
                    key={rk}
                    style={[styles.reasonChip, reason === rk && styles.reasonChipActive]}
                    onPress={() => setReason(rk)}
                  >
                    <Text style={[styles.reasonChipText, reason === rk && styles.reasonChipTextActive]}>
                      {REASON_LABELS[rk]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Amount */}
              <Text style={styles.modalFieldLabel}>Fine Amount (₹):</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="e.g. 500"
                placeholderTextColor="#94a3b8"
                value={fineAmount}
                onChangeText={setFineAmount}
              />

              {/* Description */}
              <Text style={styles.modalFieldLabel}>Description / Notes:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Details of damage or rule violation..."
                placeholderTextColor="#94a3b8"
                value={fineDesc}
                onChangeText={setFineDesc}
              />

              <TouchableOpacity
                style={[styles.submitBtn, (!selectedStudent || !fineAmount || creating) && styles.submitBtnDisabled]}
                disabled={!selectedStudent || !fineAmount || creating}
                onPress={handleCreateFine}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Assessment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Pay Fine Modal */}
      <Modal visible={!!collectTarget} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeaderCenter}>
              <Ionicons name="card" size={24} color="#15803d" />
              <Text style={styles.modalTitleCenter}>Record Fine Payment</Text>
            </View>
            <Text style={styles.modalDescCenter}>
              Collecting fine from <Text style={{ fontWeight: '700' }}>{collectTarget?.student_name}</Text>{' '}
              (Due: ₹{collectTarget?.outstanding_amount})
            </Text>

            <Text style={styles.modalFieldLabel}>Amount (₹):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={collectAmount}
              onChangeText={setCollectAmount}
            />

            <Text style={styles.modalFieldLabel}>Payment Mode:</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {['CASH', 'UPI', 'ONLINE'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeChip, collectMode === m && styles.modeChipActive]}
                  onPress={() => setCollectMode(m)}
                >
                  <Text style={[styles.modeChipText, collectMode === m && styles.modeChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsCenter}>
              <TouchableOpacity style={styles.cancelBtnCenter} onPress={() => setCollectTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnCenter, { backgroundColor: '#15803d' }]}
                disabled={collecting}
                onPress={handleCollectFine}
              >
                {collecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Receipt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Waive Modal */}
      <Modal visible={!!waiveTarget} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeaderCenter}>
              <Ionicons name="cut" size={24} color="#ca8a04" />
              <Text style={styles.modalTitleCenter}>Waive Fine Assessment</Text>
            </View>
            <Text style={styles.modalDescCenter}>
              Waive ₹{waiveTarget?.outstanding_amount} fine for{' '}
              <Text style={{ fontWeight: '700' }}>{waiveTarget?.student_name}</Text>?
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Reason for granting waiver (e.g. first-time warning)..."
              placeholderTextColor="#94a3b8"
              value={waiveReason}
              onChangeText={setWaiveReason}
            />

            <View style={styles.modalActionsCenter}>
              <TouchableOpacity style={styles.cancelBtnCenter} onPress={() => setWaiveTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnCenter, { backgroundColor: '#ca8a04' }]}
                disabled={waiving}
                onPress={handleWaiveFine}
              >
                {waiving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Waive Fine</Text>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  levyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  levyHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: '#4338ca' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  fineCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fineHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  fineReasonTag: { fontSize: 12, color: '#dc2626', fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  fineDesc: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 8 },

  amountRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  amountCol: { flex: 1 },
  amountLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  amountVal: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },

  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  payBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  waiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef9c3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  waiveBtnText: { color: '#854d0e', fontSize: 12, fontWeight: '700' },

  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  resolvedText: { fontSize: 12, fontWeight: '600' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  // Sheet Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },

  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
  },
  selectedName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  selectedSub: { fontSize: 12, color: '#64748b' },
  changeLink: { fontSize: 12, fontWeight: '600', color: '#4338ca' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchRowInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  resultsDrop: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 140,
  },
  resultItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  resultTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  resultDesc: { fontSize: 11, color: '#64748b' },

  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  reasonChipActive: { backgroundColor: '#dc2626' },
  reasonChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  reasonChipTextActive: { color: '#fff' },

  submitBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Center Modal
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  modalHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  modalTitleCenter: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalDescCenter: { fontSize: 13, color: '#475569', marginBottom: 14 },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  modeChipActive: { backgroundColor: '#15803d' },
  modeChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  modeChipTextActive: { color: '#fff' },
  modalActionsCenter: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtnCenter: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  confirmBtnCenter: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 8 },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
