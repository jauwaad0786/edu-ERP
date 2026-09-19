// mob_app/src/screens/dashboard/TeacherDashboardScreen.js
// Teacher Dashboard — GPS check-in, class attendance, marks, schedule

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const C = {
  primary: '#0176d3', green: '#16a34a', warning: '#d97706',
  error: '#dc2626', text: '#1e293b', muted: '#64748b',
  bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0',
};

function KPICard({ icon, label, value, color = C.primary, onPress }) {
  return (
    <TouchableOpacity style={[styles.kpiCard, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={styles.kpiValue}>{value ?? '—'}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={16} color={C.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function TeacherDashboardScreen() {
  const { user, logout } = useAuth();
  const [assignments,  setAssignments]  = useState([]);
  const [myStatus,     setMyStatus]     = useState(null);
  const [holidays,     setHolidays]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [checkingIn,   setCheckingIn]   = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [asgn, status, hols] = await Promise.all([
        client.get('/principal/teacher/my-assignments').catch(() => ({ data: [] })),
        client.get('/staff-attendance/my-status', { params: { date: today } }).catch(() => ({ data: null })),
        client.get('/principal/holidays', { params: { applies_to: 'TEACHER' } }).catch(() => ({ data: [] })),
      ]);
      setAssignments(asgn.data || []);
      setMyStatus(status.data);
      setHolidays(hols.data || []);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await client.post('/staff-attendance/check-in', {});
      Alert.alert('✅ Checked In', 'Your attendance has been recorded.');
      load(true);
    } catch (err) {
      Alert.alert('Check-In Failed', err.response?.data?.error || 'Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      await client.post('/staff-attendance/check-out', {});
      Alert.alert('✅ Checked Out', 'Your check-out has been recorded.');
      load(true);
    } catch (err) {
      Alert.alert('Check-Out Failed', err.response?.data?.error || 'Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  // unique classes from assignments
  const classes = [];
  const seen = new Set();
  assignments.forEach(a => {
    if (!seen.has(a.class_id)) {
      seen.add(a.class_id);
      classes.push({ id: a.class_id, name: a.class_name, section: a.section });
    }
  });

  const todayHols = holidays.filter(h => h.date === today);
  const isCheckedIn  = myStatus?.check_in  && !myStatus?.check_out;
  const isCheckedOut = myStatus?.check_in  &&  myStatus?.check_out;
  const isAbsent     = !myStatus?.check_in;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.muted, marginTop: 12 }}>Loading your dashboard…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {/* Header */}
        <View style={styles.heroCard}>
          <Text style={styles.heroGreeting}>{greeting},</Text>
          <Text style={styles.heroName}>{user?.name || 'Teacher'}</Text>
          <Text style={styles.heroSub}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''} · {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} today
          </Text>
          {todayHols.length > 0 && (
            <View style={styles.holBanner}>
              <Ionicons name="calendar" size={13} color="#92400e" />
              <Text style={styles.holText}> {todayHols[0].name} — Holiday today</Text>
            </View>
          )}
        </View>

        {/* Attendance Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="finger-print-outline" size={16} color={C.primary} />
            <Text style={styles.cardTitle}>My Attendance Status</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={[styles.statusDot, {
              backgroundColor: isCheckedOut ? C.green : isCheckedIn ? C.warning : C.error,
            }]} />
            <Text style={{ fontWeight: '700', color: C.text, fontSize: 14 }}>
              {isCheckedOut ? 'Checked Out' : isCheckedIn ? 'Checked In' : 'Not Yet Checked In'}
            </Text>
          </View>
          {myStatus?.check_in && (
            <Text style={styles.attTime}>In: {new Date(myStatus.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
          )}
          {myStatus?.check_out && (
            <Text style={styles.attTime}>Out: {new Date(myStatus.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
          )}

          {!isCheckedOut && (
            <TouchableOpacity
              style={[styles.checkBtn, { backgroundColor: isCheckedIn ? C.error : C.green }]}
              onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={checkingIn}
              activeOpacity={0.85}
            >
              {checkingIn
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.checkBtnText}>{isCheckedIn ? 'Check Out' : 'Check In'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* KPIs */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.kpiGrid}>
          <KPICard icon="library-outline"  label="My Classes"   value={classes.length}      color={C.primary} />
          <KPICard icon="book-outline"     label="Subjects"     value={[...new Set(assignments.map(a => a.subject_id))].length} color="#7c3aed" />
          <KPICard icon="calendar-outline" label="Holidays"     value={holidays.filter(h => new Date(h.date) >= new Date()).length} color={C.warning} />
        </View>

        {/* My Classes */}
        <SectionCard title={`My Classes (${classes.length})`} icon="library-outline">
          {classes.length === 0 ? (
            <Text style={styles.emptyText}>No classes assigned</Text>
          ) : (
            classes.map((cls, i) => (
              <View key={i} style={styles.listRow}>
                <View style={[styles.classBadge, { backgroundColor: `${C.primary}15` }]}>
                  <Ionicons name="people-outline" size={16} color={C.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.listTitle}>{cls.name}</Text>
                  {cls.section && <Text style={styles.listSub}>Section {cls.section}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </View>
            ))
          )}
        </SectionCard>

        {/* Upcoming Holidays */}
        {holidays.filter(h => new Date(h.date) >= new Date()).length > 0 && (
          <SectionCard title="Upcoming Holidays" icon="calendar-outline">
            {holidays.filter(h => new Date(h.date) >= new Date()).slice(0, 4).map((h, i) => (
              <View key={i} style={[styles.listRow, { borderLeftWidth: 3, borderLeftColor: C.warning, paddingLeft: 10, marginBottom: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{h.name}</Text>
                  <Text style={styles.listSub}>{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ])}
        >
          <Ionicons name="log-out-outline" size={16} color={C.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heroCard: {
    backgroundColor: C.primary, borderRadius: 18, padding: 22, marginBottom: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  heroGreeting: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  heroName:     { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub:      { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  holBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 12 },
  holText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontWeight: '700', fontSize: 14, color: C.text },

  statusDot: { width: 12, height: 12, borderRadius: 6 },
  attTime: { fontSize: 12, color: C.muted, marginBottom: 2 },
  checkBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border, borderLeftWidth: 3,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },
  kpiLabel: { fontSize: 10, color: C.muted, textAlign: 'center', fontWeight: '600' },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  classBadge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 13, fontWeight: '600', color: C.text },
  listSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  emptyText: { textAlign: 'center', color: C.muted, fontSize: 13, paddingVertical: 16 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, marginTop: 8, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2',
  },
  logoutText: { color: C.error, fontWeight: '700', fontSize: 14 },
});
