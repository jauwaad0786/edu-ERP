// mob_app/src/screens/dashboard/PrincipalDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function PrincipalDashboardScreen() {
  const { user, logout } = useAuth();
  const [stats,    setStats]    = useState(null);
  const [fees,     setFees]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [s, f] = await Promise.all([
        client.get('/principal/dashboard').catch(() => ({ data: null })),
        client.get('/principal/fees/summary').catch(() => ({ data: null })),
      ]);
      setStats(s.data);
      setFees(f.data);
    } finally {
      if (isRefresh) setRefresh(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const presentPct = stats?.total_students ? Math.round((stats.students_present / stats.total_students) * 100) : null;
  const collectRate = fees?.total_demand ? Math.round((fees.collected / fees.total_demand) * 100) : null;

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[C.primary]} />}>

        <View style={[styles.hero, { backgroundColor: C.primary }]}>
          <Text style={styles.hGreet}>{greeting.toUpperCase()}</Text>
          <Text style={styles.hName}>{user?.name || 'Principal'}</Text>
          <Text style={styles.hSub}>{user?.school?.name || 'Your School'} · Executive Dashboard</Text>
        </View>

        {/* KPI Grid */}
        <View style={styles.grid}>
          {[
            { icon: 'people-outline', label: 'Students', value: stats?.total_students?.toLocaleString(), color: C.primary },
            { icon: 'clipboard-outline', label: 'Student Att.', value: presentPct != null ? `${presentPct}%` : '—', color: presentPct >= 85 ? C.green : C.warning },
            { icon: 'person-circle-outline', label: 'Teachers', value: stats?.total_teachers?.toLocaleString(), color: '#7c3aed' },
            { icon: 'receipt-outline', label: 'Collection Rate', value: collectRate != null ? `${collectRate}%` : '—', color: collectRate >= 80 ? C.green : C.warning },
          ].map((k, i) => (
            <View key={i} style={[styles.kpi, { borderLeftColor: k.color }]}>
              <Ionicons name={k.icon} size={20} color={k.color} style={{ marginBottom: 4 }} />
              <Text style={styles.kpiVal}>{k.value ?? '—'}</Text>
              <Text style={styles.kpiLab}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Fee Summary */}
        {fees && (
          <View style={styles.card}>
            <View style={styles.ch}><Ionicons name="cash-outline" size={16} color={C.green} /><Text style={styles.ct}>Fee Summary</Text></View>
            {[['Total Demand', fees.total_demand], ['Collected', fees.collected], ['Outstanding', fees.outstanding]].map(([l, v]) => (
              <View key={l} style={styles.infoRow}>
                <Text style={styles.infoL}>{l}</Text>
                <Text style={[styles.infoV, l === 'Outstanding' && fees.outstanding > 0 && { color: C.warning }]}>₹{Number(v || 0).toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.lgBtn} onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} /><Text style={styles.lgTxt}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 22, marginBottom: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  hGreet: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  hName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  hSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpi: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, alignItems: 'center' },
  kpiVal: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  kpiLab: { fontSize: 10, color: '#64748b', fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ct: { fontWeight: '700', fontSize: 14, color: '#1e293b' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoL: { fontSize: 13, color: '#64748b' },
  infoV: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  lgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  lgTxt: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
});
