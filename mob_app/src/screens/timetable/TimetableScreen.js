// mob_app/src/screens/timetable/TimetableScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_LABELS = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
};
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const SUBJECT_COLORS = [
  '#0b57d0', '#16a34a', '#d97706', '#dc2626', '#9333ea',
  '#0284c7', '#ea580c', '#65a30d', '#db2777', '#4f46e5',
];

export default function TimetableScreen({ navigation }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isStaff = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  // Active day — defaults to today's day of week
  const todayIdx = new Date().getDay(); // 0 is Sunday
  const defaultDay = todayIdx >= 1 && todayIdx <= 6 ? DAYS[todayIdx - 1] : 'MON';
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  // Class Selection (Staff)
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Timetable & Periods State
  const [timetable, setTimetable] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit Period Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPeriodNo, setEditingPeriodNo] = useState(1);
  const [modalSubjectId, setModalSubjectId] = useState('');
  const [modalTeacherId, setModalTeacherId] = useState('');
  const [modalRoom, setModalRoom] = useState('');
  const [modalStartTime, setModalStartTime] = useState('09:00 AM');
  const [modalEndTime, setModalEndTime] = useState('09:45 AM');
  const [modalIsBreak, setModalIsBreak] = useState(false);
  const [modalBreakLabel, setModalBreakLabel] = useState('Lunch Break');
  const [savingSlot, setSavingSlot] = useState(false);

  // 1. Load Classes (for Staff)
  const loadClasses = useCallback(async () => {
    if (!isStaff) return;
    try {
      const res = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
    } catch {
      setClasses([]);
    }
  }, [isStaff, selectedClassId]);

  // 2. Load Subjects & Teachers (for slot creation)
  const loadAuxData = useCallback(async () => {
    if (!isStaff) return;
    try {
      const [subRes, tchRes] = await Promise.all([
        client.get('/principal/subjects').catch(() => ({ data: [] })),
        client.get('/principal/teachers').catch(() => ({ data: [] })),
      ]);
      setSubjects(Array.isArray(subRes.data) ? subRes.data : subRes.data?.subjects || []);
      setTeachers(Array.isArray(tchRes.data) ? tchRes.data : tchRes.data?.teachers || []);
    } catch {
      // ignore
    }
  }, [isStaff]);

  // 3. Load Timetable & Periods
  const loadTimetable = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isStaff && selectedClassId) {
        // Fetch class timetables
        const ttRes = await client.get('/principal/timetables', {
          params: { class_id: selectedClassId },
        }).catch(() => ({ data: [] }));

        const ttList = Array.isArray(ttRes.data) ? ttRes.data : [];
        if (ttList.length > 0) {
          const currentTt = ttList[0];
          setTimetable(currentTt);

          // Fetch periods for this timetable
          const perRes = await client.get(`/principal/timetables/${currentTt.id}/periods`).catch(() => ({ data: [] }));
          setPeriods(Array.isArray(perRes.data) ? perRes.data : []);
        } else {
          setTimetable(null);
          setPeriods([]);
        }
      } else {
        // Student or Teacher Personal Timetable
        const endpoint = role === 'TEACHER' ? '/teacher/timetable' : '/student/timetable';
        const res = await client.get(endpoint).catch(() => ({ data: null }));
        const pList = Array.isArray(res.data) ? res.data : (res.data?.periods || res.data?.schedule || []);
        setPeriods(pList);
        setTimetable(res.data?.timetable || { title: 'My Schedule', status: 'PUBLISHED' });
      }
    } catch {
      setPeriods([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [isStaff, selectedClassId, role]);

  useEffect(() => {
    loadClasses();
    loadAuxData();
  }, [loadClasses, loadAuxData]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  // Filter periods for the active selected day
  const dayPeriods = useMemo(() => {
    return periods
      .filter(p => String(p.day).toUpperCase() === selectedDay)
      .sort((a, b) => (a.period_no || 0) - (b.period_no || 0));
  }, [periods, selectedDay]);

  // Open Add/Edit Modal
  const openEditSlot = (periodNo) => {
    const existing = dayPeriods.find(p => p.period_no === periodNo);
    setEditingPeriodNo(periodNo);
    if (existing) {
      setModalSubjectId(existing.subject_id ? String(existing.subject_id) : '');
      setModalTeacherId(existing.teacher_id ? String(existing.teacher_id) : '');
      setModalRoom(existing.room || '');
      setModalStartTime(existing.start_time || '09:00 AM');
      setModalEndTime(existing.end_time || '09:45 AM');
      setModalIsBreak(Boolean(existing.is_break));
      setModalBreakLabel(existing.break_label || 'Recess / Lunch');
    } else {
      setModalSubjectId(subjects.length > 0 ? String(subjects[0].id) : '');
      setModalTeacherId(teachers.length > 0 ? String(teachers[0].id) : '');
      setModalRoom('');
      setModalStartTime('09:00 AM');
      setModalEndTime('09:45 AM');
      setModalIsBreak(false);
      setModalBreakLabel('Lunch Break');
    }
    setModalVisible(true);
  };

  // Save Period Slot
  const handleSaveSlot = async () => {
    if (!timetable?.id) {
      // Need to create timetable first if it doesn't exist
      if (!selectedClassId) {
        Alert.alert('Notice', 'Please select a class first.');
        return;
      }
      try {
        setSavingSlot(true);
        const newTt = await client.post('/principal/timetables', {
          class_id: selectedClassId,
          session: '2026-27',
          title: 'Weekly Timetable',
        });
        setTimetable(newTt.data);
        await savePeriodToTt(newTt.data.id);
      } catch (err) {
        Alert.alert('Creation Failed', err.response?.data?.error || 'Could not initialize timetable.');
      } finally {
        setSavingSlot(false);
      }
      return;
    }

    setSavingSlot(true);
    try {
      await savePeriodToTt(timetable.id);
    } finally {
      setSavingSlot(false);
    }
  };

  const savePeriodToTt = async (ttId) => {
    try {
      await client.post(`/principal/timetables/${ttId}/periods`, {
        day: selectedDay,
        period_no: editingPeriodNo,
        subject_id: modalIsBreak ? null : (modalSubjectId ? Number(modalSubjectId) : null),
        teacher_id: modalIsBreak ? null : (modalTeacherId ? Number(modalTeacherId) : null),
        room: modalRoom.trim() || undefined,
        start_time: modalStartTime.trim(),
        end_time: modalEndTime.trim(),
        is_break: modalIsBreak,
        break_label: modalIsBreak ? modalBreakLabel.trim() : undefined,
      });

      setModalVisible(false);
      Alert.alert('Period Saved', `Period ${editingPeriodNo} updated for ${DAY_LABELS[selectedDay]}.`);
      loadTimetable();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Could not save timetable period.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Weekly Timetable</Text>
            <Text style={styles.headerSub}>
              {DAY_LABELS[selectedDay]} Schedule {timetable?.status ? `· ${timetable.status}` : ''}
            </Text>
          </View>
        </View>

        {isStaff && (
          <TouchableOpacity
            style={styles.addPeriodBtn}
            onPress={() => openEditSlot(dayPeriods.length + 1 <= 8 ? dayPeriods.length + 1 : 1)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addPeriodText}>Add Slot</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Class Selector Bar (Staff Only) */}
      {isStaff && classes.length > 0 && (
        <View style={styles.classChipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {classes.map(c => {
              const isSel = selectedClassId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.classChip, isSel && styles.classChipActive]}
                  onPress={() => setSelectedClassId(c.id)}
                >
                  <Text style={[styles.classChipText, isSel && styles.classChipTextActive]}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Day Selector Tabs (MON-SAT) */}
      <View style={styles.dayTabsRow}>
        {DAYS.map(d => {
          const isSel = selectedDay === d;
          return (
            <TouchableOpacity
              key={d}
              style={[styles.dayTabBtn, isSel && styles.dayTabBtnActive]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[styles.dayTabText, isSel && styles.dayTabTextActive]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Period Schedule List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTimetable(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {dayPeriods.length > 0 ? (
            dayPeriods.map((slot, idx) => {
              const pNo = slot.period_no || idx + 1;
              const isBreak = Boolean(slot.is_break);
              const color = SUBJECT_COLORS[(pNo - 1) % SUBJECT_COLORS.length];
              const subName = slot.subject_name || slot.subject?.name || (isBreak ? (slot.break_label || 'Break') : 'Period');
              const tchName = slot.teacher_name || slot.teacher?.name || '';

              return (
                <TouchableOpacity
                  key={slot.id || idx}
                  style={[styles.periodCard, isBreak && styles.breakCard]}
                  onPress={() => isStaff && openEditSlot(pNo)}
                  activeOpacity={isStaff ? 0.7 : 1}
                >
                  <View style={[styles.periodBadge, { backgroundColor: isBreak ? '#fef3c7' : `${color}18` }]}>
                    <Text style={[styles.periodBadgeText, { color: isBreak ? '#d97706' : color }]}>
                      {isBreak ? '☕' : `P${pNo}`}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.periodSubject, isBreak && { color: '#92400e' }]}>{subName}</Text>
                    {Boolean(tchName) && (
                      <Text style={styles.periodTeacher}>👤 {tchName}</Text>
                    )}
                    {(Boolean(slot.start_time) || Boolean(slot.room)) && (
                      <Text style={styles.periodTiming}>
                        {slot.start_time ? `${slot.start_time} - ${slot.end_time || ''}` : ''}
                        {slot.room ? ` · Room ${slot.room}` : ''}
                      </Text>
                    )}
                  </View>

                  {isStaff && (
                    <Ionicons name="pencil-outline" size={16} color="#94a3b8" />
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Periods Scheduled</Text>
              <Text style={styles.emptySub}>No classes assigned for {DAY_LABELS[selectedDay]}.</Text>
              {isStaff && (
                <TouchableOpacity style={styles.addSlotEmptyBtn} onPress={() => openEditSlot(1)}>
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.addSlotEmptyText}>Add Period 1</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add / Edit Period Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {DAY_LABELS[selectedDay]} · Period {editingPeriodNo}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Break toggle */}
              <TouchableOpacity
                style={[styles.breakToggleBtn, modalIsBreak && styles.breakToggleBtnActive]}
                onPress={() => setModalIsBreak(!modalIsBreak)}
              >
                <Ionicons name={modalIsBreak ? 'cafe' : 'cafe-outline'} size={18} color={modalIsBreak ? '#fff' : '#64748b'} />
                <Text style={[styles.breakToggleText, modalIsBreak && styles.breakToggleTextActive]}>
                  {modalIsBreak ? 'This is a Recess / Break Slot' : 'Mark as Break / Recess'}
                </Text>
              </TouchableOpacity>

              {modalIsBreak ? (
                <>
                  <Text style={styles.modalLabel}>Break Label</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Lunch Break, Morning Assembly"
                    placeholderTextColor="#94a3b8"
                    value={modalBreakLabel}
                    onChangeText={setModalBreakLabel}
                  />
                </>
              ) : (
                <>
                  {/* Subject Selector */}
                  <Text style={styles.modalLabel}>Select Subject</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {subjects.map(s => {
                        const isSel = String(modalSubjectId) === String(s.id);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.modalChip, isSel && styles.modalChipActive]}
                            onPress={() => setModalSubjectId(String(s.id))}
                          >
                            <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>{s.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Teacher Selector */}
                  <Text style={styles.modalLabel}>Assigned Teacher</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {teachers.map(t => {
                        const isSel = String(modalTeacherId) === String(t.id);
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={[styles.modalChip, isSel && styles.modalChipActive]}
                            onPress={() => setModalTeacherId(String(t.id))}
                          >
                            <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>{t.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Room Number */}
                  <Text style={styles.modalLabel}>Classroom / Lab Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Room 102 or Physics Lab"
                    placeholderTextColor="#94a3b8"
                    value={modalRoom}
                    onChangeText={setModalRoom}
                  />
                </>
              )}

              {/* Start & End Times */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Start Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="09:00 AM"
                    placeholderTextColor="#94a3b8"
                    value={modalStartTime}
                    onChangeText={setModalStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>End Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="09:45 AM"
                    placeholderTextColor="#94a3b8"
                    value={modalEndTime}
                    onChangeText={setModalEndTime}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingSlot && { opacity: 0.7 }]}
                onPress={handleSaveSlot}
                disabled={savingSlot}
              >
                {savingSlot ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Timetable Slot</Text>
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
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  addPeriodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPeriodText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  classChipsContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  classChipTextActive: { color: '#ffffff' },
  dayTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dayTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  dayTabBtnActive: { backgroundColor: colors.primary },
  dayTabText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  dayTabTextActive: { color: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  breakCard: { backgroundColor: '#fffbeb', borderColor: '#fef3c7' },
  periodBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBadgeText: { fontSize: 14, fontWeight: '900' },
  periodSubject: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  periodTeacher: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  periodTiming: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  addSlotEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  addSlotEmptyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  modalLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  breakToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },
  breakToggleBtnActive: { backgroundColor: '#d97706' },
  breakToggleText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  breakToggleTextActive: { color: '#ffffff' },
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalChipActive: { backgroundColor: colors.primary },
  modalChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  modalChipTextActive: { color: '#ffffff' },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
