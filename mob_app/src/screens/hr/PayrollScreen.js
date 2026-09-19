// mob_app/src/screens/hr/PayrollScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#be123c', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function PayrollScreen() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hrms/payroll/runs').catch(() => client.get('/hrms/employees'));
      const list = Array.isArray(res.data) ? res.data : res.data?.runs || res.data?.employees || [];
      setRuns(list);
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
        <Text style={styles.headerTitle}>Payroll & Salaries</Text>
        <Text style={styles.headerSub}>Monthly Salary Batches</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {runs.length > 0 ? (
          runs.map((r, i) => (
            <View key={r.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.title}>{r.month_year || r.name || `Salary Batch #${i+1}`}</Text>
                <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.green }}>{r.status || 'PROCESSED'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={styles.meta}>Employees: {r.employee_count || 'All staff'}</Text>
                <Text style={styles.amount}>₹{Number(r.total_amount || r.salary || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="cash-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No payroll records found</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  meta: { fontSize: 12, color: C.muted },
  amount: { fontSize: 14, fontWeight: '800', color: C.primary },
});
