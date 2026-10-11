// mob_app/src/screens/dashboard/StudentDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import KPICard from '../../components/common/KPICard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export default function StudentDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [fees, setFees] = useState(null);
  const [arrivalEvents, setArrivalEvents] = useState([]);
  const [respondingArrivalId, setRespondingArrivalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isParent = role === 'PARENT';

  const load = useCallback(async (isRefresh = false, childId = null) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const activeChildId = childId || selectedChildId;
      const childParam = isParent && activeChildId ? `?student_id=${activeChildId}` : '';

      const [p, a, f, chRes, arrRes] = await Promise.all([
        client.get(`/student/profile${childParam}`).catch(() => ({ data: null })),
        client.get(`/student/attendance${childParam}`).catch(() => ({ data: null })),
        client.get(`/student/fees${childParam}`).catch(() => ({ data: null })),
        isParent
          ? client.get('/student/children').catch(() => client.get('/parent/children')).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        isParent
          ? client.get('/arrivals/parent/pending').catch(() => ({ data: { events: [] } }))
          : Promise.resolve({ data: { events: [] } }),
      ]);

      setProfile(p.data);
      setAttendance(a.data);
      setFees(f.data);

      const chList = Array.isArray(chRes.data) ? chRes.data : (chRes.data?.children || []);
      setChildren(chList);
      if (isParent && chList.length > 0 && !activeChildId) {
        setSelectedChildId(chList[0].id);
      }

      const arrList = Array.isArray(arrRes.data?.events)
        ? arrRes.data.events
        : (Array.isArray(arrRes.data) ? arrRes.data : []);
      setArrivalEvents(arrList);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isParent, selectedChildId]);

  useEffect(() => { load(); }, [load]);

  const handleSelectChild = (child) => {
    setSelectedChildId(child.id);
    load(false, child.id);
  };

  // Interactive Arrival Response handler (YES / NO)
  const handleArrivalResponse = async (event, responseValue) => {
    setRespondingArrivalId(event.id);
    try {
      const res = await client.post(`/arrivals/${event.id}/respond`, {
        response: responseValue,
      });

      const updatedStatus = res.data?.status || (responseValue === 'YES' ? 'CONFIRMED_YES' : 'REPORTED_NO');

      setArrivalEvents(prev =>
        prev.map(ev => ev.id === event.id ? {
          ...ev,
          response_status: updatedStatus,
          is_expired: false,
          response_timestamp: new Date().toISOString(),
        } : ev)
      );

      if (responseValue === 'YES') {
        Alert.alert('Arrival Confirmed ✓', `You confirmed that ${event.student_name || 'your child'} has reached school safely.`);
      } else {
        Alert.alert('Alert Dispatched ⚠', `You reported that ${event.student_name || 'your child'} did NOT reach school today. Administration has been alerted immediately.`);
      }
    } catch (err) {
      Alert.alert('Response Failed', err.response?.data?.error || 'Could not record arrival response.');
    } finally {
      setRespondingArrivalId(null);
    }
  };

  const attPct = attendance?.percentage != null
    ? Math.round(attendance.percentage)
    : attendance
    ? Math.round((attendance.present / (attendance.total_days || attendance.total || 1)) * 100)
    : null;

  const dueAmount = Number(fees?.outstanding ?? fees?.balance ?? 0);
  const paidAmount = Number(fees?.total_paid ?? fees?.paid ?? 0);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  const studentName = profile?.name || user?.name || (role === 'PARENT' ? 'Parent' : 'Student');
  const classDisplay = profile?.class_name
    ? `Class ${profile.class_name}${profile.section ? ` · Sec ${profile.section}` : ''}`
    : 'Enrolled';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Child Switcher for Parents with multiple children */}
        {isParent && children.length > 1 && (
          <View style={styles.childSwitcherRow}>
            <Text style={styles.childSwitcherLabel}>Select Child:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {children.map(ch => {
                const isSelected = ch.id === selectedChildId;
                return (
                  <TouchableOpacity
                    key={`ch_${ch.id}`}
                    style={[styles.childPill, isSelected && styles.childPillActive]}
                    onPress={() => handleSelectChild(ch)}
                  >
                    <Ionicons name="person" size={13} color={isSelected ? '#fff' : '#475569'} />
                    <Text style={[styles.childPillText, isSelected && styles.childPillTextActive]}>
                      {ch.name} ({ch.class_display || `Class ${ch.class_name || ''}`})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Modern Gradient Hero */}
        <GradientHero
          tagline={role === 'PARENT' ? 'PARENT PORTAL' : 'STUDENT PORTAL'}
          title={studentName}
          subtitle={`${classDisplay} • Roll #${profile?.roll_no || profile?.roll_number || '—'}`}
          avatarText={studentName}
          gradientColors={colors.studentGradient}
        />

        {/* ══════════════════════════════════════════════════════════════
            PARENT ARRIVAL CONFIRMATION INTERACTIVE CARD (PHASE 4)
           ══════════════════════════════════════════════════════════════ */}
        {isParent && arrivalEvents.length > 0 && (
          <View style={styles.arrivalHeroSection}>
            {arrivalEvents.map(ev => {
              const isAwaiting = ev.response_status === 'AWAITING_RESPONSE';
              const isYes = ev.response_status === 'CONFIRMED_YES';
              const isNo = ev.response_status === 'REPORTED_NO';
              const isExpired = ev.response_status === 'NO_RESPONSE' || ev.is_expired;
              const timeStr = ev.arrival_time
                ? new Date(ev.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'today';
              const isBusy = respondingArrivalId === ev.id;

              return (
                <View key={`arr_hero_${ev.id}`} style={styles.arrivalHeroCard}>
                  <View style={styles.arrivalHeroHeader}>
                    <View style={styles.arrivalIconBadge}>
                      <Ionicons name="shield-checkmark" size={16} color="#059669" />
                      <Text style={styles.arrivalIconBadgeText}>SCHOOL ARRIVAL CONFIRMATION</Text>
                    </View>
                    <Text style={styles.arrivalHeroTime}>{timeStr}</Text>
                  </View>

                  <Text style={styles.arrivalHeroPrompt}>
                    Your child, <Text style={styles.boldText}>{ev.student_name || 'Student'}</Text>, has been marked as arrived at school today at <Text style={styles.boldText}>{timeStr}</Text>. Please confirm.
                  </Text>

                  {isAwaiting && !isExpired && (
                    <View style={styles.arrivalButtonRow}>
                      <TouchableOpacity
                        style={[styles.arrivalBtn, styles.arrivalBtnYes]}
                        disabled={isBusy}
                        onPress={() => handleArrivalResponse(ev, 'YES')}
                        activeOpacity={0.8}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                            <Text style={styles.arrivalBtnText}>YES — Reached School</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.arrivalBtn, styles.arrivalBtnNo]}
                        disabled={isBusy}
                        onPress={() => handleArrivalResponse(ev, 'NO')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                        <Text style={styles.arrivalBtnText}>NO — Not Reached School</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isYes && (
                    <View style={styles.arrivalReceiptYes}>
                      <Ionicons name="checkmark-done-circle" size={18} color="#15803d" />
                      <Text style={styles.arrivalReceiptTextYes}>Confirmed: Student has reached school safely.</Text>
                    </View>
                  )}

                  {isNo && (
                    <View style={styles.arrivalReceiptNo}>
                      <Ionicons name="warning" size={18} color="#b91c1c" />
                      <Text style={styles.arrivalReceiptTextNo}>Alerted school staff: Discrepancy reported.</Text>
                    </View>
                  )}

                  {isExpired && (
                    <View style={styles.arrivalReceiptExpired}>
                      <Ionicons name="time" size={16} color="#64748b" />
                      <Text style={styles.arrivalReceiptTextExpired}>Confirmation window has closed.</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* High-Impact KPI Stat Cards */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Attendance"
            value={attPct != null ? `${attPct}%` : '—'}
            sublabel={`Present: ${attendance?.present ?? 0} days`}
            icon="clipboard-outline"
            accentColor={attPct >= 75 ? colors.success : colors.error}
            badgeText={attPct != null ? (attPct >= 75 ? 'Good' : 'Attention') : null}
            onPress={() => navigation?.navigate('Attendance')}
          />

          <KPICard
            label="Fee Dues"
            value={`₹${dueAmount.toLocaleString('en-IN')}`}
            sublabel={`Paid: ₹${paidAmount.toLocaleString('en-IN')}`}
            icon="receipt-outline"
            accentColor={dueAmount > 0 ? colors.warning : colors.success}
            badgeText={dueAmount > 0 ? 'Due' : 'Cleared'}
            onPress={() => navigation?.navigate('Fees')}
          />
        </View>

        {/* Quick Academic Hub */}
        <Card padding={16}>
          <View style={styles.sectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Academic Services</Text>
          </View>

          <View style={styles.serviceGrid}>
            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Attendance')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.serviceLabel}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Timetable')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="time-outline" size={22} color="#16a34a" />
              </View>
              <Text style={styles.serviceLabel}>Timetable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Marks')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="ribbon-outline" size={22} color="#d97706" />
              </View>
              <Text style={styles.serviceLabel}>Marks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Assignments')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#faf5ff' }]}>
                <Ionicons name="book-outline" size={22} color="#9333ea" />
              </View>
              <Text style={styles.serviceLabel}>Homework</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Fees')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="receipt-outline" size={22} color="#dc2626" />
              </View>
              <Text style={styles.serviceLabel}>Fee Bills</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serviceItem}
              onPress={() => navigation?.navigate('Documents')}
            >
              <View style={[styles.serviceIcon, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="document-text-outline" size={22} color="#059669" />
              </View>
              <Text style={styles.serviceLabel}>Documents</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Live Transport Tracker Shortcut */}
        <TouchableOpacity
          style={styles.transportBanner}
          onPress={() => navigation?.navigate('Transport')}
          activeOpacity={0.85}
        >
          <View style={styles.transportIconBox}>
            <Ionicons name="bus" size={24} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.transportTitle}>Live School Bus Telemetry</Text>
            <Text style={styles.transportSubtitle}>Track route ETA, live GPS location & stop arrival alerts.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 36, gap: 14 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b', fontWeight: '600' },
  childSwitcherRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  childSwitcherLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  childPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  childPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  childPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  childPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  arrivalHeroSection: {
    gap: 10,
  },
  arrivalHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#86efac',
    shadowColor: '#16a34a',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  arrivalHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  arrivalIconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  arrivalIconBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
  },
  arrivalHeroTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  arrivalHeroPrompt: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  arrivalButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  arrivalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  arrivalBtnYes: {
    backgroundColor: '#16a34a',
  },
  arrivalBtnNo: {
    backgroundColor: '#dc2626',
  },
  arrivalBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  arrivalReceiptYes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  arrivalReceiptTextYes: {
    fontSize: 12.5,
    color: '#15803d',
    fontWeight: '700',
  },
  arrivalReceiptNo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  arrivalReceiptTextNo: {
    fontSize: 12.5,
    color: '#b91c1c',
    fontWeight: '700',
  },
  arrivalReceiptExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  arrivalReceiptTextExpired: {
    fontSize: 12,
    color: '#64748b',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  serviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  transportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  transportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  transportSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
