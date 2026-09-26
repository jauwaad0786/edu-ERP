// mob_app/src/screens/hostel/VisitorsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const RELATIONS = ['PARENT', 'GUARDIAN', 'SIBLING', 'RELATIVE', 'OTHER'];
const ID_PROOFS = ['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT', 'OTHER'];

function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

export default function VisitorsScreen({ navigation }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_CAMPUS' | 'CHECKED_OUT'
  const [search, setSearch] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));

  // Modal State
  const [createModal, setCreateModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Form Fields
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [relation, setRelation] = useState('PARENT');
  const [idProofType, setIdProofType] = useState('AADHAAR');
  const [idProofNo, setIdProofNo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Visitors
  const loadVisitors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hostel/visitors', {
        params: { visit_date: visitDate },
      }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.visitors || []);
      setVisitors(list);
    } catch {
      setVisitors([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [visitDate]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  // Search Admitted Resident Students
  const searchResidents = async (query) => {
    setStudentSearch(query);
    if (!query || query.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const res = await client.get('/hostel/admissions', { params: { search: query } }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.admissions || []);
      setStudentResults(list);
    } catch {
      setStudentResults([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Submit Visitor Entry
  const handleCreateVisitor = async () => {
    if (!selectedStudent) {
      Alert.alert('Select Resident', 'Please search and select the hostel resident being visited.');
      return;
    }
    if (!visitorName.trim() || !visitorPhone.trim()) {
      Alert.alert('Required Fields', 'Visitor Full Name and Mobile Number are required.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/hostel/visitors', {
        student_id: selectedStudent.student_id || selectedStudent.id,
        visitor_name: visitorName.trim(),
        visitor_phone: visitorPhone.trim(),
        relation,
        id_proof_type: idProofType,
        id_proof_no: idProofNo.trim(),
        purpose: purpose.trim(),
      });

      Alert.alert('Entry Logged', 'Visitor gate pass recorded successfully.');
      setCreateModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setVisitorName('');
      setVisitorPhone('');
      setIdProofNo('');
      setPurpose('');
      loadVisitors();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to record visitor';
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Checkout Visitor
  const handleCheckout = (visitor) => {
    Alert.alert(
      'Visitor Check-Out',
      `Check out ${visitor.visitor_name} from campus?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Check-Out',
          onPress: async () => {
            try {
              await client.patch(`/hostel/visitors/${visitor.id}/checkout`);
              Alert.alert('Checked Out', `${visitor.visitor_name} marked as checked out.`);
              loadVisitors();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to check out visitor');
            }
          },
        },
      ]
    );
  };

  // Metrics
  const metrics = useMemo(() => {
    let inCampus = 0;
    let checkedOut = 0;
    visitors.forEach(v => {
      if (!v.out_time) inCampus++;
      else checkedOut++;
    });
    return { total: visitors.length, inCampus, checkedOut };
  }, [visitors]);

  // Filtered List
  const filteredVisitors = useMemo(() => {
    let list = visitors;
    if (statusFilter === 'IN_CAMPUS') list = list.filter(v => !v.out_time);
    if (statusFilter === 'CHECKED_OUT') list = list.filter(v => !!v.out_time);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.visitor_name && v.visitor_name.toLowerCase().includes(q)) ||
        (v.visitor_phone && v.visitor_phone.includes(q)) ||
        (v.student_name && v.student_name.toLowerCase().includes(q)) ||
        (v.purpose && v.purpose.toLowerCase().includes(q))
      );
    }
    return list;
  }, [visitors, statusFilter, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Visitor Gate Pass</Text>
            <Text style={styles.headerSub}>Hostel Security & Campus Access Log</Text>
          </View>
          <TouchableOpacity style={styles.logBtn} onPress={() => setCreateModal(true)}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.logBtnText}>Log Entry</Text>
          </TouchableOpacity>
        </View>

        {/* Live Counters */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.total}</Text>
            <Text style={styles.metricLbl}>Total Today</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#16a34a' }]}>{metrics.inCampus}</Text>
            <Text style={styles.metricLbl}>In Campus</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#64748b' }]}>{metrics.checkedOut}</Text>
            <Text style={styles.metricLbl}>Checked Out</Text>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search visitor, phone, resident student..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Chips */}
        <View style={styles.statusChipsRow}>
          {[
            { key: 'ALL', label: 'All Visitors' },
            { key: 'IN_CAMPUS', label: 'Inside Campus' },
            { key: 'CHECKED_OUT', label: 'Checked Out' },
          ].map((st) => (
            <TouchableOpacity
              key={st.key}
              style={[styles.filterChip, statusFilter === st.key && styles.filterChipActive]}
              onPress={() => setStatusFilter(st.key)}
            >
              <Text style={[styles.filterChipText, statusFilter === st.key && styles.filterChipTextActive]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Visitors List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading visitor registry...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadVisitors(true)} colors={[colors.primary]} />
          }
        >
          {filteredVisitors.length > 0 ? (
            filteredVisitors.map((v) => {
              const isInside = !v.out_time;

              return (
                <View key={v.id} style={styles.card}>
                  {/* Top Bar: Name & Inside/Out Status */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitorName}>{v.visitor_name}</Text>
                      <Text style={styles.phoneText}>
                        <Ionicons name="call-outline" size={12} color={colors.textMuted} /> {v.visitor_phone}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, isInside ? styles.badgeInside : styles.badgeOut]}>
                      <Ionicons
                        name={isInside ? 'enter-outline' : 'checkmark-done'}
                        size={12}
                        color={isInside ? '#16a34a' : '#64748b'}
                      />
                      <Text style={[styles.statusText, { color: isInside ? '#16a34a' : '#64748b' }]}>
                        {isInside ? 'Inside Campus' : 'Checked Out'}
                      </Text>
                    </View>
                  </View>

                  {/* Resident Info Box */}
                  <View style={styles.residentBox}>
                    <Ionicons name="person" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.residentLabel}>Visiting Resident Student:</Text>
                      <Text style={styles.residentName}>
                        {v.student_name || `Student #${v.student_id}`} · {v.hostel_name || 'Hostel'}
                      </Text>
                    </View>
                    <View style={styles.relationBadge}>
                      <Text style={styles.relationText}>{v.relation}</Text>
                    </View>
                  </View>

                  {/* ID Proof & Time details */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="card-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        {v.id_proof_type}: {v.id_proof_no || 'Verified'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        In: {formatTime(v.in_time)} {v.out_time ? `· Out: ${formatTime(v.out_time)}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Purpose */}
                  {v.purpose ? (
                    <Text style={styles.purposeText} numberOfLines={2}>
                      Purpose: "{v.purpose}"
                    </Text>
                  ) : null}

                  {/* Footer Actions */}
                  <View style={styles.cardFooter}>
                    {v.visitor_phone ? (
                      <TouchableOpacity
                        style={styles.callShortcut}
                        onPress={() => Linking.openURL(`tel:${v.visitor_phone}`).catch(() => {})}
                      >
                        <Ionicons name="call" size={13} color="#16a34a" />
                        <Text style={styles.callShortcutText}>Call Visitor</Text>
                      </TouchableOpacity>
                    ) : <View />}

                    {isInside ? (
                      <TouchableOpacity
                        style={styles.checkoutBtn}
                        onPress={() => handleCheckout(v)}
                      >
                        <Ionicons name="log-out-outline" size={14} color="#dc2626" />
                        <Text style={styles.checkoutBtnText}>Check Out</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Visitors Logged</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? `No visitors matching "${search}".`
                  : 'No visitors recorded for this date and filter.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* LOG VISITOR ENTRY MODAL */}
      <Modal visible={createModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Log Visitor Gate Entry</Text>
                <Text style={styles.modalSub}>Record hostel visitor arrival & ID check</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Resident Student Search */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Resident Student Being Visited *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Search resident student name..."
                  value={studentSearch}
                  onChangeText={searchResidents}
                />
                {searchingStudents && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 6 }} />}

                {studentResults.length > 0 && !selectedStudent && (
                  <View style={styles.dropdownResults}>
                    {studentResults.map((stu) => (
                      <TouchableOpacity
                        key={stu.id || stu.student_id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedStudent(stu);
                          setStudentSearch(`${stu.student_name || stu.name} (Room ${stu.room_number || 'N/A'})`);
                          setStudentResults([]);
                        }}
                      >
                        <Text style={styles.dropdownItemName}>{stu.student_name || stu.name}</Text>
                        <Text style={styles.dropdownItemSub}>
                          Room: {stu.room_number || 'N/A'} · Bed: {stu.bed_number || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selectedStudent && (
                  <View style={styles.selectedPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    <Text style={styles.selectedPillText}>
                      {selectedStudent.student_name || selectedStudent.name} (Room {selectedStudent.room_number || 'N/A'})
                    </Text>
                    <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                      <Ionicons name="close" size={14} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Visitor Name & Phone */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1.2 }]}>
                  <Text style={styles.formLabel}>Visitor Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Ramesh Kumar"
                    value={visitorName}
                    onChangeText={setVisitorName}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Mobile Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="phone-pad"
                    placeholder="9876543210"
                    value={visitorPhone}
                    onChangeText={setVisitorPhone}
                  />
                </View>
              </View>

              {/* Relation Chips */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Relation to Resident *</Text>
                <View style={styles.chipRow}>
                  {RELATIONS.map((rel) => (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.formChip, relation === rel && styles.formChipActive]}
                      onPress={() => setRelation(rel)}
                    >
                      <Text style={[styles.formChipText, relation === rel && styles.formChipTextActive]}>
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ID Proof Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ID Proof Verified</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {ID_PROOFS.map((idType) => (
                    <TouchableOpacity
                      key={idType}
                      style={[styles.formChip, idProofType === idType && styles.formChipActive]}
                      onPress={() => setIdProofType(idType)}
                    >
                      <Text style={[styles.formChipText, idProofType === idType && styles.formChipTextActive]}>
                        {idType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* ID Proof Number */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ID Proof Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. XXXX-XXXX-1234"
                  value={idProofNo}
                  onChangeText={setIdProofNo}
                />
              </View>

              {/* Purpose */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Purpose of Visit</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g. Delivering study notes, family visit..."
                  multiline
                  value={purpose}
                  onChangeText={setPurpose}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateVisitor}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Record Gate Entry</Text>
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
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 4,
  },
  logBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricVal: { fontSize: 16, fontWeight: '800', color: colors.text },
  metricLbl: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  metricDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0' },
  filterSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, fontSize: 13, color: colors.text },
  statusChipsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  listContainer: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: colors.textMuted },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  visitorName: { fontSize: 15, fontWeight: '700', color: colors.text },
  phoneText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeInside: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  badgeOut: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  statusText: { fontSize: 11, fontWeight: '700' },
  residentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  residentLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  residentName: { fontSize: 12, fontWeight: '700', color: colors.text },
  relationBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  relationText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.textMuted },
  purposeText: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  callShortcut: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  callShortcutText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  checkoutBtnText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  formChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  formChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  formChipText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  formChipTextActive: { color: '#fff', fontWeight: '700' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dropdownResults: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff', marginTop: 4, maxHeight: 120 },
  dropdownItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemName: { fontSize: 12, fontWeight: '700', color: colors.text },
  dropdownItemSub: { fontSize: 11, color: colors.textMuted },
  selectedPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6 },
  selectedPillText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
});
