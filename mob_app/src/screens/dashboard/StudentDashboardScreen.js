// mob_app/src/screens/dashboard/StudentDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const C = { primary: '#7c3aed', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function StudentDashboardScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const role = user?.role;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [p, a, f] = await Promise.all([
        client.get('/student/profile').catch(() => ({ data: null })),
        client.get('/student/attendance/summary').catch(() => ({ data: null })),
        client.get('/student/fees/summary').catch(() => ({ data: null })),
      ]);
      setProfile(p.data);
      setAttendance(a.data);
      setFees(f.data);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const attPct = attendance
    ? Math.round((attendance.present / (attendance.total || 1)) * 100) : null;

  if (loading) return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: C.primary }]}>
          <Text style={styles.heroGreeting}>{role === 'PARENT' ? 'Parent Portal' : 'Student Portal'}</Text>
          <Text style={styles.heroName}>{profile?.name || user?.name || (role === 'PARENT' ? 'Parent' : 'Student')}</Text>
          {profile?.class_name && <Text style={styles.heroSub}>Class {profile.class_name} {profile.section ? `· Section ${profile.section}` : ''}</Text>}
          {profile?.roll_no && <Text style={styles.heroSub}>Roll No: {profile.roll_no}</Text>}
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: C.green }]}>
            <Text style={styles.kpiValue}>{attPct != null ? `${attPct}%` : '—'}</Text>
            <Text style={styles.kpiLabel}>Attendance</Text>
            <Text style={{ fontSize: 10, color: attPct >= 75 ? C.green : C.error, fontWeight: '700' }}>
              {attPct != null ? (attPct >= 75 ? 'GOOD' : 'LOW') : ''}
            </Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: fees?.outstanding > 0 ? C.warning : C.green }]}>
            <Text style={styles.kpiValue}>
              {fees?.outstanding != null ? `₹${Number(fees.outstanding).toLocaleString('en-IN')}` : '—'}
            </Text>
            <Text style={styles.kpiLabel}>Pending Fees</Text>
            <Text style={{ fontSize: 10, color: fees?.outstanding > 0 ? C.warning : C.green, fontWeight: '700' }}>
              {fees?.outstanding > 0 ? 'DUE' : 'CLEAR'}
            </Text>
          </View>
        </View>

        {/* Profile Summary */}
        {profile && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={16} color={C.primary} />
              <Text style={styles.cardTitle}>Profile</Text>
            </View>
            {[
              ['Admission No', profile.admission_no],
              ['Date of Birth', profile.dob],
              ['Guardian', profile.guardian_name || profile.father_name],
              ['Phone', profile.guardian_phone || profile.phone],
            ].filter(([,v]) => v).map(([label, val]) => (
              <View key={label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoVal}>{val}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Attendance Card */}
        {attendance && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="clipboard-outline" size={16} color={C.green} />
              <Text style={styles.cardTitle}>Attendance Summary</Text>
            </View>
            <View style={styles.attBar}>
              <View style={[styles.attFill, { width: `${attPct}%`, backgroundColor: attPct >= 75 ? C.green : C.error }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={styles.infoLabel}>Present: <Text style={styles.infoVal}>{attendance.present}</Text></Text>
              <Text style={styles.infoLabel}>Absent: <Text style={{ color: C.error, fontWeight: '700' }}>{attendance.absent}</Text></Text>
              <Text style={styles.infoLabel}>Total: <Text style={styles.infoVal}>{attendance.total}</Text></Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={() =>
          Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])
        }>
          <Ionicons name="log-out-outline" size={16} color={C.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 22, marginBottom: 16, shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  kpiLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontWeight: '700', fontSize: 14, color: '#1e293b' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 12, color: '#64748b' },
  infoVal: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  attBar: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 4 },
  attFill: { height: '100%', borderRadius: 99 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
