// mob_app/src/screens/examinations/ExaminationsScreen.js
// Exact match to Screen 11 of mockup: Examinations hub with tabs, status badges, and quick actions
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function ExaminationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExams = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Primary: /principal/exams, fallback: /results/terms or /marks/exams
      let res = await client.get('/principal/exams').catch(() => null);
      if (!res || !res.data) {
        res = await client.get('/results/terms').catch(() => null);
      }
      if (!res || !res.data) {
        res = await client.get('/marks/exams').catch(() => null);
      }

      const list = Array.isArray(res?.data)
        ? res.data
        : res?.data?.exams || res?.data?.terms || res?.data?.data || [];
      setExams(list);
    } catch (err) {
      console.warn('Failed to fetch exams:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const displayList = useMemo(() => {
    return exams.map((e, i) => {
      const rawStatus = (e.status || 'Upcoming').toLowerCase();
      const status = rawStatus === 'ongoing' ? 'Ongoing' : rawStatus === 'completed' || rawStatus === 'archived' ? 'Completed' : 'Upcoming';
      return {
        id: e.id || i,
        title: e.name || e.title || e.term_name || `Exam ${i + 1}`,
        dates: e.start_date ? `${e.start_date}${e.end_date ? ' - ' + e.end_date : ''}` : 'Scheduled',
        classes: e.classes ? `Classes: ${Array.isArray(e.classes) ? e.classes.join(', ') : e.classes}` : 'Classes: 1 - 10',
        status: status,
        icon: status === 'Upcoming' ? 'calendar' : status === 'Ongoing' ? 'document-text' : 'ribbon',
        color: status === 'Upcoming' ? '#0284c7' : status === 'Ongoing' ? '#16a34a' : '#7c3aed',
        bg: status === 'Upcoming' ? '#e0f2fe' : status === 'Ongoing' ? '#dcfce7' : '#ede9fe',
      };
    });
  }, [exams]);

  const filteredExams = useMemo(() => {
    return displayList.filter(e => e.status.toLowerCase() === activeTab.toLowerCase());
  }, [displayList, activeTab]);

  const TABS = ['Upcoming', 'Ongoing', 'Completed'];

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
        <Text style={styles.headerTitle}>Examinations</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => {
          const isSel = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isSel && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, isSel && styles.tabBtnTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading exam schedules...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadExams(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Exam Cards */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            {filteredExams.length > 0 ? (
              filteredExams.map(exam => (
                <View key={exam.id} style={styles.examCard}>
                  <View style={[styles.examIconCircle, { backgroundColor: exam.bg }]}>
                    <Ionicons name={exam.icon} size={22} color={exam.color} />
                  </View>

                  <View style={styles.examInfoCol}>
                    <Text style={styles.examTitle}>{exam.title}</Text>
                    <Text style={styles.examDates}>{exam.dates}</Text>
                    <Text style={styles.examClasses}>{exam.classes}</Text>
                  </View>

                  <View style={[
                    styles.statusPill,
                    exam.status === 'Upcoming' && styles.statusUpcoming,
                    exam.status === 'Ongoing' && styles.statusOngoing,
                    exam.status === 'Completed' && styles.statusCompleted,
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      exam.status === 'Upcoming' && { color: '#0284c7' },
                      exam.status === 'Ongoing' && { color: '#ea580c' },
                      exam.status === 'Completed' && { color: '#16a34a' },
                    ]}>
                      {exam.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyCardText}>No {activeTab.toLowerCase()} exams found</Text>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionHeading}>Quick Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('ExamSchedule')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="calendar-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionLabel}>Create Exam Schedule</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('AdmitCards')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="card-outline" size={18} color="#7c3aed" />
              </View>
              <Text style={styles.actionLabel}>Generate Admit Cards</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('MarksEntry')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="create-outline" size={18} color="#16a34a" />
              </View>
              <Text style={styles.actionLabel}>Enter / View Marks</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.actionRowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('ResultCards')}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="ribbon-outline" size={18} color="#d97706" />
              </View>
              <Text style={styles.actionLabel}>Generate Result Cards</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
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
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  examIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  examInfoCol: {
    flex: 1,
  },
  examTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  examDates: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  examClasses: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusUpcoming: {
    backgroundColor: '#e0f2fe',
  },
  statusOngoing: {
    backgroundColor: '#ffedd5',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: '#f8fafc',
    marginLeft: 58,
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
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
});
