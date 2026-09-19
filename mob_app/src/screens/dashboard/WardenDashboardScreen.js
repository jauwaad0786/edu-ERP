// mob_app/src/screens/dashboard/WardenDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#4338ca', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', green: '#16a34a', warning: '#d97706' };
export default function WardenDashboardScreen() {
  const { user, logout } = useAuth();
  const [dash, setDash] = useState(null); const [passes, setPasses] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [d, p] = await Promise.all([
        client.get('/hostel/dashboard').catch(() => ({ data: null })),
        client.get('/hostel/out-pass', { params: { status: 'PENDING', per_page: 5 } }).catch(() => ({ data: { passes: [] } })),
      ]);
      setDash(d.data); setPasses(p.data?.passes || []);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const occupancy = dash?.total_beds && dash?.total_residents != null ? Math.round((dash.total_residents / dash.total_beds) * 100) : null;
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: '#3730a3', borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>HOSTEL WARDEN PORTAL</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>Hostel Operations Hub</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{dash?.total_residents || 0} residents · {dash?.total_beds || 0} beds{occupancy != null ? ` · ${occupancy}% occupancy` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Residents', v: dash?.total_residents, c: C.primary },
            { l: 'Available Beds', v: dash?.available_beds ?? (dash?.total_beds - dash?.total_residents), c: C.green },
            { l: 'Pending Passes', v: passes.length, c: passes.length > 0 ? C.warning : C.green },
            { l: 'Complaints', v: dash?.open_complaints ?? '—', c: C.error },
          ].map((k, i) => (
            <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: k.c, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 }}>{k.v ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' }}>{k.l}</Text>
            </View>
          ))}
        </View>
        {passes.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.text, marginBottom: 10 }}>Pending Out Passes ({passes.length})</Text>
            {passes.map((p, i) => (
              <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: C.text }}>{p.student_name || 'Student'}</Text>
                <Text style={{ fontSize: 11, color: C.muted }}>{p.pass_type || 'OUT PASS'} · {p.destination || '—'}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} /><Text style={{ color: C.error, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
