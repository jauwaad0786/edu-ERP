// mob_app/src/screens/dashboard/AccountantDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#16a34a', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', warning: '#d97706' };
const fmtK = v => v != null ? (v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${Number(v).toLocaleString('en-IN')}`) : '₹—';
export default function AccountantDashboardScreen() {
  const { user, logout } = useAuth();
  const [fees, setFees] = useState(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try { const f = await client.get('/principal/fees/summary').catch(() => ({ data: null })); setFees(f.data); }
    finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const collectRate = fees?.total_demand ? Math.round((fees.collected / fees.total_demand) * 100) : null;
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: '#047857', borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>FINANCE OPERATIONS</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>Financial Command Center</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>Total Demand: {fmtK(fees?.total_demand)} · Collected: {fmtK(fees?.collected)}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Demand', v: fmtK(fees?.total_demand), c: '#0176d3' },
            { l: 'Collected', v: fmtK(fees?.collected), c: C.primary },
            { l: 'Outstanding', v: fmtK(fees?.outstanding), c: fees?.outstanding > 0 ? C.warning : C.primary },
            { l: 'Collection Rate', v: collectRate != null ? `${collectRate}%` : '—', c: collectRate >= 80 ? C.primary : C.warning },
          ].map((k, i) => (
            <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: k.c, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 2 }}>{k.v}</Text>
              <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' }}>{k.l}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} /><Text style={{ color: C.error, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
