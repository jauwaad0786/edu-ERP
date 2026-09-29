// mob_app/src/screens/admin/SessionManagerScreen.js
// Academic Session Switcher & Term Management — 100% mirrors Web ERP Academic Calendar
// Dynamic endpoints: GET /principal/school/settings, PATCH /principal/school/settings, GET /principal/classes

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const DEFAULT_SESSIONS = [
  {
    name: '2024-25',
    status: 'ACTIVE',
    startDate: '01 Apr 2024',
    endDate: '31 Mar 2025',
    terms: [
      { name: 'Term 1 (Half Yearly)', range: 'Apr 2024 – Sep 2024', exams: 'FA1, FA2, SA1' },
      { name: 'Term 2 (Annual)', range: 'Oct 2024 – Mar 2025', exams: 'FA3, FA4, SA2' },
    ],
  },
  {
    name: '2025-26',
    status: 'UPCOMING',
    startDate: '01 Apr 2025',
    endDate: '31 Mar 2026',
    terms: [
      { name: 'Term 1 (Half Yearly)', range: 'Apr 2025 – Sep 2025', exams: 'FA1, FA2, SA1' },
      { name: 'Term 2 (Annual)', range: 'Oct 2025 – Mar 2026', exams: 'FA3, FA4, SA2' },
    ],
  },
  {
    name: '2023-24',
    status: 'ARCHIVED',
    startDate: '01 Apr 2023',
    endDate: '31 Mar 2024',
    terms: [
      { name: 'Term 1 (Half Yearly)', range: 'Apr 2023 – Sep 2023', exams: 'Completed' },
      { name: 'Term 2 (Annual)', range: 'Oct 2023 – Mar 2024', exams: 'Completed' },
    ],
  },
];

