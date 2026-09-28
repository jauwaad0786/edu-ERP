// mob_app/src/screens/documents/IssueCertificatesScreen.js
// Institutional Certificate Issuance Workspace — 100% mirrors Web ERP DocumentsPage.jsx
// Handles Transfer Certificate (TC), Bonafide, Character, SLC, and Fee Clearance with auto-serial generation.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const CERT_TEMPLATES = [
  {
    key: 'TRANSFER_CERTIFICATE',
    label: 'Transfer Certificate (TC)',
    icon: 'document-text-outline',
    color: '#0f766e',
    badge: 'OFFICIAL TC',
  },
  {
    key: 'BONAFIDE',
    label: 'Bonafide Certificate',
    icon: 'school-outline',
    color: '#4338ca',
    badge: 'STUDENT BONAFIDE',
  },
  {
    key: 'CHARACTER_CERTIFICATE',
    label: 'Character Certificate',
    icon: 'ribbon-outline',
    color: '#1d4ed8',
    badge: 'BONAFIDE & CONDUCT',
  },
  {
    key: 'SCHOOL_LEAVING_CERTIFICATE',
    label: 'School Leaving (SLC)',
    icon: 'exit-outline',
    color: '#1e3a8a',
    badge: 'OFFICIAL SLC',
  },
  {
    key: 'FEE_CLEARANCE',
    label: 'No Dues / Clearance',
    icon: 'receipt-outline',
    color: '#059669',
    badge: 'FEE CLEARANCE',
  },
  {
    key: 'SPORTS_ACHIEVEMENT',
    label: 'Sports Achievement',
    icon: 'trophy-outline',
    color: '#ea580c',
    badge: 'SPORTS AWARD',
  },
];

