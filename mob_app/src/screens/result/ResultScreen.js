// mob_app/src/screens/result/ResultScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#7c3aed', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function ResultScreen() {
  const [results, setResults] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDetail, setExamDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/student/marks').catch(() => ({ data: [] }));
      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data);
      if (data.length > 0 && !selectedExam) {
        setSelectedExam(data[0].exam_id);
      }
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedExam]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedExam) return;
    client.get('/student/marks', { params: { exam_id: selectedExam } })
      .then(res => setExamDetail(res.data))
      .catch(() => setExamDetail(null));
  }, [selectedExam]);

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
        <Text style={styles.headerTitle}>Examination Results</Text>
        <Text style={styles.headerSub}>Published Academic Report Cards</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
      >
        {results.length > 0 ? (
          <>
            {/* Exam selector chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {results.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, selectedExam === r.exam_id && styles.chipActive]}
                  onPress={() => setSelectedExam(r.exam_id)}
                >
                  <Text style={[styles.chipText, selectedExam === r.exam_id && styles.chipTextActive]}>
                    {r.exam_name || `Exam #${r.exam_id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Scorecard Summary */}
            {examDetail && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>
                    {examDetail.exam?.exam_name || 'Report Card'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: examDetail.result === 'PASS' ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={{ color: examDetail.result === 'PASS' ? C.green : C.error, fontWeight: '700', fontSize: 12 }}>
                      {examDetail.result || 'PUBLISHED'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.primary }}>{examDetail.percentage}%</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>Percentage</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.green }}>{examDetail.grade || '—'}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>Grade</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{examDetail.total_obtained} / {examDetail.total_max}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>Total Score</Text>
                  </View>
                </View>

                {/* Subject table */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase' }}>Subject Breakdown</Text>
                {Array.isArray(examDetail.subjects) && examDetail.subjects.map((sub, i) => (
                  <View key={i} style={styles.subjectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', fontSize: 13, color: C.text }}>{sub.subject_name || sub.subject || `Subject ${i+1}`}</Text>
                      {sub.is_absent && <Text style={{ color: C.error, fontSize: 10 }}>Absent</Text>}
                    </View>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: C.text }}>
                      {sub.is_absent ? 'AB' : `${sub.marks_obtained} / ${sub.max_marks}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="school-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>No published results found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#7c3aed', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  subjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
});
