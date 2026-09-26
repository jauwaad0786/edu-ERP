// mob_app/src/screens/marks/MarksScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function MarksScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [roster, setRoster] = useState([]);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load initial dropdowns (classes, exams, subjects)
  const loadInitialData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [clsRes, examRes, subRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/exams').catch(() => ({ data: [] })),
        client.get('/principal/subjects').catch(() => ({ data: [] })),
      ]);

      const clsList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      const exList = Array.isArray(examRes.data) ? examRes.data : examRes.data?.exams || [];
      const subList = Array.isArray(subRes.data) ? subRes.data : subRes.data?.subjects || [];

      setClasses(clsList);
      setExams(exList);
      setSubjects(subList);

      if (clsList.length > 0 && !selectedClass) setSelectedClass(clsList[0].id);
      if (exList.length > 0 && !selectedExam) setSelectedExam(exList[0].id);
      if (subList.length > 0 && !selectedSubject) setSelectedSubject(subList[0].id);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedClass, selectedExam, selectedSubject]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch roster when class, exam, and subject are chosen
  const loadRoster = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingRoster(true);
    try {
      const params = { class_id: selectedClass };
      if (selectedExam) params.exam_id = selectedExam;
      if (selectedSubject) params.subject_id = selectedSubject;

      const res = await client.get('/marks/roster', { params }).catch(() => null);
      const rows = Array.isArray(res?.data)
        ? res.data
        : res?.data?.students || res?.data?.roster || [];

      setRoster(rows);
      const initialScores = {};
      rows.forEach(r => {
        const sid = r.student_id || r.id;
        initialScores[sid] = r.marks_obtained != null ? String(r.marks_obtained) : '';
      });
      setScores(initialScores);
    } catch {
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedClass, selectedExam, selectedSubject]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const handleScoreChange = (studentId, val) => {
    setScores(prev => ({ ...prev, [studentId]: val }));
  };

  const handleSaveMarks = async () => {
    if (!selectedClass || !selectedExam || !selectedSubject) {
      Alert.alert('Selection Required', 'Please select a Class, Exam, and Subject to record marks.');
      return;
    }

    const entries = roster.map(s => {
      const sid = s.student_id || s.id;
      const rawScore = scores[sid];
      return {
        student_id: sid,
        marks_obtained: rawScore !== '' && rawScore != null ? Number(rawScore) : 0,
        is_absent: rawScore === 'AB' || rawScore === 'A',
        remarks: 'Recorded via Mobile ERP',
      };
    });

    setSaving(true);
    try {
      await client.post('/marks/save', {
        class_id: selectedClass,
        exam_id: selectedExam,
        subject_id: selectedSubject,
        entries,
      });
      Alert.alert('Marks Saved', `Successfully updated scores for ${entries.length} students.`);
      loadRoster();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.message || err.response?.data?.error || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching Assessment Rosters...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {navigation?.canGoBack?.() && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Marks & Evaluation</Text>
              <Text style={styles.headerSub}>Roster grading & score submissions</Text>
            </View>
          </View>
          {roster.length > 0 && (
            <TouchableOpacity
              style={styles.saveHeaderBtn}
              onPress={handleSaveMarks}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={16} color="#fff" />
                  <Text style={styles.saveHeaderBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Filters Carousel */}
        <View style={styles.filterSection}>
          {/* Class Selector */}
          <Text style={styles.filterLabel}>Class:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {classes.map(c => {
              const active = selectedClass === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setSelectedClass(c.id)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    Class {c.name} {c.section ? `(${c.section})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Exam Selector */}
          {exams.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Exam Term:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                {exams.map(e => {
                  const active = selectedExam === e.id;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedExam(e.id)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {e.name || e.title || `Term ${e.id}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Subject Selector */}
          {subjects.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Subject:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {subjects.map(sub => {
                  const active = selectedSubject === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setSelectedSubject(sub.id)}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {sub.name || sub.subject_name || `Subject ${sub.id}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadInitialData(true)}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loadingRoster ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading class roster...</Text>
          </View>
        ) : roster.length > 0 ? (
          <View style={styles.rosterCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
                <Ionicons name="school-outline" size={18} color="#4338ca" />
              </View>
              <Text style={styles.cardTitle}>Student Mark Roster ({roster.length})</Text>
            </View>

            {roster.map((s, i) => {
              const sid = s.student_id || s.id;
              const sName = s.name || s.student_name || 'Student';
              const sRoll = s.roll_number || s.roll_no || i + 1;
              const maxScore = s.max_marks || 100;
              const currentScore = scores[sid] ?? '';

              return (
                <View
                  key={sid}
                  style={[
                    styles.studentRow,
                    i === roster.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>{sName.charAt(0).toUpperCase()}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.nameText} numberOfLines={1}>{sName}</Text>
                    <Text style={styles.subText}>Roll #{sRoll}  • Max: {maxScore}</Text>
                  </View>

                  <View style={styles.scoreInputWrapper}>
                    <TextInput
                      style={styles.scoreInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      value={currentScore}
                      onChangeText={(val) => handleScoreChange(sid, val)}
                    />
                    <Text style={styles.maxMarkText}>/{maxScore}</Text>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.saveBottomBtn}
              onPress={handleSaveMarks}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBottomBtnText}>Save All Marks</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Roster Records</Text>
            <Text style={styles.emptyDesc}>
              Please select a valid Class, Exam, and Subject to view and enter marks.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b', fontWeight: '600' },
  header: {
    backgroundColor: '#312e81',
    padding: 16,
    paddingTop: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  saveHeaderBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13, marginLeft: 4 },
  filterSection: { marginTop: 12 },
  filterLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#ffffff' },
  pillText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: '#312e81', fontWeight: '800' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  rosterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#6366f1', fontWeight: '800', fontSize: 15 },
  nameText: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  subText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  scoreInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scoreInput: {
    width: 44,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    padding: 2,
  },
  maxMarkText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  saveBottomBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptyDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
