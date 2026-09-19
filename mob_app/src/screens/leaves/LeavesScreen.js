// mob_app/src/screens/leaves/LeavesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#be123c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function LeavesScreen() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = filter === 'ALL' ? {} : { status: filter };
      const res = await client.get('/hrms/leaves/requests', { params }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.requests || [];
      setRequests(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (reqId, action) => {
    try {
      await client.post(`/hrms/leaves/requests/${reqId}/review`, { action });
      Alert.alert('Success', `Leave request ${action.toLowerCase()}ed`);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update leave');
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
        <Text style={styles.headerTitle}>Leave Applications</Text>
        <Text style={styles.headerSub}>Staff & Faculty Leave Requests</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {requests.length > 0 ? (
          requests.map((r, i) => (
            <View key={r.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.employee_name || r.user_name || 'Staff Member'}</Text>
                  <Text style={styles.sub}>{r.leave_type || 'Leave'} · {r.days_count || 1} day(s)</Text>
                </View>
                <View style={[styles.badge, {
                  backgroundColor: r.status === 'APPROVED' ? '#dcfce7' : r.status === 'REJECTED' ? '#fee2e2' : '#fef3c7'
                }]}>
                  <Text style={{
                    fontSize: 11, fontWeight: '700',
                    color: r.status === 'APPROVED' ? C.green : r.status === 'REJECTED' ? C.error : C.warning
                  }}>
                    {r.status || 'PENDING'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: C.text, marginVertical: 4 }}>
                <Text style={{ fontWeight: '700' }}>Period: </Text>{r.from_date} → {r.to_date}
              </Text>
              {r.reason && (
                <Text style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 10 }}>"{r.reason}"</Text>
              )}

              {r.status === 'PENDING' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: C.green }]}
                    onPress={() => handleReview(r.id, 'APPROVE')}
                  >
                    <Ionicons name="checkmark-outline" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: C.error }]}
                    onPress={() => handleReview(r.id, 'REJECT')}
                  >
                    <Ionicons name="close-outline" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="calendar-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No leave applications found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#be123c', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  filterRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#be123c' },
  filterText: { fontSize: 11, fontWeight: '700', color: C.muted },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
