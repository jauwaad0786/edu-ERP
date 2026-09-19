// mob_app/src/screens/transport/LiveTrackingScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#ea580c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function LiveTrackingScreen() {
  const [liveTrips, setLiveTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/transport/live').catch(() => client.get('/transport/trips'));
      const list = Array.isArray(res.data) ? res.data : res.data?.trips || res.data?.vehicles || [];
      setLiveTrips(list);
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
        <Text style={styles.headerTitle}>Live Fleet GPS</Text>
        <Text style={styles.headerSub}>Real-time Vehicle Locations & Trips</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {liveTrips.length > 0 ? (
          liveTrips.map((t, i) => (
            <View key={t.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleNo}>{t.vehicle_no || t.registration_no || `Vehicle #${i+1}`}</Text>
                  <Text style={styles.sub}>Route: {t.route_name || 'Active Route'} · Driver: {t.driver_name || '—'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.green }}>LIVE GPS</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Speed</Text>
                  <Text style={styles.infoVal}>{t.speed || t.current_speed || 0} km/h</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Students on Board</Text>
                  <Text style={styles.infoVal}>{t.students_count || t.passenger_count || '—'}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>Last Ping</Text>
                  <Text style={styles.infoVal}>{t.last_ping || 'Just now'}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="navigate-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No vehicles actively on the road</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  vehicleNo: { fontSize: 16, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  infoBox: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 10 },
  infoCol: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 10, color: C.muted, fontWeight: '600' },
  infoVal: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 2 },
});
