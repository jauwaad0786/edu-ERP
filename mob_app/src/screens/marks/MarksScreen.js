// mob_app/src/screens/marks/MarksScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';

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
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching Assessment Rosters...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <GradientHero
          tagline="ACADEMIC EVALUATION"
          title="Marks & Grades"
          subtitle="Score entry, term evaluation, and performance grade sheets"
          avatarText="M"
          gradientColors={['#1e1b4b', '#4338ca', '#3b82f6']}
        />

        {/* Class Selector Pills */}
        {classes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classSelector}
          >
            {classes.map(c => {
              const isSelected = selectedClass === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.classPill, isSelected && styles.classPillActive]}
                  onPress={() => setSelectedClass(c.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.classPillText, isSelected && styles.classPillTextActive]}>
                    {c.name || `Class ${c.grade || ''} ${c.section || ''}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Roster Cards */}
        {roster.length > 0 ? (
          <Card padding={16}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Student Grades ({roster.length})</Text>
            </View>

            {roster.map((s, i) => {
              const score = s.total_marks ?? s.marks ?? s.score ?? '—';
              const maxScore = s.max_marks ?? 100;
              const grade = s.grade || (typeof score === 'number' ? (score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D') : 'Pass');

              return (
                <View
                  key={s.id || s.student_id || i}
                  style={[
                    styles.studentRow,
                    i === roster.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {(s.name || s.student_name || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.nameText}>{s.name || s.student_name || 'Student'}</Text>
                    <Text style={styles.subText}>Roll #{s.roll_no || i + 1}</Text>
                  </View>

                  <View style={styles.scoreCol}>
                    <Text style={styles.scoreVal}>{score} <Text style={{ fontSize: 11, color: colors.muted }}>/ {maxScore}</Text></Text>
                    <Badge
                      label={grade}
                      variant={grade.startsWith('A') ? 'success' : grade.startsWith('B') ? 'primary' : 'warning'}
                      size="sm"
                      style={{ alignSelf: 'flex-end', marginTop: 2 }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        ) : (
          <EmptyState
            icon="school-outline"
            title="No Marks Records"
            description="No student roster or evaluation records found for this class."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  classSelector: {
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  classPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  classPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  classPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.muted,
  },
  classPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  subText: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  scoreCol: {
    alignItems: 'flex-end',
  },
  scoreVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
});