const CONDUCT_OPTIONS = ['Exemplary', 'Very Good', 'Good', 'Satisfactory'];
const PROMOTION_OPTIONS = ['Yes', 'No', 'N/A - Mid Session'];

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

  // Form Fields per Certificate Type
  const [formFields, setFormFields] = useState({
    reason_for_leaving: 'Family Relocation / Higher Studies',
    conduct: 'Very Good',
    last_class_studied: '',
    promoted_to_next: 'Yes',
    dues_paid: 'Cleared - No Dues Pending',
    total_meetings: '210',
    attended_meetings: '195',
    purpose: 'For Higher Studies / Admission',
    academic_session: '2026-27',
    remarks: 'Bearing a good moral conduct and diligent character.',
    sport_name: 'Athletics',
    event_name: 'Annual Inter-School Sports Meet',
    position_rank: 'First Position (Gold Medal)',
  });
  const [generalRemarks, setGeneralRemarks] = useState('');
  const [visibleToStudent, setVisibleToStudent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // View Certificate Modal
  const [viewingCertData, setViewingCertData] = useState(null);
  const [loadingCertData, setLoadingCertData] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);

  // Load Classes
  useEffect(() => {
    client.get('/principal/classes')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
        setClasses(list);
      })
      .catch(() => {});
  }, []);

  const loadWorkspace = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { doc_type: selectedTemplate };
      if (selectedClassId) params.class_id = selectedClassId;

      const res = await client.get('/principal/documents/issue-workspace', { params });
      setIssuedList(res.data?.issued || res.data?.documents || []);
      setStudents(res.data?.students || []);
    } catch {
      setIssuedList([]);
      setStudents([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
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
      } catch {
        setStudentResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, showIssueModal, targetStudent]);

  const openIssueModal = (preselectedStudent = null) => {
    setTargetStudent(preselectedStudent);
    setStudentSearch('');
    setStudentResults([]);
    setGeneralRemarks('');
    setVisibleToStudent(true);

    const studentClass = preselectedStudent?.class_name || preselectedStudent?.class_display || '';
    setFormFields({
      reason_for_leaving: 'Family Relocation / Higher Studies',
      conduct: 'Very Good',
      last_class_studied: studentClass,
      promoted_to_next: 'Yes',
      dues_paid: 'Cleared - No Dues Pending',
      total_meetings: '210',
      attended_meetings: '195',
      purpose: 'For Higher Studies / Admission',
      academic_session: '2026-27',
      remarks: 'Bearing a good moral conduct and diligent character.',
      sport_name: 'Athletics',
      event_name: 'Annual Inter-School Sports Meet',
      position_rank: 'First Position (Gold Medal)',
    });
    setShowIssueModal(true);
  };

  const handleIssueCertificate = async () => {
    if (!targetStudent) {
      Alert.alert('Required', 'Please select a student.');
      return;
    }

    const tpl = CERT_TEMPLATES.find(t => t.key === selectedTemplate);
    const sid = targetStudent.id || targetStudent.student_id;

    try {
      setSubmitting(true);
      const res = await client.post(`/principal/students/${sid}/issue-certificate`, {
        doc_type: selectedTemplate,
        title: tpl?.label || 'Certificate',
        payload: formFields,
        remarks: generalRemarks,
        is_visible_to_student: visibleToStudent,
      });

      const certNo = res.data?.certificate_no || res.data?.document?.certificate_no || 'Generated';
      Alert.alert(
        'Certificate Issued',
        `${tpl?.label} issued successfully!\nSerial: ${certNo}`
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

  const openViewCertificate = async (item) => {
    setViewModalVisible(true);
    setLoadingCertData(true);
    setViewingCertData(null);
    try {
      const res = await client.get(`/principal/documents/issued/${item.id}/certificate-data`);
      setViewingCertData(res.data);
    } catch {
      setViewingCertData({
        document: item,
        student: { name: item.student_name, admission_no: item.admission_no || '—' },
        payload: item.payload_data ? JSON.parse(item.payload_data) : {},
      });
    } finally {
      setLoadingCertData(false);
    }
  };

  const handleDeleteIssued = async (item) => {
    Alert.alert(
      'Revoke Certificate',
      `Revoke ${item.title || 'Certificate'} #${item.certificate_no || item.serial_number || ''} for ${item.student_name}?`,
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
            } catch {
              Alert.alert('Error', 'Failed to revoke certificate');
            }
          },
        },
      ]
    );
  };

  const handleShareCertificate = (data) => {
    if (!data) return;
    const doc = data.document || {};
    const stu = data.student || {};
    const text = `Official Certificate Details:\n\nDocument: ${doc.title || 'Certificate'}\nSerial No: ${doc.certificate_no || doc.serial_number || '—'}\nStudent: ${stu.name || 'Student'}\nAdmission No: ${stu.admission_no || '—'}\nIssued Date: ${doc.issued_at || 'Today'}\nStatus: Officially Verified`;
    Share.share({ message: text, title: doc.title || 'Certificate' });
  };

  const filteredIssued = issuedList.filter(i =>
    !search ||
    i.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.certificate_no?.toLowerCase().includes(search.toLowerCase())
  );

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
          <Text style={styles.headerTitle}>Issue Certificates</Text>
          <Text style={styles.headerSubtitle}>TC, Bonafide & Character Credentials</Text>
        </View>
        <TouchableOpacity style={styles.issueHeaderBtn} onPress={() => openIssueModal()}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.issueHeaderBtnText}>Issue</Text>
        </TouchableOpacity>
      </View>

      {/* Template Selector Bar */}
      <View style={styles.templateBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateScroll}>
          {CERT_TEMPLATES.map(t => {
            const active = selectedTemplate === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.templateChip, active && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => setSelectedTemplate(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? '#ffffff' : t.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.templateChipText, active && { color: '#ffffff' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Class Filter & Search Row */}
      <View style={styles.filterRow}>
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

      {/* Search Input */}
      <View style={styles.searchBarBox}>
        <Ionicons name="search-outline" size={16} color="#64748b" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search by student name or certificate number..."
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

      {/* Issued Certificates List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching certificates repository...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIssued}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadWorkspace(true)}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="ribbon-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Certificates Issued Yet</Text>
              <Text style={styles.emptySub}>
                {search ? 'No match found for your search.' : 'Tap "+ Issue" to generate an official certificate.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const certNum = item.certificate_no || item.serial_number || 'N/A';
            return (
              <View style={styles.certCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Ionicons name="ribbon" size={20} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.studentName}>{item.student_name || 'Student'}</Text>
                    <Text style={styles.certTitleSub}>
                      {item.title || 'Official Certificate'}
                    </Text>
                    <Text style={styles.certSerialText}>
                      Serial: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{certNum}</Text>
                    </Text>
                  </View>
                  <View style={styles.validBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                    <Text style={styles.validBadgeText}>Verified</Text>
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
                    onPress={() => openViewCertificate(item)}
                  >
                    <Ionicons name="eye-outline" size={14} color="#7c3aed" />
                    <Text style={styles.viewBtnText}>View Certificate</Text>
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
          }}
        />
      )}

      {/* Issue Certificate Modal */}
      <Modal
        visible={showIssueModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Issue {CERT_TEMPLATES.find(t => t.key === selectedTemplate)?.label}
                </Text>
                <Text style={styles.modalSub}>Auto-incremented serial number & live printable registry</Text>
              </View>
              <TouchableOpacity onPress={() => setShowIssueModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* Student Selector */}
              <Text style={styles.inputLabel}>Select Candidate Student *</Text>
              {targetStudent ? (
                <View style={styles.selectedStudentBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedStudentName}>{targetStudent.name || targetStudent.student_name}</Text>
                    <Text style={styles.selectedStudentSub}>
                      Adm: {targetStudent.admission_no || '—'} • Class: {targetStudent.class_name || targetStudent.class_display || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setTargetStudent(null)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchStudentRow}>
                    <Ionicons name="search" size={16} color="#64748b" />
                    <TextInput
                      style={styles.searchStudentInput}
                      placeholder="Type name or admission number..."
                      placeholderTextColor="#94a3b8"
                      value={studentSearch}
                      onChangeText={setStudentSearch}
                    />
                  </View>
                  {studentResults.length > 0 && (
                    <View style={styles.resultsDrop}>
                      {studentResults.map(s => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.resultItem}
                          onPress={() => {
                            setTargetStudent(s);
                            setStudentSearch('');
                            setStudentResults([]);
                            setFormFields(prev => ({
                              ...prev,
                              last_class_studied: s.class_name || s.class_display || '',
                            }));
                          }}
                        >
                          <Text style={styles.resultTitle}>{s.name || s.student_name}</Text>
                          <Text style={styles.resultDesc}>
                            Adm #{s.admission_no || '—'} • Class {s.class_name || s.class_display || '—'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Dynamic Template Specific Form Fields */}
              <Text style={styles.sectionDividerText}>Certificate Parameters</Text>

              {/* TRANSFER CERTIFICATE FIELDS */}
              {(selectedTemplate === 'TRANSFER_CERTIFICATE' || selectedTemplate === 'SCHOOL_LEAVING_CERTIFICATE') && (
                <>
                  <Text style={styles.inputLabel}>Reason for Leaving School *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Relocation, parent request"
                    value={formFields.reason_for_leaving}
                    onChangeText={t => setFormFields({ ...formFields, reason_for_leaving: t })}
                  />

                  <Text style={styles.inputLabel}>Class in Which Last Studied</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Class 10th - A"
                    value={formFields.last_class_studied}
                    onChangeText={t => setFormFields({ ...formFields, last_class_studied: t })}
                  />

                  <Text style={styles.inputLabel}>General Conduct Rating</Text>
                  <View style={styles.chipsRow}>
                    {CONDUCT_OPTIONS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.smallChip, formFields.conduct === c && styles.smallChipActive]}
                        onPress={() => setFormFields({ ...formFields, conduct: c })}
                      >
                        <Text style={[styles.smallChipText, formFields.conduct === c && styles.smallChipTextActive]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Qualified for Promotion to Next Class</Text>
                  <View style={styles.chipsRow}>
                    {PROMOTION_OPTIONS.map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.smallChip, formFields.promoted_to_next === p && styles.smallChipActive]}
                        onPress={() => setFormFields({ ...formFields, promoted_to_next: p })}
                      >
                        <Text style={[styles.smallChipText, formFields.promoted_to_next === p && styles.smallChipTextActive]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>School Dues Clearance Status</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Cleared - No Dues Pending"
                    value={formFields.dues_paid}
                    onChangeText={t => setFormFields({ ...formFields, dues_paid: t })}
                  />
                </>
              )}

              {/* BONAFIDE CERTIFICATE FIELDS */}
              {selectedTemplate === 'BONAFIDE' && (
                <>
                  <Text style={styles.inputLabel}>Purpose of Bonafide Certificate *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Bus Pass, Bank Account Opening, Passport Verification"
                    value={formFields.purpose}
                    onChangeText={t => setFormFields({ ...formFields, purpose: t })}
                  />

                  <Text style={styles.inputLabel}>Academic Session</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2026-27"
                    value={formFields.academic_session}
                    onChangeText={t => setFormFields({ ...formFields, academic_session: t })}
                  />
                </>
              )}

              {/* CHARACTER CERTIFICATE FIELDS */}
              {selectedTemplate === 'CHARACTER_CERTIFICATE' && (
                <>
                  <Text style={styles.inputLabel}>Conduct & Moral Character *</Text>
                  <View style={styles.chipsRow}>
                    {CONDUCT_OPTIONS.map(c => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.smallChip, formFields.conduct === c && styles.smallChipActive]}
                        onPress={() => setFormFields({ ...formFields, conduct: c })}
                      >
                        <Text style={[styles.smallChipText, formFields.conduct === c && styles.smallChipTextActive]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Purpose of Issuance</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. For Higher Studies / College Admission"
                    value={formFields.purpose}
                    onChangeText={t => setFormFields({ ...formFields, purpose: t })}
                  />

                  <Text style={styles.inputLabel}>Academic & Moral Character Remarks</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60 }]}
                    placeholder="e.g. Bears exemplary moral conduct and keen diligence..."
                    multiline
                    value={formFields.remarks}
                    onChangeText={t => setFormFields({ ...formFields, remarks: t })}
                  />
                </>
              )}

              {/* SPORTS ACHIEVEMENT FIELDS */}
              {selectedTemplate === 'SPORTS_ACHIEVEMENT' && (
                <>
                  <Text style={styles.inputLabel}>Sport / Discipline *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Athletics, Cricket, Football"
                    value={formFields.sport_name}
                    onChangeText={t => setFormFields({ ...formFields, sport_name: t })}
                  />

                  <Text style={styles.inputLabel}>Tournament / Event Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Annual Inter-School Sports Meet"
                    value={formFields.event_name}
                    onChangeText={t => setFormFields({ ...formFields, event_name: t })}
                  />

                  <Text style={styles.inputLabel}>Position / Award Secured *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. First Position (Gold Medal)"
                    value={formFields.position_rank}
                    onChangeText={t => setFormFields({ ...formFields, position_rank: t })}
                  />
                </>
              )}

              {/* FEE CLEARANCE FIELDS */}
              {selectedTemplate === 'FEE_CLEARANCE' && (
                <>
                  <Text style={styles.inputLabel}>Dues Cleared Up To</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Entire Academic Session 2026-27"
                    value={formFields.dues_paid}
                    onChangeText={t => setFormFields({ ...formFields, dues_paid: t })}
                  />
                </>
              )}

              {/* Additional Remarks & Visibility */}
              <Text style={styles.inputLabel}>Authorized Remarks (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                placeholder="Official notes or registry endorsements..."
                multiline
                value={generalRemarks}
                onChangeText={setGeneralRemarks}
              />

              <TouchableOpacity
                style={styles.visibilityToggle}
                onPress={() => setVisibleToStudent(!visibleToStudent)}
              >
                <Ionicons
                  name={visibleToStudent ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={visibleToStudent ? colors.primary : '#94a3b8'}
                />
                <Text style={styles.visibilityText}>
                  Make immediately visible to Student / Parent portal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, (!targetStudent || submitting) && styles.submitBtnDisabled]}
                onPress={handleIssueCertificate}
                disabled={!targetStudent || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Generate & Issue Certificate</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Official Certificate Preview & Print Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTopTitle}>Official Certificate</Text>
                <Text style={styles.previewTopSub}>Authentic Institutional Record</Text>
              </View>
              <TouchableOpacity onPress={() => setViewModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingCertData ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading certificate credentials...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Certificate Frame */}
                <View style={styles.certFrame}>
                  {/* Emblem / Header */}
                  <View style={styles.certEmblemBox}>
                    <Ionicons name="ribbon" size={36} color="#0f766e" />
                    <Text style={styles.schoolHeaderName}>
                      {viewingCertData?.school?.name || 'INSTITUTIONAL ACADEMY'}
                    </Text>
                    <Text style={styles.schoolAddressText}>
                      {viewingCertData?.school?.address || 'CBSE Affiliated Institutional Campus'}
                    </Text>
                  </View>

                  <View style={styles.certRuleLine} />

                  <Text style={styles.certTypeBanner}>
                    {viewingCertData?.document?.title || 'CERTIFICATE OF MERIT'}
                  </Text>

                  <Text style={styles.certSerialBanner}>
                    Certificate No: {viewingCertData?.document?.certificate_no || viewingCertData?.document?.serial_number || 'OFFICIAL'}
                  </Text>

                  {/* Body Statement */}
                  <View style={styles.certStatementBox}>
                    <Text style={styles.certStatementText}>
                      This is to certify that{' '}
                      <Text style={{ fontWeight: '800', color: '#0f172a' }}>
                        {viewingCertData?.student?.name || 'The Student'}
                      </Text>
                      , bearing Admission Number{' '}
                      <Text style={{ fontWeight: '800', color: '#0f172a' }}>
                        {viewingCertData?.student?.admission_no || '—'}
                      </Text>
                      , son/daughter of{' '}
                      <Text style={{ fontWeight: '800', color: '#0f172a' }}>
                        {viewingCertData?.student?.parent_name || viewingCertData?.student?.father_name || 'Guardian'}
                      </Text>
                      , was a bonafide student of Class{' '}
                      <Text style={{ fontWeight: '800', color: '#0f172a' }}>
                        {viewingCertData?.student?.class_display || viewingCertData?.student?.class_name || '—'}
                      </Text>
                      .
                    </Text>

                    {/* Custom Attributes Table */}
                    {viewingCertData?.payload && Object.keys(viewingCertData.payload).length > 0 && (
                      <View style={styles.payloadGrid}>
                        {Object.entries(viewingCertData.payload).map(([k, v]) => (
                          <View key={k} style={styles.payloadRow}>
                            <Text style={styles.payloadKey}>{k.replace(/_/g, ' ').toUpperCase()}:</Text>
                            <Text style={styles.payloadVal}>{String(v)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Footer Signatures */}
                  <View style={styles.certSignRow}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.signLabel}>Issued Date</Text>
                      <Text style={styles.signValue}>{viewingCertData?.document?.issued_at || 'Today'}</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.sealCircle}>
                        <Text style={styles.sealText}>SEAL</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.signLabel}>Authorized Signatory</Text>
                      <Text style={styles.signValue}>Principal</Text>
                    </View>
                  </View>
                </View>

                {/* Share Button */}
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShareCertificate(viewingCertData)}
                >
                  <Ionicons name="share-social-outline" size={18} color="#ffffff" />
                  <Text style={styles.shareBtnText}>Share Certificate Statement</Text>
                </TouchableOpacity>
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
  issueHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  issueHeaderBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  templateBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  templateScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterRow: {
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
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
  certCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  certTitleSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  certSerialText: {
    fontSize: 11,
    color: '#7c3aed',
    marginTop: 2,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  validBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  certMetaBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  metaRowText: {
    fontSize: 12,
    color: '#64748b',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c3aed',
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  revokeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
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
    marginBottom: 4,
  },
  selectedStudentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  selectedStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectedStudentSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  changeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  searchStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  searchStudentInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  resultsDrop: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    maxHeight: 140,
  },
  resultItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sectionDividerText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 8,
    marginBottom: 8,
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
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  smallChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  visibilityText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    maxHeight: '92%',
  },
  previewTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  previewTopTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  previewTopSub: {
    fontSize: 11,
    color: '#64748b',
  },
  certFrame: {
    borderWidth: 2,
    borderColor: '#0f766e',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#fcfdfd',
  },
  certEmblemBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  schoolHeaderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
    textAlign: 'center',
  },
  schoolAddressText: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  certRuleLine: {
    height: 1,
    backgroundColor: '#0f766e',
    marginVertical: 8,
  },
  certTypeBanner: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f766e',
    textAlign: 'center',
    letterSpacing: 1,
  },
  certSerialBanner: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  certStatementBox: {
    gap: 8,
  },
  certStatementText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
    textAlign: 'justify',
  },
  payloadGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
    gap: 4,
  },
  payloadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payloadKey: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  payloadVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  certSignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  signLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  signValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  sealCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0f766e',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
