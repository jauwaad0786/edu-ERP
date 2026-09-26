// mob_app/src/screens/communication/MeetingsScreen.js
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

const STATUS_FILTERS = ['ALL', 'PENDING', 'ACCEPTED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];

const PREFERRED_MODES = [
  { key: 'GOOGLE_MEET', label: 'Google Meet', icon: 'videocam-outline', color: '#16a34a' },
  { key: 'ZOOM', label: 'Zoom Video', icon: 'videocam', color: '#0284c7' },
  { key: 'PHONE_CALL', label: 'Phone Call', icon: 'call-outline', color: '#7c3aed' },
  { key: 'IN_PERSON', label: 'Campus In-Person', icon: 'people-outline', color: '#ea580c' },
];

const PRIORITIES = [
  { key: 'LOW', label: 'Low', color: '#64748b' },
  { key: 'MEDIUM', label: 'Normal', color: '#0284c7' },
  { key: 'HIGH', label: 'High', color: '#ea580c' },
  { key: 'URGENT', label: 'Urgent', color: '#dc2626' },
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function MeetingsScreen({ navigation }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isPrincipalOrAdmin = ['PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'].includes(userRole);

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState(null);

  // Form Fields
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [meetingTime, setMeetingTime] = useState('11:00 AM');
  const [priority, setPriority] = useState('MEDIUM');
  const [preferredMode, setPreferredMode] = useState('GOOGLE_MEET');
  const [submitting, setSubmitting] = useState(false);

  // Load Meetings
  const loadMeetings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (activeStatus !== 'ALL') params.status = activeStatus;

      const res = await client.get('/support/meetings', { params }).catch(() => ({ data: { data: [] } }));
      const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      setMeetings(list);
    } catch {
      setMeetings([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Request Meeting
  const handleCreateMeeting = async () => {
    if (!topic.trim()) {
      Alert.alert('Missing Topic', 'Please enter a topic for the meeting.');
      return;
    }
    if (!meetingDate.trim() || !meetingTime.trim()) {
      Alert.alert('Missing Schedule', 'Please provide date and time.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/support/meetings', {
        topic: topic.trim(),
        description: description.trim(),
        meeting_date: meetingDate.trim(),
        meeting_time: meetingTime.trim(),
        priority,
        preferred_mode: preferredMode,
        product_type: 'EduERP',
      });

      Alert.alert('Requested', 'Your meeting request has been submitted successfully.');
      setCreateModal(false);
      setTopic('');
      setDescription('');
      loadMeetings();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit meeting request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Join Link
  const handleJoinMeeting = (link) => {
    if (!link) {
      Alert.alert('No Meeting Link', 'A video conference link has not been attached yet.');
      return;
    }
    const targetUrl = link.startsWith('http') ? link : `https://${link}`;
    Linking.openURL(targetUrl).catch(() => {
      Alert.alert('Error', 'Unable to open the meeting link.');
    });
  };

  // Filtered List
  const filteredList = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(m => {
      const t = (m.topic || '').toLowerCase();
      const req = (m.requester_name || '').toLowerCase();
      const desc = (m.description || '').toLowerCase();
      return t.includes(q) || req.includes(q) || desc.includes(q);
    });
  }, [meetings, search]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'CONFIRMED' };
      case 'PENDING':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'PENDING' };
      case 'RESCHEDULED':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', label: 'RESCHEDULED' };
      case 'COMPLETED':
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'COMPLETED' };
      case 'CANCELLED':
      default:
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', label: 'CANCELLED' };
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
            <Text style={styles.headerTitle}>Meetings & Conferences</Text>
            <Text style={styles.headerSubtitle}>PTM, virtual sessions & conferences</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModal(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Book Meeting</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMeetings(true)} colors={[colors.primary]} />}
      >
        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsRow}>
          {STATUS_FILTERS.map(f => {
            const isActive = activeStatus === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveStatus(f)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search meeting topic, attendee, or agenda..."
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

        {/* Loading Spinner */}
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching scheduled meetings...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredList.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Meetings Found</Text>
            <Text style={styles.emptySubtitle}>
              No scheduled virtual sessions or parent-teacher conferences match this filter.
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={() => setCreateModal(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCreateBtnText}>Request New Meeting</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Meeting Cards */}
        {!loading && filteredList.map(item => {
          const statusStyle = getStatusBadge(item.status);
          const modeObj = PREFERRED_MODES.find(m => m.key === item.preferred_mode) || PREFERRED_MODES[0];
          const hasLink = Boolean(item.meeting_link);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setDetailMeeting(item)}
            >
              {/* Header Badges */}
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {statusStyle.label}
                  </Text>
                </View>

                <View style={styles.modeBadge}>
                  <Ionicons name={modeObj.icon} size={13} color={modeObj.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.modeBadgeText, { color: modeObj.color }]}>
                    {modeObj.label}
                  </Text>
                </View>
              </View>

              {/* Topic */}
              <Text style={styles.topicTitle}>{item.topic}</Text>

              {/* Requester & School */}
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>
                  {item.requester_name || 'Requester'} {item.requester_role ? `(${item.requester_role})` : ''}
                </Text>
                {Boolean(item.school_name) && (
                  <Text style={[styles.metaText, { marginLeft: 6 }]}>• {item.school_name}</Text>
                )}
              </View>

              {/* Schedule Info */}
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleItem}>
                  <Ionicons name="calendar-outline" size={14} color="#4338ca" style={{ marginRight: 4 }} />
                  <Text style={styles.scheduleDate}>{formatDate(item.meeting_date)}</Text>
                </View>
                <View style={styles.scheduleItem}>
                  <Ionicons name="time-outline" size={14} color="#4338ca" style={{ marginRight: 4 }} />
                  <Text style={styles.scheduleTime}>{item.meeting_time}</Text>
                </View>
              </View>

              {/* Description preview */}
              {Boolean(item.description) && (
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* Actions Footer */}
              <View style={styles.cardFooter}>
                {hasLink ? (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => handleJoinMeeting(item.meeting_link)}
                  >
                    <Ionicons name="videocam" size={15} color="#fff" />
                    <Text style={styles.joinBtnText}>Join Virtual Room</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noLinkBox}>
                    <Ionicons name="hourglass-outline" size={13} color="#94a3b8" />
                    <Text style={styles.noLinkText}>Link pending host confirmation</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => setDetailMeeting(item)}
                >
                  <Text style={styles.detailsBtnText}>Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={Boolean(detailMeeting)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Meeting Details</Text>
                <Text style={styles.modalSubtitle}>ID #{detailMeeting?.id}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailMeeting(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {detailMeeting && (
              <ScrollView style={{ maxHeight: 400 }}>
                {/* Status banner */}
                <View style={[styles.detailStatusBanner, { backgroundColor: getStatusBadge(detailMeeting.status).bg }]}>
                  <Text style={[styles.detailStatusText, { color: getStatusBadge(detailMeeting.status).text }]}>
                    Status: {getStatusBadge(detailMeeting.status).label}
                  </Text>
                </View>

                <Text style={styles.detailTopic}>{detailMeeting.topic}</Text>
                {Boolean(detailMeeting.description) && (
                  <Text style={styles.detailDesc}>{detailMeeting.description}</Text>
                )}

                <View style={styles.detailDivider} />

                {/* Schedule */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Schedule & Timing</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(detailMeeting.meeting_date)} at {detailMeeting.meeting_time}
                  </Text>
                </View>

                {/* Mode & Priority */}
                <View style={styles.detailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Preferred Mode</Text>
                    <Text style={styles.detailValue}>{detailMeeting.preferred_mode}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Priority</Text>
                    <Text style={[styles.detailValue, { color: colors.primary }]}>{detailMeeting.priority}</Text>
                  </View>
                </View>

                {/* Requester */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Requested By</Text>
                  <Text style={styles.detailValue}>
                    {detailMeeting.requester_name} ({detailMeeting.requester_role})
                  </Text>
                </View>

                {/* Meeting Link */}
                {Boolean(detailMeeting.meeting_link) && (
                  <View style={styles.detailLinkBox}>
                    <Text style={styles.detailLabel}>Conference Room URL</Text>
                    <TouchableOpacity
                      style={styles.detailJoinBtn}
                      onPress={() => handleJoinMeeting(detailMeeting.meeting_link)}
                    >
                      <Ionicons name="videocam" size={16} color="#fff" />
                      <Text style={styles.detailJoinBtnText}>Open Conference Room</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Response Note */}
                {Boolean(detailMeeting.response_note) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Host Response Note</Text>
                    <Text style={styles.detailValue}>{detailMeeting.response_note}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setDetailMeeting(null)}>
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREATE MEETING MODAL */}
      <Modal visible={createModal} animationType="slide">
        <SafeAreaView style={styles.wizardContainer}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.wizardCloseBtn}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Request Virtual Meeting / PTM</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.wizardScroll}>
            <Text style={styles.inputLabel}>Meeting Topic</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Academic Progress & Behavioral Review"
              value={topic}
              onChangeText={setTopic}
            />

            <Text style={styles.inputLabel}>Detailed Agenda & Description</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Specify points of discussion or questions..."
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Date & Time */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={meetingDate}
                  onChangeText={setMeetingDate}
                  placeholder="2026-09-28"
                />
              </View>

              <View style={{ width: 120 }}>
                <Text style={styles.inputLabel}>Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={meetingTime}
                  onChangeText={setMeetingTime}
                  placeholder="11:00 AM"
                />
              </View>
            </View>

            {/* Preferred Mode */}
            <Text style={styles.inputLabel}>Preferred Conference Mode</Text>
            <View style={styles.modePickGrid}>
              {PREFERRED_MODES.map(m => {
                const isSelected = preferredMode === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modePickCard, isSelected && styles.modePickCardActive]}
                    onPress={() => setPreferredMode(m.key)}
                  >
                    <Ionicons name={m.icon} size={20} color={isSelected ? colors.primary : '#64748b'} />
                    <Text style={[styles.modePickText, isSelected && styles.modePickTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Priority */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Urgency / Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => {
                const isSelected = priority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.priorityChip, isSelected && { backgroundColor: p.color, borderColor: p.color }]}
                    onPress={() => setPriority(p.key)}
                  >
                    <Text style={[styles.priorityChipText, isSelected && { color: '#fff' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.wizardFooter}>
            <TouchableOpacity
              style={styles.wizardCancelBtn}
              onPress={() => setCreateModal(false)}
            >
              <Text style={styles.wizardCancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.wizardSubmitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleCreateMeeting}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.wizardSubmitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 16,
    paddingBottom: 40,
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
  centerContainer: {
    padding: 40,
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
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    gap: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  scheduleTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  descriptionText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noLinkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noLinkText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
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
    maxHeight: '85%',
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
  detailStatusBanner: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailTopic: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  detailDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  detailSection: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  detailLinkBox: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 10,
  },
  detailJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 6,
    gap: 6,
  },
  detailJoinBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  wizardScroll: {
    flex: 1,
    padding: 16,
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
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
  },
  modePickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modePickCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  modePickCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
  },
  modePickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modePickTextActive: {
    color: colors.primary,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  wizardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  wizardCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wizardCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  wizardSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  wizardSubmitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
