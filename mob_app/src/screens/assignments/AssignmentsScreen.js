// mob_app/src/screens/assignments/AssignmentsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const STATUS_CONFIG = {
  PENDING:   { bg: '#fef3c7', text: '#d97706', border: '#fde68a', label: 'Pending' },
  SUBMITTED: { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd', label: 'Submitted' },
  LATE:      { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa', label: 'Late Submission' },
  MARKED:    { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', label: 'Evaluated' },
  EXPIRED:   { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', label: 'Overdue / Closed' },
  ACTIVE:    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Active' },
};

function formatDueDate(dueStr) {
  if (!dueStr) return 'No due date';
  try {
    const due = new Date(dueStr);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return `Due in ${diffDays} days (${due.toLocaleDateString()})`;
  } catch {
    return dueStr;
  }
}

export default function AssignmentsScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role || '';
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'].includes(role);
  const isTeacher = role === 'TEACHER';
  const isStudent = role === 'STUDENT' || role === 'PARENT';
  const canCreate = isPrincipal || isTeacher;

  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  // Create Assignment Modal
  const [createModal, setCreateModal] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formSubjects, setFormSubjects] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaxMarks, setFormMaxMarks] = useState('20');
  const [formDueDate, setFormDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  // Student Homework Submit Modal
  const [submitModal, setSubmitModal] = useState(false);
  const [targetAssignment, setTargetAssignment] = useState(null);
  const [studentComment, setStudentComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Teacher Review & Grade Modal
  const [submissionsModal, setSubmissionsModal] = useState(false);
  const [detailAssignment, setDetailAssignment] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [gradeDialog, setGradeDialog] = useState(false);
  const [targetStudentSub, setTargetStudentSub] = useState(null);
  const [gradeMarks, setGradeMarks] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  // 1. Fetch Classes & Subjects for Filters
  useEffect(() => {
    client.get('/principal/classes')
      .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClasses([]));

    client.get('/principal/subjects')
      .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSubjects([]));
  }, []);

  // Update form subjects when form class changes in Create Modal
  useEffect(() => {
    if (formClassId) {
      client.get(`/principal/classes/${formClassId}/subjects`)
        .then(res => setFormSubjects(Array.isArray(res.data) ? res.data : []))
        .catch(() => setFormSubjects([]));
    } else {
      setFormSubjects([]);
    }
  }, [formClassId]);

  // 2. Load Assignments
  const loadAssignments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (selectedSubjectId) params.subject_id = selectedSubjectId;
      if (search.trim()) params.search = search.trim();

      const res = await client.get('/academic/assignments', { params }).catch(() => ({ data: { assignments: [] } }));
      const list = res.data?.assignments || [];
      setAssignments(list);
    } catch {
      setAssignments([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedClassId, selectedSubjectId, search]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // 3. Create Assignment Handler
  const handleCreateAssignment = async () => {
    if (!formClassId || !formSubjectId || !formTitle.trim() || !formDueDate.trim()) {
      Alert.alert('Required Fields', 'Please select Class, Subject, Title, and Due Date.');
      return;
    }

    setCreating(true);
    try {
      await client.post('/academic/assignments', {
        class_id: formClassId,
        subject_id: formSubjectId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        max_marks: parseFloat(formMaxMarks) || 20,
        due_date: formDueDate.trim(),
      });

      Alert.alert('Success', 'Homework assignment published successfully!');
      setCreateModal(false);
      setFormTitle('');
      setFormDesc('');
      setFormDueDate('');
      loadAssignments();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to create assignment';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  // 4. Student Submit Homework
  const openSubmitModal = (asn) => {
    setTargetAssignment(asn);
    setStudentComment(asn.my_submission?.student_comment || '');
    setSubmitModal(true);
  };

  const handleSubmitHomework = async () => {
    if (!studentComment.trim()) {
      Alert.alert('Validation Error', 'Please enter your homework response, solution, or submission notes.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post(`/academic/assignments/${targetAssignment.id}/submit`, {
        student_comment: studentComment.trim(),
      });

      Alert.alert('Submitted!', 'Your homework has been submitted to your teacher.');
      setSubmitModal(false);
      setTargetAssignment(null);
      setStudentComment('');
      loadAssignments();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Submission failed';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Teacher View Submissions & Grade
  const openSubmissionsModal = async (asn) => {
    setDetailAssignment(null);
    setSubmissionsModal(true);
    setLoadingDetails(true);
    try {
      const res = await client.get(`/academic/assignments/${asn.id}`);
      setDetailAssignment(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load student submissions roster.');
      setSubmissionsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openGradeDialog = (studentItem) => {
    setTargetStudentSub(studentItem);
    setGradeMarks(studentItem.marks_obtained !== null ? String(studentItem.marks_obtained) : '');
    setGradeFeedback(studentItem.feedback || '');
    setGradeDialog(true);
  };

  const handleSaveGrade = async () => {
    if (gradeMarks === '' || isNaN(gradeMarks)) {
      Alert.alert('Invalid Marks', 'Please enter a valid numeric mark.');
      return;
    }
    const marksNum = parseFloat(gradeMarks);
    if (marksNum < 0 || marksNum > (detailAssignment?.max_marks || 100)) {
      Alert.alert('Mark Out of Bounds', `Marks must be between 0 and ${detailAssignment?.max_marks || 100}`);
      return;
    }

    const subId = targetStudentSub.submission?.id;
    if (!subId) {
      Alert.alert('No Submission', 'Student has not submitted work yet to grade.');
      return;
    }

    setSavingGrade(true);
    try {
      await client.post(`/academic/assignments/${detailAssignment.id}/submissions/${subId}/grade`, {
        marks_obtained: marksNum,
        teacher_feedback: gradeFeedback.trim(),
      });

      Alert.alert('Graded', 'Student submission marks and feedback saved!');
      setGradeDialog(false);
      // Reload assignment details
      const updated = await client.get(`/academic/assignments/${detailAssignment.id}`);
      setDetailAssignment(updated.data);
      loadAssignments();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Grading failed';
      Alert.alert('Error', msg);
    } finally {
      setSavingGrade(false);
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = (asn) => {
    Alert.alert(
      'Delete Assignment',
      `Are you sure you want to delete "${asn.title}"? All submissions will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/academic/assignments/${asn.id}`);
              Alert.alert('Deleted', 'Assignment deleted successfully.');
              loadAssignments();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete assignment');
            }
          },
        },
      ]
    );
  };

  // Filtered List
  const filteredAssignments = useMemo(() => {
    if (activeTab === 'ALL') return assignments;
    if (isStudent) {
      if (activeTab === 'PENDING') return assignments.filter(a => a.submission_status === 'PENDING');
      if (activeTab === 'SUBMITTED') return assignments.filter(a => a.submission_status === 'SUBMITTED' || a.submission_status === 'LATE');
      if (activeTab === 'MARKED') return assignments.filter(a => a.submission_status === 'MARKED');
    } else {
      if (activeTab === 'ACTIVE') return assignments.filter(a => a.status === 'ACTIVE');
      if (activeTab === 'CLOSED') return assignments.filter(a => a.status === 'CLOSED');
    }
    return assignments;
  }, [assignments, activeTab, isStudent]);

  // Overall Metrics
  const metrics = useMemo(() => {
    if (isStudent) {
      let pending = 0, submitted = 0, marked = 0;
      assignments.forEach(a => {
        if (a.submission_status === 'PENDING') pending++;
        else if (a.submission_status === 'SUBMITTED' || a.submission_status === 'LATE') submitted++;
        else if (a.submission_status === 'MARKED') marked++;
      });
      return { total: assignments.length, pending, submitted, marked };
    } else {
      let totalStudents = 0, totalSubs = 0, totalMarked = 0;
      assignments.forEach(a => {
        totalStudents += a.total_students || 0;
        totalSubs += a.submitted_count || 0;
        totalMarked += a.marked_count || 0;
      });
      return { total: assignments.length, totalStudents, totalSubs, totalMarked };
    }
  }, [assignments, isStudent]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Homework & Assignments</Text>
            <Text style={styles.headerSub}>Curriculum Tasks & Evaluation</Text>
          </View>
          {canCreate && (
            <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModal(true)}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.createBtnText}>New Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.total}</Text>
            <Text style={styles.metricLbl}>Assignments</Text>
          </View>
          <View style={styles.metricDivider} />
          {isStudent ? (
            <>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: '#d97706' }]}>{metrics.pending}</Text>
                <Text style={styles.metricLbl}>Pending</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: '#0284c7' }]}>{metrics.submitted}</Text>
                <Text style={styles.metricLbl}>Submitted</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: '#16a34a' }]}>{metrics.marked}</Text>
                <Text style={styles.metricLbl}>Graded</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: '#0284c7' }]}>{metrics.totalSubs}</Text>
                <Text style={styles.metricLbl}>Submitted</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: '#16a34a' }]}>{metrics.totalMarked}</Text>
                <Text style={styles.metricLbl}>Evaluated</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(isStudent ? ['ALL', 'PENDING', 'SUBMITTED', 'MARKED'] : ['ALL', 'ACTIVE', 'CLOSED']).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterChip, activeTab === tab && styles.filterChipActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterChipText, activeTab === tab && styles.filterChipTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assignments by topic or UID..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Assignments List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading assignments...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAssignments(true)} colors={[colors.primary]} />
          }
        >
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((asn) => {
              const stConf = isStudent
                ? (STATUS_CONFIG[asn.submission_status] || STATUS_CONFIG.PENDING)
                : (STATUS_CONFIG[asn.status] || STATUS_CONFIG.ACTIVE);

              const isDueOver = asn.due_date && new Date(asn.due_date) < new Date();

              return (
                <View key={asn.id} style={styles.card}>
                  {/* Top Badges */}
                  <View style={styles.cardHeader}>
                    <View style={styles.subjectBadge}>
                      <Ionicons name="book-outline" size={12} color={colors.primary} />
                      <Text style={styles.subjectText}>{asn.subject_name || 'Subject'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <View style={styles.classBadge}>
                        <Text style={styles.classText}>{asn.class_name || 'All'}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: stConf.bg, borderColor: stConf.border }]}>
                        <Text style={[styles.statusText, { color: stConf.text }]}>{stConf.label}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Title & Desc */}
                  <Text style={styles.title}>{asn.title}</Text>
                  {asn.description ? (
                    <Text style={styles.desc} numberOfLines={3}>{asn.description}</Text>
                  ) : null}

                  {/* Meta: Due Date & Marks */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={isDueOver ? '#dc2626' : colors.textMuted} />
                      <Text style={[styles.metaText, isDueOver && { color: '#dc2626', fontWeight: '700' }]}>
                        {formatDueDate(asn.due_date)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="ribbon-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>Max: {asn.max_marks} Marks</Text>
                    </View>
                  </View>

                  {/* Attachment Link if teacher provided one */}
                  {asn.attachment_url && (
                    <TouchableOpacity
                      style={styles.attachmentPill}
                      onPress={() => Linking.openURL(asn.attachment_url).catch(() => {})}
                    >
                      <Ionicons name="attach-outline" size={14} color="#0284c7" />
                      <Text style={styles.attachmentText}>
                        {asn.attachment_name || 'Download Assignment Worksheet'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Student View Specifics: Submission status & feedback */}
                  {isStudent && (
                    <View style={styles.studentFeedbackBox}>
                      {asn.my_submission ? (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.submittedOnText}>
                              Submitted on: {new Date(asn.my_submission.submitted_at).toLocaleDateString()}
                            </Text>
                            {asn.my_submission.marks_obtained !== null && (
                              <View style={styles.scoreBadge}>
                                <Text style={styles.scoreText}>
                                  Score: {asn.my_submission.marks_obtained} / {asn.max_marks}
                                </Text>
                              </View>
                            )}
                          </View>
                          {asn.my_submission.teacher_feedback ? (
                            <View style={styles.feedbackRow}>
                              <Ionicons name="chatbubble-ellipses-outline" size={13} color="#16a34a" />
                              <Text style={styles.feedbackText}>
                                Feedback: {asn.my_submission.teacher_feedback}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <Text style={styles.unsubmittedNotice}>
                          {isDueOver ? 'Assignment deadline has passed.' : 'Submission pending. Complete and submit your work before the due date.'}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Teacher View Specifics: Progress bar */}
                  {!isStudent && (
                    <View style={styles.teacherStatsBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={styles.statLabel}>
                          Turned In: {asn.submitted_count || 0} / {asn.total_students || 0}
                        </Text>
                        <Text style={styles.statLabel}>
                          Graded: {asn.marked_count || 0} / {asn.submitted_count || 0}
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${asn.total_students > 0 ? Math.min(100, Math.round(((asn.submitted_count || 0) / asn.total_students) * 100)) : 0}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    {isStudent ? (
                      <TouchableOpacity
                        style={[styles.actionBtnPrimary, isDueOver && !asn.my_submission && { backgroundColor: '#94a3b8' }]}
                        onPress={() => openSubmitModal(asn)}
                      >
                        <Ionicons name={asn.my_submission ? 'refresh-outline' : 'cloud-upload-outline'} size={15} color="#fff" />
                        <Text style={styles.actionBtnPrimaryText}>
                          {asn.my_submission ? 'Update / Resubmit Homework' : 'Submit Homework'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                        <TouchableOpacity
                          style={styles.actionBtnSecondary}
                          onPress={() => openSubmissionsModal(asn)}
                        >
                          <Ionicons name="people-outline" size={14} color={colors.primary} />
                          <Text style={styles.actionBtnSecondaryText}>View Submissions & Grade</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteIconBtn}
                          onPress={() => handleDeleteAssignment(asn)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Assignments Found</Text>
              <Text style={styles.emptySubtitle}>
                {search ? `No assignments matching "${search}".` : 'There are no active homework assignments for this selection.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* CREATE ASSIGNMENT MODAL (Staff) */}
      <Modal visible={createModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Publish Assignment</Text>
                <Text style={styles.modalSub}>Assign homework or project to class</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Class Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Class & Section *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {classes.map((cls) => (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.pickerChip, formClassId === cls.id && styles.pickerChipActive]}
                      onPress={() => setFormClassId(cls.id)}
                    >
                      <Text style={[styles.pickerChipText, formClassId === cls.id && styles.pickerChipTextActive]}>
                        Class {cls.name || cls.class_name} {cls.section ? `(${cls.section})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Subject Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subject *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(formSubjects.length > 0 ? formSubjects : subjects).map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.pickerChip, formSubjectId === sub.id && styles.pickerChipActive]}
                      onPress={() => setFormSubjectId(sub.id)}
                    >
                      <Text style={[styles.pickerChipText, formSubjectId === sub.id && styles.pickerChipTextActive]}>
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Assignment Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Chapter 4 Exercise 4.2 Problems 1-10"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Instructions / Details</Text>
                <TextInput
                  style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Specific requirements, reference pages, or guidelines..."
                  multiline
                  value={formDesc}
                  onChangeText={setFormDesc}
                />
              </View>

              {/* Max Marks & Due Date */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Max Marks</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="20"
                    value={formMaxMarks}
                    onChangeText={setFormMaxMarks}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1.5 }]}>
                  <Text style={styles.formLabel}>Due Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2026-10-15"
                    value={formDueDate}
                    onChangeText={setFormDueDate}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateAssignment}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Publish Assignment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* STUDENT SUBMISSION MODAL */}
      <Modal visible={submitModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Submit Homework</Text>
                <Text style={styles.modalSub}>{targetAssignment?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setSubmitModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Written Response / Solution Notes / Links *</Text>
              <TextInput
                style={[styles.formInput, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Type your homework answers, key steps, or cloud document/drive link..."
                multiline
                value={studentComment}
                onChangeText={setStudentComment}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitHomework}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Confirm Submission</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TEACHER SUBMISSIONS ROSTER MODAL */}
      <Modal visible={submissionsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Student Submissions</Text>
                <Text style={styles.modalSub}>
                  {detailAssignment?.title} · Class {detailAssignment?.class_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSubmissionsModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 10, color: colors.textMuted, fontSize: 13 }}>
                  Loading student submissions...
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {detailAssignment?.student_submissions?.length > 0 ? (
                  detailAssignment.student_submissions.map((stu) => {
                    const stConf = STATUS_CONFIG[stu.status] || STATUS_CONFIG.PENDING;
                    return (
                      <View key={stu.student_id} style={styles.studentSubCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.studentName}>{stu.name}</Text>
                            <Text style={styles.studentRoll}>Roll: {stu.roll_number} · Adm: {stu.admission_no}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: stConf.bg, borderColor: stConf.border }]}>
                            <Text style={[styles.statusText, { color: stConf.text }]}>{stConf.label}</Text>
                          </View>
                        </View>

                        {/* Submission Comment / Solution if present */}
                        {stu.submission?.student_comment ? (
                          <View style={styles.subSolutionBox}>
                            <Text style={styles.subSolutionLabel}>Student Response:</Text>
                            <Text style={styles.subSolutionText}>{stu.submission.student_comment}</Text>
                          </View>
                        ) : null}

                        {/* Evaluated Marks if present */}
                        {stu.marks_obtained !== null && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>
                              Awarded: {stu.marks_obtained} / {detailAssignment.max_marks} Marks
                            </Text>
                          </View>
                        )}

                        {/* Grade action */}
                        {stu.submission && (
                          <TouchableOpacity
                            style={styles.gradeBtn}
                            onPress={() => openGradeDialog(stu)}
                          >
                            <Ionicons name="pencil-outline" size={13} color={colors.primary} />
                            <Text style={styles.gradeBtnText}>
                              {stu.marks_obtained !== null ? 'Edit Evaluation' : 'Evaluate & Award Marks'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>No student records found in class.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* GRADE EVALUATION DIALOG */}
      <Modal visible={gradeDialog} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Grade Student Work</Text>
                <Text style={styles.modalSub}>{targetStudentSub?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setGradeDialog(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Marks Awarded (Out of {detailAssignment?.max_marks || 20}) *
              </Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                placeholder="e.g. 18"
                value={gradeMarks}
                onChangeText={setGradeMarks}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Teacher Feedback / Remarks</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="e.g. Excellent problem solving, neat presentation..."
                multiline
                value={gradeFeedback}
                onChangeText={setGradeFeedback}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, savingGrade && { opacity: 0.6 }]}
              onPress={handleSaveGrade}
              disabled={savingGrade}
            >
              {savingGrade ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Save Evaluation</Text>
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
  createBtn: {
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
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, fontSize: 13, color: colors.text },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  classBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  classText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  desc: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  attachmentText: { fontSize: 11, fontWeight: '600', color: '#0284c7' },
  studentFeedbackBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  submittedOnText: { fontSize: 11, color: colors.textMuted },
  scoreBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  scoreText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  feedbackText: { fontSize: 12, color: '#166534', fontStyle: 'italic' },
  unsubmittedNotice: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  teacherStatsBox: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  progressBarTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  cardActions: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnSecondaryText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  deleteIconBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
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
  pickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  pickerChipTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  studentSubCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentName: { fontSize: 13, fontWeight: '700', color: colors.text },
  studentRoll: { fontSize: 11, color: colors.textMuted },
  subSolutionBox: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subSolutionLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  subSolutionText: { fontSize: 12, color: colors.text },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  gradeBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
