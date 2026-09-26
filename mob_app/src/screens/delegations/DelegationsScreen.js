// mob_app/src/screens/delegations/DelegationsScreen.js
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

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'SCHEDULED', 'EXPIRING_SOON', 'EXPIRED', 'REVOKED'];

const REASON_PRESETS = [
  'Medical Leave / Teacher Absent',
  'Personal Emergency',
  'School Official Duty',
  'Professional Training / Workshop',
  'Maternity / Paternity Leave',
  'Other Reason',
];

const PERMISSION_OPTIONS = [
  { code: 'ATTENDANCE_MARK', label: 'Take Attendance', icon: 'clipboard-outline' },
  { code: 'MARKS_ENTER', label: 'Enter Exam Marks', icon: 'pencil-outline' },
  { code: 'STUDENT_VIEW', label: 'View Students', icon: 'people-outline' },
  { code: 'NOTES_MANAGE', label: 'Study Materials', icon: 'document-text-outline' },
];

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoStr;
  }
}

export default function DelegationsScreen({ navigation }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isTeacher = userRole === 'TEACHER';

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delegations, setDelegations] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expiring_soon: 0,
    expired: 0,
    revoked: 0,
  });

  // Principal Filters
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('Regular teacher resumed duties');
  const [revoking, setRevoking] = useState(false);

  // Wizard States
  const [wizardStep, setWizardStep] = useState(1);
  const [teachersLookup, setTeachersLookup] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');

  const [sourceTeacher, setSourceTeacher] = useState(null);
  const [delegateTeacher, setDelegateTeacher] = useState(null);
  const [selectedScopes, setSelectedScopes] = useState([]); // [{ class_id, class_name, subject_id, subject_name, selected }]
  const [selectedPermissions, setSelectedPermissions] = useState([
    'ATTENDANCE_MARK', 'MARKS_ENTER', 'STUDENT_VIEW', 'NOTES_MANAGE'
  ]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [endTime, setEndTime] = useState('16:00');
  const [reason, setReason] = useState(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Delegations
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isTeacher) {
        const res = await client.get('/teacher/delegations/active').catch(() => ({ data: [] }));
        const list = Array.isArray(res.data) ? res.data : [];
        setDelegations(list);
      } else {
        const res = await client.get('/principal/delegations', {
          params: { status: activeTab },
        }).catch(() => ({ data: { delegations: [], metrics: {} } }));
        const list = Array.isArray(res.data?.delegations) ? res.data.delegations : [];
        setDelegations(list);
        if (res.data?.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch {
      setDelegations([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [isTeacher, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Teachers for Wizard
  const openCreateWizard = async () => {
    setWizardStep(1);
    setSourceTeacher(null);
    setDelegateTeacher(null);
    setSelectedScopes([]);
    setSelectedPermissions(['ATTENDANCE_MARK', 'MARKS_ENTER', 'STUDENT_VIEW', 'NOTES_MANAGE']);
    setConflicts([]);
    setTeacherSearch('');
    setCreateModal(true);

    setLoadingTeachers(true);
    try {
      const res = await client.get('/principal/delegations/teachers-lookup');
      setTeachersLookup(Array.isArray(res.data) ? res.data : []);
    } catch {
      Alert.alert('Error', 'Failed to load teachers directory for substitution.');
    } finally {
      setLoadingTeachers(false);
    }
  };

  // When source teacher is selected, setup their class assignments
  const handleSelectSourceTeacher = (t) => {
    setSourceTeacher(t);
    const scopes = (t.assignments || []).map((a, idx) => ({
      id: `${a.class_id}_${a.subject_id || 'all'}_${idx}`,
      class_id: a.class_id,
      class_name: a.class_name,
      subject_id: a.subject_id || null,
      subject_name: a.subject_name || 'All Subjects',
      selected: true,
    }));
    setSelectedScopes(scopes);
    setWizardStep(2);
    setTeacherSearch('');
  };

  // Conflict Checking
  useEffect(() => {
    if (wizardStep === 4 && delegateTeacher && startDate && endDate) {
      setCheckingConflicts(true);
      const starts_at = `${startDate}T${startTime}:00`;
      const expires_at = `${endDate}T${endTime}:00`;
      const activeScopes = selectedScopes
        .filter(s => s.selected)
        .map(s => ({ class_id: s.class_id, subject_id: s.subject_id }));

      client.post('/principal/delegations/check-conflicts', {
        delegate_teacher_id: delegateTeacher.id,
        starts_at,
        expires_at,
        scopes: activeScopes,
      })
        .then(r => setConflicts(r.data?.conflicts || []))
        .catch(() => setConflicts([]))
        .finally(() => setCheckingConflicts(false));
    }
  }, [wizardStep, delegateTeacher, startDate, startTime, endDate, endTime, selectedScopes]);

  // Submit Delegation
  const handleSubmitDelegation = async () => {
    if (!sourceTeacher || !delegateTeacher) {
      Alert.alert('Missing Selection', 'Please select both absent and substitute teachers.');
      return;
    }
    const starts_at = `${startDate}T${startTime}:00`;
    const expires_at = `${endDate}T${endTime}:00`;

    if (new Date(starts_at) >= new Date(expires_at)) {
      Alert.alert('Invalid Schedule', 'End date/time must be strictly after the start date/time.');
      return;
    }

    const activeScopes = selectedScopes
      .filter(s => s.selected)
      .map(s => ({ class_id: s.class_id, subject_id: s.subject_id }));

    if (activeScopes.length === 0) {
      Alert.alert('No Classes Selected', 'Please select at least one class or subject to delegate.');
      return;
    }

    if (selectedPermissions.length === 0) {
      Alert.alert('No Permissions', 'Please grant at least one permission code.');
      return;
    }

    const effectiveReason = reason === 'Other Reason' ? (customReason.trim() || 'Other') : reason;

    setSubmitting(true);
    try {
      await client.post('/principal/delegations', {
        source_teacher_id: sourceTeacher.id,
        delegate_teacher_id: delegateTeacher.id,
        starts_at,
        expires_at,
        reason: effectiveReason,
        notes: notes.trim(),
        scopes: activeScopes,
        permissions: selectedPermissions,
      });

      Alert.alert('Success', `Delegation created! ${delegateTeacher.name} has been granted temporary access.`);
      setCreateModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create delegation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke Delegation
  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await client.post(`/principal/delegations/${revokeTarget.id}/revoke`, {
        reason: revokeReason || 'Regular teacher resumed duties',
      });
      Alert.alert('Revoked', 'Teacher delegation has been revoked. Temporary permissions terminated.');
      setRevokeTarget(null);
      loadData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to revoke delegation.');
    } finally {
      setRevoking(false);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    if (!search.trim()) return delegations;
    const q = search.toLowerCase();
    return delegations.filter(d => {
      const sName = (d.source_teacher_name || '').toLowerCase();
      const dName = (d.delegate_teacher_name || '').toLowerCase();
      const sEmp = (d.source_employee_id || '').toLowerCase();
      const dEmp = (d.delegate_employee_id || '').toLowerCase();
      const rTxt = (d.reason || '').toLowerCase();
      return sName.includes(q) || dName.includes(q) || sEmp.includes(q) || dEmp.includes(q) || rTxt.includes(q);
    });
  }, [delegations, search]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'ACTIVE NOW' };
      case 'SCHEDULED':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', label: 'SCHEDULED' };
      case 'EXPIRING_SOON':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'EXPIRING SOON' };
      case 'REVOKED':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', label: 'REVOKED' };
      case 'EXPIRED':
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'EXPIRED' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>
              {isTeacher ? 'My Substitute Duties' : 'Teacher Delegations'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isTeacher ? 'Active temporary access' : 'Substitute management & access'}
            </Text>
          </View>
        </View>

        {!isTeacher && (
          <TouchableOpacity style={styles.createBtn} onPress={openCreateWizard}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>New Delegation</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      >
        {/* Principal Metric Cards */}
        {!isTeacher && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
              <View style={[styles.metricCard, { backgroundColor: '#4338ca10', borderColor: '#4338ca30' }]}>
                <Text style={[styles.metricVal, { color: '#4338ca' }]}>{metrics.total}</Text>
                <Text style={styles.metricLabel}>Total</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#16a34a10', borderColor: '#16a34a30' }]}>
                <Text style={[styles.metricVal, { color: '#16a34a' }]}>{metrics.active}</Text>
                <Text style={styles.metricLabel}>Active</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#0284c710', borderColor: '#0284c730' }]}>
                <Text style={[styles.metricVal, { color: '#0284c7' }]}>{metrics.scheduled}</Text>
                <Text style={styles.metricLabel}>Scheduled</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#d9770610', borderColor: '#d9770630' }]}>
                <Text style={[styles.metricVal, { color: '#d97706' }]}>{metrics.expiring_soon}</Text>
                <Text style={styles.metricLabel}>Expiring Soon</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#dc262610', borderColor: '#dc262630' }]}>
                <Text style={[styles.metricVal, { color: '#dc2626' }]}>{metrics.revoked}</Text>
                <Text style={styles.metricLabel}>Revoked</Text>
              </View>
            </ScrollView>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
              {STATUS_FILTERS.map(f => {
                const isActive = activeTab === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActiveTab(f)}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {f.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search teacher, employee ID, or reason..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
              />
              {Boolean(search) && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Teacher Active Banner */}
        {isTeacher && (
          <View style={styles.teacherBanner}>
            <Ionicons name="information-circle" size={24} color="#0284c7" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teacherBannerTitle}>Substitute Access Active</Text>
              <Text style={styles.teacherBannerSub}>
                You have been authorized temporary access to manage attendance, marks, and notes for absent colleagues.
              </Text>
            </View>
          </View>
        )}

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading delegations...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredList.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Delegations Found</Text>
            <Text style={styles.emptySubtitle}>
              {isTeacher
                ? 'You currently do not have any active substitute duties.'
                : 'No substitution records match the current filter.'}
            </Text>
            {!isTeacher && (
              <TouchableOpacity style={styles.emptyCreateBtn} onPress={openCreateWizard}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyCreateBtnText}>Create Substitution</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* List of Delegations */}
        {!loading && filteredList.map(item => {
          const statusStyle = getStatusColor(item.status);
          const isItemActive = item.status === 'ACTIVE';

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setDetailItem(item)}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                  <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                    {statusStyle.label}
                  </Text>
                </View>
                <Text style={styles.sessionBadge}>{item.session || '2024-25'}</Text>
              </View>

              {/* Substitution Flow (Absent -> Substitute) */}
              <View style={styles.flowRow}>
                <View style={styles.teacherCol}>
                  <Text style={styles.colLabel}>ABSENT TEACHER</Text>
                  <Text style={styles.teacherName} numberOfLines={1}>{item.source_teacher_name}</Text>
                  {Boolean(item.source_employee_id) && (
                    <Text style={styles.empId}>ID: {item.source_employee_id}</Text>
                  )}
                  {Boolean(item.source_department) && (
                    <Text style={styles.deptText}>{item.source_department}</Text>
                  )}
                </View>

                <View style={styles.arrowCol}>
                  <Ionicons name="arrow-forward-circle" size={26} color="#6366f1" />
                  <Text style={styles.substituteTag}>SUBSTITUTE</Text>
                </View>

                <View style={[styles.teacherCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.colLabel}>DELEGATED TO</Text>
                  <Text style={[styles.teacherName, { color: '#0369a1' }]} numberOfLines={1}>
                    {item.delegate_teacher_name}
                  </Text>
                  {Boolean(item.delegate_employee_id) && (
                    <Text style={styles.empId}>ID: {item.delegate_employee_id}</Text>
                  )}
                  {Boolean(item.delegate_department) && (
                    <Text style={styles.deptText}>{item.delegate_department}</Text>
                  )}
                </View>
              </View>

              {/* Window & Reason */}
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" style={{ marginRight: 4 }} />
                  <Text style={styles.infoText}>
                    {formatDate(item.starts_at)} — {formatDate(item.expires_at)}
                  </Text>
                </View>
                {Boolean(item.reason) && (
                  <View style={styles.infoItem}>
                    <Ionicons name="medkit-outline" size={14} color="#d97706" style={{ marginRight: 4 }} />
                    <Text style={[styles.infoText, { color: '#b45309' }]} numberOfLines={1}>
                      {item.reason}
                    </Text>
                  </View>
                )}
              </View>

              {/* Scoped Classes */}
              {Array.isArray(item.scopes) && item.scopes.length > 0 && (
                <View style={styles.scopesContainer}>
                  <Text style={styles.scopesTitle}>Assigned Classes:</Text>
                  <View style={styles.scopeChipsRow}>
                    {item.scopes.map((s, idx) => (
                      <View key={s.id || idx} style={styles.scopeChip}>
                        <Ionicons name="school-outline" size={12} color="#4338ca" style={{ marginRight: 4 }} />
                        <Text style={styles.scopeChipText}>
                          {s.class_name} {s.subject_name ? `• ${s.subject_name}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Teacher Quick Actions */}
              {isTeacher && isItemActive && (
                <View style={styles.teacherActionsRow}>
                  <TouchableOpacity
                    style={styles.teacherActionBtn}
                    onPress={() => navigation?.navigate?.('Attendance')}
                  >
                    <Ionicons name="clipboard-outline" size={14} color="#16a34a" />
                    <Text style={[styles.teacherActionText, { color: '#16a34a' }]}>Attendance</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teacherActionBtn}
                    onPress={() => navigation?.navigate?.('Marks')}
                  >
                    <Ionicons name="pencil-outline" size={14} color="#4338ca" />
                    <Text style={[styles.teacherActionText, { color: '#4338ca' }]}>Marks</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teacherActionBtn}
                    onPress={() => navigation?.navigate?.('Notes')}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#0284c7" />
                    <Text style={[styles.teacherActionText, { color: '#0284c7' }]}>Notes</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Principal Revoke Shortcut */}
              {!isTeacher && (isItemActive || item.status === 'SCHEDULED') && (
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.revokeBtn}
                    onPress={() => {
                      setRevokeTarget(item);
                      setRevokeReason('Regular teacher resumed duties');
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                    <Text style={styles.revokeBtnText}>Revoke Substitution</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewDetailBtn}
                    onPress={() => setDetailItem(item)}
                  >
                    <Text style={styles.viewDetailText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={Boolean(detailItem)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Delegation Details</Text>
                <Text style={styles.modalSubtitle}>Reference #{detailItem?.id}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {detailItem && (
              <ScrollView style={{ maxHeight: 420 }}>
                {/* Status banner */}
                <View style={[styles.detailStatusRow, { backgroundColor: getStatusColor(detailItem.status).bg }]}>
                  <Text style={[styles.detailStatusText, { color: getStatusColor(detailItem.status).text }]}>
                    Status: {getStatusColor(detailItem.status).label}
                  </Text>
                </View>

                {/* Teachers Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Teachers Involved</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Absent Teacher:</Text>
                    <Text style={styles.detailValue}>
                      {detailItem.source_teacher_name} ({detailItem.source_employee_id || 'N/A'})
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Substitute Teacher:</Text>
                    <Text style={[styles.detailValue, { color: '#0369a1', fontWeight: 'bold' }]}>
                      {detailItem.delegate_teacher_name} ({detailItem.delegate_employee_id || 'N/A'})
                    </Text>
                  </View>
                </View>

                {/* Timing */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Schedule & Duration</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Starts At:</Text>
                    <Text style={styles.detailValue}>{formatDateTime(detailItem.starts_at)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expires At:</Text>
                    <Text style={styles.detailValue}>{formatDateTime(detailItem.expires_at)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reason:</Text>
                    <Text style={styles.detailValue}>{detailItem.reason || 'None specified'}</Text>
                  </View>
                  {Boolean(detailItem.notes) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notes:</Text>
                      <Text style={styles.detailValue}>{detailItem.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Permissions Granted */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Granted Permissions</Text>
                  <View style={styles.scopeChipsRow}>
                    {(detailItem.permissions || []).map(p => (
                      <View key={p} style={styles.permChip}>
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text style={styles.permChipText}>{p.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Assigned Classes */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Authorized Classes & Subjects</Text>
                  {(detailItem.scopes || []).map((s, idx) => (
                    <View key={s.id || idx} style={styles.detailScopeItem}>
                      <Ionicons name="school" size={16} color="#4338ca" style={{ marginRight: 8 }} />
                      <View>
                        <Text style={styles.detailScopeClass}>{s.class_name}</Text>
                        <Text style={styles.detailScopeSubject}>{s.subject_name || 'All Subjects'}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Revocation Details */}
                {detailItem.revoked_at && (
                  <View style={[styles.detailSection, { backgroundColor: '#fee2e240', borderRadius: 8, padding: 8 }]}>
                    <Text style={[styles.detailSectionTitle, { color: '#b91c1c' }]}>Revocation Audit</Text>
                    <Text style={styles.detailLabel}>Revoked At: {formatDateTime(detailItem.revoked_at)}</Text>
                    <Text style={styles.detailLabel}>Revoked By: {detailItem.revoker_name || 'Principal'}</Text>
                    <Text style={styles.detailLabel}>Reason: {detailItem.revoke_reason}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setDetailItem(null)}>
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* REVOKE REASON MODAL */}
      <Modal visible={Boolean(revokeTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Revoke Delegation</Text>
                <Text style={styles.modalSubtitle}>Terminate substitute access immediately</Text>
              </View>
              <TouchableOpacity onPress={() => setRevokeTarget(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.revokeWarning}>
              Are you sure you want to revoke substitution duties from{' '}
              <Text style={{ fontWeight: 'bold' }}>{revokeTarget?.delegate_teacher_name}</Text>?
              All temporary class access will be revoked immediately.
            </Text>

            <Text style={styles.inputLabel}>Reason for Revocation</Text>
            <TextInput
              style={styles.textInput}
              value={revokeReason}
              onChangeText={setRevokeReason}
              placeholder="e.g. Regular teacher resumed duties"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRevokeTarget(null)}
                disabled={revoking}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDangerBtn, revoking && { opacity: 0.6 }]}
                onPress={handleRevokeConfirm}
                disabled={revoking}
              >
                {revoking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalDangerBtnText}>Confirm Revoke</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE DELEGATION WIZARD MODAL */}
      <Modal visible={createModal} animationType="slide">
        <SafeAreaView style={styles.wizardContainer}>
          {/* Wizard Header */}
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.wizardCloseBtn}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>New Substitute Delegation</Text>
            <Text style={styles.wizardStepBadge}>Step {wizardStep} of 4</Text>
          </View>

          {/* Step Indicator Progress */}
          <View style={styles.stepProgressRow}>
            {[1, 2, 3, 4].map(s => (
              <View
                key={s}
                style={[
                  styles.stepProgressBar,
                  wizardStep >= s && styles.stepProgressBarActive,
                ]}
              />
            ))}
          </View>

          {/* STEP 1: Select Absent Teacher */}
          {wizardStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>1. Select Absent Teacher</Text>
              <Text style={styles.stepSubtitle}>
                Choose the faculty member who is unavailable or on leave.
              </Text>

              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search faculty name or ID..."
                  value={teacherSearch}
                  onChangeText={setTeacherSearch}
                />
              </View>

              {loadingTeachers ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <ScrollView style={{ flex: 1 }}>
                  {teachersLookup
                    .filter(t => {
                      if (!teacherSearch) return true;
                      const q = teacherSearch.toLowerCase();
                      return (t.name || '').toLowerCase().includes(q) || (t.employee_id || '').toLowerCase().includes(q);
                    })
                    .map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={styles.teacherPickItem}
                        onPress={() => handleSelectSourceTeacher(t)}
                      >
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{(t.name || 'T')[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.teacherPickName}>{t.name}</Text>
                          <Text style={styles.teacherPickMeta}>
                            ID: {t.employee_id || 'N/A'} • {t.department || 'Academics'}
                          </Text>
                          <Text style={styles.assignmentsCount}>
                            {t.assignments?.length || 0} class assignment(s)
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* STEP 2: Select Substitute Teacher */}
          {wizardStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>2. Select Substitute Teacher</Text>
              <Text style={styles.stepSubtitle}>
                Substituting for: <Text style={{ fontWeight: 'bold' }}>{sourceTeacher?.name}</Text>
              </Text>

              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search substitute teacher..."
                  value={teacherSearch}
                  onChangeText={setTeacherSearch}
                />
              </View>

              <ScrollView style={{ flex: 1 }}>
                {teachersLookup
                  .filter(t => String(t.id) !== String(sourceTeacher?.id))
                  .filter(t => {
                    if (!teacherSearch) return true;
                    const q = teacherSearch.toLowerCase();
                    return (t.name || '').toLowerCase().includes(q) || (t.employee_id || '').toLowerCase().includes(q);
                  })
                  .map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.teacherPickItem,
                        delegateTeacher?.id === t.id && styles.teacherPickItemSelected,
                      ]}
                      onPress={() => setDelegateTeacher(t)}
                    >
                      <View style={[styles.avatarCircle, { backgroundColor: '#0284c715' }]}>
                        <Text style={[styles.avatarText, { color: '#0284c7' }]}>{(t.name || 'T')[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teacherPickName}>{t.name}</Text>
                        <Text style={styles.teacherPickMeta}>
                          ID: {t.employee_id || 'N/A'} • {t.department || 'Academics'}
                        </Text>
                      </View>
                      {delegateTeacher?.id === t.id && (
                        <Ionicons name="checkmark-circle" size={22} color="#0284c7" />
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <View style={styles.wizardFooter}>
                <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(1)}>
                  <Text style={styles.wizardBackBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wizardNextBtn, !delegateTeacher && { opacity: 0.5 }]}
                  disabled={!delegateTeacher}
                  onPress={() => setWizardStep(3)}
                >
                  <Text style={styles.wizardNextBtnText}>Next: Scopes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: Scopes & Permissions */}
          {wizardStep === 3 && (
            <View style={styles.stepContent}>
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>3. Assign Classes & Permissions</Text>
                <Text style={styles.stepSubtitle}>
                  Choose which of {sourceTeacher?.name}&apos;s classes {delegateTeacher?.name} can access.
                </Text>

                <Text style={styles.scopeSectionHeader}>CLASSES & SUBJECTS</Text>
                {selectedScopes.length === 0 ? (
                  <Text style={styles.emptyNote}>
                    No registered class assignments found for {sourceTeacher?.name}.
                  </Text>
                ) : (
                  selectedScopes.map((scope, idx) => (
                    <TouchableOpacity
                      key={scope.id}
                      style={[styles.scopeToggleItem, scope.selected && styles.scopeToggleItemSelected]}
                      onPress={() => {
                        const updated = [...selectedScopes];
                        updated[idx].selected = !updated[idx].selected;
                        setSelectedScopes(updated);
                      }}
                    >
                      <Ionicons
                        name={scope.selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={scope.selected ? '#4338ca' : '#94a3b8'}
                      />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.scopeToggleClass}>{scope.class_name}</Text>
                        <Text style={styles.scopeToggleSubject}>{scope.subject_name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                <Text style={[styles.scopeSectionHeader, { marginTop: 20 }]}>ACCESS PRIVILEGES</Text>
                {PERMISSION_OPTIONS.map(p => {
                  const isChecked = selectedPermissions.includes(p.code);
                  return (
                    <TouchableOpacity
                      key={p.code}
                      style={[styles.scopeToggleItem, isChecked && styles.scopeToggleItemSelected]}
                      onPress={() => {
                        if (isChecked) {
                          setSelectedPermissions(selectedPermissions.filter(c => c !== p.code));
                        } else {
                          setSelectedPermissions([...selectedPermissions, p.code]);
                        }
                      }}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isChecked ? '#16a34a' : '#94a3b8'}
                      />
                      <Ionicons name={p.icon} size={18} color="#64748b" style={{ marginLeft: 10, marginRight: 6 }} />
                      <Text style={styles.permOptionLabel}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.wizardFooter}>
                <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(2)}>
                  <Text style={styles.wizardBackBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.wizardNextBtn,
                    (!selectedScopes.some(s => s.selected) || selectedPermissions.length === 0) && { opacity: 0.5 },
                  ]}
                  disabled={!selectedScopes.some(s => s.selected) || selectedPermissions.length === 0}
                  onPress={() => setWizardStep(4)}
                >
                  <Text style={styles.wizardNextBtnText}>Next: Schedule</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: Schedule, Reason & Conflict Check */}
          {wizardStep === 4 && (
            <View style={styles.stepContent}>
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>4. Timing & Reason</Text>
                <Text style={styles.stepSubtitle}>
                  Set start date and auto-expiration for temporary access.
                </Text>

                {/* Date Controls */}
                <View style={styles.dateRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="2026-09-27"
                    />
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput
                      style={styles.textInput}
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="08:00"
                    />
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={endDate}
                      onChangeText={setEndDate}
                      placeholder="2026-09-30"
                    />
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TextInput
                      style={styles.textInput}
                      value={endTime}
                      onChangeText={setEndTime}
                      placeholder="16:00"
                    />
                  </View>
                </View>

                {/* Conflict Alert Banner */}
                {checkingConflicts ? (
                  <View style={styles.conflictChecking}>
                    <ActivityIndicator size="small" color="#0284c7" />
                    <Text style={styles.conflictCheckingText}>Checking schedule clashes...</Text>
                  </View>
                ) : conflicts.length > 0 ? (
                  <View style={styles.conflictBox}>
                    <Ionicons name="warning" size={20} color="#b45309" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.conflictTitle}>Schedule Clashes Detected</Text>
                      {conflicts.map((c, idx) => (
                        <Text key={idx} style={styles.conflictDesc}>• {c.description || c.type}</Text>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.noConflictBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.noConflictText}>No schedule conflicts detected.</Text>
                  </View>
                )}

                {/* Reason Presets */}
                <Text style={styles.inputLabel}>Substitution Reason</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {REASON_PRESETS.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reasonChip, reason === r && styles.reasonChipActive]}
                      onPress={() => setReason(r)}
                    >
                      <Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {reason === 'Other Reason' && (
                  <TextInput
                    style={[styles.textInput, { marginBottom: 12 }]}
                    placeholder="Specify reason..."
                    value={customReason}
                    onChangeText={setCustomReason}
                  />
                )}

                <Text style={styles.inputLabel}>Internal Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g. Please cover chapter 4 and take roll call daily..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </ScrollView>

              <View style={styles.wizardFooter}>
                <TouchableOpacity style={styles.wizardBackBtn} onPress={() => setWizardStep(3)}>
                  <Text style={styles.wizardBackBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wizardSubmitBtn, submitting && { opacity: 0.7 }]}
                  disabled={submitting}
                  onPress={handleSubmitDelegation}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.wizardSubmitBtnText}>Confirm & Delegate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metricCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  filterTabsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  teacherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  teacherBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369a1',
  },
  teacherBannerSub: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 2,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyCreateBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sessionBadge: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  teacherCol: {
    flex: 1,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  empId: {
    fontSize: 11,
    color: '#64748b',
  },
  deptText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  arrowCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  substituteTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6366f1',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
  },
  scopesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginBottom: 8,
  },
  scopesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  scopeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  scopeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338ca',
  },
  teacherActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 8,
  },
  teacherActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  teacherActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revokeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailStatusRow: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailSection: {
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  permChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
  },
  detailScopeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  detailScopeClass: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailScopeSubject: {
    fontSize: 11,
    color: '#64748b',
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  revokeWarning: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalDangerBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalDangerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  wizardContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  wizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  wizardCloseBtn: {
    padding: 4,
  },
  wizardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  wizardStepBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  stepProgressRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  stepProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
  },
  stepProgressBarActive: {
    backgroundColor: colors.primary,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 14,
  },
  teacherPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  teacherPickItemSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe20',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4338ca15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4338ca',
  },
  teacherPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  teacherPickMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  assignmentsCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4338ca',
    marginTop: 2,
  },
  wizardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  wizardBackBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wizardBackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  wizardNextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  wizardNextBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  wizardSubmitBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  wizardSubmitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  scopeSectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
  },
  emptyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  scopeToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  scopeToggleItemSelected: {
    borderColor: '#4338ca',
    backgroundColor: '#eef2ff',
  },
  scopeToggleClass: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  scopeToggleSubject: {
    fontSize: 11,
    color: '#64748b',
  },
  permOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  conflictChecking: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 10,
  },
  conflictCheckingText: {
    fontSize: 12,
    color: '#0284c7',
    marginLeft: 6,
  },
  conflictBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  conflictTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2,
  },
  conflictDesc: {
    fontSize: 11,
    color: '#b45309',
  },
  noConflictBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  noConflictText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#fff',
  },
});