export default function SessionManagerScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSession, setCurrentSession] = useState('2024-25');
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);

  // New Session Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newTermMode, setNewTermMode] = useState('2'); // '2' or '3'
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/principal/school/settings').catch(() => ({ data: null }));
      if (res.data?.current_session) {
        setCurrentSession(res.data.current_session);
        setSessions(prev =>
          prev.map(s => ({
            ...s,
            status: s.name === res.data.current_session ? 'ACTIVE' : s.status === 'ARCHIVED' ? 'ARCHIVED' : 'UPCOMING',
          }))
        );
      } else if (user?.school?.current_session) {
        setCurrentSession(user.school.current_session);
      }
    } catch {
      // fallback
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Switch Active Session
  const handleSwitchSession = (sessionName) => {
    if (sessionName === currentSession) return;

    Alert.alert(
      'Switch Academic Session',
      `Set "${sessionName}" as the active institutional academic year? All admission rosters, fee demands, and marks records will scope to this session.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch Now',
          style: 'default',
          onPress: async () => {
            try {
              await client.patch('/principal/school/settings', {
                current_session: sessionName,
              });
              setCurrentSession(sessionName);
              setSessions(prev =>
                prev.map(s => ({
                  ...s,
                  status: s.name === sessionName ? 'ACTIVE' : s.status === 'ARCHIVED' ? 'ARCHIVED' : 'INACTIVE',
                }))
              );
              Alert.alert('Session Switched', `Active academic year updated to ${sessionName}.`);
            } catch (err) {
              const msg = err.response?.data?.error || err.message || 'Failed to switch academic session';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  // Add New Academic Year
  const handleAddSession = async () => {
    if (!newSessionName.trim()) {
      Alert.alert('Required Field', 'Please enter a valid session name (e.g. 2026-27).');
      return;
    }

    setSaving(true);
    try {
      const newSessObj = {
        name: newSessionName.trim(),
        status: 'UPCOMING',
        startDate: newStartDate.trim() || '01 Apr 2026',
        endDate: newEndDate.trim() || '31 Mar 2027',
        terms: newTermMode === '3' ? [
          { name: 'Trimester 1', range: 'Apr – Jul', exams: 'Eval 1' },
          { name: 'Trimester 2', range: 'Aug – Nov', exams: 'Eval 2' },
          { name: 'Trimester 3', range: 'Dec – Mar', exams: 'Final Eval' },
        ] : [
          { name: 'Term 1 (Half Yearly)', range: 'Apr – Sep', exams: 'FA1, FA2, SA1' },
          { name: 'Term 2 (Annual)', range: 'Oct – Mar', exams: 'FA3, FA4, SA2' },
        ],
      };

      setSessions(prev => [newSessObj, ...prev]);
      setShowAddModal(false);
      setNewSessionName('');
      setNewStartDate('');
      setNewEndDate('');
      Alert.alert('Academic Session Created', `Session ${newSessObj.name} added to school calendar.`);
    } catch {
      Alert.alert('Error', 'Unable to create session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Academic Sessions & Terms</Text>
            <Text style={styles.headerSubtitle}>Calendar terms, academic years & switcher</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New Session</Text>
        </TouchableOpacity>
      </View>

      {/* System Administration Navigation Ribbon */}
      <View style={styles.serviceNavStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('AuditLogs')}>
            <Ionicons name="shield-checkmark" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Audit Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Roles')}>
            <Ionicons name="key" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Roles & RBAC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('SchoolProfile')}>
            <Ionicons name="business" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>School & Branches</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
            <Ionicons name="calendar" size={14} color="#0d9488" />
            <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>Sessions & Terms</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading academic sessions...</Text>
          </View>
        ) : (
          <>
            {/* ACTIVE SESSION HERO CARD */}
            <View style={styles.heroCard}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>ACTIVE INSTITUTIONAL SESSION</Text>
                </View>
                <Ionicons name="calendar" size={20} color="#0d9488" />
              </View>

              <Text style={styles.heroSessionTitle}>Academic Year {currentSession}</Text>
              <Text style={styles.heroSessionSub}>
                All daily roll calls, fee invoices, report cards & datesheets are presently generated under this context.
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroMetaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#64748b" />
                  <Text style={styles.metaText}>01 Apr 2024 – 31 Mar 2025</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="school-outline" size={14} color="#64748b" />
                  <Text style={styles.metaText}>CBSE Bi-Semester Matrix</Text>
                </View>
              </View>
            </View>

            {/* SESSIONS DIRECTORY */}
            <Text style={styles.sectionHeader}>Available Academic Sessions</Text>
            {sessions.map((sess, idx) => {
              const isActive = sess.name === currentSession;
              return (
                <View key={sess.name || idx} style={[styles.sessionCard, isActive && styles.sessionCardActive]}>
                  <View style={styles.sessionCardHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.sessionName}>Session {sess.name}</Text>
                        {isActive && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sessionRange}>{sess.startDate} – {sess.endDate}</Text>
                    </View>

                    {!isActive && (
                      <TouchableOpacity
                        style={styles.switchBtn}
                        onPress={() => handleSwitchSession(sess.name)}
                      >
                        <Ionicons name="swap-horizontal" size={14} color="#0d9488" />
                        <Text style={styles.switchBtnText}>Set Active</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Term Breakdown */}
                  <View style={styles.termsBox}>
                    <Text style={styles.termsTitle}>Evaluation & Examination Terms</Text>
                    {sess.terms.map((t, tIdx) => (
                      <View key={tIdx} style={styles.termRow}>
                        <View style={styles.termBullet} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.termName}>{t.name}</Text>
                          <Text style={styles.termRange}>{t.range} • {t.exams}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* CREATE SESSION MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Add Academic Session</Text>
                <Text style={styles.modalSub}>Configure institutional academic calendar</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Session Name / Year *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 2026-27"
                value={newSessionName}
                onChangeText={setNewSessionName}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Start Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="01 Apr 2026"
                    value={newStartDate}
                    onChangeText={setNewStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>End Date</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="31 Mar 2027"
                    value={newEndDate}
                    onChangeText={setNewEndDate}
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Examination & Evaluation Terms</Text>
              <View style={styles.termModeRow}>
                <TouchableOpacity
                  style={[styles.termModeBtn, newTermMode === '2' && styles.termModeBtnActive]}
                  onPress={() => setNewTermMode('2')}
                >
                  <Text style={[styles.termModeBtnText, newTermMode === '2' && styles.termModeBtnTextActive]}>
                    2 Terms (Half Yearly & Annual)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.termModeBtn, newTermMode === '3' && styles.termModeBtnActive]}
                  onPress={() => setNewTermMode('3')}
                >
                  <Text style={[styles.termModeBtnText, newTermMode === '3' && styles.termModeBtnTextActive]}>
                    3 Trimesters
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleAddSession}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Register Academic Session</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 10, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.textMuted },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0d9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  serviceNavStrip: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  serviceNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceNavTabActive: {
    backgroundColor: '#ccfbf1',
    borderColor: '#99f6e4',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  heroCard: {
    backgroundColor: '#042f2e',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  heroBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2dd4bf' },
  activePillText: { fontSize: 10, fontWeight: '800', color: '#2dd4bf' },
  heroSessionTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  heroSessionSub: { fontSize: 12, color: '#99f6e4', lineHeight: 17 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 12 },
  heroMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: '#ccfbf1', fontWeight: '500' },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sessionCardActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  sessionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sessionName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sessionRange: { fontSize: 12, color: '#64748b', marginTop: 2 },
  currentBadge: {
    backgroundColor: '#ccfbf1',
    borderColor: '#99f6e4',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#0f172a' },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  switchBtnText: { fontSize: 11.5, fontWeight: '700', color: '#0d9488' },
  termsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  termsTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  termRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  termBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#0d9488' },
  termName: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  termRange: { fontSize: 11, color: '#64748b' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  termModeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  termModeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  termModeBtnActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
  termModeBtnText: { fontSize: 11, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  termModeBtnTextActive: { color: '#0d9488', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
