// mob_app/src/screens/fees/FeesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#16a34a', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', warning: '#d97706' };
const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '₹—';

export default function FeesScreen() {
  const { user } = useAuth();
  const [fees, setFees] = useState(null); const [txns, setTxns] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const isStaff = ['PRINCIPAL', 'ACCOUNTANT', 'ADMIN'].includes(user?.role);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const endpoint = isStaff ? '/principal/fees/summary' : '/student/fees';
      const f = await client.get(endpoint).catch(() => ({ data: null }));
      setFees(f.data);
      if (isStaff) {
        const rRecent = await client.get('/principal/fees/recent-collections').catch(() => ({ data: [] }));
        setTxns(Array.isArray(rRecent.data) ? rRecent.data : []);
      } else {
        setTxns(Array.isArray(f.data?.records) ? f.data.records : []);
      }
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, [isStaff]);
  useEffect(() => { load(); }, [load]);
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;

  const totalDemand = fees?.total_demand ?? fees?.total_due ?? fees?.gross_due;
  const totalPaid = fees?.paid ?? fees?.collected ?? fees?.total_collected ?? fees?.total_paid;
  const outstanding = fees?.outstanding ?? fees?.balance;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: '#047857', padding: 20 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Fees Portal</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>Fee payments & records</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        {fees && (
          <View style={styles.card}>
            <View style={styles.ch}><Ionicons name="receipt-outline" size={16} color={C.primary} /><Text style={styles.ct}>Fee Summary</Text></View>
            {[['Total Demand', totalDemand], ['Paid', totalPaid], ['Outstanding', outstanding]].map(([l, v]) => (
              <View key={l} style={styles.row}><Text style={styles.rowL}>{l}</Text><Text style={[styles.rowV, l === 'Outstanding' && outstanding > 0 && { color: C.warning }]}>{fmt(v)}</Text></View>
            ))}
          </View>
        )}
        {txns.length > 0 && (
          <View style={styles.card}>
            <View style={styles.ch}><Ionicons name="card-outline" size={16} color={C.primary} /><Text style={styles.ct}>Payment History</Text></View>
            {txns.slice(0, 10).map((t, i) => (
              <View key={i} style={styles.row}>
                <View><Text style={{ fontWeight: '600', fontSize: 13, color: '#1e293b' }}>{t.fee_head || t.description || 'Payment'}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{t.payment_date || t.paid_on || '—'} · {t.payment_mode || t.mode || '—'}</Text></View>
                <Text style={{ fontWeight: '700', fontSize: 14, color: C.primary }}>{fmt(t.amount)}</Text>
              </View>
            ))}
          </View>
        )}
        {!fees && txns.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="receipt-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No fee data available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  ch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ct: { fontWeight: '700', fontSize: 14, color: '#1e293b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowL: { fontSize: 13, color: '#64748b' }, rowV: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
});
