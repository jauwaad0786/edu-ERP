// mob_app/src/screens/documents/IssueCertificatesScreen.js
// Institutional Certificate Issuance Workspace — 100% mirrors Web ERP DocumentsPage.jsx
// Handles Transfer Certificate (TC), Character, Bonafide certificates with auto-serial generation.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const CERT_TEMPLATES = [
  { key: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate (TC)', icon: 'school-outline', color: '#dc2626' },
  { key: 'CHARACTER_CERTIFICATE', label: 'Character Certificate', icon: 'ribbon-outline', color: '#16a34a' },
  { key: 'BONAFIDE_CERTIFICATE', label: 'Bonafide Certificate', icon: 'shield-checkmark-outline', color: '#0b57d0' },
  { key: 'FEE_CLEARANCE', label: 'Fee Clearance Certificate', icon: 'receipt-outline', color: '#d97706' },
];

export default function IssueCertificatesScreen({ navigation }) {
  const [selectedTemplate, setSelectedTemplate] = useState('TRANSFER_CERTIFICATE');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Workspace & Issued list
  const [issuedList, setIssuedList] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Issue Certificate Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [targetStudent, setTargetStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);

  // Form Fields
  const [certificateNo, setCertificateNo] = useState('');
  const [conduct, setConduct] = useState('Good');
  const [leavingReason, setLeavingReason] = useState('Course completed / relocation');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View Certificate Modal
  const [viewingCert, setViewingCert] = useState(null);

  // Load Classes
  useEffect(() => {
    client.get('/principal/classes')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
        setClasses(list);
      })
      .catch(() => {});
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const params = { doc_type: selectedTemplate };
      if (selectedClassId) params.class_id = selectedClassId;

      const res = await client.get('/principal/documents/issue-workspace', { params });
      setIssuedList(res.data?.issued || res.data?.documents || []);
      setStudents(res.data?.students || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load certificate workspace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTemplate, selectedClassId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Search Students for Issuance
  useEffect(() => {
    if (!showIssueModal || targetStudent || !studentSearch.trim()) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await client.get(`/principal/students?search=${encodeURIComponent(studentSearch.trim())}&per_page=6`);
        setStudentResults(res.data?.students || res.data?.data || res.data || []);
      } catch (e) {
        setStudentResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, showIssueModal, targetStudent]);

  const openIssueModal = (preselectedStudent = null) => {
    setTargetStudent(preselectedStudent);
    setStudentSearch('');
    setStudentResults([]);
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const prefix = selectedTemplate === 'TRANSFER_CERTIFICATE' ? 'TC' : selectedTemplate === 'BONAFIDE_CERTIFICATE' ? 'BNF' : 'CHR';
    setCertificateNo(`${prefix}-2026-${randomSeq}`);
    setConduct('Good');
    setLeavingReason('Course completed / relocation');
    setRemarks('');
    setShowIssueModal(true);
  };

  const handleIssueCertificate = async () => {
    if (!targetStudent) {
      Alert.alert('Required', 'Please select a student.');
      return;
    }
    try {
      setSubmitting(true);
      await client.post(`/principal/students/${targetStudent.id || targetStudent.student_id}/documents/issued`, {
        doc_type: selectedTemplate,
        title: CERT_TEMPLATES.find(t => t.key === selectedTemplate)?.label || 'Certificate',
        serial_number: certificateNo,
        conduct,
        leaving_reason: leavingReason,
        remarks,
        visible_to_student: true,
      });

      Alert.alert(
        'Certificate Issued',
        `${CERT_TEMPLATES.find(t => t.key === selectedTemplate)?.label} issued successfully for ${targetStudent.name || targetStudent.student_name}.`
      );
      setShowIssueModal(false);
      setTargetStudent(null);
      loadWorkspace();
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Failed to issue certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIssued = async (item) => {
    Alert.alert(
      'Revoke Certificate',
      `Revoke ${item.title || 'Certificate'} for ${item.student_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/documents/issued/${item.id}`);
              Alert.alert('Revoked', 'Certificate revoked from student credentials.');
              loadWorkspace();
            } catch (e) {
              Alert.alert('Error', 'Failed to revoke certificate');
            }
          },
        },
      ]
    );
  };

  const filteredIssued = issuedList.filter(i =>
    !search || i.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.serial_number?.toLowerCase().includes(search.toLowerCase())
  );

  const renderIssuedItem = ({ item }) => (
    <View style={styles.certCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Ionicons name="ribbon" size={18} color="#7c3aed" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.studentName}>{item.student_name || 'Student'}</Text>
          <Text style={styles.certTitleSub}>
            {item.title || 'Official Certificate'} • Serial: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.serial_number || 'N/A'}</Text>
          </Text>
        </View>
        <View style={styles.validBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#15803d" />
          <Text style={styles.validBadgeText}>Issued</Text>
        </View>
      </View>

      <View style={styles.certMetaBox}>
        <Text style={styles.metaRowText}>
          Issued on: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.issued_at || 'Today'}</Text>
        </Text>
        {item.leaving_reason ? (
          <Text style={styles.metaRowText}>
            Reason: <Text style={{ fontWeight: '600', color: '#334155' }}>{item.leaving_reason}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => setViewingCert(item)}
        >
          <Ionicons name="eye-outline" size={14} color="#7c3aed" />
          <Text style={styles.viewBtnText}>View Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.revokeBtn}
          onPress={() => handleDeleteIssued(item)}
        >
          <Ionicons name="trash-outline" size={14} color="#ef4444" />
          <Text style={styles.revokeBtnText}>Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Issue Certificates</Text>
          <Text style={styles.headerSubtitle}>TC, Character, Bonafide credentials</Text>
        </View>
        <TouchableOpacity style={styles.issueHeaderBtn} onPress={() => openIssueModal()}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.issueHeaderBtnText}>New Cert</Text>
        </TouchableOpacity>
      </View>

      {/* Template Selector Bar */}
      <View style={styles.templateBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CERT_TEMPLATES.map(t => {
            const active = selectedTemplate === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.templateChip, active && styles.templateChipActive]}
                onPress={() => setSelectedTemplate(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? '#fff' : t.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.templateChipText, active && styles.templateChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search issued certificates by student or serial..."
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
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Loading issued certificates...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIssued}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderIssuedItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadWorkspace();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ribbon-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Certificates Issued Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the "New Cert" button above to issue credentials for students.
              </Text>
            </View>
          }
        />
      )}

      {/* Issue Certificate Modal */}
      <Modal visible={showIssueModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Generate & Issue Certificate</Text>
                <Text style={styles.modalSheetSub}>
                  {CERT_TEMPLATES.find(t => t.key === selectedTemplate)?.label}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Step 1: Select Student */}
              <Text style={styles.fieldLabel}>Select Student:</Text>
              {targetStudent ? (
                <View style={styles.selectedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedTitle}>{targetStudent.name || targetStudent.student_name}</Text>
                    <Text style={styles.selectedSub}>
                      {targetStudent.class_name ? `Class: ${targetStudent.class_name} • ` : ''}Roll: {targetStudent.roll_number || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setTargetStudent(null)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchRowInput}
                      placeholder="Type student name or roll..."
                      placeholderTextColor="#94a3b8"
                      value={studentSearch}
                      onChangeText={setStudentSearch}
                    />
                  </View>
                  {studentResults.length > 0 ? (
                    <View style={styles.resultsDrop}>
                      {studentResults.map(s => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.resultItem}
                          onPress={() => {
                            setTargetStudent(s);
                            setStudentResults([]);
                            setStudentSearch('');
                          }}
                        >
                          <Text style={styles.resultTitle}>{s.name}</Text>
                          <Text style={styles.resultDesc}>Class: {s.class_name || 'N/A'} • Adm: {s.admission_no || s.roll_number || '—'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              {/* Certificate Serial No */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Certificate Serial Number:</Text>
              <TextInput
                style={styles.input}
                value={certificateNo}
                onChangeText={setCertificateNo}
              />

              {/* Conduct */}
              <Text style={styles.fieldLabel}>Student Conduct / Character:</Text>
              <TextInput
                style={styles.input}
                value={conduct}
                onChangeText={setConduct}
              />

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason for Leaving / Request:</Text>
              <TextInput
                style={styles.input}
                value={leavingReason}
                onChangeText={setLeavingReason}
              />

              {/* Remarks */}
              <Text style={styles.fieldLabel}>Additional Institutional Remarks:</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Cleared all school dues up to current academic session..."
                placeholderTextColor="#94a3b8"
                value={remarks}
                onChangeText={setRemarks}
              />

              <TouchableOpacity
                style={[styles.submitBtn, (!targetStudent || submitting) && styles.submitBtnDisabled]}
                disabled={!targetStudent || submitting}
                onPress={handleIssueCertificate}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Issue Official Certificate</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Certificate Details Modal */}
      <Modal visible={!!viewingCert} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalCenterTop}>
              <Ionicons name="ribbon-outline" size={24} color="#7c3aed" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.modalCenterTitle}>{viewingCert?.title}</Text>
                <Text style={styles.modalCenterSub}>Official Digital Certificate</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingCert(null)}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.certBodyBox}>
              <Text style={styles.certField}>
                Student: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{viewingCert?.student_name}</Text>
              </Text>
              <Text style={styles.certField}>
                Serial No: <Text style={{ fontWeight: '700', color: '#7c3aed' }}>{viewingCert?.serial_number}</Text>
              </Text>
              <Text style={styles.certField}>
                Issued Date: <Text style={{ fontWeight: '600' }}>{viewingCert?.issued_at || 'Active'}</Text>
              </Text>
              {viewingCert?.conduct ? (
                <Text style={styles.certField}>
                  Conduct: <Text style={{ fontWeight: '600' }}>{viewingCert?.conduct}</Text>
                </Text>
              ) : null}
              {viewingCert?.leaving_reason ? (
                <Text style={styles.certField}>
                  Reason: <Text style={{ fontWeight: '600' }}>{viewingCert?.leaving_reason}</Text>
                </Text>
              ) : null}
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

  templateBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  templateChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  templateChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  templateChipTextActive: { color: '#fff' },

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

  certCard: {
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
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  certTitleSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  validBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },

  certMetaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
    gap: 2,
  },
  metaRowText: { fontSize: 11, color: '#64748b' },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  viewBtnText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  revokeBtnText: { fontSize: 11, fontWeight: '600', color: '#ef4444' },

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
    maxHeight: '90%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#7c3aed' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
  },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  selectedSub: { fontSize: 11, color: '#64748b' },
  changeLink: { fontSize: 12, fontWeight: '600', color: '#7c3aed' },

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
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalCenterTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalCenterTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalCenterSub: { fontSize: 11, color: '#64748b' },
  certBodyBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, gap: 6 },
  certField: { fontSize: 13, color: '#334155' },
});
