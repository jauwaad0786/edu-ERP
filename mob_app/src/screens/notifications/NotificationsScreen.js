// mob_app/src/screens/notifications/NotificationsScreen.js
// Exact match to Screen 5 of mockup: Categorized notifications with dynamic backend sync
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function NotificationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let res = await client.get('/notifications').catch(() => null);
      if (!res || !res.data) {
        res = await client.get('/support/notifications').catch(() => null);
      }
      const list = Array.isArray(res?.data)
        ? res.data
        : res?.data?.notifications || res?.data?.data || [];
      setNotifications(list);
    } catch (err) {
      console.warn('Failed to load notifications:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const displayList = useMemo(() => {
    return notifications.map((n, i) => {
      const rawCat = (n.category || n.type || '').toUpperCase();
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
      } else if (rawCat.includes('QUERY') || rawCat.includes('MESSAGE') || rawCat.includes('CHAT')) {
        category = 'Others';
        icon = 'chatbubble-ellipses';
        color = '#ea580c';
        bg = '#ffedd5';
      }

      return {
        id: n.id || i,
        category: category,
        title: n.title || 'Institutional Notification',
        desc: n.message || n.body || n.content || n.description || 'Details available in portal.',
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
        icon,
        color,
        bg,
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
          style={styles.headerBackBtn}
          onPress={() => navigation?.navigate?.('NotificationSettings')}
        >
          <Ionicons name="settings-outline" size={20} color="#ffffff" />
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
          <View style={{ gap: 10 }}>
            {filtered.map(item => (
              <View key={item.id} style={styles.notifCard}>
                <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.titleRow}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.notifDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
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
    fontWeight: '700',
    color: '#1e293b',
  },
  notifTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  notifDesc: {
    fontSize: 12.5,
    fontWeight: '400',
    color: '#64748b',
    lineHeight: 18,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
