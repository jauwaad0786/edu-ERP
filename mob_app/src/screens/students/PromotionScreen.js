// mob_app/src/screens/students/PromotionScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const ACTION_COLORS = {
  PROMOTE: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Promote' },
  DETAIN: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', label: 'Detain' },
  GRADUATE: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe', label: 'Graduate' },
  LEFT: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', label: 'Left/TC' },
};

export default function PromotionScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Step 1: Config
  const [step, setStep] = useState(1); // 1 = Config, 2 = Review Roster
  const [sourceSession, setSourceSession] = useState('2025-26');
  const [targetSession, setTargetSession] = useState('2026-27');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');

  // Step 2: Preview & Student Actions
  const [previewList, setPreviewList] = useState([]);
  const [studentActions, setStudentActions] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Load Classes and Sessions
  const loadInitialData = useCallback(async () => {
    try {
      const [clsRes, sessRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/students/sessions').catch(() => ({ data: { sessions: [] } })),
      ]);

      const clsList = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      setClasses(clsList);
      if (clsList.length > 0) {
        setSourceClassId(String(clsList[0].id));
        if (clsList.length > 1) {
          setTargetClassId(String(clsList[1].id));
        } else {
          setTargetClassId(String(clsList[0].id));
        }
      }

      const sessList = sessRes.data?.sessions || [];
      setSessions(sessList);
      if (sessList.length > 0) {
        setSourceSession(sessList[0]);
        if (sessList.length > 1) {
          setTargetSession(sessList[1]);
        } else {
          setTargetSession('2026-27');
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Preview from Backend
  const handleLoadPreview = async () => {
    if (!sourceSession || !targetSession || !sourceClassId) {
      Alert.alert('Selection Missing', 'Please select source session, target session, and source class.');
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await client.post('/principal/students/promote/preview', {
        source_session: sourceSession,
        source_class_id: parseInt(sourceClassId, 10),
        target_session: targetSession,
        target_class_id: targetClassId ? parseInt(targetClassId, 10) : null,
      });

      const list = res.data?.preview || res.data?.students || [];
      if (list.length === 0) {
        Alert.alert('No Students Found', 'No active students found in the selected source class and session.');
        setLoadingPreview(false);
        return;
      }

      setPreviewList(list);

      // Build initial student action map
      const initial = {};
      list.forEach(s => {
        initial[s.student_id] = {
          action: s.recommended_action || 'PROMOTE',
          target_class_id: s.suggested_class_id || (targetClassId ? parseInt(targetClassId, 10) : s.current_class_id),
          target_section: s.current_section || 'A',
          target_roll_number: s.current_roll_no || '',
          remarks: s.has_conflict ? s.conflict_reason : '',
        };
      });
      setStudentActions(initial);
      setStep(2);
    } catch (err) {
      Alert.alert('Preview Failed', err?.response?.data?.error || 'Failed to generate promotion preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Toggle student action: PROMOTE <-> DETAIN <-> LEFT
  const cycleAction = (studentId) => {
    setStudentActions(prev => {
      const current = prev[studentId]?.action || 'PROMOTE';
      const order = ['PROMOTE', 'DETAIN', 'LEFT'];
      const nextIdx = (order.indexOf(current) + 1) % order.length;
      return {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          action: order[nextIdx],
        },
      };
    });
  };

  // Bulk promote all / detain all
  const bulkSetAction = (action) => {
    setStudentActions(prev => {
      const next = { ...prev };
      previewList.forEach(s => {
        if (next[s.student_id]) {
          next[s.student_id].action = action;
        }
      });
      return next;
    });
  };

  // Execute Promotion Confirm
  const handleConfirmPromotion = async () => {
    Alert.alert(
      'Confirm Annual Promotion',
      `Promote ${previewList.length} students from Session ${sourceSession} to ${targetSession}? This updates academic records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Rollover',
          onPress: async () => {
            setExecuting(true);
            try {
              const studentsPayload = Object.keys(studentActions).map(id => ({
                student_id: parseInt(id, 10),
                action: studentActions[id].action,
                target_class_id: studentActions[id].target_class_id,
                target_section: studentActions[id].target_section,
                target_roll_number: studentActions[id].target_roll_number,
                remarks: studentActions[id].remarks,
              }));

              const res = await client.post('/principal/students/promote/confirm', {
                source_session: sourceSession,
                target_session: targetSession,
                source_class_id: parseInt(sourceClassId, 10),
                target_class_id: targetClassId ? parseInt(targetClassId, 10) : null,
                students: studentsPayload,
              });

              Alert.alert(
                'Promotion Successful',
                res.data?.message || 'Students have been successfully promoted and enrolled for the new session!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setStep(1);
                      setPreviewList([]);
                    },
                  },
                ]
              );
            } catch (err) {
              Alert.alert('Promotion Error', err?.response?.data?.error || 'Failed to complete promotion rollover.');
            } finally {
              setExecuting(false);
            }
          },
        },
      ]
    );
  };

  // Filtered Preview Roster
  const filteredRoster = useMemo(() => {
    return previewList.filter(s => {
      const q = searchFilter.toLowerCase();
      const matchSearch = !q ||
        (s.student_name && s.student_name.toLowerCase().includes(q)) ||
        (s.admission_no && s.admission_no.toLowerCase().includes(q));

      const act = studentActions[s.student_id]?.action || 'PROMOTE';
      const matchStatus = statusFilter === 'ALL' || act === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [previewList, searchFilter, statusFilter, studentActions]);

  // Statistics
  const stats = useMemo(() => {
    let p = 0, d = 0, l = 0;
    Object.values(studentActions).forEach(a => {
      if (a.action === 'PROMOTE') p++;
      else if (a.action === 'DETAIN') d++;
      else if (a.action === 'LEFT') l++;
    });
    return { promote: p, detain: d, left: l, total: previewList.length };
  }, [studentActions, previewList]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 2) setStep(1);
            else if (navigation?.goBack) navigation.goBack();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Student Promotion</Text>
          <Text style={styles.headerSub}>
            {step === 1 ? 'Step 1: Session & Class Criteria' : 'Step 2: Review Roster & Overrides'}
          </Text>
        </View>
      </View>

      {loadingInitial ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading academic records...</Text>
        </View>
      ) : step === 1 ? (
        /* STEP 1: CONFIGURATION */
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.bannerCard}>
            <Ionicons name="information-circle" size={24} color="#0b57d0" />
            <Text style={styles.bannerText}>
              Annual academic rollover promotes an entire class to the next grade while preserving previous attendance, marks, and ledger history.
            </Text>
          </View>

          {/* Source Session & Class */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SOURCE ACADEMIC RECORD</Text>

            <Text style={styles.fieldLabel}>Current Session</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {sessions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pill, sourceSession === s && styles.pillActive]}
                  onPress={() => setSourceSession(s)}
                >
                  <Text style={[styles.pillText, sourceSession === s && styles.pillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Current Class (Promoting From)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, String(sourceClassId) === String(c.id) && styles.pillActive]}
                  onPress={() => setSourceClassId(String(c.id))}
                >
                  <Text style={[styles.pillText, String(sourceClassId) === String(c.id) && styles.pillTextActive]}>
                    Class {c.name} {c.section ? `(${c.section})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Target Session & Class */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TARGET PROMOTION GOAL</Text>

            <Text style={styles.fieldLabel}>New Target Session</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {sessions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.pill, targetSession === s && styles.pillActiveGreen]}
                  onPress={() => setTargetSession(s)}
                >
                  <Text style={[styles.pillText, targetSession === s && styles.pillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Target Next Class (Promoting To)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {classes.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, String(targetClassId) === String(c.id) && styles.pillActiveGreen]}
                  onPress={() => setTargetClassId(String(c.id))}
                >
                  <Text style={[styles.pillText, String(targetClassId) === String(c.id) && styles.pillTextActive]}>
                    Class {c.name} {c.section ? `(${c.section})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLoadPreview}
            disabled={loadingPreview}
            activeOpacity={0.8}
          >
            {loadingPreview ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Load Promotion Preview</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* STEP 2: REVIEW ROSTER & EXECUTE */
        <View style={styles.flex1}>
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: '#15803d' }]}>{stats.promote}</Text>
              <Text style={styles.statLbl}>Promote</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: '#dc2626' }]}>{stats.detain}</Text>
              <Text style={styles.statLbl}>Detain</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: '#64748b' }]}>{stats.left}</Text>
              <Text style={styles.statLbl}>Left</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: '#0b57d0' }]}>{stats.total}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
          </View>

          {/* Quick Bulk Actions */}
          <View style={styles.bulkRow}>
            <Text style={styles.bulkLabel}>Bulk Apply:</Text>
            <TouchableOpacity style={styles.bulkBtn} onPress={() => bulkSetAction('PROMOTE')}>
              <Text style={[styles.bulkBtnText, { color: '#15803d' }]}>All Promote</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkBtn} onPress={() => bulkSetAction('DETAIN')}>
              <Text style={[styles.bulkBtnText, { color: '#dc2626' }]}>All Detain</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Filter */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search student by name or admission..."
              placeholderTextColor="#94a3b8"
              value={searchFilter}
              onChangeText={setSearchFilter}
            />
          </View>

          {/* Student Review List */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredRoster.map(s => {
              const actionObj = studentActions[s.student_id] || { action: 'PROMOTE' };
              const cfg = ACTION_COLORS[actionObj.action] || ACTION_COLORS.PROMOTE;

              return (
                <View key={s.student_id} style={styles.rosterCard}>
                  <View style={styles.rosterCardTop}>
                    <View style={styles.rosterInfo}>
                      <Text style={styles.rosterName}>{s.student_name}</Text>
                      <Text style={styles.rosterMeta}>
                        Adm: {s.admission_no} • Current Roll: {s.current_roll_no || '—'}
                      </Text>
                      {s.has_conflict ? (
                        <View style={styles.conflictBadge}>
                          <Ionicons name="warning" size={12} color="#b45309" />
                          <Text style={styles.conflictText}>{s.conflict_reason || 'Grade threshold issue'}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* 1-Tap Action Cycler */}
                    <TouchableOpacity
                      style={[styles.actionTag, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                      onPress={() => cycleAction(s.student_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionTagText, { color: cfg.text }]}>{cfg.label}</Text>
                      <Ionicons name="sync" size={12} color={cfg.text} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Fixed Execute Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.executeBtn}
              onPress={handleConfirmPromotion}
              disabled={executing}
              activeOpacity={0.8}
            >
              {executing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.executeBtnText}>Execute Batch Promotion</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#bfdbfe',
    marginTop: 1,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  pillScroll: {
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  pillActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  actionBtn: {
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  bulkLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  bulkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1e293b',
  },
  rosterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rosterCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rosterInfo: {
    flex: 1,
    marginRight: 10,
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  rosterMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  conflictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  conflictText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '600',
  },
  actionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 4,
  },
  executeBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  executeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
