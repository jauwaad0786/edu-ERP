/**
 * mob_app/src/screens/dashboard/LibrarianDashboardScreen.js
 * Librarian — Library Operations mobile dashboard
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
const C = { primary: '#0891b2', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', error: '#dc2626', warning: '#d97706', green: '#16a34a' };
export default function LibrarianDashboardScreen() {
  const { user, logout } = useAuth();
  const [dash, setDash] = useState(null); const [overdue, setOverdue] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [d, ov] = await Promise.all([
        client.get('/library/dashboard').catch(() => ({ data: null })),
        client.get('/library/issue-return', { params: { status: 'OVERDUE', per_page: 5 } }).catch(() => ({ data: { transactions: [] } })),
      ]);
      setDash(d.data); setOverdue(ov.data?.transactions || []);
    } finally { if (isRefresh) setRefreshing(false); else setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator size="large" color={C.primary} /></SafeAreaView>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}>
        <View style={{ backgroundColor: '#0369a1', borderRadius: 18, padding: 22, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>LIBRARY OPERATIONS</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>Library Command Center</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>{dash?.total_books || 0} books · {dash?.available_books || 0} available</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Books', v: dash?.total_books?.toLocaleString(), c: C.primary },
            { l: 'Available', v: dash?.available_books?.toLocaleString(), c: C.green },
            { l: 'Issued', v: dash?.issued_books?.toLocaleString(), c: '#7c3aed' },
            { l: 'Overdue', v: dash?.overdue_books ?? overdue.length, c: (dash?.overdue_books ?? overdue.length) > 0 ? C.error : C.green },
          ].map((k, i) => (
            <View key={i} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, borderLeftColor: k.c, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 }}>{k.v ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' }}>{k.l}</Text>
            </View>
          ))}
        </View>
        {overdue.length > 0 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.text, marginBottom: 10 }}>Overdue Books ({overdue.length})</Text>
            {overdue.map((ov, i) => (
              <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: C.text }}>{ov.book_title || 'Book'}</Text>
                <Text style={{ fontSize: 11, color: C.muted }}>{ov.member_name || 'Member'} · Due: {ov.due_date || '—'}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
          onPress={() => Alert.alert('Logout', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={16} color={C.error} /><Text style={{ color: C.error, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
