// mob_app/src/screens/attendance/AttendanceScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Role-aware endpoint mapping
      let endpoint = '/student/attendance';
      if (user?.role === 'TEACHER') endpoint = '/staff-attendance/my-status';
      else if (['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'HR', 'ADMIN'].includes(user?.role)) endpoint = '/staff-attendance/dashboard';

      const r = await client.get(endpoint).catch(() => ({ data: null }));
      setData(r.data);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;

  const records = Array.isArray(data?.records) ? data.records : [];
  const entries = data ? Object.entries(data).filter(([k, v]) => v !== null && typeof v !== 'object') : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <Text style={styles.headerSub}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        {entries.length > 0 && (
          <View style={styles.card}>
            <View style={styles.ch}><Ionicons name="clipboard-outline" size={16} color={C.primary} /><Text style={styles.ct}>Attendance Summary</Text></View>
            {entries.slice(0, 8).map(([key, val]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.rowL}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                <Text style={styles.rowV}>{String(val)}</Text>
              </View>
            ))}
          </View>
        )}

        {records.length > 0 && (
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.ch}><Ionicons name="calendar-outline" size={16} color={C.primary} /><Text style={styles.ct}>Recent History</Text></View>
            {records.slice(0, 15).map((rec, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowL}>{rec.date || rec.attendance_date}</Text>
                <Text style={[styles.rowV, { color: (rec.status === 'PRESENT' || rec.status === 'Present') ? C.green : C.error }]}>{rec.status}</Text>
              </View>
            ))}
          </View>
        )}

        {!data && records.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="clipboard-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No attendance data available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.primary, padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ct: { fontWeight: '700', fontSize: 14, color: '#1e293b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowL: { fontSize: 13, color: '#64748b' },
  rowV: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
});
