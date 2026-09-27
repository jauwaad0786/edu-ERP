// mob_app/src/screens/documents/StudentDocumentsScreen.js
// Student Documents & KYC Verification Matrix — 100% mirrors Web ERP DocumentsPage.jsx
// Handles student document tracking, KYC completion %, Aadhaar/Birth certificate status.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const DOC_TYPES = [
  { key: 'AADHAR_STUDENT', label: 'Student Aadhaar' },
  { key: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { key: 'PHOTO', label: 'Passport Photo' },
  { key: 'TRANSFER_CERTIFICATE', label: 'Previous TC' },
  { key: 'REPORT_CARD', label: 'Past Marks Card' },
  { key: 'AADHAR_PARENT', label: 'Parent Aadhaar' },
  { key: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
  { key: 'ADDRESS_PROOF', label: 'Address Proof' },
];

export default function StudentDocumentsScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PENDING' | 'MISSING'
  const [search, setSearch] = useState('');

  const [studentsStatus, setStudentsStatus] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload/Record Doc Modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [docType, setDocType] = useState('AADHAR_STUDENT');
  const [docTitle, setDocTitle] = useState('');
  const [docRemarks, setDocRemarks] = useState('');
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Load Classes
  useEffect(() => {
    client.get('/principal/classes')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].id.toString());
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const [statusRes, analyticsRes] = await Promise.all([
        client.get('/principal/documents/students-status', { params }).catch(() => ({ data: [] })),
        client.get('/principal/documents/analytics', { params: selectedClassId ? { class_id: selectedClassId } : {} }).catch(() => ({ data: null })),
      ]);

      const dataList = Array.isArray(statusRes.data)
        ? statusRes.data
        : statusRes.data?.students || statusRes.data?.data || [];
      setStudentsStatus(dataList);
      setAnalytics(analyticsRes.data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load student KYC documents status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordDocument = async () => {
    if (!selectedStudent) return;
    try {
      setSubmittingDoc(true);
      await client.post(`/principal/students/${selectedStudent.student_id || selectedStudent.id}/documents/student`, {
        doc_type: docType,
        title: docTitle || DOC_TYPES.find(d => d.key === docType)?.label || 'Document',
        remarks: docRemarks,
        status: 'VERIFIED',
      });
      Alert.alert('Success', 'Document KYC record registered and verified.');
      setSelectedStudent(null);
      setDocTitle('');
      setDocRemarks('');
      loadData();
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Failed to record document');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const renderStudentItem = ({ item }) => {
    const totalReq = item.total_required || 5;
    const uploaded = item.uploaded_count || item.documents_count || 0;
    const verified = item.verified_count || 0;
    const isComplete = verified >= totalReq;
    const isPartial = uploaded > 0 && !isComplete;

    const badgeBg = isComplete ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2';
    const badgeColor = isComplete ? '#15803d' : isPartial ? '#b45309' : '#dc2626';
    const statusText = isComplete ? 'Complete' : isPartial ? 'Partial' : 'Missing';

    return (
      <View style={styles.studentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.student_name || item.name || 'S')[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.studentName}>{item.student_name || item.name}</Text>
            <Text style={styles.studentSub}>
              {item.class_name ? `Class: ${item.class_name} • ` : ''}Adm: {item.admission_no || item.roll_number || '—'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Completion Progress Bar */}
        <View style={styles.progressBox}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>KYC Completion</Text>
            <Text style={styles.progressCount}>{verified}/{totalReq} Verified</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, Math.round((verified / totalReq) * 100))}%` },
              ]}
            />
          </View>
        </View>

        {/* Existing verified doc chips */}
        {item.documents && item.documents.length > 0 ? (
          <View style={styles.docChipsRow}>
            {item.documents.map((d, dIdx) => (
              <View key={dIdx} style={styles.docChip}>
                <Ionicons name="checkmark-circle" size={11} color="#15803d" />
                <Text style={styles.docChipText}>{d.doc_type || d.title}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.recordDocBtn}
            onPress={() => {
              setSelectedStudent(item);
              setDocType('AADHAR_STUDENT');
              setDocTitle('');
              setDocRemarks('');
            }}
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#0b57d0" />
            <Text style={styles.recordDocBtnText}>Verify / Record Document</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.headerTitle}>Student Documents & KYC</Text>
          <Text style={styles.headerSubtitle}>Verification matrix & institutional repository</Text>
        </View>
        <TouchableOpacity
          style={styles.issueHeaderBtn}
          onPress={() => navigation.navigate('IssueCertificates')}
        >
          <Ionicons name="ribbon-outline" size={15} color="#fff" />
          <Text style={styles.issueHeaderBtnText}>Certificates</Text>
        </TouchableOpacity>
      </View>

      {/* Class Selector Bar */}
      <View style={styles.classBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.classChip, !selectedClassId && styles.classChipActive]}
            onPress={() => setSelectedClassId('')}
          >
            <Text style={[styles.classChipText, !selectedClassId && styles.classChipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classes.map(c => {
            const active = selectedClassId === c.id.toString();
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.classChip, active && styles.classChipActive]}
                onPress={() => setSelectedClassId(c.id.toString())}
              >
                <Text style={[styles.classChipText, active && styles.classChipTextActive]}>
                  {c.name} {c.section ? `(${c.section})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Analytics KPI Row */}
      {analytics ? (
        <View style={styles.kpiContainer}>
          <View style={[styles.kpiCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.kpiLabel, { color: '#1d4ed8' }]}>Total Students</Text>
            <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{analytics.total_students || studentsStatus.length}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.kpiLabel, { color: '#15803d' }]}>Full KYC</Text>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>{analytics.complete_count || 0}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.kpiLabel, { color: '#b91c1c' }]}>Pending / Missing</Text>
            <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{analytics.pending_count || 0}</Text>
          </View>
        </View>
      ) : null}

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {['ALL', 'COMPLETE', 'PARTIAL', 'MISSING'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student by name or roll..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading KYC verification status...</Text>
        </View>
      ) : (
        <FlatList
          data={studentsStatus}
          keyExtractor={(item, index) => item.student_id?.toString() || item.id?.toString() || index.toString()}
          renderItem={renderStudentItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Student Records</Text>
              <Text style={styles.emptySubtitle}>No student data matched the current class or filters.</Text>
            </View>
          }
        />
      )}

      {/* Record Document Modal */}
      <Modal visible={!!selectedStudent} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Verify Document</Text>
                <Text style={styles.modalSheetSub}>
                  {selectedStudent?.student_name || selectedStudent?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Document Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {DOC_TYPES.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.typeChip, docType === d.key && styles.typeChipActive]}
                    onPress={() => setDocType(d.key)}
                  >
                    <Text style={[styles.typeChipText, docType === d.key && styles.typeChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Document Title / ID Number:</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aadhaar 12-digit / Certificate Serial No..."
                placeholderTextColor="#94a3b8"
                value={docTitle}
                onChangeText={setDocTitle}
              />

              <Text style={styles.fieldLabel}>Verification Remarks:</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Original physically inspected and verified..."
                placeholderTextColor="#94a3b8"
                value={docRemarks}
                onChangeText={setDocRemarks}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingDoc && styles.submitBtnDisabled]}
                disabled={submittingDoc}
                onPress={handleRecordDocument}
              >
                {submittingDoc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Mark as Verified & Complete</Text>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },
  issueHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  issueHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  classBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  classChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  classChipTextActive: { color: '#fff' },

  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  kpiCard: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  kpiValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: '#0b57d0' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },

  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#0b57d0' },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  studentSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  progressBox: { marginTop: 10 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 11, color: '#64748b' },
  progressCount: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  progressBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#15803d', borderRadius: 3 },

  docChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  docChipText: { fontSize: 10, color: '#15803d', fontWeight: '600' },

  cardActions: {
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  recordDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  recordDocBtnText: { fontSize: 12, fontWeight: '600', color: '#0b57d0' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#64748b' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  typeChipActive: { backgroundColor: '#0b57d0' },
  typeChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#0b57d0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
