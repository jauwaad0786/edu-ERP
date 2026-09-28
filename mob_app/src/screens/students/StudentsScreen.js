// mob_app/src/screens/students/StudentsScreen.js
// 100% Feature Parity with Web ERP StudentsPage.jsx & backend APIs
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const STATUS_BADGES = {
  ACTIVE:      { bg: '#dcfce7', text: '#15803d', label: 'Confirmed (Active)' },
  PROVISIONAL: { bg: '#fef3c7', text: '#b45309', label: 'Unconfirmed (Fee Due)' },
  PROMOTED:    { bg: '#e0e7ff', text: '#3730a3', label: 'Promoted' },
  RETAINED:    { bg: '#fef3c7', text: '#92400e', label: 'Retained' },
  GRADUATED:   { bg: '#f3e8ff', text: '#6b21a8', label: 'Graduated' },
  WITHDRAWN:   { bg: '#fee2e2', text: '#991b1b', label: 'Withdrawn' },
  LEFT:        { bg: '#f1f5f9', text: '#475569', label: 'Left' },
};

const AVATAR_BG_COLORS = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe', '#ffedd5'];

export default function StudentsScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals for filters
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Provisional count & Rollback token
  const [provisionalCount, setProvisionalCount] = useState(0);
  const [lastRollbackToken, setLastRollbackToken] = useState(null);
  const [revertingShuffle, setRevertingShuffle] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Load classes, sessions, and provisional count
  const loadInitialMeta = useCallback(async () => {
    try {
      const [clsRes, sessRes, provRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/students/sessions').catch(() => ({ data: {} })),
        client.get('/principal/students?status=PROVISIONAL').catch(() => ({ data: [] })),
      ]);

      const clsList = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      setClasses(clsList);

      const sessList = sessRes.data?.sessions || [];
      setSessions(sessList);
      if (sessList.length > 0 && !selectedSession) {
        setSelectedSession(sessList[0]);
      }

      const provList = Array.isArray(provRes.data)
        ? provRes.data
        : provRes.data?.students || provRes.data?.data || [];
      setProvisionalCount(provList.length);
    } catch (err) {
      console.warn('Failed to load metadata:', err?.message);
    }
  }, [selectedSession]);

  useEffect(() => {
    loadInitialMeta();
  }, [loadInitialMeta]);

  // Load students based on classFilter & sessionFilter
  const loadStudents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (selectedClassId) params.class_id = selectedClassId;
      if (selectedSession) params.session = selectedSession;

      const res = await client.get('/principal/students', { params });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.students || res.data?.data || [];
      setStudents(list);
    } catch (err) {
      console.warn('Failed to load students:', err?.message);
      setStudents([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedClassId, selectedSession]);

  useEffect(() => {
    loadStudents();
    setSelectedIds(new Set());
  }, [loadStudents]);

  // Filter students by search and status
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const sName = (s.name || s.student_name || '').toLowerCase();
      const sAdm = (s.admission_no || s.admission_number || '').toLowerCase();
      const sRoll = (s.roll_no || s.roll_number || '').toString();

      const matchesSearch = !search ||
        sName.includes(search.toLowerCase()) ||
        sAdm.includes(search.toLowerCase()) ||
        sRoll.includes(search);

      const matchesStatus = !selectedStatus || (s.status || 'ACTIVE') === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, selectedStatus]);

  // Multi-selection handlers
  const toggleStudentSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // Download admission card PDF
  const handleDownloadAdmissionCard = async (student) => {
    setDownloadingId(student.id);
    try {
      const url = `${client.defaults.baseURL}/principal/admission-card/${student.id}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Download Error', 'Could not open admission card.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const q = [];
      if (selectedSession) q.push(`session=${encodeURIComponent(selectedSession)}`);
      if (selectedClassId) q.push(`class_id=${encodeURIComponent(selectedClassId)}`);
      const qs = q.length ? `?${q.join('&')}` : '';
      const url = `${client.defaults.baseURL}/principal/students/export${qs}`;
      await Linking.openURL(url);
      Alert.alert('Export Triggered', 'Student roster CSV export opened in browser.');
    } catch {
      Alert.alert('Export Failed', 'Unable to export students CSV.');
    } finally {
      setExporting(false);
    }
  };

  // Rollback Shuffle
  const handleRollbackShuffle = async () => {
    if (!lastRollbackToken) return;
    Alert.alert(
      'Revert Last Shuffle?',
      'Are you sure you want to revert the last section shuffle? Students will be restored to their previous sections.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo Shuffle',
          style: 'destructive',
          onPress: async () => {
            setRevertingShuffle(true);
            try {
              const res = await client.post('/principal/students/shuffle/rollback', {
                rollback_token: lastRollbackToken,
              });
              Alert.alert('Shuffle Reverted', res.data?.message || 'Section shuffle reverted successfully!');
              setLastRollbackToken(null);
              loadStudents();
            } catch (err) {
              Alert.alert('Rollback Failed', err.response?.data?.error || 'Could not revert shuffle.');
            } finally {
              setRevertingShuffle(false);
            }
          }
        }
      ]
    );
  };

  // Delete student with 365-day retention notice
  const handleDeleteStudent = (stu) => {
    Alert.alert(
      'Move to Deleted Items?',
      `Are you sure you want to delete ${stu.name}? This record will be moved to DELETED ITEMS and remains recoverable for 1 year (365 days).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Student',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/students/${stu.id}`);
              Alert.alert('Deleted', `${stu.name} moved to Deleted Items.`);
              setStudents(prev => prev.filter(s => s.id !== stu.id));
            } catch (err) {
              Alert.alert('Action Failed', err.response?.data?.error || 'Could not delete student.');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name) => {
    if (!name) return 'S';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const selectedClassObj = classes.find(c => String(c.id) === String(selectedClassId));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Students Directory</Text>
          <Text style={styles.headerSubtitle}>
            {students.length} Total Enrolled
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          <Ionicons name="download-outline" size={18} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation?.navigate ? navigation.navigate('AddStudentWizard') : null}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Provisional Admissions Notice Banner */}
      {provisionalCount > 0 && (
        <TouchableOpacity
          style={styles.provisionalBanner}
          activeOpacity={0.85}
          onPress={() => navigation?.navigate ? navigation.navigate('Provisional') : null}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            <Ionicons name="time" size={20} color="#b45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.provisionalTitle}>
                {provisionalCount} Unconfirmed {provisionalCount === 1 ? 'Admission' : 'Admissions'} Pending Fee
              </Text>
              <Text style={styles.provisionalSub}>
                Tap to inspect Provisional Queue &amp; complete fee clearance.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#b45309" />
        </TouchableOpacity>
      )}

      {/* Shuffle Rollback Banner */}
      {lastRollbackToken && (
        <View style={styles.rollbackBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rollbackTitle}>Recent Section Shuffle Active</Text>
            <Text style={styles.rollbackSub}>You can revert student sections to previous state.</Text>
          </View>
          <TouchableOpacity
            style={styles.rollbackBtn}
            onPress={handleRollbackShuffle}
            disabled={revertingShuffle}
          >
            <Text style={styles.rollbackBtnText}>
              {revertingShuffle ? 'Undoing...' : 'Undo'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, admission no, roll no..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Action Shortcuts */}
      <View style={styles.quickActionsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('AddStudentWizard') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="person-add" size={14} color="#0b57d0" />
            <Text style={styles.quickActionText}>Admission Wizard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('Provisional') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="time-outline" size={14} color="#d97706" />
            <Text style={styles.quickActionText}>Provisional Queue ({provisionalCount})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('BulkEdit') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={14} color="#0d9488" />
            <Text style={styles.quickActionText}>Bulk Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('SectionShuffle') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="shuffle-outline" size={14} color="#7c3aed" />
            <Text style={styles.quickActionText}>Section Shuffle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('Promotion') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="rocket-outline" size={14} color="#16a34a" />
            <Text style={styles.quickActionText}>Promote &amp; Rollover</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('AnnualRegister') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="repeat-outline" size={14} color="#059669" />
            <Text style={styles.quickActionText}>Annual Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('StudentImport') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#0891b2" />
            <Text style={styles.quickActionText}>Import CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('IDCard') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="card-outline" size={14} color="#7c3aed" />
            <Text style={styles.quickActionText}>ID Cards</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Filter Row: Session, Class, Status */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowSessionModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={13} color="#64748b" />
          <Text style={styles.filterPillText} numberOfLines={1}>
            {selectedSession ? `Session ${selectedSession}` : 'All Sessions'}
          </Text>
          <Ionicons name="chevron-down" size={13} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowClassModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="school-outline" size={13} color="#64748b" />
          <Text style={styles.filterPillText} numberOfLines={1}>
            {selectedClassObj ? `${selectedClassObj.name} - ${selectedClassObj.section}` : 'All Classes'}
          </Text>
          <Ionicons name="chevron-down" size={13} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowStatusModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="filter-outline" size={13} color="#64748b" />
          <Text style={styles.filterPillText} numberOfLines={1}>
            {selectedStatus ? (STATUS_BADGES[selectedStatus]?.label || selectedStatus) : 'All Statuses'}
          </Text>
          <Ionicons name="chevron-down" size={13} color="#64748b" />
        </TouchableOpacity>

        {(selectedSession || selectedClassId || selectedStatus || search) && (
          <TouchableOpacity
            style={styles.clearFilterBtn}
            onPress={() => {
              setSelectedClassId('');
              setSelectedStatus('');
              setSearch('');
            }}
          >
            <Ionicons name="close" size={16} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection Header Bar */}
      <View style={styles.selectionBar}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={toggleSelectAll}
        >
          <Ionicons
            name={selectedIds.size > 0 && selectedIds.size === filteredStudents.length ? 'checkbox' : 'square-outline'}
            size={18}
            color={colors.primary}
          />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>
            {selectedIds.size > 0 ? `Selected ${selectedIds.size} of ${filteredStudents.length}` : 'Select All'}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: '#94a3b8' }}>
          Showing {filteredStudents.length} students
        </Text>
      </View>

      {/* Student List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching enrolled students...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, selectedIds.size > 0 && { paddingBottom: 90 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadStudents(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s, idx) => {
              const isSelected = selectedIds.has(s.id);
              const bgColor = AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length];
              const sName = s.name || s.student_name || 'Student';
              const sClass = s.class_name || (classes.find(c => String(c.id) === String(s.class_id)) ? `${classes.find(c => String(c.id) === String(s.class_id)).name} - ${classes.find(c => String(c.id) === String(s.class_id)).section}` : 'Class');
              const sRoll = s.roll_no || s.roll_number || '—';
              const sAdm = s.admission_no || s.admission_number || '—';
              const st = STATUS_BADGES[s.status || 'ACTIVE'] || STATUS_BADGES.ACTIVE;

              return (
                <View
                  key={s.id || idx}
                  style={[
                    styles.studentCard,
                    isSelected && { borderColor: colors.primary, backgroundColor: '#f0f9ff' },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Checkbox */}
                    <TouchableOpacity
                      onPress={() => toggleStudentSelection(s.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginRight: 10 }}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? colors.primary : '#94a3b8'}
                      />
                    </TouchableOpacity>

                    {/* Avatar */}
                    <TouchableOpacity
                      style={[styles.avatarCircle, { backgroundColor: bgColor }]}
                      onPress={() => navigation?.navigate('StudentDetail', { student: s, student_id: s.id })}
                    >
                      <Text style={styles.avatarText}>{getInitials(sName)}</Text>
                    </TouchableOpacity>

                    {/* Info */}
                    <TouchableOpacity
                      style={styles.infoCol}
                      onPress={() => navigation?.navigate('StudentDetail', { student: s, student_id: s.id })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.studentName} numberOfLines={1}>{sName}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
                        </View>
                      </View>

                      <Text style={styles.studentMeta}>
                        Adm #{sAdm} &nbsp;·&nbsp; Roll: {sRoll} &nbsp;·&nbsp; {sClass}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {s.house ? (
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>🏠 {s.house}</Text>
                          </View>
                        ) : null}
                        {s.stream && s.stream !== 'General' ? (
                          <View style={[styles.tagBadge, { backgroundColor: '#f3e8ff' }]}>
                            <Text style={[styles.tagBadgeText, { color: '#7c3aed' }]}>🧪 {s.stream}</Text>
                          </View>
                        ) : null}
                        {s.session ? (
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>{s.session}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Bottom Action Strip on Card */}
                  <View style={styles.cardActionStrip}>
                    {s.status === 'PROVISIONAL' ? (
                      <TouchableOpacity
                        style={styles.actionBtnProvisional}
                        onPress={() => navigation?.navigate('Provisional')}
                      >
                        <Ionicons name="flash-outline" size={13} color="#b45309" />
                        <Text style={styles.actionBtnProvisionalText}>Complete Admission</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.actionBtnMini}
                      onPress={() => handleDownloadAdmissionCard(s)}
                      disabled={downloadingId === s.id}
                    >
                      <Ionicons name="card-outline" size={13} color="#0b57d0" />
                      <Text style={styles.actionBtnMiniText}>
                        {downloadingId === s.id ? 'Loading...' : 'Adm Card'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnMini}
                      onPress={() => navigation?.navigate('StudentDetail', { student: s, student_id: s.id, tab: 'history' })}
                    >
                      <Ionicons name="time-outline" size={13} color="#7c3aed" />
                      <Text style={[styles.actionBtnMiniText, { color: '#7c3aed' }]}>History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnMini}
                      onPress={() => navigation?.navigate('IDCard', { student_id: s.id, student: s })}
                    >
                      <Ionicons name="id-card-outline" size={13} color="#0284c7" />
                      <Text style={[styles.actionBtnMiniText, { color: '#0284c7' }]}>ID Card</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteMiniBtn}
                      onPress={() => handleDeleteStudent(s)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySub}>
                {search || selectedClassId || selectedStatus
                  ? 'Try clearing your filters or changing search keywords'
                  : 'Get started by creating a new student admission'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Multi-Select Toolbar */}
      {selectedIds.size > 0 && (
        <View style={styles.floatingToolbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.floatingToolbarTitle}>
              {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} selected
            </Text>
            <Text style={styles.floatingToolbarSub}>Ready for batch modification</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.floatingActionBtn}
              onPress={() => {
                navigation.navigate('BulkEdit', {
                  selectedIds: Array.from(selectedIds),
                  session: selectedSession,
                });
              }}
            >
              <Ionicons name="create-outline" size={16} color="#ffffff" />
              <Text style={styles.floatingActionBtnText}>Bulk Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingClearBtn}
              onPress={() => setSelectedIds(new Set())}
            >
              <Text style={styles.floatingClearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Session Filter Modal */}
      <Modal visible={showSessionModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSessionModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Academic Session</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[styles.modalItem, !selectedSession && styles.modalItemActive]}
                onPress={() => {
                  setSelectedSession('');
                  setShowSessionModal(false);
                }}
              >
                <Text style={[styles.modalItemText, !selectedSession && styles.modalItemTextActive]}>
                  All Sessions
                </Text>
              </TouchableOpacity>
              {sessions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.modalItem, selectedSession === s && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedSession(s);
                    setShowSessionModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedSession === s && styles.modalItemTextActive]}>
                    Session {s}
                  </Text>
                  {selectedSession === s && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Class Filter Modal */}
      <Modal visible={showClassModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowClassModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Class &amp; Section</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[styles.modalItem, !selectedClassId && styles.modalItemActive]}
                onPress={() => {
                  setSelectedClassId('');
                  setShowClassModal(false);
                }}
              >
                <Text style={[styles.modalItemText, !selectedClassId && styles.modalItemTextActive]}>
                  All Classes
                </Text>
              </TouchableOpacity>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.modalItem, String(selectedClassId) === String(c.id) && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedClassId(String(c.id));
                    setShowClassModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, String(selectedClassId) === String(c.id) && styles.modalItemTextActive]}>
                    {c.name} — Section {c.section}
                  </Text>
                  {String(selectedClassId) === String(c.id) && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Filter Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Status</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[styles.modalItem, !selectedStatus && styles.modalItemActive]}
                onPress={() => {
                  setSelectedStatus('');
                  setShowStatusModal(false);
                }}
              >
                <Text style={[styles.modalItemText, !selectedStatus && styles.modalItemTextActive]}>
                  All Statuses
                </Text>
              </TouchableOpacity>
              {Object.entries(STATUS_BADGES).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalItem, selectedStatus === key && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedStatus(key);
                    setShowStatusModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedStatus === key && styles.modalItemTextActive]}>
                    {val.label}
                  </Text>
                  {selectedStatus === key && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 18,
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
    marginRight: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  provisionalBanner: {
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  provisionalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400e',
  },
  provisionalSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 1,
  },
  rollbackBanner: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rollbackTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1e40af',
  },
  rollbackSub: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 1,
  },
  rollbackBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  rollbackBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13.5,
    color: '#0f172a',
    paddingVertical: 0,
  },
  quickActionsWrapper: {
    backgroundColor: '#ffffff',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  quickActionsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  quickActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    maxWidth: '75%',
  },
  clearFilterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  studentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  infoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '65%',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  tagBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  cardActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtnProvisional: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnProvisionalText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#b45309',
  },
  actionBtnMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  actionBtnMiniText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0b57d0',
  },
  deleteMiniBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  floatingToolbar: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  floatingToolbarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  floatingToolbarSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  floatingActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  floatingClearBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  floatingClearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  modalHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  modalItemActive: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  modalItemText: {
    fontSize: 13.5,
    color: '#334155',
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
