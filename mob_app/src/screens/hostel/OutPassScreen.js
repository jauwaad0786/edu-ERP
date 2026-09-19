// mob_app/src/screens/hostel/OutPassScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#4338ca', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function OutPassScreen() {
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hostel/out-passes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.out_passes || [];
      setPasses(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (passId, status) => {
    try {
      await client.patch(`/hostel/out-passes/${passId}/status`, { status });
      Alert.alert('Status Updated', `Out pass marked as ${status.toLowerCase()}`);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update pass');
    }
  };

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
        <Text style={styles.headerTitle}>Hostel Out Passes</Text>
        <Text style={styles.headerSub}>Student Gate Passes & Leave Permits</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {passes.length > 0 ? (
          passes.map((p, i) => (
            <View key={p.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.student_name || 'Student'}</Text>
                  <Text style={styles.sub}>Room: {p.room_number || '—'} · Reason: {p.reason || 'Personal'}</Text>
                </View>
                <View style={[styles.badge, {
                  backgroundColor: p.status === 'APPROVED' ? '#dcfce7' : p.status === 'REJECTED' ? '#fee2e2' : '#fef3c7'
                }]}>
                  <Text style={{
                    fontSize: 10, fontWeight: '700',
                    color: p.status === 'APPROVED' ? C.green : p.status === 'REJECTED' ? C.error : C.warning
                  }}>
                    {p.status || 'PENDING'}
                  </Text>
                </View>
              </View>

              <Text style={styles.timeRow}>
                <Ionicons name="time-outline" size={12} color={C.muted} /> Out: {p.out_time || p.from_date || '—'} → In: {p.expected_return_time || p.to_date || '—'}
              </Text>

              {p.status === 'PENDING' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: C.green }]}
                    onPress={() => handleUpdateStatus(p.id, 'APPROVED')}
                  >
                    <Text style={styles.btnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: C.error }]}
                    onPress={() => handleUpdateStatus(p.id, 'REJECTED')}
                  >
                    <Text style={styles.btnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="exit-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No gate passes issued</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#4338ca', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  timeRow: { fontSize: 12, color: C.muted, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
