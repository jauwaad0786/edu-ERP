// mob_app/src/screens/students/StudentDetailScreen.js
// 100% Feature Parity with Web ERP StudentProfile.jsx & all backend student APIs
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert, Linking, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const AVATAR_COLORS = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe'];

const TABS = [
  { key: 'overview',   label: 'Overview',   icon: 'person-outline' },
  { key: 'history',    label: 'History',    icon: 'time-outline' },
  { key: 'attendance', label: 'Attendance', icon: 'checkbox-outline' },
  { key: 'fees',       label: 'Fees',       icon: 'cash-outline' },
  { key: 'marks',      label: 'Marks',      icon: 'ribbon-outline' },
  { key: 'transport',  label: 'Transport',  icon: 'bus-outline' },
  { key: 'documents',  label: 'Documents',  icon: 'document-text-outline' },
];

export default function StudentDetailScreen({ route, navigation }) {
  const { student: passedStudent, student_id, studentId, id, tab: initialTab } = route?.params || {};
  const sid = passedStudent?.id || student_id || studentId || id;

  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [student, setStudent] = useState(passedStudent || null);
  const [fees, setFees] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [history, setHistory] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [transportInfo, setTransportInfo] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Fetch full student profile and related data
  const loadFullProfile = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    try {
      const [stuRes, feeRes, attRes, histRes, transRes, docRes] = await Promise.all([
        // 1. Full student profile (includes info and exams)
        client.get(`/principal/students/${sid}/profile`).catch(() =>
          client.get(`/principal/students/${sid}`).catch(() => ({ data: passedStudent }))
        ),
        // 2. Fee records
        client.get(`/principal/fees/student-records/${sid}`).catch(() => ({ data: null })),
        // 3. Attendance monthly summary
        client.get(`/teacher/attendance/monthly/${sid}`).catch(() => ({ data: null })),
        // 4. Multi-year academic history
        client.get(`/principal/students/${sid}/history`).catch(() => ({ data: { history: [] } })),
        // 5. Transport info
        client.get(`/transport/students/browse?search=${sid}&per_page=1`).catch(() => ({ data: { data: [] } })),
        // 6. Documents
        client.get(`/principal/students/${sid}/documents`).catch(() => ({ data: { documents: [] } })),
      ]);

      const stuData = stuRes.data?.student || stuRes.data?.info || stuRes.data;
      if (stuData) {
        setStudent(stuData);
        setEditForm({
          name: stuData.name || '',
          roll_number: String(stuData.roll_number || stuData.roll_no || ''),
          father_name: stuData.father_name || '',
          parent_phone: stuData.parent_phone || '',
          parent_email: stuData.parent_email || '',
          blood_group: stuData.blood_group || '',
          gender: stuData.gender || 'Male',
          dob: stuData.dob ? String(stuData.dob).slice(0, 10) : '',
          category: stuData.category || 'General',
          address: stuData.address || '',
          aadhar_no: stuData.aadhar_no || '',
          religion: stuData.religion || '',
          nationality: stuData.nationality || 'Indian',
        });
      }

      // Exams
      const examList = stuRes.data?.exams || [];
      setExams(examList);
      if (examList.length > 0 && !selectedExam) {
        setSelectedExam(examList[0].exam_type);
      }

      setFees(feeRes.data);
      setAttendance(attRes.data || stuRes.data?.attendance);
      setHistory(histRes.data?.history || histRes.data?.enrollments || []);

      if (transRes.data?.data && transRes.data.data.length > 0) {
        setTransportInfo(transRes.data.data[0]);
      }

      setDocuments(docRes.data?.documents || docRes.data?.student_documents || []);
    } catch (err) {
      console.warn('Failed to load full student details:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [sid, passedStudent, selectedExam]);

  useEffect(() => {
    loadFullProfile();
  }, [loadFullProfile]);

  // Handle Edit Profile Save
  const handleSaveProfile = async () => {
    if (!student?.id) return;
    setSavingEdit(true);
    try {
      await client.put(`/principal/students/${student.id}`, editForm);
      Alert.alert('Profile Updated', 'Student profile has been updated successfully.');
      setShowEditModal(false);
      loadFullProfile();
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.error || 'Could not update student profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Download Admission Card PDF
  const handleDownloadAdmissionCard = async () => {
    if (!student?.id) return;
    try {
      const url = `${client.defaults.baseURL}/principal/admission-card/${student.id}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Download Error', 'Could not open admission card.');
    }
  };

  // Delete / Archive Student
  const handleDeleteStudent = () => {
    if (!student?.id) return;
    Alert.alert(
      'Move to Deleted Items?',
      `Are you sure you want to remove ${student.name || 'this student'}? This record will be moved to DELETED ITEMS and remains recoverable for 1 year (365 days).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive / Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await client.delete(`/principal/students/${student.id}`);
              Alert.alert('Student Archived', 'Student record has been archived successfully.', [
                { text: 'OK', onPress: () => (navigation?.goBack ? navigation.goBack() : null) }
              ]);
            } catch (err) {
              Alert.alert('Action Failed', err.response?.data?.error || 'Could not delete student record.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Full Student Profile...</Text>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="person-outline" size={48} color={colors.muted} style={{ opacity: 0.4, marginBottom: 12 }} />
        <Text style={styles.loadingText}>Student not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const name = student.name || student.student_name || 'Student';
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const attPct = attendance?.percentage != null
    ? Math.round(attendance.percentage)
    : attendance?.present && attendance?.total_days
    ? Math.round((attendance.present / attendance.total_days) * 100)
    : null;

  const feeRecords = Array.isArray(fees) ? fees : fees?.records || [];
  const totalPending = (fees?.pending != null)
    ? fees.pending
    : feeRecords.filter(f => f.status !== 'PAID').reduce((sum, f) => {
        const due = (f.amount_due || f.amount || 0) - (f.amount_paid || 0);
        return sum + Math.max(0, due);
      }, 0);

  const currentExam = exams.find(e => e.exam_type === selectedExam) || exams[0];

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
          <Text style={styles.headerSubtitle}>
            Adm #{student.admission_no || student.admission_number || '—'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => setShowEditModal(true)}
        >
          <Ionicons name="pencil-outline" size={17} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => navigation?.navigate('IDCard', { student_id: sid, student })}
        >
          <Ionicons name="card-outline" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Identity Hero Card */}
        <View style={styles.profileHeroCard}>
          <View style={styles.heroRow}>
            <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[0] }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.heroName}>{name}</Text>
                <View style={[
                  styles.statusPill,
                  { backgroundColor: student.status === 'PROVISIONAL' ? '#fef3c7' : '#dcfce7' }
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    { color: student.status === 'PROVISIONAL' ? '#d97706' : '#16a34a' }
                  ]}>
                    {student.status || 'ACTIVE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroMeta}>
                Class: {student.class_name || 'Class'} - Section {student.section || 'A'} &nbsp;·&nbsp; Roll: {student.roll_number || student.roll_no || '—'}
              </Text>
              <Text style={styles.heroSession}>Session: {student.session || '2026-27'}</Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={[styles.metricPill, { backgroundColor: totalPending > 0 ? '#fee2e2' : '#dcfce7' }]}>
              <Ionicons name="cash" size={14} color={totalPending > 0 ? '#dc2626' : '#16a34a'} />
              <Text style={[styles.metricText, { color: totalPending > 0 ? '#dc2626' : '#16a34a' }]}>
                {totalPending > 0 ? `₹${Number(totalPending).toLocaleString('en-IN')} Due` : 'Fees Clear'}
              </Text>
            </View>

            {attPct != null && (
              <View style={[styles.metricPill, { backgroundColor: attPct >= 75 ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons name="calendar" size={14} color={attPct >= 75 ? '#16a34a' : '#dc2626'} />
                <Text style={[styles.metricText, { color: attPct >= 75 ? '#16a34a' : '#dc2626' }]}>
                  {attPct}% Attendance
                </Text>
              </View>
            )}
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            {Boolean(student.parent_phone || student.father_phone || student.phone) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                onPress={() => Linking.openURL(`tel:${student.parent_phone || student.father_phone || student.phone}`)}
              >
                <Ionicons name="call" size={15} color="#0b57d0" />
                <Text style={[styles.actionBtnText, { color: '#0b57d0' }]}>Call</Text>
              </TouchableOpacity>
            )}

            {Boolean(student.parent_phone || student.father_phone || student.phone) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#dcfce7' }]}
                onPress={() => {
                  const num = String(student.parent_phone || student.father_phone || student.phone).replace(/\D/g, '');
                  const intlNum = num.length === 10 ? `91${num}` : num;
                  Linking.openURL(`https://wa.me/${intlNum}?text=Hello%20Parent%2C%20regarding%20${encodeURIComponent(name)}`).catch(() => {});
                }}
              >
                <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
                <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#e0f2fe' }]}
              onPress={handleDownloadAdmissionCard}
            >
              <Ionicons name="document-text" size={15} color="#0369a1" />
              <Text style={[styles.actionBtnText, { color: '#0369a1' }]}>Adm Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]}
              onPress={() => navigation?.navigate('FeeCollect', { student })}
            >
              <Ionicons name="card" size={15} color="#b45309" />
              <Text style={[styles.actionBtnText, { color: '#b45309' }]}>Collect Fee</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation Strip */}
        <View style={styles.tabStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabChip, isActive && styles.tabChipActive]}
                  onPress={() => setActiveTab(t.key)}
                >
                  <Ionicons
                    name={t.icon}
                    size={14}
                    color={isActive ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <InfoRow icon="person-outline" label="Full Legal Name" value={name} />
              <View style={styles.divider} />
              <InfoRow icon="calendar-outline" label="Date of Birth" value={student.dob ? String(student.dob).slice(0, 10) : '—'} />
              <View style={styles.divider} />
              <InfoRow icon="male-female-outline" label="Gender" value={student.gender} />
              <View style={styles.divider} />
              <InfoRow icon="medkit-outline" label="Blood Group" value={student.blood_group} />
              <View style={styles.divider} />
              <InfoRow icon="pricetag-outline" label="Category" value={student.category} />
              <View style={styles.divider} />
              <InfoRow icon="card-outline" label="Aadhar Card No" value={student.aadhar_no} />
              <View style={styles.divider} />
              <InfoRow icon="flag-outline" label="Nationality" value={student.nationality || 'Indian'} />
              <View style={styles.divider} />
              <InfoRow icon="heart-outline" label="Religion" value={student.religion} />
              <View style={styles.divider} />
              <InfoRow icon="location-outline" label="Residential Address" value={student.address} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Parent &amp; Guardian Dossier</Text>
              <InfoRow icon="man-outline" label="Father's Name" value={student.father_name} />
              <View style={styles.divider} />
              <InfoRow icon="woman-outline" label="Mother's Name" value={student.mother_name} />
              <View style={styles.divider} />
              <InfoRow icon="call-outline" label="Primary Parent Phone" value={student.parent_phone} />
              <View style={styles.divider} />
              <InfoRow icon="mail-outline" label="Parent Email" value={student.parent_email} />
              <View style={styles.divider} />
              <InfoRow icon="shield-checkmark-outline" label="Emergency Contact" value={student.emergency_phone || student.parent_phone} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Academic Classification</Text>
              <InfoRow icon="school-outline" label="Class &amp; Section" value={`${student.class_name || 'Class'} - ${student.section || 'A'}`} />
              <View style={styles.divider} />
              <InfoRow icon="document-outline" label="Roll Number" value={student.roll_number || student.roll_no} />
              <View style={styles.divider} />
              <InfoRow icon="home-outline" label="House" value={student.house} />
              <View style={styles.divider} />
              <InfoRow icon="git-branch-outline" label="Stream" value={student.stream || 'General'} />
              <View style={styles.divider} />
              <InfoRow icon="calendar-outline" label="Admission Date" value={student.admission_date ? String(student.admission_date).slice(0, 10) : '—'} />
            </View>

            <TouchableOpacity style={styles.deleteCardBtn} onPress={handleDeleteStudent} disabled={deleting}>
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
              <Text style={styles.deleteCardBtnText}>
                {deleting ? 'Archiving...' : 'Move Student to Deleted Items (365d retention)'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TAB 2: ACADEMIC HISTORY ── */}
        {activeTab === 'history' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Multi-Year Academic History</Text>
            <Text style={styles.cardSubtitle}>
              Continuous record of session enrollments, grade progression, and promotional rollover.
            </Text>

            {history.length > 0 ? (
              history.map((h, i) => (
                <View key={h.id || i} style={styles.historyItem}>
                  <View style={styles.historyDot} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.historySession}>{h.session || 'Session'}</Text>
                      <View style={[styles.historyBadge, { backgroundColor: h.enrollment_status === 'PROMOTED' ? '#dcfce7' : '#f1f5f9' }]}>
                        <Text style={[styles.historyBadgeText, { color: h.enrollment_status === 'PROMOTED' ? '#15803d' : '#475569' }]}>
                          {h.enrollment_status || 'ACTIVE'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyClass}>
                      Class: {h.class_name || (h.class_ref?.name ? `${h.class_ref.name} - ${h.section || h.class_ref.section}` : `Class ID ${h.class_id}`)}
                    </Text>
                    {h.remarks ? (
                      <Text style={styles.historyRemarks}>Note: {h.remarks}</Text>
                    ) : null}
                    <Text style={styles.historyDate}>
                      Enrolled: {h.enrolled_date ? String(h.enrolled_date).slice(0, 10) : (h.created_at ? String(h.created_at).slice(0, 10) : '—')}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCardBox}>
                <Ionicons name="time-outline" size={36} color="#cbd5e1" />
                <Text style={styles.emptyCardText}>No multi-year history records logged yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── TAB 3: ATTENDANCE ── */}
        {activeTab === 'attendance' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Attendance Performance</Text>
              <View style={styles.attSummaryGrid}>
                <View style={[styles.attSummaryBox, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[styles.attSummaryVal, { color: '#16a34a' }]}>{attendance?.present || attendance?.present_days || 0}</Text>
                  <Text style={styles.attSummaryLabel}>Days Present</Text>
                </View>
                <View style={[styles.attSummaryBox, { backgroundColor: '#fef2f2' }]}>
                  <Text style={[styles.attSummaryVal, { color: '#dc2626' }]}>{attendance?.absent || attendance?.absent_days || 0}</Text>
                  <Text style={styles.attSummaryLabel}>Days Absent</Text>
                </View>
                <View style={[styles.attSummaryBox, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[styles.attSummaryVal, { color: '#0b57d0' }]}>
                    {attendance?.percentage != null ? `${Math.round(attendance.percentage)}%` : `${attPct || 0}%`}
                  </Text>
                  <Text style={styles.attSummaryLabel}>Overall Rate</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => navigation?.navigate('Attendance')}
            >
              <Ionicons name="calendar-outline" size={16} color="#ffffff" />
              <Text style={styles.primaryActionBtnText}>Open Daily Attendance Register</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TAB 4: FEES ── */}
        {activeTab === 'fees' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.cardTitle}>Fee Balance &amp; Demands</Text>
                <TouchableOpacity
                  style={styles.collectSmallBtn}
                  onPress={() => navigation?.navigate('FeeCollect', { student })}
                >
                  <Ionicons name="cash-outline" size={14} color="#ffffff" />
                  <Text style={styles.collectSmallBtnText}>Collect</Text>
                </TouchableOpacity>
              </View>

              {feeRecords.length > 0 ? (
                feeRecords.map((f, idx) => (
                  <View key={f.id || idx} style={styles.feeRecordItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feeRecordTitle}>{f.fee_type || f.fee_head || 'School Fee'}</Text>
                      <Text style={styles.feeRecordMeta}>Month / Term: {f.month || f.session || 'Current'}</Text>
                      <Text style={styles.feeRecordAmount}>
                        Due: ₹{f.amount || f.amount_due || 0} &nbsp;|&nbsp; Paid: ₹{f.amount_paid || 0}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusPill,
                      { backgroundColor: f.status === 'PAID' ? '#dcfce7' : '#fee2e2' }
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        { color: f.status === 'PAID' ? '#15803d' : '#dc2626' }
                      ]}>
                        {f.status || 'UNPAID'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCardBox}>
                  <Ionicons name="checkmark-circle-outline" size={36} color="#16a34a" />
                  <Text style={styles.emptyCardText}>No outstanding fee demands on record.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── TAB 5: MARKS ── */}
        {activeTab === 'marks' && (
          <View style={{ gap: 12 }}>
            {exams.length > 0 ? (
              <>
                {/* Exam selector chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {exams.map(e => (
                    <TouchableOpacity
                      key={e.exam_type}
                      style={[styles.examChip, selectedExam === e.exam_type && styles.examChipActive]}
                      onPress={() => setSelectedExam(e.exam_type)}
                    >
                      <Text style={[styles.examChipText, selectedExam === e.exam_type && styles.examChipTextActive]}>
                        {e.exam_type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {currentExam && (
                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={styles.cardTitle}>{currentExam.exam_type}</Text>
                      <View style={[styles.statusPill, { backgroundColor: currentExam.avg_pct >= 33 ? '#dcfce7' : '#fee2e2' }]}>
                        <Text style={[styles.statusPillText, { color: currentExam.avg_pct >= 33 ? '#16a34a' : '#dc2626' }]}>
                          {currentExam.avg_pct}% &nbsp;{currentExam.avg_pct >= 33 ? 'PASS' : 'FAIL'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                      Total Score: <strong>{currentExam.total_obtained || 0}</strong> / {currentExam.total_max || 0}
                    </Text>

                    {(currentExam.subjects || []).map((sub, sIdx) => (
                      <View key={sIdx} style={styles.subjectRow}>
                        <Text style={styles.subjectName}>{sub.subject}</Text>
                        <Text style={styles.subjectScore}>
                          {sub.marks_obtained} / {sub.max_marks} ({sub.percentage}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.card}>
                <View style={styles.emptyCardBox}>
                  <Ionicons name="ribbon-outline" size={36} color="#cbd5e1" />
                  <Text style={styles.emptyCardText}>No examination marks records uploaded yet.</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── TAB 6: TRANSPORT ── */}
        {activeTab === 'transport' && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Transport Enrollment</Text>
              {transportInfo ? (
                <>
                  <InfoRow icon="bus-outline" label="Assigned Vehicle" value={transportInfo.vehicle_number || 'School Bus'} />
                  <View style={styles.divider} />
                  <InfoRow icon="navigate-outline" label="Route Name" value={transportInfo.route_name || 'Assigned Route'} />
                  <View style={styles.divider} />
                  <InfoRow icon="person-outline" label="Driver" value={transportInfo.driver_name} />
                  <View style={styles.divider} />
                  <InfoRow icon="call-outline" label="Driver Phone" value={transportInfo.driver_phone} />
                  <View style={styles.divider} />
                  <InfoRow icon="pin-outline" label="Pickup Stop" value={transportInfo.pickup_stop_name || 'Standard Stop'} />
                  <View style={styles.divider} />
                  <InfoRow icon="flag-outline" label="Drop Stop" value={transportInfo.drop_stop_name || 'Standard Stop'} />
                </>
              ) : (
                <View style={styles.emptyCardBox}>
                  <Ionicons name="bus-outline" size={36} color="#cbd5e1" />
                  <Text style={styles.emptyCardText}>Student is not currently enrolled in school transport.</Text>
                </View>
              )}
            </View>

            {transportInfo && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => navigation?.navigate('LiveTracking')}
              >
                <Ionicons name="map-outline" size={16} color="#ffffff" />
                <Text style={styles.primaryActionBtnText}>Open Live Bus Tracker</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── TAB 7: DOCUMENTS ── */}
        {activeTab === 'documents' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>KYC &amp; Certificates</Text>
            <Text style={styles.cardSubtitle}>
              Government IDs, Transfer Certificates (TC), and Issued Documents.
            </Text>

            {documents.length > 0 ? (
              documents.map((d, dIdx) => (
                <View key={d.id || dIdx} style={styles.docItem}>
                  <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.docTitle}>{d.title || d.document_type || 'Document'}</Text>
                    <Text style={styles.docMeta}>
                      Status: {d.status || 'VERIFIED'} &nbsp;·&nbsp; {d.created_at ? String(d.created_at).slice(0, 10) : ''}
                    </Text>
                  </View>
                  {d.file_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(d.file_url)}>
                      <Ionicons name="eye-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyCardBox}>
                <Ionicons name="document-outline" size={36} color="#cbd5e1" />
                <Text style={styles.emptyCardText}>No uploaded student documents found.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top']}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={{ fontSize: 15, color: '#64748b' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Edit Student Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={savingEdit}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>
                {savingEdit ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Legal Name *</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.name}
                onChangeText={t => setEditForm(p => ({ ...p, name: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Roll Number</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.roll_number}
                onChangeText={t => setEditForm(p => ({ ...p, roll_number: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Father's Name</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.father_name}
                onChangeText={t => setEditForm(p => ({ ...p, father_name: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Parent Mobile / WhatsApp</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="phone-pad"
                value={editForm.parent_phone}
                onChangeText={t => setEditForm(p => ({ ...p, parent_phone: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Parent Email</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="email-address"
                autoCapitalize="none"
                value={editForm.parent_email}
                onChangeText={t => setEditForm(p => ({ ...p, parent_email: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.dob}
                placeholder="2012-05-15"
                onChangeText={t => setEditForm(p => ({ ...p, dob: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Blood Group</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.blood_group}
                placeholder="B+"
                onChangeText={t => setEditForm(p => ({ ...p, blood_group: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Aadhar Card No</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editForm.aadhar_no}
                onChangeText={t => setEditForm(p => ({ ...p, aadhar_no: t }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Residential Address</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                multiline
                value={editForm.address}
                onChangeText={t => setEditForm(p => ({ ...p, address: t }))}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '600',
  },
  backBtn: {
    marginTop: 12,
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: {
    padding: 4,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#bfdbfe',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  scrollContent: {
    padding: 14,
    gap: 14,
  },
  profileHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  heroName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  heroSession: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  metricsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  metricText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabStrip: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabScroll: {
    gap: 6,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 2,
  },
  deleteCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  deleteCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  historySession: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyClass: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  historyRemarks: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  historyDate: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyCardBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyCardText: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  attSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  attSummaryBox: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  attSummaryVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  attSummaryLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  collectSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  collectSmallBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  feeRecordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  feeRecordTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  feeRecordMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  feeRecordAmount: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
  },
  examChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  examChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  examChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  examChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  subjectName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  subjectScore: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  docMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
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
  },
});
