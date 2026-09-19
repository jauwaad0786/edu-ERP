// mob_app/src/screens/transport/VehiclesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#ea580c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/transport/vehicles').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.vehicles || [];
      setVehicles(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fleet Vehicles</Text>
        <Text style={styles.headerSub}>{vehicles.length} Buses & Vans Managed</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {vehicles.length > 0 ? (
          vehicles.map((v, i) => (
            <View key={v.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.iconBox}>
                  <Ionicons name="bus-outline" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.regNo}>{v.registration_no || v.vehicle_number || v.reg_no || `Bus #${i+1}`}</Text>
                  <Text style={styles.sub}>{v.model || 'School Bus'} · Capacity: {v.capacity || v.seating_capacity || 40} seats</Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Driver: {v.driver_name || 'Assigned'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: v.status === 'INACTIVE' ? '#fee2e2' : '#dcfce7' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: v.status === 'INACTIVE' ? C.error : C.green }}>
                    {v.status || 'ACTIVE'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="bus-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No fleet vehicles recorded</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#ea580c', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  regNo: { fontSize: 15, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
