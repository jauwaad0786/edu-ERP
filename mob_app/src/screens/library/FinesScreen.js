// mob_app/src/screens/library/FinesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0891b2', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function FinesScreen() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/library/fines').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.fines || [];
      setFines(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalFines = fines.reduce((sum, f) => sum + Number(f.amount || 0), 0);

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
        <Text style={styles.headerTitle}>Library Fines & Dues</Text>
        <Text style={styles.headerSub}>Total Fines: ₹{totalFines.toLocaleString('en-IN')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {fines.length > 0 ? (
          fines.map((f, i) => (
            <View key={f.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.member}>{f.member_name || f.student_name || 'Borrower'}</Text>
                  <Text style={styles.book}>{f.book_title || 'Overdue Book'}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Date: {f.created_at?.split('T')[0] || f.date || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amount}>₹{Number(f.amount || 0).toLocaleString('en-IN')}</Text>
                  <View style={[styles.badge, { backgroundColor: f.status === 'PAID' ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: f.status === 'PAID' ? C.green : C.error }}>
                      {f.status || 'UNPAID'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="cash-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No outstanding library fines</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#0891b2', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  member: { fontSize: 15, fontWeight: '700', color: C.text },
  book: { fontSize: 12, color: C.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
});
