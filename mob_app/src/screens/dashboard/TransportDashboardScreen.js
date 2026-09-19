// mob_app/src/screens/dashboard/TransportDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#ea580c', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', green: '#16a34a', warning: '#d97706' };
export default function TransportDashboardScreen() {
  const { user, logout } = useAuth();
  const [dash, setDash] = useState(null); const [vehicles, setVehicles] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [d, v] = await Promise.all([
        client.get('/transport/dashboard').catch(() => ({ data: null })),
        client.get('/transport/vehicles', { params: { per_page: 10 } }).catch(() => ({ data: { vehicles: [] } })),
      ]);
      setDash(d.data); setVehicles(v.data?.vehicles || v.data || []);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  const activeCount = vehicles.filter(v => v.status === 'ACTIVE').length;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: '#9a3412', borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>TRANSPORT OPERATIONS</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>Fleet Operations Hub</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{dash?.total_vehicles ?? vehicles.length} vehicles · {activeCount} active</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Vehicles', v: dash?.total_vehicles ?? vehicles.length, c: C.primary },
            { l: 'Active', v: activeCount, c: C.green },
            { l: 'Routes', v: dash?.total_routes, c: '#0176d3' },
            { l: 'Students', v: dash?.total_students?.toLocaleString(), c: '#7c3aed' },
          ].map((k, i) => (
            <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: k.c, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 }}>{k.v ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' }}>{k.l}</Text>
            </View>
          ))}
        </View>
        {vehicles.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.text, marginBottom: 10 }}>Fleet Status</Text>
            {vehicles.slice(0, 5).map((v, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 }}>
                <Ionicons name="bus-outline" size={18} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: C.text }}>{v.registration_no || v.vehicle_no || `Vehicle ${i + 1}`}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{v.make || v.model || 'Bus'}</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: v.status === 'ACTIVE' ? C.green : C.warning }}>{v.status || 'ACTIVE'}</Text>
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
