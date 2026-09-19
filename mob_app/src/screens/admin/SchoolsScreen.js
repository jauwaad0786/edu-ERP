// mob_app/src/screens/admin/SchoolsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function SchoolsScreen() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/admin/schools').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.schools || [];
      setSchools(list);
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
        <Text style={styles.headerTitle}>Tenant Schools</Text>
        <Text style={styles.headerSub}>{schools.length} Active Institutions</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {schools.length > 0 ? (
          schools.map((s, i) => (
            <View key={s.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name || 'School Name'}</Text>
                  <Text style={styles.slug}>Slug: {s.slug || s.domain || '—'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: s.is_active !== false ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: s.is_active !== false ? C.green : C.error }}>
                    {s.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>Contact: {s.email || s.contact_email || '—'} · Plan: {s.subscription_plan || s.plan || 'Standard'}</Text>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="school-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No institutions registered</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#0176d3', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  name: { fontSize: 16, fontWeight: '800', color: C.text },
  slug: { fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
