// mob_app/src/screens/notifications/NotificationsScreen.js
// Categorized notifications with dynamic backend sync, arrival confirmations, deep-linking, mark-all-read & unread badges.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useMobileNotifications } from '../../context/NotificationContext';
import notificationService from '../../services/notificationService';

export default function NotificationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [arrivalEvents, setArrivalEvents] = useState([]);
  const [respondingEventId, setRespondingEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { markAsRead: contextMarkAsRead, markAllAsRead: contextMarkAllAsRead, refreshUnreadCount } = useMobileNotifications();

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [notifRes, arrivalRes] = await Promise.all([
        client.get('/support/notifications').catch(() =>
          client.get('/notifications').catch(() => null)
        ),
        client.get('/arrivals/parent/pending').catch(() =>
          client.get('/principal/arrivals/parent/pending').catch(() => ({ data: { events: [] } }))
        ),
      ]);

      const list = Array.isArray(notifRes?.data)
        ? notifRes.data
        : notifRes?.data?.notifications || notifRes?.data?.data || [];
      setNotifications(list);

      const arrivals = Array.isArray(arrivalRes?.data?.events)
        ? arrivalRes.data.events
        : (Array.isArray(arrivalRes?.data) ? arrivalRes.data : []);
      setArrivalEvents(arrivals);
      refreshUnreadCount?.();
    } catch (err) {
      console.warn('Failed to load notifications:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle Parent Interactive Response: YES or NO
  const handleArrivalResponse = async (event, responseValue) => {
    const eventId = event.id;
    setRespondingEventId(eventId);
    try {
      const res = await client.post(`/arrivals/${eventId}/respond`, {
        response: responseValue,
      });

      const updatedStatus = res.data?.status || (responseValue === 'YES' ? 'CONFIRMED_YES' : 'REPORTED_NO');

      // Update local state immediately
      setArrivalEvents(prev =>
        prev.map(ev => ev.id === eventId ? {
          ...ev,
          response_status: updatedStatus,
          is_expired: false,
          response_timestamp: new Date().toISOString(),
        } : ev)
      );

      if (responseValue === 'YES') {
        Alert.alert(
          'Arrival Confirmed ✓',
          `You have confirmed that ${event.student_name || 'your child'} reached school safely today.`
        );
      } else {
        Alert.alert(
          'Alert Dispatched ⚠',
          `You reported that ${event.student_name || 'your child'} did NOT reach school today. School administration and security have been alerted immediately for urgent verification.`
        );
      }
    } catch (err) {
      Alert.alert(
        'Submission Failed',
        err.response?.data?.error || 'Could not record arrival response. Please check connection and try again.'
      );
    } finally {
      setRespondingEventId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await contextMarkAllAsRead?.();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.warn('Error marking all as read:', e);
    }
  };

  const handleNotificationPress = async (item) => {
    // 1. Mark as read
    if (!item.isRead) {
      try {
        await contextMarkAsRead?.(item.id);
        setNotifications(prev =>
          prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      } catch (e) {
        // silently ignore
      }
    }

    // 2. Deep-link navigation
    const deepLink = item.deep_link;
    const cat = item.rawCategory || '';

    if (deepLink) {
      if (deepLink.includes('fee')) navigation?.navigate?.('Fees');
      else if (deepLink.includes('attendance')) navigation?.navigate?.('Attendance');
      else if (deepLink.includes('exam')) navigation?.navigate?.('Exams');
      else if (deepLink.includes('result')) navigation?.navigate?.('Results');
      else if (deepLink.includes('hostel')) navigation?.navigate?.('Hostel');
      else if (deepLink.includes('transport')) navigation?.navigate?.('Transport');
    } else if (cat.includes('FEE')) {
      navigation?.navigate?.('Fees');
    } else if (cat.includes('ATTENDANCE')) {
      navigation?.navigate?.('Attendance');
    } else if (cat.includes('EXAM')) {
      navigation?.navigate?.('Exams');
    } else if (cat.includes('RESULT')) {
      navigation?.navigate?.('Results');
    }
  };

  const displayList = useMemo(() => {
    return notifications.map((n, i) => {
      const rawCat = (n.category || n.notif_type || n.type || '').toUpperCase();
      let category = 'Others';
      let icon = 'notifications';
      let color = '#0284c7';
      let bg = '#e0f2fe';

      if (rawCat.includes('ARRIVAL') || rawCat.includes('SCHOOL_ARRIVAL')) {
        category = 'Arrivals';
        icon = 'shield-checkmark';
        color = '#059669';
        bg = '#d1fae5';
      } else if (rawCat.includes('FEE') || rawCat.includes('FINANCE') || rawCat.includes('DUE') || rawCat.includes('PAYMENT')) {
        category = 'Finance';
        icon = 'receipt';
        color = '#dc2626';
        bg = '#fee2e2';
      } else if (rawCat.includes('EXAM') || rawCat.includes('TEST') || rawCat.includes('MARK') || rawCat.includes('RESULT')) {
        category = 'Academic';
        icon = 'calendar';
        color = '#7c3aed';
        bg = '#ede9fe';
      } else if (rawCat.includes('ADMISSION') || rawCat.includes('STUDENT') || rawCat.includes('ENROLL')) {
        category = 'Academic';
        icon = 'person-add';
        color = '#16a34a';
        bg = '#dcfce7';
      } else if (rawCat.includes('LEAVE') || rawCat.includes('ATTENDANCE') || rawCat.includes('STAFF')) {
        category = 'Academic';
        icon = 'time';
        color = '#0284c7';
        bg = '#e0f2fe';
      } else if (rawCat.includes('QUERY') || rawCat.includes('MESSAGE') || rawCat.includes('CHAT') || rawCat.includes('ANNOUNCEMENT')) {
        category = 'Others';
        icon = 'chatbubble-ellipses';
        color = '#ea580c';
        bg = '#ffedd5';
      }

      return {
        id: n.id || i,
        rawCategory: rawCat,
        category: category,
        title: n.title || 'Institutional Notification',
        desc: n.message || n.body || n.content || n.description || 'Details available in portal.',
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        icon,
        color,
        bg,
        deep_link: n.deep_link,
        isRead: Boolean(n.is_read || n.read),
      };
    });
  }, [notifications]);

  const counts = useMemo(() => {
    const all = displayList.length + arrivalEvents.length;
    const arrivals = arrivalEvents.length;
    const academic = displayList.filter(n => n.category === 'Academic').length;
    const finance = displayList.filter(n => n.category === 'Finance').length;
    const others = displayList.filter(n => n.category === 'Others').length;
    return { all, arrivals, academic, finance, others };
  }, [displayList, arrivalEvents]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return displayList;
    if (activeTab === 'Arrivals') return [];
    if (activeTab === 'Academic') return displayList.filter(n => n.category === 'Academic');
    if (activeTab === 'Finance') return displayList.filter(n => n.category === 'Finance');
    return displayList.filter(n => n.category === 'Others');
  }, [displayList, activeTab]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => loadNotifications(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleMarkAllRead}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'All' && styles.tabBtnActive]}
          onPress={() => setActiveTab('All')}
        >
          <Text style={[styles.tabText, activeTab === 'All' && styles.tabTextActive]}>
            All ({counts.all})
          </Text>
        </TouchableOpacity>

        {arrivalEvents.length > 0 && (
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Arrivals' && styles.tabBtnActiveArrival]}
            onPress={() => setActiveTab('Arrivals')}
          >
            <Text style={[styles.tabText, activeTab === 'Arrivals' && styles.tabTextActive]}>
              Arrivals ({counts.arrivals})
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'Academic' && styles.tabBtnActive]}
          onPress={() => setActiveTab('Academic')}
        >
          <Text style={[styles.tabText, activeTab === 'Academic' && styles.tabTextActive]}>
            Academic ({counts.academic})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'Finance' && styles.tabBtnActive]}
          onPress={() => setActiveTab('Finance')}
        >
          <Text style={[styles.tabText, activeTab === 'Finance' && styles.tabTextActive]}>
            Finance ({counts.finance})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'Others' && styles.tabBtnActive]}
          onPress={() => setActiveTab('Others')}
        >
          <Text style={[styles.tabText, activeTab === 'Others' && styles.tabTextActive]}>
            Others ({counts.others})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadNotifications(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ══════════════════════════════════════════════════════════════
              SPECIAL FEATURE: SCHOOL ARRIVAL CONFIRMATION WITH YES/NO BUTTONS
             ══════════════════════════════════════════════════════════════ */}
          {(activeTab === 'All' || activeTab === 'Arrivals') && arrivalEvents.length > 0 && (
            <View style={styles.arrivalSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#059669" />
                <Text style={styles.sectionTitle}>Child School Arrival Confirmation</Text>
              </View>

              {arrivalEvents.map((ev) => {
                const isAwaiting = ev.response_status === 'AWAITING_RESPONSE';
                const isYes = ev.response_status === 'CONFIRMED_YES';
                const isNo = ev.response_status === 'REPORTED_NO';
                const isExpired = ev.response_status === 'NO_RESPONSE' || ev.is_expired;
                const arrivalTimeFormatted = ev.arrival_time
                  ? new Date(ev.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'today morning';
                const isBusy = respondingEventId === ev.id;

                return (
                  <View key={`arrival_${ev.id}`} style={styles.arrivalCard}>
                    {/* Card Header */}
                    <View style={styles.arrivalCardHeader}>
                      <View style={styles.arrivalTagRow}>
                        <View style={styles.arrivalBadge}>
                          <Ionicons name="school" size={14} color="#047857" />
                          <Text style={styles.arrivalBadgeText}>PHYSICAL ARRIVAL</Text>
                        </View>
                        <Text style={styles.arrivalTimeText}>{arrivalTimeFormatted}</Text>
                      </View>
                      <Text style={styles.arrivalChildName}>{ev.student_name || 'Your Child'}</Text>
                      {ev.class_display ? (
                        <Text style={styles.arrivalClassSub}>{ev.class_display} • Roll #{ev.roll_number || '—'}</Text>
                      ) : null}
                    </View>

                    {/* Notification Message */}
                    <Text style={styles.arrivalPromptText}>
                      Your child, <Text style={styles.boldText}>{ev.student_name || 'Student'}</Text>, has been marked as arrived at school today at <Text style={styles.boldText}>{arrivalTimeFormatted}</Text>. Please confirm.
                    </Text>

                    {/* Interactive Response Actions */}
                    {isAwaiting && !isExpired && (
                      <View style={styles.responseContainer}>
                        <Text style={styles.actionPromptLabel}>Tap to respond (no typing required):</Text>
                        <View style={styles.buttonRow}>
                          {/* YES BUTTON */}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.yesBtn]}
                            disabled={isBusy}
                            onPress={() => handleArrivalResponse(ev, 'YES')}
                            activeOpacity={0.8}
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                                <Text style={styles.btnTextYes}>YES — Reached School</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {/* NO BUTTON */}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.noBtn]}
                            disabled={isBusy}
                            onPress={() => handleArrivalResponse(ev, 'NO')}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close-circle" size={18} color="#ffffff" />
                            <Text style={styles.btnTextNo}>NO — Not Reached School</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* State Receipts */}
                    {isYes && (
                      <View style={styles.receiptBoxSuccess}>
                        <Ionicons name="checkmark-done-circle" size={20} color="#15803d" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.receiptTitleSuccess}>Confirmed: Reached School</Text>
                          <Text style={styles.receiptDescSuccess}>
                            Recorded on {ev.response_timestamp ? new Date(ev.response_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'today'}. Thank you for verifying.
                          </Text>
                        </View>
                      </View>
                    )}

                    {isNo && (
                      <View style={styles.receiptBoxAlert}>
                        <Ionicons name="warning" size={20} color="#b91c1c" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.receiptTitleAlert}>Reported: Not Reached School</Text>
                          <Text style={styles.receiptDescAlert}>
                            Alerted school administration immediately. A staff member is verifying the discrepancy.
                          </Text>
                        </View>
                      </View>
                    )}

                    {isExpired && (
                      <View style={styles.receiptBoxExpired}>
                        <Ionicons name="time-outline" size={20} color="#64748b" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.receiptTitleExpired}>No Response (Window Expired)</Text>
                          <Text style={styles.receiptDescExpired}>
                            The 2-hour confirmation window for this arrival event has concluded.
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Regular Notifications List */}
          {filtered.length === 0 && arrivalEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up with your announcements and updates.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {filtered.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.notifCard, !item.isRead && styles.unreadCard]}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>

                  <View style={styles.infoCol}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>
                        {item.title}
                      </Text>
                      <Text style={styles.notifTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.notifDesc} numberOfLines={2}>{item.desc}</Text>
                  </View>

                  {!item.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    padding: 4,
  },
  headerActionBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnActiveArrival: {
    backgroundColor: '#059669',
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  arrivalSection: {
    marginBottom: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  arrivalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    shadowColor: '#059669',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  arrivalCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  arrivalTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  arrivalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  arrivalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  arrivalTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  arrivalChildName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  arrivalClassSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  arrivalPromptText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 14,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  responseContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionPromptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  yesBtn: {
    backgroundColor: '#16a34a',
  },
  noBtn: {
    backgroundColor: '#dc2626',
  },
  btnTextYes: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnTextNo: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  receiptTitleSuccess: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#15803d',
  },
  receiptDescSuccess: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  receiptBoxAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  receiptTitleAlert: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#b91c1c',
  },
  receiptDescAlert: {
    fontSize: 12,
    color: '#991b1b',
    marginTop: 2,
    lineHeight: 16,
  },
  receiptBoxExpired: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  receiptTitleExpired: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  receiptDescExpired: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#f0f7ff',
    borderColor: '#bfdbfe',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#0f172a',
  },
  notifTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  notifDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 17,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
});
