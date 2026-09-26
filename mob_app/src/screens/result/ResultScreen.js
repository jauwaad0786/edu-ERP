// mob_app/src/screens/result/ResultScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, Linking, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

export default function ResultScreen({ route, navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipalOrAdmin = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudentOrParent = role === 'STUDENT' || role === 'PARENT';

  const initialExamId = route?.params?.examId || null;

  // Student/Parent States
  const [publishedExams, setPublishedExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [examDetail, setExamDetail] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [currentStudentProfile, setCurrentStudentProfile] = useState(null);

  // Admin/Teacher States
  const [adminTab, setAdminTab] = useState('Approval'); // 'Approval' | 'Marksheets'
  const [adminExams, setAdminExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [dashboardData, setDashboardData] = useState([]);
  const [students, setStudents] = useState([]);

  // Preview Student Result Modal
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewResultData, setPreviewResultData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Return Reason Modal
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [targetReturnSubject, setTargetReturnSubject] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  // Loaders
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Initial Load based on Role
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isStudentOrParent) {
        // Load student profile & published exam summaries
        const [profileRes, marksRes] = await Promise.all([
          client.get('/student/profile').catch(() => null),
          client.get('/student/marks').catch(() => ({ data: [] })),
        ]);

        if (profileRes?.data) {
          if (role === 'PARENT' && Array.isArray(profileRes.data.children)) {
            setChildren(profileRes.data.children);
            const first = profileRes.data.children[0];
            setSelectedChildId(first?.id || null);
            setCurrentStudentProfile(first || null);
          } else {
            setCurrentStudentProfile(profileRes.data);
          }
        }

        const rawMarks = Array.isArray(marksRes.data) ? marksRes.data : [];
        setPublishedExams(rawMarks);
        if (rawMarks.length > 0 && !selectedExamId) {
          setSelectedExamId(rawMarks[0].exam_id);
        }
      } else {
        // Principal / Teacher
        const [examRes, clsRes] = await Promise.all([
          client.get('/principal/exams').catch(() => ({ data: [] })),
          client.get('/principal/classes').catch(() => ({ data: [] })),
        ]);

        const eList = Array.isArray(examRes.data) ? examRes.data : examRes.data?.exams || [];
        const cList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
        setAdminExams(eList);
        setClasses(cList);

        if (eList.length > 0 && !selectedExamId) {
          setSelectedExamId(eList[0].id);
        }
        if (cList.length > 0 && !selectedClassId) {
          setSelectedClassId(cList[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load results:', err);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isStudentOrParent, role, selectedExamId, selectedClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Student/Parent: Load Exam Detail Marksheet
  useEffect(() => {
    if (!isStudentOrParent || !selectedExamId) return;
    setLoadingDetail(true);

    const studentId = currentStudentProfile?.id;
    // Prefer the richer /principal/result-card/:student_id/:exam_id/data endpoint, fallback to /student/marks
    const fetchMarks = async () => {
      try {
        let res = null;
        if (studentId) {
          res = await client.get(`/principal/result-card/${studentId}/${selectedExamId}/data`).catch(() => null);
        }
        if (!res || !res.data || !res.data.marks) {
          const params = { exam_id: selectedExamId };
          if (role === 'PARENT' && studentId) params.student_id = studentId;
          res = await client.get('/student/marks', { params });
        }
        setExamDetail(res.data);
      } catch (err) {
        console.warn('Error fetching exam detail:', err);
        setExamDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchMarks();
  }, [isStudentOrParent, selectedExamId, currentStudentProfile, role]);

  // 3. Principal/Teacher: Load Dashboard / Class Students
  const fetchAdminDashboard = useCallback(async () => {
    if (isStudentOrParent || !selectedExamId) return;
    try {
      const res = await client.get(`/results/principal/dashboard?exam_id=${selectedExamId}`);
      const data = Array.isArray(res.data) ? res.data : res.data?.items || res.data?.subjects || [];
      setDashboardData(data);
    } catch {
      setDashboardData([]);
    }
  }, [isStudentOrParent, selectedExamId]);

  const fetchClassStudents = useCallback(async () => {
    if (isStudentOrParent || !selectedClassId) return;
    try {
      const res = await client.get(`/principal/students?class_id=${selectedClassId}`);
      const raw = res.data;
      setStudents(Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []));
    } catch {
      setStudents([]);
    }
  }, [isStudentOrParent, selectedClassId]);

  useEffect(() => {
    if (!isStudentOrParent) {
      if (adminTab === 'Approval') fetchAdminDashboard();
      if (adminTab === 'Marksheets') fetchClassStudents();
    }
  }, [isStudentOrParent, adminTab, fetchAdminDashboard, fetchClassStudents]);

  // Handle Child Switch (Parent)
  const handleSelectChild = (child) => {
    setSelectedChildId(child.id);
    setCurrentStudentProfile(child);
  };

  // Preview Result Card for Student (Admin)
  const openPreview = async (stu) => {
    setPreviewStudent(stu);
    setLoadingPreview(true);
    try {
      const res = await client.get(`/principal/result-card/${stu.id}/${selectedExamId}/data`);
      setPreviewResultData(res.data);
    } catch {
      setPreviewResultData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Download Student Result Card PDF
  const handleDownloadPDF = (studentId) => {
    const targetStudentId = studentId || currentStudentProfile?.id;
    if (!targetStudentId || !selectedExamId) {
      Alert.alert('Notice', 'Exam or student selection missing.');
      return;
    }
    const url = `${client.defaults.baseURL}/principal/result-card/${targetStudentId}/${selectedExamId}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open PDF report card URL.');
    });
  };

  // Bulk Download Class Result Cards (Admin)
  const handleBulkDownload = () => {
    if (!selectedExamId) {
      Alert.alert('Notice', 'Please select an examination first.');
      return;
    }
    let url = `${client.defaults.baseURL}/principal/exams/${selectedExamId}/result-cards/bulk`;
    if (selectedClassId) url += `?class_id=${selectedClassId}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open bulk report cards download URL.');
    });
  };

  // Principal RMS Actions: Approve, Return, Publish
  const handleApproveSubject = async (item) => {
    Alert.alert(
      'Approve Subject Marks',
      `Approve marks for ${item.subject_name || 'Subject'} in ${item.class_name || 'Class'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await client.post('/results/principal/approve', {
                exam_id: selectedExamId,
                class_id: item.class_id,
                subject_id: item.subject_id,
              });
              Alert.alert('Approved', 'Subject marks have been approved.');
              fetchAdminDashboard();
            } catch (err) {
              Alert.alert('Approval Failed', err.response?.data?.error || 'Could not approve marks.');
            }
          },
        },
      ]
    );
  };

  const handleReturnSubject = async () => {
    if (!targetReturnSubject || !returnReason.trim()) {
      Alert.alert('Notice', 'Please provide a reason for returning the marks.');
      return;
    }
    setReturning(true);
    try {
      await client.post('/results/principal/return', {
        exam_id: selectedExamId,
        class_id: targetReturnSubject.class_id,
        subject_id: targetReturnSubject.subject_id,
        reason: returnReason.trim(),
      });
      Alert.alert('Returned', 'Marks have been returned to the teacher for correction.');
      setReturnModalVisible(false);
      setReturnReason('');
      setTargetReturnSubject(null);
      fetchAdminDashboard();
    } catch (err) {
      Alert.alert('Action Failed', err.response?.data?.error || 'Failed to return marks.');
    } finally {
      setReturning(false);
    }
  };

  const handlePublishClassResults = (classId) => {
    Alert.alert(
      'Publish Class Results',
      'Publishing will make report cards officially visible to students and parents. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Now',
          onPress: async () => {
            try {
              await client.post('/results/publish', {
                exam_id: selectedExamId,
                class_id: classId || selectedClassId,
              }).catch(() => {
                // Fallback to /marks/publish
                return client.post('/marks/publish', {
                  exam_id: selectedExamId,
                  class_id: classId || selectedClassId,
                });
              });
              Alert.alert('Published', 'Class results have been published successfully.');
              fetchAdminDashboard();
            } catch (err) {
              Alert.alert('Publish Failed', err.response?.data?.error || 'Could not publish results.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {navigation?.canGoBack?.() && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Academic Results & RMS</Text>
              <Text style={styles.headerSub}>Report cards, approvals & publication</Text>
            </View>
          </View>

          {!isStudentOrParent && adminTab === 'Marksheets' && (
            <TouchableOpacity
              style={styles.bulkBtn}
              onPress={handleBulkDownload}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={15} color="#fff" />
              <Text style={styles.bulkBtnText}>Bulk PDF</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Admin Tab Switcher */}
        {!isStudentOrParent && (
          <View style={styles.adminTabs}>
            <TouchableOpacity
              style={[styles.adminTab, adminTab === 'Approval' && styles.adminTabActive]}
              onPress={() => setAdminTab('Approval')}
            >
              <Ionicons name="checkmark-done-circle-outline" size={15} color={adminTab === 'Approval' ? '#fff' : '#94a3b8'} />
              <Text style={[styles.adminTabText, adminTab === 'Approval' && styles.adminTabTextActive]}>
                RMS Approvals
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.adminTab, adminTab === 'Marksheets' && styles.adminTabActive]}
              onPress={() => setAdminTab('Marksheets')}
            >
              <Ionicons name="document-text-outline" size={15} color={adminTab === 'Marksheets' ? '#fff' : '#94a3b8'} />
              <Text style={[styles.adminTabText, adminTab === 'Marksheets' && styles.adminTabTextActive]}>
                Class Marksheets
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Parent Child Switcher */}
      {role === 'PARENT' && children.length > 1 && (
        <View style={styles.childBar}>
          <Text style={styles.childBarLabel}>Select Child:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {children.map(ch => {
              const sel = selectedChildId === ch.id;
              return (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.childChip, sel && styles.childChipActive]}
                  onPress={() => handleSelectChild(ch)}
                >
                  <Ionicons name="person" size={13} color={sel ? '#fff' : '#64748b'} />
                  <Text style={[styles.childChipText, sel && styles.childChipTextActive]}>
                    {ch.name || ch.user?.name || `Child ${ch.id}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Exam Selector Carousel */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Examination Term:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(isStudentOrParent ? publishedExams : adminExams).map(e => {
            const exId = e.exam_id || e.id;
            const sel = selectedExamId === exId;
            return (
              <TouchableOpacity
                key={exId}
                style={[styles.examChip, sel && styles.examChipActive]}
                onPress={() => setSelectedExamId(exId)}
              >
                <Ionicons name="ribbon-outline" size={14} color={sel ? '#fff' : '#7c3aed'} />
                <Text style={[styles.examChipText, sel && styles.examChipTextActive]}>
                  {e.exam_name || e.name || `Exam ${exId}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Class Selector for Admin Marksheets */}
        {!isStudentOrParent && adminTab === 'Marksheets' && classes.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.filterLabel}>Class:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {classes.map(c => {
                const sel = selectedClassId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classChip, sel && styles.classChipActive]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.classChipText, sel && styles.classChipTextActive]}>
                      Class {c.name}{c.section ? ` (${c.section})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching academic records...</Text>
        </View>
      ) : isStudentOrParent ? (
        /* STUDENT & PARENT VIEW */
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
          {loadingDetail ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading report card...</Text>
            </View>
          ) : examDetail ? (
            <View style={styles.reportCard}>
              {/* Card Banner */}
              <View style={styles.reportBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportSchoolTitle}>ACADEMIC PERFORMANCE REPORT</Text>
                  <Text style={styles.reportExamTitle}>
                    {examDetail.exam?.exam_name || 'Terminal Examination'}
                  </Text>
                  <Text style={styles.reportSession}>
                    Session: {examDetail.exam?.session || '2026-27'}
                  </Text>
                </View>
                <View style={[
                  styles.resultPill,
                  (examDetail.overall_result || examDetail.result) === 'PASS' ? styles.resultPass : styles.resultFail
                ]}>
                  <Text style={[
                    styles.resultPillText,
                    (examDetail.overall_result || examDetail.result) === 'PASS' ? { color: '#059669' } : { color: '#dc2626' }
                  ]}>
                    {examDetail.overall_result || examDetail.result || 'PUBLISHED'}
                  </Text>
                </View>
              </View>

              {/* Student Info Details */}
              <View style={styles.studentInfoStrip}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoColLabel}>Student Name</Text>
                  <Text style={styles.infoColVal}>
                    {examDetail.student?.name || currentStudentProfile?.name || user?.name || '—'}
                  </Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoColLabel}>Roll Number</Text>
                  <Text style={styles.infoColVal}>
                    {examDetail.student?.roll_number || currentStudentProfile?.roll_number || '—'}
                  </Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoColLabel}>Class & Section</Text>
                  <Text style={styles.infoColVal}>
                    {examDetail.student?.class_name || (currentStudentProfile?.class?.name ? `${currentStudentProfile.class.name} - ${currentStudentProfile.class.section}` : '—')}
                  </Text>
                </View>
              </View>

              {/* KPI Score Overview */}
              <View style={styles.kpiOverview}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>{examDetail.overall_percentage ?? examDetail.percentage ?? 0}%</Text>
                  <Text style={styles.kpiLabel}>Percentage</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{examDetail.overall_grade || examDetail.grade || '—'}</Text>
                  <Text style={styles.kpiLabel}>Overall Grade</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>
                    {examDetail.total_obtained ?? 0} / {examDetail.total_max ?? 0}
                  </Text>
                  <Text style={styles.kpiLabel}>Total Marks</Text>
                </View>
              </View>

              {/* Subject Breakdown Table */}
              <View style={styles.subjectSection}>
                <Text style={styles.sectionHeading}>Subject-Wise Marks & Grades</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHCol, { flex: 2 }]}>Subject</Text>
                  <Text style={[styles.tableHCol, { flex: 1, textAlign: 'center' }]}>Max</Text>
                  <Text style={[styles.tableHCol, { flex: 1, textAlign: 'center' }]}>Obt.</Text>
                  <Text style={[styles.tableHCol, { flex: 1, textAlign: 'right' }]}>Grade</Text>
                </View>

                {(examDetail.marks || examDetail.subjects || []).map((sub, i) => {
                  const sName = sub.subject_name || sub.subject || `Subject ${i + 1}`;
                  const sMax = sub.max_marks || 100;
                  const sObt = sub.marks_obtained != null ? sub.marks_obtained : '—';
                  const isAb = Boolean(sub.is_absent);
                  const sGrade = isAb ? 'AB' : (sub.grade || '—');

                  return (
                    <View key={sub.id || i} style={styles.tableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.subNameText}>{sName}</Text>
                        {isAb && <Text style={{ fontSize: 10, color: '#dc2626' }}>Absent</Text>}
                      </View>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: '#64748b' }]}>{sMax}</Text>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontWeight: '700' }]}>
                        {isAb ? 'AB' : sObt}
                      </Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={[
                          styles.gradeBadge,
                          sGrade.startsWith('A') ? styles.badgeA :
                          sGrade.startsWith('B') ? styles.badgeB :
                          sGrade === 'AB' ? styles.badgeAB : styles.badgeC
                        ]}>
                          <Text style={styles.gradeBadgeText}>{sGrade}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Previous Term Comparison (if available) */}
              {Array.isArray(examDetail.prev_marks) && examDetail.prev_marks.length > 0 && (
                <View style={styles.prevSection}>
                  <Text style={styles.prevHeading}>Previous Term Comparison (Mid-Term)</Text>
                  <View style={{ gap: 6 }}>
                    {examDetail.prev_marks.map((pm, pi) => (
                      <View key={pi} style={styles.prevRow}>
                        <Text style={styles.prevSubName}>{pm.subject_name}</Text>
                        <Text style={styles.prevScore}>{pm.marks_obtained} / {pm.max_marks} ({pm.grade})</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Download PDF Button */}
              <TouchableOpacity
                style={styles.downloadPdfBtn}
                onPress={() => handleDownloadPDF(currentStudentProfile?.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="download" size={18} color="#fff" />
                <Text style={styles.downloadPdfBtnText}>Download Official Marksheet (PDF)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Published Report Card</Text>
              <Text style={styles.emptyCardText}>Results have not yet been published for this examination.</Text>
            </View>
          )}
        </ScrollView>
      ) : adminTab === 'Approval' ? (
        /* PRINCIPAL RMS APPROVAL WORKFLOW */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchAdminDashboard}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Class Result Publication Quick Action */}
          {selectedClassId && (
            <View style={styles.publishClassBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.publishClassTitle}>Publish Class Results</Text>
                <Text style={styles.publishClassSub}>Make approved marks visible to students/parents</Text>
              </View>
              <TouchableOpacity
                style={styles.publishClassBtn}
                onPress={() => handlePublishClassResults(selectedClassId)}
              >
                <Ionicons name="rocket-outline" size={16} color="#fff" />
                <Text style={styles.publishClassBtnText}>Publish</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Submission Items List */}
          <Text style={styles.sectionHeading}>Teacher Submissions & Approvals</Text>
          {dashboardData.length > 0 ? (
            <View style={{ gap: 10 }}>
              {dashboardData.map((item, idx) => {
                const status = (item.status || 'DRAFT').toUpperCase();
                const isSubmitted = status === 'SUBMITTED' || status === 'RESUBMITTED';
                const isApproved = status === 'APPROVED' || status === 'PUBLISHED';
                const isReturned = status === 'RETURNED_FOR_CORRECTION';

                return (
                  <View key={item.id || idx} style={styles.rmsCard}>
                    <View style={styles.rmsCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rmsSubject}>{item.subject_name || `Subject ${item.subject_id}`}</Text>
                        <Text style={styles.rmsClass}>
                          {item.class_name ? `Class: ${item.class_name}` : ''} {item.teacher_name ? ` • Teacher: ${item.teacher_name}` : ''}
                        </Text>
                      </View>

                      <View style={[
                        styles.rmsStatusBadge,
                        isApproved ? styles.statusBadgeApproved :
                        isSubmitted ? styles.statusBadgeSubmitted :
                        isReturned ? styles.statusBadgeReturned : styles.statusBadgeDraft
                      ]}>
                        <Text style={[
                          styles.rmsStatusText,
                          isApproved ? { color: '#059669' } :
                          isSubmitted ? { color: '#0284c7' } :
                          isReturned ? { color: '#dc2626' } : { color: '#64748b' }
                        ]}>
                          {status.replace('_FOR_CORRECTION', '')}
                        </Text>
                      </View>
                    </View>

                    {item.return_reason && (
                      <View style={styles.reasonNotice}>
                        <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                        <Text style={styles.reasonNoticeText}>Remark: {item.return_reason}</Text>
                      </View>
                    )}

                    {/* Principal Actions */}
                    {isPrincipalOrAdmin && (
                      <View style={styles.rmsActionRow}>
                        <TouchableOpacity
                          style={styles.rmsActionBtnOutline}
                          onPress={() => navigation?.navigate?.('Marks', {
                            examId: selectedExamId,
                            classId: item.class_id,
                            subjectId: item.subject_id,
                          })}
                        >
                          <Ionicons name="eye-outline" size={14} color="#0284c7" />
                          <Text style={[styles.rmsActionBtnText, { color: '#0284c7' }]}>Inspect</Text>
                        </TouchableOpacity>

                        {isSubmitted && (
                          <>
                            <TouchableOpacity
                              style={[styles.rmsActionBtnOutline, { borderColor: '#fecaca' }]}
                              onPress={() => {
                                setTargetReturnSubject(item);
                                setReturnModalVisible(true);
                              }}
                            >
                              <Ionicons name="arrow-undo-outline" size={14} color="#dc2626" />
                              <Text style={[styles.rmsActionBtnText, { color: '#dc2626' }]}>Return</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.rmsActionBtnSolid}
                              onPress={() => handleApproveSubject(item)}
                            >
                              <Ionicons name="checkmark-outline" size={14} color="#fff" />
                              <Text style={styles.rmsActionBtnSolidText}>Approve</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Pending Submissions</Text>
              <Text style={styles.emptyCardText}>All subject marks have either been approved or no draft marks exist.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* PRINCIPAL & TEACHER MARKSHEETS TAB */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchClassStudents}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeading}>Enrolled Students ({students.length})</Text>
          {students.length > 0 ? (
            <View style={{ gap: 10 }}>
              {students.map((stu, i) => {
                const sName = stu.name || stu.user?.name || `Student ${i + 1}`;
                const sRoll = stu.roll_number || stu.roll_no || i + 1;

                return (
                  <View key={stu.id || i} style={styles.studentCard}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentAvatarText}>{sName.charAt(0).toUpperCase()}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.studentName} numberOfLines={1}>{sName}</Text>
                      <Text style={styles.studentRoll}>Roll #{sRoll} {stu.admission_number ? ` • Adm: ${stu.admission_number}` : ''}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.previewIconBtn}
                        onPress={() => openPreview(stu)}
                      >
                        <Ionicons name="eye-outline" size={16} color="#7c3aed" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.downloadIconBtn}
                        onPress={() => handleDownloadPDF(stu.id)}
                      >
                        <Ionicons name="download-outline" size={16} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Students in Class</Text>
              <Text style={styles.emptyCardText}>Select another class or ensure students are enrolled.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Preview Student Report Card Modal */}
      <Modal
        visible={Boolean(previewStudent)}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Report Card Preview</Text>
                <Text style={styles.modalSubtitle}>
                  {previewStudent?.name || previewStudent?.user?.name} (Roll #{previewStudent?.roll_number || '—'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewStudent(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {loadingPreview ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
              ) : previewResultData ? (
                <View>
                  {/* KPI Mini Bar */}
                  <View style={styles.previewKpiBar}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.previewKpiVal}>{previewResultData.overall_percentage}%</Text>
                      <Text style={styles.previewKpiLbl}>Percentage</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[styles.previewKpiVal, { color: '#059669' }]}>{previewResultData.overall_result}</Text>
                      <Text style={styles.previewKpiLbl}>Result</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.previewKpiVal}>{previewResultData.total_obtained} / {previewResultData.total_max}</Text>
                      <Text style={styles.previewKpiLbl}>Marks</Text>
                    </View>
                  </View>

                  {/* Marks List */}
                  <View style={{ gap: 6, marginTop: 12 }}>
                    {(previewResultData.marks || []).map((m, idx) => (
                      <View key={idx} style={styles.previewMarkRow}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b', flex: 1 }}>
                          {m.subject_name}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#475569', marginRight: 10 }}>
                          {m.marks_obtained} / {m.max_marks}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#7c3aed' }}>
                          {m.grade}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>
                  No result card data available.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDownloadBtn}
              onPress={() => {
                handleDownloadPDF(previewStudent?.id);
                setPreviewStudent(null);
              }}
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.modalDownloadBtnText}>Download PDF Marksheet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Return Subject Modal */}
      <Modal
        visible={returnModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReturnModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Return Marks for Correction</Text>
              <TouchableOpacity onPress={() => setReturnModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
              Specify the revision reason or error details for the assigned teacher:
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Please re-check Roll #12 marks, appears out of range..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={returnReason}
              onChangeText={setReturnReason}
            />

            <TouchableOpacity
              style={[styles.returnSubmitBtn, returning && { opacity: 0.6 }]}
              onPress={handleReturnSubject}
              disabled={returning}
            >
              {returning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.returnSubmitBtnText}>Return to Teacher</Text>
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
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  bulkBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  adminTabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 3,
    marginTop: 10,
    gap: 4,
  },
  adminTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  adminTabActive: { backgroundColor: '#7c3aed' },
  adminTabText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  adminTabTextActive: { color: '#fff' },
  childBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  childBarLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  childChipActive: { backgroundColor: '#7c3aed' },
  childChipText: { fontSize: 12, color: '#64748b' },
  childChipTextActive: { color: '#fff', fontWeight: '600' },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  examChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  examChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  examChipText: { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  examChipTextActive: { color: '#fff' },
  classChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: '#334155', borderColor: '#334155' },
  classChipText: { fontSize: 12, color: '#475569' },
  classChipTextActive: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  reportBanner: {
    backgroundColor: '#0f172a',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportSchoolTitle: { fontSize: 10, fontWeight: '800', color: '#a78bfa', letterSpacing: 0.5 },
  reportExamTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginTop: 2 },
  reportSession: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  resultPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  resultPass: { backgroundColor: '#ecfdf5' },
  resultFail: { backgroundColor: '#fef2f2' },
  resultPillText: { fontSize: 11, fontWeight: '800' },
  studentInfoStrip: {
    padding: 14,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoCol: { flex: 1 },
  infoColLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase' },
  infoColVal: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  kpiOverview: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  kpiBox: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 17, fontWeight: '800', color: '#7c3aed' },
  kpiLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  kpiDivider: { width: 1, backgroundColor: '#f1f5f9' },
  subjectSection: { padding: 14 },
  sectionHeading: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHCol: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  subNameText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  tableCell: { fontSize: 12 },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  badgeA: { backgroundColor: '#ecfdf5' },
  badgeB: { backgroundColor: '#eff6ff' },
  badgeC: { backgroundColor: '#fffbeb' },
  badgeAB: { backgroundColor: '#fef2f2' },
  gradeBadgeText: { fontSize: 11, fontWeight: '700', color: '#1e293b' },
  prevSection: {
    margin: 14,
    marginTop: 0,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  prevHeading: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  prevRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  prevSubName: { fontSize: 12, color: '#334155' },
  prevScore: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  downloadPdfBtn: {
    backgroundColor: '#7c3aed',
    margin: 14,
    marginTop: 0,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  downloadPdfBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptyCardText: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  publishClassBanner: {
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    marginBottom: 14,
  },
  publishClassTitle: { fontSize: 14, fontWeight: '700', color: '#6d28d9' },
  publishClassSub: { fontSize: 11, color: '#7c3aed', marginTop: 1 },
  publishClassBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  publishClassBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rmsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rmsCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rmsSubject: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  rmsClass: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rmsStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeApproved: { backgroundColor: '#ecfdf5' },
  statusBadgeSubmitted: { backgroundColor: '#e0f2fe' },
  statusBadgeReturned: { backgroundColor: '#fef2f2' },
  statusBadgeDraft: { backgroundColor: '#f1f5f9' },
  rmsStatusText: { fontSize: 10, fontWeight: '700' },
  reasonNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  reasonNoticeText: { fontSize: 11, color: '#dc2626', flex: 1 },
  rmsActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rmsActionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  rmsActionBtnText: { fontSize: 11, fontWeight: '600' },
  rmsActionBtnSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  rmsActionBtnSolidText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: { color: '#7c3aed', fontWeight: '700', fontSize: 14 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  studentRoll: { fontSize: 11, color: '#64748b', marginTop: 2 },
  previewIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  downloadIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
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
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
  previewKpiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  previewKpiVal: { fontSize: 16, fontWeight: '800', color: '#7c3aed' },
  previewKpiLbl: { fontSize: 11, color: '#64748b' },
  previewMarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalDownloadBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  modalDownloadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reasonInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  returnSubmitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  returnSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
