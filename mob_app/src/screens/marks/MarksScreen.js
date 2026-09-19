// mob_app/src/screens/marks/MarksScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#0176d3', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function MarksScreen() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const clsRes = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const clsList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      setClasses(clsList);
      if (clsList.length > 0 && !selectedClass) {
        setSelectedClass(clsList[0].id);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedClass) return;
    client.get('/marks/roster', { params: { class_id: selectedClass } })
      .then(res => {
        const rows = Array.isArray(res.data) ? res.data : res.data?.students || res.data?.roster || [];
        setRoster(rows);
      })
      .catch(() => setRoster([]));
  }, [selectedClass]);

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
        <Text style={styles.headerTitle}>Marks & Assessment</Text>
        <Text style={styles.headerSub}>Student Marks & Class Rosters</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {/* Class selector */}
        {classes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chip, selectedClass === cls.id && styles.chipActive]}
                onPress={() => setSelectedClass(cls.id)}
              >
                <Text style={[styles.chipText, selectedClass === cls.id && styles.chipTextActive]}>
                  {cls.name} {cls.section ? `- ${cls.section}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Student Marks Roster */}
        {roster.length > 0 ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>STUDENT</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>MARKS</Text>
            </View>
            {roster.map((stu, i) => (
              <View key={i} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: C.text }}>{stu.name || stu.student_name || `Student #${i+1}`}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>Roll: {stu.roll_no || '—'} · Adm: {stu.admission_no || '—'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.primary }}>
                  {stu.marks_obtained != null ? `${stu.marks_obtained}/${stu.max_marks || 100}` : 'Entered'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="pencil-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No marks roster found for this class</Text>
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: '#0176d3', borderColor: '#0176d3' },
  chipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
});
