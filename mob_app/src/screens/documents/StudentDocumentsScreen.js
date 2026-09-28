// mob_app/src/screens/documents/StudentDocumentsScreen.js
// Student Documents & KYC Verification Matrix — 100% mirrors Web ERP DocumentsPage.jsx
// Supports both Staff/Admin view (KYC matrix, audit, uploads) and Student/Parent view (personal KYC & issued certificates).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const DOC_TYPES = [
  { key: 'AADHAR_STUDENT', label: 'Student Aadhaar' },
  { key: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { key: 'PHOTO', label: 'Passport Photo' },
  { key: 'TRANSFER_CERTIFICATE', label: 'Previous TC' },
  { key: 'REPORT_CARD', label: 'Past Marks Card' },
  { key: 'AADHAR_PARENT', label: 'Parent Aadhaar' },
  { key: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
  { key: 'ADDRESS_PROOF', label: 'Address Proof' },
  { key: 'MEDICAL_CERTIFICATE', label: 'Medical Fitness' },
];

export default function StudentDocumentsScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isStaff = ['PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'TEACHER', 'DIRECTOR'].includes(role);

  // ─── ADMIN / STAFF STATE ──────────────────────────────────────────────────
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETE' | 'PENDING' | 'MISSING'
  const [search, setSearch] = useState('');
  const [studentsStatus, setStudentsStatus] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload/Record Doc Modal (Staff)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [docType, setDocType] = useState('AADHAR_STUDENT');
  const [docTitle, setDocTitle] = useState('');
  const [docRemarks, setDocRemarks] = useState('');
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // View Student Dossier Modal
  const [dossierStudent, setDossierStudent] = useState(null);
  const [dossierData, setDossierData] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [dossierModalVisible, setDossierModalVisible] = useState(false);

  // ─── STUDENT / PARENT STATE ───────────────────────────────────────────────
  const [myDocsData, setMyDocsData] = useState([]);
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const [studentActiveTab, setStudentActiveTab] = useState('KYC'); // 'KYC' | 'CERTIFICATES'

  // Load Classes for Staff
  useEffect(() => {
    if (isStaff) {
      client.get('/principal/classes')
        .then(r => {
          const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
          setClasses(list);
        })
        .catch(() => {});
    }
  }, [isStaff]);

  // Load Data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isStaff) {
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
      } else {
        // Student or Parent
        const res = await client.get('/student/documents').catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : [res.data];
        setMyDocsData(list.filter(Boolean));
      }
    } catch {
      if (isStaff) {
        setStudentsStatus([]);
      } else {
        setMyDocsData([]);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isStaff, selectedClassId, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Staff: Record/Upload student document
  const handleRecordDocument = async () => {
    if (!selectedStudent) return;
    try {
      setSubmittingDoc(true);
      const sid = selectedStudent.student_id || selectedStudent.id;
      await client.post(`/principal/students/${sid}/documents/student`, {
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
      Alert.alert('Error', err.response?.data?.error || 'Failed to record document');
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Staff: View full student dossier
  const openDossier = async (student) => {
    setDossierStudent(student);
    setDossierModalVisible(true);
    setLoadingDossier(true);
    try {
      const sid = student.student_id || student.id;
      const res = await client.get(`/principal/students/${sid}/documents`);
      setDossierData(res.data || {});
    } catch {
      setDossierData(null);
    } finally {
      setLoadingDossier(false);
    }
  };

  // Staff: Delete KYC document
  const handleDeleteDoc = async (docId) => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this verified document record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/documents/student/${docId}`);
              Alert.alert('Removed', 'Document record removed.');
              if (dossierStudent) openDossier(dossierStudent);
              loadData();
            } catch {
              Alert.alert('Error', 'Failed to remove document.');
            }
          },
        },
      ]
    );
  };

  const handleShareDoc = (doc) => {
    Share.share({
      message: `Document Record:\nTitle: ${doc.title || doc.doc_type}\nStatus: Verified\nIssued: ${doc.uploaded_at || doc.issued_at || 'Institutional Record'}`,
      title: doc.title || 'Document',
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENT / PARENT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isStaff) {
    const currentChild = myDocsData[activeChildIdx] || {};
    const kycDocs = currentChild.kyc_documents || currentChild.documents || [];
    const issuedCerts = currentChild.issued_documents || currentChild.certificates || [];

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Documents & Certificates</Text>
            <Text style={styles.headerSubtitle}>Verified Credentials & School Records</Text>
          </View>
        </View>

        {/* Parent Child Switcher */}
        {myDocsData.length > 1 && (
          <View style={styles.childBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {myDocsData.map((ch, idx) => (
                <TouchableOpacity
                  key={ch.student_id || idx}
                  style={[styles.childChip, activeChildIdx === idx && styles.childChipActive]}
                  onPress={() => setActiveChildIdx(idx)}
                >
                  <Text style={[styles.childChipText, activeChildIdx === idx && styles.childChipTextActive]}>
                    {ch.student_name || `Child ${idx + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, studentActiveTab === 'KYC' && styles.tabBtnActive]}
            onPress={() => setStudentActiveTab('KYC')}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={studentActiveTab === 'KYC' ? colors.primary : '#64748b'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabBtnText, studentActiveTab === 'KYC' && styles.tabBtnTextActive]}>
              KYC Documents ({kycDocs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, studentActiveTab === 'CERTIFICATES' && styles.tabBtnActive]}
            onPress={() => setStudentActiveTab('CERTIFICATES')}
          >
            <Ionicons
              name="ribbon-outline"
              size={16}
              color={studentActiveTab === 'CERTIFICATES' ? colors.primary : '#64748b'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabBtnText, studentActiveTab === 'CERTIFICATES' && styles.tabBtnTextActive]}>
              Issued Certificates ({issuedCerts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading credentials...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
          >
            {studentActiveTab === 'KYC' ? (
              kycDocs.length > 0 ? (
                kycDocs.map((doc, i) => (
                  <View key={doc.id || i} style={styles.cardItem}>
                    <View style={styles.cardItemHeader}>
                      <View style={[styles.avatar, { backgroundColor: '#f0fdf4' }]}>
                        <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.cardItemTitle}>{doc.title || doc.doc_type}</Text>
                        <Text style={styles.cardItemSub}>
                          Type: {DOC_TYPES.find(d => d.key === doc.doc_type)?.label || doc.doc_type}
                        </Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                      </View>
                    </View>
                    {doc.remarks ? (
                      <Text style={styles.docNotes}>Notes: {doc.remarks}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="document-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No Uploaded KYC Records</Text>
                  <Text style={styles.emptySub}>Official school documents will appear here once verified.</Text>
                </View>
              )
            ) : (
              issuedCerts.length > 0 ? (
                issuedCerts.map((cert, i) => (
                  <View key={cert.id || i} style={styles.cardItem}>
                    <View style={styles.cardItemHeader}>
                      <View style={[styles.avatar, { backgroundColor: '#f5f3ff' }]}>
                        <Ionicons name="ribbon" size={22} color="#7c3aed" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.cardItemTitle}>{cert.title || 'Official Certificate'}</Text>
                        <Text style={styles.cardItemSub}>
                          Serial: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{cert.certificate_no || cert.serial_number || '—'}</Text>
                        </Text>
                        <Text style={styles.certDateText}>Issued: {cert.issued_at || 'Academic Session'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.shareSmallBtn}
                      onPress={() => handleShareDoc(cert)}
                    >
                      <Ionicons name="share-outline" size={14} color="#7c3aed" />
                      <Text style={styles.shareSmallBtnText}>Share Details</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="ribbon-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No Certificates Issued</Text>
                  <Text style={styles.emptySub}>Transfer or Bonafide certificates will appear here once issued by the school.</Text>
                </View>
              )
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN / PRINCIPAL / TEACHER VIEW (COMPLIANCE MATRIX)
  // ═══════════════════════════════════════════════════════════════════════════
  const totalStudents = analytics?.total_students || studentsStatus.length;
  const completeKYC = analytics?.complete_students || studentsStatus.filter(s => s.status === 'COMPLETE' || s.completion_pct >= 100).length;
  const pendingKYC = analytics?.pending_students || (totalStudents - completeKYC);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Student Documents & KYC</Text>
          <Text style={styles.headerSubtitle}>Verification Matrix & Audit Compliance</Text>
        </View>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigation?.navigate?.('IssueCertificates')}
        >
          <Ionicons name="ribbon-outline" size={16} color="#ffffff" />
          <Text style={styles.headerActionText}>Issue Cert</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Overview Banner */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{totalStudents}</Text>
          <Text style={styles.kpiLbl}>Total Students</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#dcfce7' }]}>
          <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{completeKYC}</Text>
          <Text style={styles.kpiLbl}>Complete KYC</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: '#fee2e2' }]}>
          <Text style={[styles.kpiVal, { color: '#dc2626' }]}>{pendingKYC}</Text>
          <Text style={styles.kpiLbl}>Pending / Missing</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarBox}>
        <Ionicons name="search-outline" size={16} color="#64748b" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search by student name or admission number..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Class Chips */}
      <View style={{ height: 38, marginBottom: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChipsScroll}>
          <TouchableOpacity
            style={[styles.classChip, !selectedClassId && styles.classChipActive]}
            onPress={() => setSelectedClassId('')}
          >
            <Text style={[styles.classChipText, !selectedClassId && styles.classChipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classes.map(c => {
            const isSel = selectedClassId === String(c.id);
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
      </View>

      {/* Status Chips */}
      <View style={{ height: 36, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChipsScroll}>
          {['ALL', 'COMPLETE', 'PENDING', 'MISSING'].map(st => {
            const isSel = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.statusChip, isSel && styles.statusChipActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[styles.statusChipText, isSel && styles.statusChipTextActive]}>
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Compliance List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching compliance matrix...</Text>
        </View>
      ) : (
        <FlatList
          data={studentsStatus}
          keyExtractor={(item) => String(item.student_id || item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Student Records</Text>
              <Text style={styles.emptySub}>No students match the selected filter criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const pct = item.completion_pct != null ? item.completion_pct : (item.status === 'COMPLETE' ? 100 : 50);
            const isComplete = pct >= 100;

            return (
              <View style={styles.studentCard}>
                <View style={styles.studentCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentNameText}>{item.student_name || item.name}</Text>
                    <Text style={styles.studentClassText}>
                      Adm: {item.admission_no || '—'} • Class: {item.class_name || item.class_display || '—'}
                    </Text>
                  </View>
                  <View style={[styles.pctBadge, { backgroundColor: isComplete ? '#dcfce7' : '#fef3c7' }]}>
                    <Text style={[styles.pctBadgeText, { color: isComplete ? '#15803d' : '#b45309' }]}>
                      {pct}% KYC
                    </Text>
                  </View>
                </View>

                {/* Document Type Badges */}
                <View style={styles.docBadgesRow}>
                  {DOC_TYPES.slice(0, 4).map(d => {
                    const isUploaded = (item.uploaded_doc_types && item.uploaded_doc_types.includes(d.key)) || isComplete;
                    return (
                      <View
                        key={d.key}
                        style={[styles.docTypeBadge, isUploaded && styles.docTypeBadgeUploaded]}
                      >
                        <Ionicons
                          name={isUploaded ? 'checkmark-circle' : 'alert-circle-outline'}
                          size={12}
                          color={isUploaded ? '#16a34a' : '#94a3b8'}
                        />
                        <Text style={[styles.docTypeBadgeText, isUploaded && styles.docTypeBadgeTextUploaded]}>
                          {d.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.cardDivider} />

                {/* Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openDossier(item)}
                  >
                    <Ionicons name="folder-outline" size={14} color="#0284c7" />
                    <Text style={[styles.actionBtnOutlineText, { color: '#0284c7' }]}>View Dossier</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={() => {
                      setSelectedStudent(item);
                      setDocType('AADHAR_STUDENT');
                      setDocTitle('');
                      setDocRemarks('');
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={14} color="#ffffff" />
                    <Text style={styles.actionBtnPrimaryText}>Upload / Verify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Upload / Record Modal */}
      <Modal
        visible={!!selectedStudent}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Record Student Document</Text>
                <Text style={styles.modalSub}>
                  {selectedStudent?.student_name || selectedStudent?.name} (Adm: {selectedStudent?.admission_no || '—'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.inputLabel}>Document Category *</Text>
              <View style={styles.docChipsRow}>
                {DOC_TYPES.map(d => (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.smallChip, docType === d.key && styles.smallChipActive]}
                    onPress={() => {
                      setDocType(d.key);
                      setDocTitle(d.label);
                    }}
                  >
                    <Text style={[styles.smallChipText, docType === d.key && styles.smallChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Document Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Student Aadhaar Card (Original Verified)"
                value={docTitle}
                onChangeText={setDocTitle}
              />

              <Text style={styles.inputLabel}>Verification Remarks</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Physically verified original copy, ID number match..."
                multiline
                value={docRemarks}
                onChangeText={setDocRemarks}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingDoc && { opacity: 0.7 }]}
                onPress={handleRecordDocument}
                disabled={submittingDoc}
              >
                {submittingDoc ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Verify & Save Record</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Student Dossier Modal */}
      <Modal
        visible={dossierModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDossierModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {dossierStudent?.student_name || dossierStudent?.name || 'Student Dossier'}
                </Text>
                <Text style={styles.modalSub}>Complete Document Portfolio</Text>
              </View>
              <TouchableOpacity onPress={() => setDossierModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingDossier ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching student portfolio...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={styles.dossierSectionHeading}>Verified KYC Documents</Text>
                {dossierData?.student_documents && dossierData.student_documents.length > 0 ? (
                  dossierData.student_documents.map((d, i) => (
                    <View key={d.id || i} style={styles.dossierItemCard}>
                      <View style={styles.dossierHeader}>
                        <Text style={styles.dossierTitle}>{d.title || d.doc_type}</Text>
                        <TouchableOpacity onPress={() => handleDeleteDoc(d.id)}>
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.dossierMeta}>
                        Uploaded: {d.uploaded_at || 'Verified'} • {d.doc_type}
                      </Text>
                      {d.remarks ? <Text style={styles.dossierNotes}>{d.remarks}</Text> : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyNotice}>No KYC documents uploaded yet.</Text>
                )}

                <Text style={[styles.dossierSectionHeading, { marginTop: 14 }]}>Issued Certificates</Text>
                {dossierData?.issued_documents && dossierData.issued_documents.length > 0 ? (
                  dossierData.issued_documents.map((c, i) => (
                    <View key={c.id || i} style={styles.dossierItemCard}>
                      <View style={styles.dossierHeader}>
                        <Text style={styles.dossierTitle}>{c.title || 'Official Certificate'}</Text>
                        <Text style={styles.serialTag}>#{c.certificate_no || c.serial_number || 'OFFICIAL'}</Text>
                      </View>
                      <Text style={styles.dossierMeta}>Issued: {c.issued_at || 'Today'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyNotice}>No certificates issued for this student.</Text>
                )}
              </ScrollView>
            )}
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
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 2,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  classChipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  classChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  classChipActive: {
    backgroundColor: colors.primary,
  },
  classChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  classChipTextActive: {
    color: '#ffffff',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  statusChipActive: {
    backgroundColor: '#0f172a',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  studentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  studentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  studentNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentClassText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pctBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  docBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  docTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docTypeBadgeUploaded: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  docTypeBadgeText: {
    fontSize: 10,
    color: '#64748b',
  },
  docTypeBadgeTextUploaded: {
    color: '#15803d',
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  childBar: {
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  childChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  childChipActive: {
    backgroundColor: colors.primary,
  },
  childChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  childChipTextActive: {
    color: '#ffffff',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  cardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  certDateText: {
    fontSize: 10,
    color: '#7c3aed',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  docNotes: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  shareSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  shareSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  docChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  smallChipActive: {
    backgroundColor: colors.primary,
  },
  smallChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  smallChipTextActive: {
    color: '#ffffff',
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dossierSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  dossierItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dossierTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  dossierMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  dossierNotes: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  serialTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
  },
  emptyNotice: {
    fontSize: 12,
    color: '#94a3b8',
    paddingVertical: 8,
  },
});
