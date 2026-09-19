// mob_app/src/screens/fees/OutstandingScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#d97706', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function OutstandingScreen() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/principal/fees/records', { params: { status: 'UNPAID' } }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.records || [];
      setRecords(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r =>
    (r.student_name || r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.class_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = filtered.reduce((sum, r) => sum + (Number(r.amount_due || 0) - Number(r.amount_paid || 0)), 0);

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
        <Text style={styles.headerTitle}>Outstanding Dues</Text>
        <Text style={styles.headerSub}>Total Pending: ₹{totalOutstanding.toLocaleString('en-IN')}</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by student or class..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {filtered.length > 0 ? (
          filtered.map((r, i) => {
            const due = Number(r.amount_due || 0) - Number(r.amount_paid || 0);
            return (
              <View key={r.id || i} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.student_name || r.name || 'Student'}</Text>
                    <Text style={styles.sub}>Class {r.class_name || '—'} · Month: {r.month || r.session || '—'}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Head: {r.fee_head || 'Tuition Fee'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>₹{due.toLocaleString('en-IN')}</Text>
                    <Text style={{ fontSize: 10, color: C.error, fontWeight: '700' }}>OVERDUE</Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={C.green} style={{ opacity: 0.6 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No outstanding dues found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#d97706', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 16, marginBottom: 0, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 13, color: C.text },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: '#d97706' },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: '#dc2626' },
});
