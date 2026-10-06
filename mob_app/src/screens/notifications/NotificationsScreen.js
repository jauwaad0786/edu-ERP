// mob_app/src/screens/notifications/NotificationsScreen.js
// Categorized notifications with dynamic backend sync, deep-linking, mark-all-read & unread badges.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { markAsRead: contextMarkAsRead, markAllAsRead: contextMarkAllAsRead, refreshUnreadCount } = useMobileNotifications();

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let res = await client.get('/support/notifications').catch(() => null);
      if (!res || !res.data) {
        res = await client.get('/notifications').catch(() => null);
      }
      const list = Array.isArray(res?.data)
        ? res.data
        : res?.data?.notifications || res?.data?.data || [];
      setNotifications(list);
      refreshUnreadCount();
    } catch (err) {
      console.warn('Failed to load notifications:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await contextMarkAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.warn('Error marking all as read:', e);
    }
  };

  const handleNotificationPress = async (item) => {
    // 1. Mark as read
    if (!item.isRead) {
      try {
        await contextMarkAsRead(item.id);
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

      if (rawCat.includes('FEE') || rawCat.includes('FINANCE') || rawCat.includes('DUE') || rawCat.includes('PAYMENT')) {
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
    const all = displayList.length;
    const academic = displayList.filter(n => n.category === 'Academic').length;
    const finance = displayList.filter(n => n.category === 'Finance').length;
    const others = displayList.filter(n => n.category === 'Others' || (n.category !== 'Academic' && n.category !== 'Finance')).length;
    return { all, academic, finance, others };
  }, [displayList]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return displayList;
    if (activeTab === 'Academic') return displayList.filter(n => n.category === 'Academic');
    if (activeTab === 'Finance') return displayList.filter(n => n.category === 'Finance');
    return displayList.filter(n => n.category === 'Others' || (n.category !== 'Academic' && n.category !== 'Finance'));
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
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleMarkAllRead}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="checkmark-done-outline" size={20} color="#ffffff" />
        </TouchableOpacity>
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
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up in this category.</Text>
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
