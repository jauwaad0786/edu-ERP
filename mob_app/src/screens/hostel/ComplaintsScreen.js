// mob_app/src/screens/hostel/ComplaintsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const CATEGORIES = [
  { key: 'ALL', label: 'All Categories', icon: 'apps-outline' },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: 'construct-outline' },
  { key: 'ELECTRICAL', label: 'Electrical', icon: 'flash-outline' },
  { key: 'PLUMBING', label: 'Plumbing', icon: 'water-outline' },
  { key: 'CLEANING', label: 'Cleaning', icon: 'sparkles-outline' },
  { key: 'FOOD', label: 'Mess / Food', icon: 'restaurant-outline' },
  { key: 'SAFETY', label: 'Safety', icon: 'shield-checkmark-outline' },
  { key: 'WIFI', label: 'Wi-Fi / Net', icon: 'wifi-outline' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const STATUS_CONFIG = {
  OPEN:        { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', label: 'Open' },
  IN_PROGRESS: { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', label: 'In Progress' },
  RESOLVED:    { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', label: 'Resolved' },
  CLOSED:      { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: 'Closed' },
};

const PRIORITY_CONFIG = {
  LOW:    { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  MEDIUM: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  HIGH:   { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' },
  URGENT: { bg: '#fee2e2', text: '#e11d48', border: '#fecdd3' },
};

export default function ComplaintsScreen({ navigation }) {
  const { user } = useAuth();
  const isStudent = (user?.role === 'STUDENT');
  const canManage = ['HOSTEL', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Create Modal State
  const [createModal, setCreateModal] = useState(false);
  const [category, setCategory] = useState('MAINTENANCE');
  const [priority, setPriority] = useState('MEDIUM');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Student search for staff creating complaints on behalf of resident
  const [studentSearch, setStudentSearch] = useState('');
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Resolve / Status Update Modal State
  const [resolveModal, setResolveModal] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);

  // Load complaints
  const loadComplaints = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;

      const res = await client.get('/hostel/complaints', { params }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.complaints || res.data?.data || []);
      setComplaints(list);
    } catch {
      setComplaints([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Search resident for staff creating complaint
  const searchResidents = async (query) => {
    setStudentSearch(query);
    if (!query || query.trim().length < 2) {
      setStudentList([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const res = await client.get('/hostel/admissions', { params: { search: query } }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.admissions || []);
      setStudentList(list);
    } catch {
      setStudentList([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Submit Complaint
  const handleCreateComplaint = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a complaint title.');
      return;
    }

    if (canManage && !isStudent && !selectedStudent) {
      Alert.alert('Select Resident', 'Please search and select the resident student lodging this complaint.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: desc.trim(),
        category,
        priority,
      };

      if (canManage && !isStudent && selectedStudent) {
        payload.student_id = selectedStudent.student_id || selectedStudent.id;
      }

      await client.post('/hostel/complaints', payload);
      Alert.alert('Success', 'Complaint ticket logged successfully.');
      setCreateModal(false);
      setTitle('');
      setDesc('');
      setSelectedStudent(null);
      setStudentSearch('');
      setStudentList([]);
      loadComplaints();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to submit complaint';
      Alert.alert('Submission Failed', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Resolve Dialog
  const openResolveModal = (comp) => {
    setSelectedComp(comp);
    setUpdateStatus(comp.status === 'OPEN' ? 'IN_PROGRESS' : 'RESOLVED');
    setResolutionText(comp.resolution || '');
    setResolveModal(true);
  };

  // Submit Resolution
  const handleUpdateStatus = async () => {
    if (!selectedComp) return;
    setResolving(true);
    try {
      await client.patch(`/hostel/complaints/${selectedComp.id}/status`, {
        status: updateStatus,
        resolution: resolutionText.trim(),
      });
      Alert.alert('Updated', `Complaint marked as ${updateStatus}.`);
      setResolveModal(false);
      setSelectedComp(null);
      loadComplaints();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update complaint status.';
      Alert.alert('Error', errorMsg);
    } finally {
      setResolving(false);
    }
  };

  // Counts
  const counts = useMemo(() => {
    const res = { ALL: complaints.length, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
    complaints.forEach((c) => {
      if (res[c.status] !== undefined) res[c.status]++;
    });
    return res;
  }, [complaints]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Hostel Maintenance</Text>
            <Text style={styles.headerSub}>Room Complaints & Work Orders</Text>
          </View>
          <TouchableOpacity
            style={styles.lodgeBtn}
            onPress={() => setCreateModal(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.lodgeBtnText}>Lodge Issue</Text>
          </TouchableOpacity>
        </View>

        {/* Status Count Pills */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{complaints.length}</Text>
            <Text style={styles.metricLabel}>Total</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: '#dc2626' }]}>{counts.OPEN}</Text>
            <Text style={styles.metricLabel}>Open</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: '#0284c7' }]}>{counts.IN_PROGRESS}</Text>
            <Text style={styles.metricLabel}>In Progress</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: '#16a34a' }]}>{counts.RESOLVED}</Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                {st.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catChip, categoryFilter === cat.key && styles.catChipActive]}
              onPress={() => setCategoryFilter(cat.key)}
            >
              <Ionicons
                name={cat.icon}
                size={13}
                color={categoryFilter === cat.key ? '#fff' : colors.textMuted}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.catChipText, categoryFilter === cat.key && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Complaints List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadComplaints(true)}
              colors={[colors.primary]}
            />
          }
        >
          {complaints.length > 0 ? (
            complaints.map((c) => {
              const stConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.OPEN;
              const prConf = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.MEDIUM;
              const catObj = CATEGORIES.find(x => x.key === c.category) || CATEGORIES[1];

              return (
                <View key={c.id} style={styles.complaintCard}>
                  {/* Top Bar: Category, Priority, Status */}
                  <View style={styles.cardHeader}>
                    <View style={styles.catBadge}>
                      <Ionicons name={catObj.icon} size={12} color={colors.primary} />
                      <Text style={styles.catBadgeText}>{c.category}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={[styles.priorityBadge, { backgroundColor: prConf.bg, borderColor: prConf.border }]}>
                        <Text style={[styles.priorityText, { color: prConf.text }]}>{c.priority}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: stConf.bg, borderColor: stConf.border }]}>
                        <Text style={[styles.statusText, { color: stConf.text }]}>{stConf.label}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Title & Desc */}
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  {c.description ? (
                    <Text style={styles.cardDesc}>{c.description}</Text>
                  ) : null}

                  {/* Meta details */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="bed-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>
                        Room: {c.room_number || '—'} {c.hostel_name ? `(${c.hostel_name})` : ''}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>{c.student_name || 'Resident'}</Text>
                    </View>
                  </View>

                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.dateText}>
                      Logged: {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </Text>
                  </View>

                  {/* Resolution section if present */}
                  {c.resolution ? (
                    <View style={styles.resolutionBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text style={styles.resolutionTitle}>Resolution Remarks</Text>
                      </View>
                      <Text style={styles.resolutionText}>{c.resolution}</Text>
                      {c.resolved_at && (
                        <Text style={styles.resolvedDateText}>
                          Resolved on: {new Date(c.resolved_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  ) : null}

                  {/* Action buttons for warden/principal */}
                  {canManage && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openResolveModal(c)}
                      >
                        <Ionicons name="construct-outline" size={14} color={colors.primary} />
                        <Text style={styles.actionBtnText}>
                          {c.status === 'RESOLVED' || c.status === 'CLOSED' ? 'Update Remarks' : 'Update / Resolve'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Complaints Found</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter === 'ALL'
                  ? 'All room maintenance requests and hostel issues are in good standing.'
                  : `No complaints with status "${statusFilter}".`}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* CREATE COMPLAINT MODAL */}
      <Modal visible={createModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Lodge Maintenance Issue</Text>
                <Text style={styles.modalSub}>Report room repair or hostel grievance</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Resident selector for staff */}
              {canManage && !isStudent && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Select Resident Student *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Search resident student name..."
                    value={studentSearch}
                    onChangeText={searchResidents}
                  />
                  {searchingStudents && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 6 }} />}

                  {studentList.length > 0 && !selectedStudent && (
                    <View style={styles.dropdownResults}>
                      {studentList.map((stu) => (
                        <TouchableOpacity
                          key={stu.id || stu.student_id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedStudent(stu);
                            setStudentSearch(`${stu.student_name || stu.name} (Room ${stu.room_number || 'N/A'})`);
                            setStudentList([]);
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
                      <Ionicons name="person" size={12} color="#16a34a" />
                      <Text style={styles.selectedPillText}>
                        {selectedStudent.student_name || selectedStudent.name} (Room {selectedStudent.room_number || 'N/A'})
                      </Text>
                      <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                        <Ionicons name="close" size={14} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Category Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Issue Category *</Text>
                <View style={styles.chipGrid}>
                  {CATEGORIES.filter(c => c.key !== 'ALL').map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.modalChip, category === cat.key && styles.modalChipActive]}
                      onPress={() => setCategory(cat.key)}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={13}
                        color={category === cat.key ? '#fff' : colors.text}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.modalChipText, category === cat.key && styles.modalChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Priority Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Urgency / Priority *</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((pr) => {
                    const conf = PRIORITY_CONFIG[pr];
                    const active = priority === pr;
                    return (
                      <TouchableOpacity
                        key={pr}
                        style={[
                          styles.prChip,
                          { borderColor: active ? conf.text : conf.border, backgroundColor: active ? conf.bg : '#fff' },
                        ]}
                        onPress={() => setPriority(pr)}
                      >
                        <Text style={[styles.prChipText, { color: conf.text, fontWeight: active ? '700' : '500' }]}>
                          {pr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title / Subject *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., Geyser not heating, Tubelight flickering..."
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Detailed Description</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Describe the issue, location inside room, or specific symptoms..."
                  multiline
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreateComplaint}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Complaint Ticket</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* RESOLVE / STATUS UPDATE MODAL */}
      <Modal visible={resolveModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Complaint Status</Text>
                <Text style={styles.modalSub}>Ticket #{selectedComp?.id} · {selectedComp?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setResolveModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>New Status *</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => {
                  const conf = STATUS_CONFIG[st];
                  const active = updateStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.prChip,
                        { borderColor: active ? conf.text : conf.border, backgroundColor: active ? conf.bg : '#fff', flex: 1 },
                      ]}
                      onPress={() => setUpdateStatus(st)}
                    >
                      <Text style={[styles.prChipText, { color: conf.text, fontWeight: active ? '700' : '500' }]}>
                        {conf.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Resolution Notes / Action Taken</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="e.g., Plumber repaired faulty valve, replacement bulbs installed..."
                multiline
                value={resolutionText}
                onChangeText={setResolutionText}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, resolving && { opacity: 0.6 }]}
              onPress={handleUpdateStatus}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Confirm Status Update</Text>
              )}
            </TouchableOpacity>
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
  lodgeBtn: {
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
  lodgeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  metricsRow: {
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
  metricValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  metricDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0' },
  filterSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 8 },
  filterScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  catScroll: { paddingHorizontal: 16, gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  catChipTextActive: { color: '#fff' },
  listContainer: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: colors.textMuted },
  complaintCard: {
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dateText: { fontSize: 11, color: colors.textMuted },
  resolutionBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  resolutionTitle: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  resolutionText: { fontSize: 12, color: '#166534', marginTop: 2 },
  resolvedDateText: { fontSize: 10, color: '#4ade80', marginTop: 4 },
  cardActions: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  formGroup: { marginBottom: 14 },
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
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  modalChipTextActive: { color: '#fff' },
  prChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  prChipText: { fontSize: 11, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dropdownResults: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 140,
  },
  dropdownItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemName: { fontSize: 12, fontWeight: '700', color: colors.text },
  dropdownItemSub: { fontSize: 11, color: colors.textMuted },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  selectedPillText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
});
