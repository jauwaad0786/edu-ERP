// mob_app/src/screens/staff/StaffScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function StaffScreen() {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/principal/teachers').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.teachers || [];
      setStaff(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = staff.filter(s =>
    (s.name || s.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.designation || '').toLowerCase().includes(search.toLowerCase())
  );

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
        <Text style={styles.headerTitle}>Staff & Faculty</Text>
        <Text style={styles.headerSub}>{staff.length} Teachers & Personnel</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, designation..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Ionicons name="close-circle" size={18} color={C.muted} onPress={() => setSearch('')} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {filtered.length > 0 ? (
          filtered.map((s, i) => (
            <View key={s.id || i} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.avatar, { backgroundColor: '#ede9fe' }]}>
                  <Text style={[styles.avatarText, { color: '#7c3aed' }]}>{(s.name || s.user_name || 'T').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.name || s.user_name}</Text>
                  <Text style={styles.sub}>{s.designation || 'Teacher'} · {s.department || 'Academics'}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.email || s.phone || '—'}</Text>
                </View>
                {s.subjects && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary }}>{Array.isArray(s.subjects) ? s.subjects.join(', ') : s.subjects}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="person-circle-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No staff members found</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 16, marginBottom: 0, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 13, color: C.text },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.muted, marginTop: 2 },
});
