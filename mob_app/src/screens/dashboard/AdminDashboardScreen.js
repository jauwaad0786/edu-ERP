// mob_app/src/screens/dashboard/AdminDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626' };
export default function AdminDashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await client.get('/admin/platform-dashboard').catch(() => client.get('/admin/dashboard').catch(() => ({ data: null })));
      setStats(r.data);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: C.primary, borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>PLATFORM ADMINISTRATOR</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>{user?.name || 'Admin'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>1P360 EduERP Platform</Text>
        </View>
        {stats && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'Schools', v: stats.total_schools },
              { l: 'Students', v: stats.total_students?.toLocaleString() },
              { l: 'Teachers', v: stats.total_teachers?.toLocaleString() },
              { l: 'Active Plans', v: stats.active_subscriptions || stats.total_active },
            ].map((k, i) => (
              <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: C.primary, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 2 }}>{k.v ?? '—'}</Text>
                <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>{k.l}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} />
          <Text style={{ color: C.error, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
