// mob_app/src/screens/notices/NoticeBoardScreen.js
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

const AUDIENCE_MAP = {
  ALL: { label: 'Everyone', icon: 'globe-outline', color: '#6366f1', bg: '#eef2ff' },
  STUDENTS: { label: 'Students', icon: 'school-outline', color: '#0284c7', bg: '#e0f2fe' },
  PARENTS: { label: 'Parents', icon: 'people-outline', color: '#7c3aed', bg: '#ede9fe' },
  TEACHERS: { label: 'Teachers', icon: 'person-outline', color: '#16a34a', bg: '#dcfce7' },
  STAFF: { label: 'Staff Only', icon: 'briefcase-outline', color: '#ea580c', bg: '#ffedd5' },
};

const PRIORITY_MAP = {
  CRITICAL: { label: 'Urgent', bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: 'alert-circle' },
  URGENT:   { label: 'Urgent', bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: 'alert-circle' },
  HIGH:     { label: 'High', bg: '#ffedd5', text: '#ea580c', border: '#fed7aa', icon: 'warning' },
  MEDIUM:   { label: 'Normal', bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: 'notifications' },
  LOW:      { label: 'Info', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: 'information-circle' },
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function NoticeBoardScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role || '';
  const canPublish = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'DIRECTOR'].includes(role);

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');

  // Publish Modal State (for staff)
  const [publishModal, setPublishModal] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubBody, setPubBody] = useState('');
  const [pubAudience, setPubAudience] = useState('ALL');
  const [pubPriority, setPubPriority] = useState('MEDIUM');
  const [pubIsPinned, setPubIsPinned] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Detail Modal State
  const [detailModal, setDetailModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);

  // Load Notices
  const loadNotices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = { per_page: 50 };
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (audienceFilter !== 'ALL') params.audience = audienceFilter;

      const res = await client.get('/support/announcements', { params }).catch(() => ({ data: { data: [] } }));
      const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setNotices(list);
    } catch {
      setNotices([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [priorityFilter, audienceFilter]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  // Publish Notice
  const handlePublishNotice = async () => {
    if (!pubTitle.trim() || !pubBody.trim()) {
      Alert.alert('Required Fields', 'Please enter both Notice Title and Message content.');
      return;
    }

    setPublishing(true);
    try {
      await client.post('/support/announcements', {
        title: pubTitle.trim(),
        body: pubBody.trim(),
        audience: pubAudience,
        priority: pubPriority,
        is_pinned: pubIsPinned,
      });

      Alert.alert('Published!', 'Official circular broadcasted successfully.');
      setPublishModal(false);
      setPubTitle('');
      setPubBody('');
      setPubAudience('ALL');
      setPubPriority('MEDIUM');
      setPubIsPinned(false);
      loadNotices();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to publish announcement';
      Alert.alert('Error', msg);
    } finally {
      setPublishing(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (notice) => {
    try {
      await client.post(`/support/announcements/${notice.id}/pin`);
      loadNotices();
    } catch (err) {
      Alert.alert('Pin Failed', err.response?.data?.error || 'Unable to toggle pin.');
    }
  };

  // Delete Notice
  const handleDeleteNotice = (notice) => {
    Alert.alert(
      'Remove Circular',
      `Are you sure you want to remove "${notice.title}" from the notice board?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/support/announcements/${notice.id}`);
              Alert.alert('Removed', 'Circular deleted from notice board.');
              loadNotices();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove notice.');
            }
          },
        },
      ]
    );
  };

  // Open Full Notice Reader
  const openDetail = (notice) => {
    setSelectedNotice(notice);
    setDetailModal(true);
  };

  // Filtered List
  const filteredNotices = useMemo(() => {
    if (!search.trim()) return notices;
    const q = search.toLowerCase();
    return notices.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.body && n.body.toLowerCase().includes(q)) ||
      (n.creator_name && n.creator_name.toLowerCase().includes(q))
    );
  }, [notices, search]);

  // Metrics
  const metrics = useMemo(() => {
    let pinnedCount = 0;
    let urgentCount = 0;
    notices.forEach(n => {
      if (n.is_pinned) pinnedCount++;
      if (n.priority === 'CRITICAL' || n.priority === 'URGENT') urgentCount++;
    });
    return { total: notices.length, pinned: pinnedCount, urgent: urgentCount };
  }, [notices]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Notice Board</Text>
            <Text style={styles.headerSub}>Official School Circulars & Broadcasts</Text>
          </View>
          {canPublish && (
            <TouchableOpacity style={styles.pubBtn} onPress={() => setPublishModal(true)}>
              <Ionicons name="megaphone-outline" size={16} color="#fff" />
              <Text style={styles.pubBtnText}>New Notice</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Live Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{metrics.total}</Text>
            <Text style={styles.metricLbl}>Circulars</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#d97706' }]}>{metrics.pinned}</Text>
            <Text style={styles.metricLbl}>Pinned</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#dc2626' }]}>{metrics.urgent}</Text>
            <Text style={styles.metricLbl}>Urgent</Text>
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterSection}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search circulars by subject or keyword..."
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Priority Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((pr) => (
            <TouchableOpacity
              key={pr}
              style={[styles.filterChip, priorityFilter === pr && styles.filterChipActive]}
              onPress={() => setPriorityFilter(pr)}
            >
              <Text style={[styles.filterChipText, priorityFilter === pr && styles.filterChipTextActive]}>
                {pr === 'ALL' ? 'All Priorities' : pr}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notices List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching school notices...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadNotices(true)} colors={[colors.primary]} />
          }
        >
          {filteredNotices.length > 0 ? (
            filteredNotices.map((n) => {
              const aud = AUDIENCE_MAP[n.audience] || AUDIENCE_MAP.ALL;
              const pri = PRIORITY_MAP[n.priority] || PRIORITY_MAP.MEDIUM;

              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.card, n.is_pinned && styles.pinnedCard]}
                  activeOpacity={0.85}
                  onPress={() => openDetail(n)}
                >
                  {/* Pinned Ribbon */}
                  {n.is_pinned && (
                    <View style={styles.pinHeader}>
                      <Ionicons name="pin" size={12} color="#b45309" />
                      <Text style={styles.pinHeaderText}>PINNED TO TOP</Text>
                    </View>
                  )}

                  {/* Card Badges */}
                  <View style={styles.cardBadges}>
                    <View style={[styles.audBadge, { backgroundColor: aud.bg }]}>
                      <Ionicons name={aud.icon} size={11} color={aud.color} />
                      <Text style={[styles.audText, { color: aud.color }]}>{aud.label}</Text>
                    </View>

                    <View style={[styles.priBadge, { backgroundColor: pri.bg, borderColor: pri.border }]}>
                      <Ionicons name={pri.icon} size={11} color={pri.text} />
                      <Text style={[styles.priText, { color: pri.text }]}>{pri.label}</Text>
                    </View>
                  </View>

                  {/* Title & Body Preview */}
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body} numberOfLines={3}>{n.body}</Text>

                  {/* Card Footer: Author & Timestamp */}
                  <View style={styles.cardFooter}>
                    <View style={styles.authorRow}>
                      <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.authorText}>
                        {n.creator_name || 'Administration'} {n.creator_role ? `(${n.creator_role})` : ''}
                      </Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.timeText}>{formatTimeAgo(n.created_at)}</Text>
                    </View>
                  </View>

                  {/* Staff Management Shortcuts */}
                  {canPublish && (
                    <View style={styles.managementBar}>
                      <TouchableOpacity
                        style={styles.mgmtBtn}
                        onPress={() => handleTogglePin(n)}
                      >
                        <Ionicons name={n.is_pinned ? 'pin' : 'pin-outline'} size={13} color="#d97706" />
                        <Text style={[styles.mgmtBtnText, { color: '#d97706' }]}>
                          {n.is_pinned ? 'Unpin' : 'Pin to Top'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mgmtBtn}
                        onPress={() => handleDeleteNotice(n)}
                      >
                        <Ionicons name="trash-outline" size={13} color="#dc2626" />
                        <Text style={[styles.mgmtBtnText, { color: '#dc2626' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="megaphone-outline" size={54} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Notices Published</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? `No circulars matching "${search}".`
                  : 'All institutional circulars and updates have been addressed.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* DETAIL MODAL (Reader) */}
      <Modal visible={detailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.modalTitle}>{selectedNotice?.title}</Text>
                <Text style={styles.modalSub}>
                  Published by {selectedNotice?.creator_name || 'Administration'} · {formatTimeAgo(selectedNotice?.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Badges in modal */}
              {selectedNotice && (
                <View style={[styles.cardBadges, { marginBottom: 14 }]}>
                  <View style={[styles.audBadge, { backgroundColor: (AUDIENCE_MAP[selectedNotice.audience] || AUDIENCE_MAP.ALL).bg }]}>
                    <Text style={[styles.audText, { color: (AUDIENCE_MAP[selectedNotice.audience] || AUDIENCE_MAP.ALL).color }]}>
                      Audience: {(AUDIENCE_MAP[selectedNotice.audience] || AUDIENCE_MAP.ALL).label}
                    </Text>
                  </View>
                  <View style={[styles.priBadge, { backgroundColor: (PRIORITY_MAP[selectedNotice.priority] || PRIORITY_MAP.MEDIUM).bg, borderColor: (PRIORITY_MAP[selectedNotice.priority] || PRIORITY_MAP.MEDIUM).border }]}>
                    <Text style={[styles.priText, { color: (PRIORITY_MAP[selectedNotice.priority] || PRIORITY_MAP.MEDIUM).text }]}>
                      Priority: {(PRIORITY_MAP[selectedNotice.priority] || PRIORITY_MAP.MEDIUM).label}
                    </Text>
                  </View>
                </View>
              )}

              {/* Full Notice Content */}
              <Text style={styles.fullBodyText}>{selectedNotice?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PUBLISH NOTICE MODAL (Staff) */}
      <Modal visible={publishModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Publish Official Circular</Text>
                <Text style={styles.modalSub}>Broadcast notice to students, teachers or parents</Text>
              </View>
              <TouchableOpacity onPress={() => setPublishModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Target Audience */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Target Audience *</Text>
                <View style={styles.chipRow}>
                  {Object.keys(AUDIENCE_MAP).map((k) => {
                    const item = AUDIENCE_MAP[k];
                    const active = pubAudience === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[
                          styles.audienceChip,
                          active && { backgroundColor: item.color, borderColor: item.color },
                        ]}
                        onPress={() => setPubAudience(k)}
                      >
                        <Ionicons
                          name={item.icon}
                          size={12}
                          color={active ? '#fff' : colors.text}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.audienceChipText, active && { color: '#fff', fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Priority */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Urgency / Priority *</Text>
                <View style={styles.chipRow}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((pr) => {
                    const item = PRIORITY_MAP[pr];
                    const active = pubPriority === pr;
                    return (
                      <TouchableOpacity
                        key={pr}
                        style={[
                          styles.audienceChip,
                          active && { backgroundColor: item.text, borderColor: item.text },
                        ]}
                        onPress={() => setPubPriority(pr)}
                      >
                        <Text style={[styles.audienceChipText, active && { color: '#fff', fontWeight: '700' }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Pin Checkbox */}
              <TouchableOpacity
                style={styles.pinToggleRow}
                onPress={() => setPubIsPinned(!pubIsPinned)}
              >
                <Ionicons
                  name={pubIsPinned ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={pubIsPinned ? colors.primary : colors.textMuted}
                />
                <Text style={styles.pinToggleText}>Pin this notice to top of board</Text>
              </TouchableOpacity>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notice Title / Subject *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Annual Sports Day Schedule & Guidelines"
                  value={pubTitle}
                  onChangeText={setPubTitle}
                />
              </View>

              {/* Body */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Circular Announcement Message *</Text>
                <TextInput
                  style={[styles.formInput, { height: 120, textAlignVertical: 'top' }]}
                  placeholder="Detailed instructions, dates, requirements, or event info..."
                  multiline
                  value={pubBody}
                  onChangeText={setPubBody}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, publishing && { opacity: 0.6 }]}
                onPress={handlePublishNotice}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Broadcast Circular</Text>
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
  pubBtn: {
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
  pubBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  metricsRow: {
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, fontSize: 13, color: colors.text },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
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
  pinnedCard: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pinHeaderText: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  cardBadges: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  audBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  audText: { fontSize: 11, fontWeight: '700' },
  priBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  priText: { fontSize: 10, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  body: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 11, color: colors.textMuted },
  managementBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  mgmtBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  mgmtBtnText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fullBodyText: { fontSize: 14, color: '#334155', lineHeight: 22 },
  formGroup: { marginBottom: 14 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  audienceChipText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  pinToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pinToggleText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
