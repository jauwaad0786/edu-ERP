// mob_app/src/screens/transport/TransportTrackScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#ea580c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function TransportTrackScreen() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const cRes = await client.get('/student/children').catch(() => ({ data: [] }));
      const cList = Array.isArray(cRes.data) ? cRes.data : [];
      setChildren(cList);
      if (cList.length > 0 && !selectedChild) {
        setSelectedChild(cList[0].id);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedChild]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedChild) return;
    client.get(`/transport/parent/child/${selectedChild}/trip`)
      .then(res => setTrip(res.data))
      .catch(() => setTrip(null));
  }, [selectedChild]);

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
        <Text style={styles.headerTitle}>Live Bus Tracking</Text>
        <Text style={styles.headerSub}>School Bus Route & GPS Status</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {children.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedChild === c.id && styles.chipActive]}
                onPress={() => setSelectedChild(c.id)}
              >
                <Text style={[styles.chipText, selectedChild === c.id && styles.chipTextActive]}>
                  {c.name} ({c.class_name || 'Class'})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {trip ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bus-outline" size={22} color={C.primary} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>Route {trip.route_name || 'Active Trip'}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: trip.status === 'IN_PROGRESS' || trip.status === 'LIVE' ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: trip.status === 'IN_PROGRESS' || trip.status === 'LIVE' ? C.green : C.warning }}>
                  {trip.status || 'SCHEDULED'}
                </Text>
              </View>
            </View>

            <View style={{ paddingVertical: 12, backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle Number</Text>
                <Text style={styles.infoVal}>{trip.vehicle_no || trip.vehicle_registration || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Driver Name</Text>
                <Text style={styles.infoVal}>{trip.driver_name || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Driver Phone</Text>
                <Text style={[styles.infoVal, { color: C.primary }]}>{trip.driver_phone || '—'}</Text>
              </View>
              {trip.current_speed != null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Speed</Text>
                  <Text style={styles.infoVal}>{trip.current_speed} km/h</Text>
                </View>
              )}
            </View>

            {trip.pickup_stop && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase' }}>Assigned Stop</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 2 }}>{trip.pickup_stop}</Text>
                {trip.eta && <Text style={{ fontSize: 12, color: C.green, marginTop: 2, fontWeight: '600' }}>ETA: {trip.eta}</Text>}
              </View>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="bus-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No active bus trip currently running</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Live tracking activates when bus leaves school</Text>
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  chipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: C.muted },
  infoVal: { fontSize: 12, fontWeight: '700', color: C.text },
});
