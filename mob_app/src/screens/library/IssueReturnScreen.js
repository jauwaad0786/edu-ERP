// mob_app/src/screens/library/IssueReturnScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0891b2', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function IssueReturnScreen() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/library/issues').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.issues || res.data?.transactions || [];
      setIssues(list);
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
        <Text style={styles.headerTitle}>Active Book Issues</Text>
        <Text style={styles.headerSub}>Circulation & Returns Desk</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {issues.length > 0 ? (
          issues.map((iss, i) => (
            <View key={iss.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookTitle}>{iss.book_title || iss.title || 'Book Title'}</Text>
                  <Text style={styles.member}>Borrower: {iss.member_name || iss.student_name || 'Member'}</Text>
                  <Text style={styles.dates}>Issued: {iss.issue_date || '—'} · Due: {iss.due_date || '—'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: iss.is_overdue || iss.status === 'OVERDUE' ? '#fee2e2' : '#e0f2fe' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: iss.is_overdue || iss.status === 'OVERDUE' ? C.error : C.primary }}>
                    {iss.is_overdue || iss.status === 'OVERDUE' ? 'OVERDUE' : (iss.status || 'ISSUED')}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="swap-horizontal-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No active book issues found</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  bookTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  member: { fontSize: 12, color: C.muted, marginTop: 3 },
  dates: { fontSize: 11, color: C.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
