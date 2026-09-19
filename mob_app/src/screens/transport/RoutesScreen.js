// mob_app/src/screens/transport/RoutesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#ea580c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function RoutesScreen() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/transport/routes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.routes || [];
      setRoutes(list);
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
        <Text style={styles.headerTitle}>Transport Routes</Text>
        <Text style={styles.headerSub}>{routes.length} Active Bus Routes</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {routes.length > 0 ? (
          routes.map((r, i) => (
            <View key={r.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.name}>{r.name || r.route_name || `Route #${r.id}`}</Text>
                <View style={styles.badge}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>
                    {r.stops_count || r.stops?.length || 0} Stops
                  </Text>
                </View>
              </View>
              <Text style={styles.sub}>
                Vehicle: {r.vehicle_no || r.vehicle_number || 'Unassigned'} · Driver: {r.driver_name || 'Unassigned'}
              </Text>
              {r.start_point && r.end_point && (
                <Text style={styles.points}>
                  {r.start_point} → {r.end_point}
                </Text>
              )}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="map-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No bus routes defined</Text>
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
  name: { fontSize: 15, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  points: { fontSize: 12, color: C.text, fontWeight: '600', marginTop: 6 },
  badge: { backgroundColor: '#ffedd5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
