// mob_app/src/screens/admin/SupportScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];

const CATEGORIES = [
  'GENERAL', 'ACADEMICS', 'FINANCE', 'TRANSPORT', 'HOSTEL', 'HRMS', 'TECHNICAL',
];

const PRIORITIES = [
  { key: 'LOW', label: 'Low', color: '#64748b' },
  { key: 'MEDIUM', label: 'Normal', color: '#0284c7' },
  { key: 'HIGH', label: 'High', color: '#ea580c' },
  { key: 'URGENT', label: 'Urgent', color: '#dc2626' },
];

function formatTimestamp(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoStr;
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  try {
    const seconds = Math.floor((new Date() - new Date(isoStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

export default function SupportScreen({ navigation }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Form Fields
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Tickets
  const loadTickets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {};
      if (activeStatus !== 'ALL') params.status = activeStatus;
      if (search.trim()) params.search = search.trim();

      const res = await client.get('/support/tickets', { params }).catch(() => ({ data: { data: [] } }));
      const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : (res.data?.tickets || []));
      setTickets(list);
    } catch {
      setTickets([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [activeStatus, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Load Single Ticket Detail & Discussion Thread
  const openTicketThread = async (ticket) => {
    setSelectedTicket(ticket);
    setLoadingDetail(true);
    try {
      const res = await client.get(`/support/tickets/${ticket.id}`);
      setSelectedTicket(res.data || ticket);
    } catch {
      // keep fallback
    } finally {
      setLoadingDetail(false);
    }
  };

  // Send Reply in Thread
  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await client.post(`/support/tickets/${selectedTicket.id}/reply`, {
        message: replyMessage.trim(),
      });
      // Append reply to current view
      setSelectedTicket(prev => ({
        ...prev,
        replies: [...(prev.replies || []), res.data],
      }));
      setReplyMessage('');
      loadTickets();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Close / Reopen Ticket
  const handleToggleTicketStatus = async () => {
    if (!selectedTicket) return;
    const isClosed = selectedTicket.status === 'CLOSED' || selectedTicket.status === 'RESOLVED';
    const targetStatus = isClosed ? 'OPEN' : 'CLOSED';

    try {
      const res = await client.patch(`/support/tickets/${selectedTicket.id}/status`, {
        status: targetStatus,
      });
      setSelectedTicket(prev => ({ ...prev, status: targetStatus }));
      Alert.alert('Updated', `Ticket status set to ${targetStatus}.`);
      loadTickets();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update ticket status.');
    }
  };

  // Submit New Ticket
  const handleCreateTicket = async () => {
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a ticket subject.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please provide issue details.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/support/tickets', {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        product_type: 'EduERP',
      });

      Alert.alert('Ticket Raised', 'Your support ticket has been registered. Our team will review and reply.');
      setCreateModal(false);
      setSubject('');
      setDescription('');
      loadTickets();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.response?.data?.message || 'Failed to raise ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: status };
      case 'IN_PROGRESS':
        return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', label: 'IN PROGRESS' };
      case 'WAITING':
        return { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe', label: 'WAITING' };
      case 'OPEN':
      default:
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'OPEN' };
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
            <Text style={styles.headerTitle}>Support & Helpdesk</Text>
            <Text style={styles.headerSubtitle}>Grievance redressal & ticketing</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModal(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createBtnText}>New Ticket</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTickets(true)} colors={[colors.primary]} />}
      >
        {/* Status Filter Chips */}
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
                  {f.replace('_', ' ')}
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
            placeholder="Search ticket #, subject, or raiser..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadTickets()}
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
            <Text style={styles.loadingText}>Fetching support tickets...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && tickets.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={56} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Support Tickets Found</Text>
            <Text style={styles.emptySubtitle}>
              You do not have any open grievance or assistance tickets matching this filter.
            </Text>
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={() => setCreateModal(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyCreateBtnText}>Raise a Ticket</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ticket Cards */}
        {!loading && tickets.map(item => {
          const statusStyle = getStatusBadge(item.status);
          const priorityObj = PRIORITIES.find(p => p.key === item.priority) || PRIORITIES[1];

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openTicketThread(item)}
            >
              {/* Header Badges */}
              <View style={styles.cardHeader}>
                <View style={styles.badgesRow}>
                  <View style={[styles.badge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                  <View style={[styles.catBadge, { marginLeft: 4 }]}>
                    <Text style={styles.catBadgeText}>{item.category || 'GENERAL'}</Text>
                  </View>
                </View>

                <Text style={[styles.priorityText, { color: priorityObj.color }]}>
                  {priorityObj.label} Priority
                </Text>
              </View>

              {/* Subject */}
              <Text style={styles.subjectText}>{item.subject}</Text>

              {/* Raiser & School */}
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={styles.metaText}>
                  {item.raiser_name || 'School User'} {item.raiser_role ? `(${item.raiser_role})` : ''}
                </Text>
                <Text style={styles.timeAgoText}>• {timeAgo(item.created_at)}</Text>
              </View>

              {/* Footer: Ticket No & Discussion Trigger */}
              <View style={styles.cardFooter}>
                <Text style={styles.ticketNoText}>#{item.ticket_no || item.id}</Text>
                <View style={styles.threadLinkRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                  <Text style={styles.threadLinkText}>View Thread</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* DISCUSSION THREAD MODAL */}
      <Modal visible={Boolean(selectedTicket)} animationType="slide">
        <SafeAreaView style={styles.threadContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Thread Header */}
            <View style={styles.threadHeader}>
              <TouchableOpacity onPress={() => setSelectedTicket(null)} style={styles.threadBackBtn}>
                <Ionicons name="arrow-back" size={22} color="#0f172a" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.threadTitle} numberOfLines={1}>
                  {selectedTicket?.subject}
                </Text>
                <Text style={styles.threadSubtitle}>
                  #{selectedTicket?.ticket_no || selectedTicket?.id} • {selectedTicket?.category}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.statusToggleBtn}
                onPress={handleToggleTicketStatus}
              >
                <Text style={styles.statusToggleText}>
                  {selectedTicket?.status === 'CLOSED' ? 'Reopen' : 'Close'}
                </Text>
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading conversation thread...</Text>
              </View>
            ) : (
              <ScrollView style={styles.threadScroll} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
                {/* Initial Ticket Description Card */}
                <View style={styles.initialPostCard}>
                  <View style={styles.initialHeader}>
                    <Text style={styles.initialRaiser}>
                      {selectedTicket?.raiser_name} ({selectedTicket?.raiser_role})
                    </Text>
                    <Text style={styles.initialTime}>{formatTimestamp(selectedTicket?.created_at)}</Text>
                  </View>
                  <Text style={styles.initialBody}>{selectedTicket?.description}</Text>
                </View>

                {/* Replies Thread */}
                {Array.isArray(selectedTicket?.replies) && selectedTicket.replies.map(reply => {
                  const isMe = String(reply.replied_by) === String(user?.id);
                  return (
                    <View
                      key={reply.id}
                      style={[styles.replyBubble, isMe ? styles.replyBubbleRight : styles.replyBubbleLeft]}
                    >
                      <View style={styles.replyBubbleHeader}>
                        <Text style={[styles.replyAuthor, isMe && { color: '#0369a1' }]}>
                          {reply.reply_name} {reply.reply_role ? `(${reply.reply_role})` : ''}
                        </Text>
                        <Text style={styles.replyTime}>{timeAgo(reply.created_at)}</Text>
                      </View>
                      <Text style={[styles.replyMessage, isMe && styles.replyMessageRight]}>
                        {reply.message}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Reply Composer Input Bar */}
            <View style={styles.composerBar}>
              <TextInput
                style={styles.composerInput}
                placeholder="Type your response to support..."
                placeholderTextColor="#94a3b8"
                value={replyMessage}
                onChangeText={setReplyMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!replyMessage.trim() || sendingReply) && { opacity: 0.5 }]}
                onPress={handleSendReply}
                disabled={!replyMessage.trim() || sendingReply}
              >
                {sendingReply ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={17} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* CREATE TICKET MODAL */}
      <Modal visible={createModal} animationType="slide">
        <SafeAreaView style={styles.createModalContainer}>
          <View style={styles.createModalHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.createModalTitle}>Raise Support Ticket</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.createModalScroll}>
            <Text style={styles.inputLabel}>Subject / Summary</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Fee receipt PDF not generating for Class 10"
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map(c => {
                const isSelected = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.catPickChip, isSelected && styles.catPickChipActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.catPickChipText, isSelected && styles.catPickChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => {
                const isSelected = priority === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.priorityPickChip, isSelected && { backgroundColor: p.color, borderColor: p.color }]}
                    onPress={() => setPriority(p.key)}
                  >
                    <Text style={[styles.priorityPickText, isSelected && { color: '#fff' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Detailed Issue Description</Text>
            <TextInput
              style={[styles.textInput, { height: 110, textAlignVertical: 'top' }]}
              placeholder="Describe what occurred, any student IDs or receipt numbers involved, and expected behavior..."
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </ScrollView>

          <View style={styles.createModalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCreateModal(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleCreateTicket}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Ticket</Text>
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
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  catBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
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
  timeAgoText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  ticketNoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  threadLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  threadLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  threadContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  threadBackBtn: {
    marginRight: 10,
  },
  threadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  threadSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    marginLeft: 8,
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  threadScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  initialPostCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  initialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  initialRaiser: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  initialTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  initialBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  replyBubble: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  replyBubbleLeft: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  replyBubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  replyBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  replyTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginLeft: 6,
  },
  replyMessage: {
    fontSize: 13,
    color: '#1e293b',
    lineHeight: 17,
  },
  replyMessageRight: {
    color: '#0f172a',
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    maxHeight: 90,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    padding: 4,
  },
  createModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  createModalScroll: {
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
  catPickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  catPickChipActive: {
    backgroundColor: colors.primary,
  },
  catPickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catPickChipTextActive: {
    color: '#fff',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityPickChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  priorityPickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  createModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
