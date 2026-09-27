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
const SESSIONS = ['2024-25', '2025-26', '2026-27'];
const SUBJECT_COLORS = [
  '#0b57d0', '#16a34a', '#d97706', '#dc2626', '#9333ea',
  '#0284c7', '#ea580c', '#65a30d', '#db2777', '#4f46e5',
];

const TIME_PRESETS = [
  { start: '08:00 AM', end: '08:45 AM' },
  { start: '08:45 AM', end: '09:30 AM' },
  { start: '09:30 AM', end: '10:15 AM' },
  { start: '10:15 AM', end: '11:00 AM' },
  { start: '11:30 AM', end: '12:15 PM' },
  { start: '12:15 PM', end: '01:00 PM' },
  { start: '01:00 PM', end: '01:45 PM' },
  { start: '01:45 PM', end: '02:30 PM' },
];

export default function TimetableScreen({ navigation, route }) {
  const { user } = useAuth();
  const role = user?.role ? String(user.role).toUpperCase() : 'STUDENT';
  const isStaff = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const isPrincipal = ['PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  // Active view tab: 'class' or 'teacher'
  const [activeTab, setActiveTab] = useState('class');

  // Active day — defaults to today's day of week
  const todayIdx = new Date().getDay(); // 0 is Sunday
  const defaultDay = todayIdx >= 1 && todayIdx <= 6 ? DAYS[todayIdx - 1] : 'MON';
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  // Class Selection (Staff)
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(route?.params?.selectedClassId || null);

  // Timetable List & Active Timetable
  const [timetables, setTimetables] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Timetable Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createClassId, setCreateClassId] = useState('');
  const [createSession, setCreateSession] = useState('2025-26');
  const [createTitle, setCreateTitle] = useState('Weekly Timetable');
  const [creatingTt, setCreatingTt] = useState(false);

  // Add / Edit Period Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPeriodNo, setEditingPeriodNo] = useState(1);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [modalSubjectId, setModalSubjectId] = useState('');
  const [modalTeacherId, setModalTeacherId] = useState('');
  const [modalRoom, setModalRoom] = useState('');
  const [modalStartTime, setModalStartTime] = useState('09:00 AM');
  const [modalEndTime, setModalEndTime] = useState('09:45 AM');
  const [modalIsBreak, setModalIsBreak] = useState(false);
  const [modalBreakLabel, setModalBreakLabel] = useState('Lunch Break');
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(false);

  // Teacher Schedule View State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [teacherSchedule, setTeacherSchedule] = useState({});
  const [loadingTeacherSchedule, setLoadingTeacherSchedule] = useState(false);

  useEffect(() => {
    if (route?.params?.selectedClassId) {
      setSelectedClassId(route.params.selectedClassId);
    }
  }, [route?.params?.selectedClassId]);

  // 1. Load Classes & Aux Data
  const loadClasses = useCallback(async () => {
    if (!isStaff) return;
    try {
      const res = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
        setCreateClassId(String(list[0].id));
      }
    } catch {
      setClasses([]);
    }
  }, [isStaff, selectedClassId]);

  const loadAuxData = useCallback(async () => {
    if (!isStaff) return;
    try {
      const [subRes, tchRes] = await Promise.all([
        client.get('/principal/subjects').catch(() => ({ data: [] })),
        client.get('/principal/teachers').catch(() => ({ data: [] })),
      ]);
      const subList = Array.isArray(subRes.data) ? subRes.data : subRes.data?.subjects || [];
      const tchList = Array.isArray(tchRes.data) ? tchRes.data : tchRes.data?.teachers || [];
      setSubjects(subList);
      setTeachers(tchList);
      if (tchList.length > 0 && !selectedTeacherId) {
        setSelectedTeacherId(String(tchList[0].id));
      }
    } catch {
      // ignore
    }
  }, [isStaff, selectedTeacherId]);

  // 2. Load Timetable & Periods with real-time state update
  const loadTimetable = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      if (isStaff && selectedClassId) {
        const ttRes = await client.get('/principal/timetables', {
          params: { class_id: selectedClassId },
        }).catch(() => ({ data: [] }));

        const ttList = Array.isArray(ttRes.data) ? ttRes.data : [];
        setTimetables(ttList);

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
      } else if (!isStaff) {
        // Student Timetable
        const res = await client.get('/student/timetable').catch(() => ({ data: null }));
        const pList = Array.isArray(res.data) ? res.data : (res.data?.periods || res.data?.schedule || []);
        setPeriods(pList);
        setTimetable(res.data?.timetable || { title: 'Class Timetable', status: 'PUBLISHED' });
      } else if (role === 'TEACHER' && !selectedClassId) {
        const res = await client.get('/teacher/timetable').catch(() => ({ data: null }));
        const pList = Array.isArray(res.data) ? res.data : (res.data?.periods || res.data?.schedule || []);
        setPeriods(pList);
        setTimetable(res.data?.timetable || { title: 'My Teaching Schedule', status: 'PUBLISHED' });
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

  // 3. Load Teacher Schedule for Teacher-wise tab
  const loadTeacherSchedule = useCallback(async () => {
    if (!selectedTeacherId) return;
    setLoadingTeacherSchedule(true);
    try {
      const res = await client.get('/principal/timetables').catch(() => ({ data: [] }));
      const allTimetables = Array.isArray(res.data) ? res.data : [];
      const published = allTimetables.filter(t => t.status === 'PUBLISHED');

      const allPeriods = [];
      for (const tt of published) {
        try {
          const pRes = await client.get(`/principal/timetables/${tt.id}/periods`);
          const pData = Array.isArray(pRes.data) ? pRes.data : [];
          pData.forEach(p => {
            if (String(p.teacher_id) === String(selectedTeacherId)) {
              const cls = classes.find(c => c.id === tt.class_id);
              allPeriods.push({
                ...p,
                class_name: cls ? `${cls.name} ${cls.section || ''}`.trim() : (tt.class_name || 'Class'),
              });
            }
          });
        } catch {
          // ignore single timetable error
        }
      }

      // Group by day and period_no
      const grid = {};
      allPeriods.forEach(p => {
        const dayUpper = String(p.day).toUpperCase();
        if (!grid[dayUpper]) grid[dayUpper] = {};
        grid[dayUpper][p.period_no] = p;
      });
      setTeacherSchedule(grid);
    } catch {
      setTeacherSchedule({});
    } finally {
      setLoadingTeacherSchedule(false);
    }
  }, [selectedTeacherId, classes]);

  useEffect(() => {
    if (activeTab === 'teacher') {
      loadTeacherSchedule();
    }
  }, [activeTab, loadTeacherSchedule]);

  // Filter periods for the active selected day in Class View
  const dayPeriods = useMemo(() => {
    return periods
      .filter(p => String(p.day).toUpperCase() === selectedDay)
      .sort((a, b) => (a.period_no || 0) - (b.period_no || 0));
  }, [periods, selectedDay]);

  // Auto-fill subject teacher when subject changes
  const handleSelectSubject = (subId) => {
    setModalSubjectId(subId);
    const sub = subjects.find(s => String(s.id) === String(subId));
    if (sub?.teacher_id) {
      setModalTeacherId(String(sub.teacher_id));
    }
  };

  // Open Add/Edit Slot Modal
  const openEditSlot = (periodNo) => {
    const existing = dayPeriods.find(p => p.period_no === periodNo);
    setEditingPeriodNo(periodNo);
    const preset = TIME_PRESETS[periodNo - 1] || { start: '09:00 AM', end: '09:45 AM' };

    if (existing) {
      setEditingPeriodId(existing.id || null);
      setModalSubjectId(existing.subject_id ? String(existing.subject_id) : '');
      setModalTeacherId(existing.teacher_id ? String(existing.teacher_id) : '');
      setModalRoom(existing.room || '');
      setModalStartTime(existing.start_time || preset.start);
      setModalEndTime(existing.end_time || preset.end);
      setModalIsBreak(Boolean(existing.is_break));
      setModalBreakLabel(existing.break_label || 'Recess / Lunch');
    } else {
      setEditingPeriodId(null);
      const defaultSubId = subjects.length > 0 ? String(subjects[0].id) : '';
      setModalSubjectId(defaultSubId);
      const sub = subjects.find(s => String(s.id) === defaultSubId);
      if (sub?.teacher_id) {
        setModalTeacherId(String(sub.teacher_id));
      } else {
        setModalTeacherId(teachers.length > 0 ? String(teachers[0].id) : '');
      }
      setModalRoom('');
      setModalStartTime(preset.start);
      setModalEndTime(preset.end);
      setModalIsBreak(false);
      setModalBreakLabel('Lunch Break');
    }
    setModalVisible(true);
  };

  // 4. Create Timetable Modal Action (1:1 with Web ERP CreateTimetableModal)
  const handleCreateTimetable = async () => {
    const cid = createClassId || selectedClassId;
    if (!cid) {
      Alert.alert('Selection Required', 'Please select a class for this timetable.');
      return;
    }
    setCreatingTt(true);
    try {
      const res = await client.post('/principal/timetables', {
        class_id: Number(cid),
        session: createSession.trim(),
        title: createTitle.trim() || 'Weekly Timetable',
      });
      const newTt = res.data;
      setTimetables(prev => [newTt, ...prev]);
      setTimetable(newTt);
      setSelectedClassId(Number(cid));
      setPeriods([]);
      setCreateModalVisible(false);
      Alert.alert('Timetable Created', `Timetable initialized for ${createSession}. You can now add periods.`);
      loadTimetable();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create timetable.');
    } finally {
      setCreatingTt(false);
    }
  };

  // 5. Save Period Slot Action (1:1 with Web ERP api.post(/principal/timetables/:id/periods))
  const handleSaveSlot = async () => {
    let ttId = timetable?.id;
    if (!ttId) {
      // Auto-create timetable if not yet initialized
      if (!selectedClassId) {
        Alert.alert('Class Required', 'Please select a class first.');
        return;
      }
      setSavingSlot(true);
      try {
        const newTt = await client.post('/principal/timetables', {
          class_id: selectedClassId,
          session: '2025-26',
          title: 'Weekly Timetable',
        });
        ttId = newTt.data.id;
        setTimetable(newTt.data);
      } catch (err) {
        Alert.alert('Initialization Failed', err.response?.data?.error || 'Could not initialize timetable.');
        setSavingSlot(false);
        return;
      }
    }

    setSavingSlot(true);
    try {
      const payload = {
        day: selectedDay,
        period_no: editingPeriodNo,
        subject_id: modalIsBreak ? null : (modalSubjectId ? Number(modalSubjectId) : null),
        teacher_id: modalIsBreak ? null : (modalTeacherId ? Number(modalTeacherId) : null),
        room: modalRoom.trim() || undefined,
        start_time: modalStartTime.trim(),
        end_time: modalEndTime.trim(),
        is_break: modalIsBreak,
        break_label: modalIsBreak ? modalBreakLabel.trim() : undefined,
      };

      const res = await client.post(`/principal/timetables/${ttId}/periods`, payload);
      const savedSlot = res.data || payload;

      // Real-time state update: replace or append in local periods array
      setPeriods(prev => {
        const next = prev.filter(
          p => !(String(p.day).toUpperCase() === selectedDay && p.period_no === editingPeriodNo)
        );
        const sub = subjects.find(s => String(s.id) === String(modalSubjectId));
        const tch = teachers.find(t => String(t.id) === String(modalTeacherId));
        next.push({
          ...savedSlot,
          id: savedSlot.id || Date.now(),
          day: selectedDay,
          period_no: editingPeriodNo,
          subject_name: sub?.name || 'Subject',
          teacher_name: tch?.name || '',
        });
        return next;
      });

      setModalVisible(false);
      Alert.alert('Slot Saved', `Period ${editingPeriodNo} updated successfully.`);
      loadTimetable();
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Could not save timetable period.');
    } finally {
      setSavingSlot(false);
    }
  };

  // 6. Delete Period Action (1:1 with Web ERP DELETE /principal/timetables/periods/:id)
  const handleDeletePeriod = async (periodId) => {
    if (!periodId) return;
    Alert.alert(
      'Remove Period',
      `Are you sure you want to remove Period ${editingPeriodNo} from ${DAY_LABELS[selectedDay]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingSlot(true);
            try {
              await client.delete(`/principal/timetables/periods/${periodId}`);
              // Real-time local state removal
              setPeriods(prev => prev.filter(p => p.id !== periodId));
              setModalVisible(false);
              Alert.alert('Removed', 'Period slot removed from schedule.');
              loadTimetable();
            } catch (err) {
              Alert.alert('Delete Failed', err.response?.data?.error || 'Could not delete period.');
            } finally {
              setDeletingSlot(false);
            }
          },
        },
      ]
    );
  };

  // 7. Publish / Unpublish Actions (1:1 with Web ERP doPublish & doUnpublish)
  const handlePublishTimetable = async () => {
    if (!timetable?.id) return;
    Alert.alert(
      'Publish Timetable',
      'Publish this timetable? All students and teachers will see this schedule immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            try {
              await client.post(`/principal/timetables/${timetable.id}/publish`);
              setTimetable(prev => ({ ...prev, status: 'PUBLISHED' }));
              Alert.alert('Published', 'Timetable published! Visible across all student & teacher portals.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to publish timetable.');
            }
          },
        },
      ]
    );
  };

  const handleUnpublishTimetable = async () => {
    if (!timetable?.id) return;
    Alert.alert(
      'Unpublish Timetable',
      'Switch timetable to DRAFT? Students will not see updates until republished.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.post(`/principal/timetables/${timetable.id}/unpublish`);
              setTimetable(prev => ({ ...prev, status: 'DRAFT' }));
              Alert.alert('Draft Mode', 'Timetable marked as DRAFT. You can now edit periods.');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to unpublish timetable.');
            }
          },
        },
      ]
    );
  };

  // 8. Delete Entire Timetable Action (1:1 with Web ERP DELETE /principal/timetables/:id)
  const handleDeleteTimetable = async () => {
    if (!timetable?.id) return;
    Alert.alert(
      'Delete Timetable Permanently',
      'Are you sure you want to permanently delete this timetable and all its periods? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/timetables/${timetable.id}`);
              setTimetable(null);
              setPeriods([]);
              Alert.alert('Deleted', 'Timetable deleted successfully.');
              loadTimetable();
            } catch (err) {
              Alert.alert('Delete Failed', err.response?.data?.error || 'Failed to delete timetable.');
            }
          },
        },
      ]
    );
  };

  const selectedClassName = useMemo(() => {
    const c = classes.find(item => item.id === selectedClassId);
    return c ? `${c.name} ${c.section || ''}`.trim() : 'Class';
  }, [classes, selectedClassId]);

  const activeTeacher = useMemo(() => {
    return teachers.find(t => String(t.id) === String(selectedTeacherId));
  }, [teachers, selectedTeacherId]);

  const isPublished = timetable?.status === 'PUBLISHED';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Timetable Management</Text>
            <Text style={styles.headerSub}>
              {activeTab === 'class'
                ? `${selectedClassName} · ${DAY_LABELS[selectedDay]}`
                : `Teacher View · ${activeTeacher?.name || 'Schedule'}`}
            </Text>
          </View>
        </View>

        {/* Header Right Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isPrincipal && (
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => {
                setCreateClassId(selectedClassId ? String(selectedClassId) : (classes[0]?.id ? String(classes[0].id) : ''));
                setCreateModalVisible(true);
              }}
            >
              <Ionicons name="add" size={17} color="#ffffff" />
              <Text style={styles.createBtnText}>+ Timetable</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={() => loadTimetable(true)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="refresh" size={19} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Staff View Tabs (Class-wise vs Teacher-wise parity with Web ERP) */}
      {isStaff && (
        <View style={styles.segmentTabBar}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'class' && styles.segmentTabActive]}
            onPress={() => setActiveTab('class')}
          >
            <Ionicons name="school-outline" size={16} color={activeTab === 'class' ? colors.primary : '#64748b'} />
            <Text style={[styles.segmentTabText, activeTab === 'class' && styles.segmentTabTextActive]}>
              Class-wise
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'teacher' && styles.segmentTabActive]}
            onPress={() => setActiveTab('teacher')}
          >
            <Ionicons name="person-outline" size={16} color={activeTab === 'teacher' ? colors.primary : '#64748b'} />
            <Text style={[styles.segmentTabText, activeTab === 'teacher' && styles.segmentTabTextActive]}>
              Teacher-wise
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 1: CLASS-WISE TIMETABLE VIEW               */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'class' && (
        <>
          {/* Class Selector Carousel (Staff Only) */}
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

          {/* Timetable Header Card (1:1 with Web ERP Timetable Header Bar) */}
          {isStaff && timetable?.id && (
            <View style={styles.ttHeaderCard}>
              <View style={styles.ttHeaderLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.statusBadge, { backgroundColor: isPublished ? '#ecfdf5' : '#fffbeb', borderColor: isPublished ? '#a7f3d0' : '#fde68a' }]}>
                    <View style={[styles.statusDot, { backgroundColor: isPublished ? '#10b981' : '#f59e0b' }]} />
                    <Text style={[styles.statusText, { color: isPublished ? '#059669' : '#d97706' }]}>
                      {isPublished ? 'PUBLISHED' : 'DRAFT'}
                    </Text>
                  </View>
                  <Text style={styles.ttSessionText}>Session: {timetable.session || '2025-26'}</Text>
                </View>
                <Text style={styles.ttCardTitle} numberOfLines={1}>
                  {timetable.title || 'Weekly Timetable'} ({selectedClassName})
                </Text>
                <Text style={styles.ttCardSub}>
                  📌 {periods.length} periods filled across all days
                </Text>
              </View>

              {/* Action Buttons: 1:1 with Web ERP */}
              {isPrincipal && (
                <View style={styles.ttHeaderActions}>
                  {!isPublished ? (
                    <>
                      <TouchableOpacity style={styles.publishBtn} onPress={handlePublishTimetable}>
                        <Ionicons name="megaphone-outline" size={13} color="#ffffff" />
                        <Text style={styles.publishBtnText}>Publish</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteTtBtn} onPress={handleDeleteTimetable}>
                        <Ionicons name="trash-outline" size={13} color="#dc2626" />
                        <Text style={styles.deleteTtBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.unpublishBtn} onPress={handleUnpublishTimetable}>
                        <Ionicons name="pencil" size={13} color="#d97706" />
                        <Text style={styles.unpublishBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.publishBtn} onPress={handlePublishTimetable}>
                        <Ionicons name="refresh-outline" size={13} color="#ffffff" />
                        <Text style={styles.publishBtnText}>Republish</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteTtBtn} onPress={handleDeleteTimetable}>
                        <Ionicons name="trash-outline" size={13} color="#dc2626" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
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

          {/* Periods List */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading class schedule...</Text>
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
                      activeOpacity={isStaff ? 0.75 : 1}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name="pencil-outline" size={17} color="#94a3b8" />
                          {slot.id ? (
                            <TouchableOpacity
                              onPress={() => handleDeletePeriod(slot.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={17} color="#dc2626" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No Periods for {DAY_LABELS[selectedDay]}</Text>
                  <Text style={styles.emptySub}>
                    {timetable?.id
                      ? 'No periods have been added for this day yet.'
                      : 'No timetable created for this class yet.'}
                  </Text>

                  {isStaff && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      {!timetable?.id ? (
                        <TouchableOpacity
                          style={styles.addSlotEmptyBtn}
                          onPress={() => {
                            setCreateClassId(selectedClassId ? String(selectedClassId) : '');
                            setCreateModalVisible(true);
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={18} color="#fff" />
                          <Text style={styles.addSlotEmptyText}>+ Create Timetable</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.addSlotEmptyBtn}
                          onPress={() => openEditSlot(1)}
                        >
                          <Ionicons name="add-circle-outline" size={18} color="#fff" />
                          <Text style={styles.addSlotEmptyText}>+ Add Period 1</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Add Period Slot button at bottom if periods exist and is staff */}
              {isStaff && timetable?.id && dayPeriods.length > 0 && dayPeriods.length < 8 && (
                <TouchableOpacity
                  style={styles.bottomAddSlotBtn}
                  onPress={() => openEditSlot(dayPeriods.length + 1)}
                >
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text style={styles.bottomAddSlotText}>+ Add Period {dayPeriods.length + 1}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB 2: TEACHER-WISE SCHEDULE VIEW              */}
      {/* ═══════════════════════════════════════════════ */}
      {activeTab === 'teacher' && (
        <View style={{ flex: 1 }}>
          {/* Teacher Selector Bar */}
          <View style={styles.teacherSelectorBar}>
            <Text style={styles.teacherSelectLabel}>SELECT TEACHER:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {teachers.map(t => {
                const isSel = String(selectedTeacherId) === String(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teacherChip, isSel && styles.teacherChipActive]}
                    onPress={() => setSelectedTeacherId(String(t.id))}
                  >
                    <Text style={[styles.teacherChipText, isSel && styles.teacherChipTextActive]}>
                      👤 {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Teacher Profile Card */}
          {activeTeacher && (
            <View style={styles.teacherInfoCard}>
              <View style={styles.teacherAvatar}>
                <Text style={styles.teacherAvatarText}>{activeTeacher.name?.charAt(0) || 'T'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teacherNameText}>{activeTeacher.name}</Text>
                <Text style={styles.teacherDesignationText}>{activeTeacher.designation || 'Faculty Member'}</Text>
              </View>
              <TouchableOpacity
                style={styles.reloadTeacherBtn}
                onPress={loadTeacherSchedule}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Day Selector Tabs for Teacher */}
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

          {/* Teacher Day Slots List */}
          {loadingTeacherSchedule ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Compiling teacher schedule...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {PERIODS.map(pNo => {
                const slot = teacherSchedule[selectedDay]?.[pNo];
                if (!slot) {
                  return (
                    <View key={pNo} style={styles.teacherFreeSlotCard}>
                      <View style={styles.periodBadgeFree}>
                        <Text style={styles.periodBadgeFreeText}>P{pNo}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.freeSlotTitle}>Free Period / Preparation</Text>
                        <Text style={styles.freeSlotSub}>No scheduled class</Text>
                      </View>
                    </View>
                  );
                }

                const color = SUBJECT_COLORS[(pNo - 1) % SUBJECT_COLORS.length];
                return (
                  <View key={pNo} style={[styles.periodCard, { borderColor: `${color}66` }]}>
                    <View style={[styles.periodBadge, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.periodBadgeText, { color }]}>P{pNo}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.periodSubject}>{slot.subject_name || 'Subject'}</Text>
                      <Text style={styles.periodTeacher}>🏫 Class: {slot.class_name || 'Assigned Class'}</Text>
                      {(Boolean(slot.start_time) || Boolean(slot.room)) && (
                        <Text style={styles.periodTiming}>
                          {slot.start_time ? `${slot.start_time} - ${slot.end_time || ''}` : ''}
                          {slot.room ? ` · Room ${slot.room}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 1: CREATE TIMETABLE (1:1 with Web ERP)     */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📅 Create Timetable</Text>
                <Text style={styles.modalSubtitle}>Initialize a weekly schedule for a class</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Select Class */}
              <Text style={styles.modalLabel}>Select Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {classes.map(c => {
                    const isSel = String(createClassId) === String(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.modalChip, isSel && styles.modalChipActive]}
                        onPress={() => setCreateClassId(String(c.id))}
                      >
                        <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Select Session */}
              <Text style={styles.modalLabel}>Academic Session</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {SESSIONS.map(s => {
                  const isSel = createSession === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sessionChip, isSel && styles.sessionChipActive]}
                      onPress={() => setCreateSession(s)}
                    >
                      <Text style={[styles.sessionChipText, isSel && styles.sessionChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <Text style={styles.modalLabel}>Timetable Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Weekly Timetable"
                placeholderTextColor="#94a3b8"
                value={createTitle}
                onChangeText={setCreateTitle}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, creatingTt && { opacity: 0.7 }]}
                onPress={handleCreateTimetable}
                disabled={creatingTt}
              >
                {creatingTt ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>+ Create Timetable</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL 2: ADD / EDIT PERIOD SLOT                 */}
      {/* ═══════════════════════════════════════════════ */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {DAY_LABELS[selectedDay]} · Period {editingPeriodNo}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingPeriodId ? 'Edit period slot' : 'Add new period slot'}
                </Text>
              </View>
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
                  {modalIsBreak ? '☕ This is a Recess / Break Slot' : '☕ Mark as Break / Recess'}
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.modalLabel}>Select Subject</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {subjects.map(s => {
                        const isSel = String(modalSubjectId) === String(s.id);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.modalChip, isSel && styles.modalChipActive]}
                            onPress={() => handleSelectSubject(String(s.id))}
                          >
                            <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>{s.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Teacher Selector (with Subject Teacher Indicator) */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.modalLabel}>Assigned Teacher</Text>
                    {modalSubjectId && (() => {
                      const sub = subjects.find(s => String(s.id) === String(modalSubjectId));
                      return sub?.teacher_id ? (
                        <Text style={styles.subjectTeacherBadge}>✓ Auto-selected</Text>
                      ) : null;
                    })()}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {teachers.map(t => {
                        const isSel = String(modalTeacherId) === String(t.id);
                        const isSubTeacher = subjects.find(
                          s => String(s.id) === String(modalSubjectId) && String(s.teacher_id) === String(t.id)
                        );
                        return (
                          <TouchableOpacity
                            key={t.id}
                            style={[styles.modalChip, isSel && styles.modalChipActive]}
                            onPress={() => setModalTeacherId(String(t.id))}
                          >
                            <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>
                              {t.name}{isSubTeacher ? ' ✓' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Room / Venue */}
                  <Text style={styles.modalLabel}>Room / Venue</Text>
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
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
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

              {/* Buttons: Remove (if exists) & Save */}
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 24 }}>
                {editingPeriodId && (
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={() => handleDeletePeriod(editingPeriodId)}
                    disabled={deletingSlot}
                  >
                    {deletingSlot ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={17} color="#dc2626" />
                        <Text style={styles.modalDeleteText}>Remove</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { flex: 1, marginTop: 0, marginBottom: 0 }, savingSlot && { opacity: 0.7 }]}
                  onPress={handleSaveSlot}
                  disabled={savingSlot}
                >
                  {savingSlot ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>💾 Save Period</Text>
                  )}
                </TouchableOpacity>
              </View>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  refreshIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  segmentTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentTabActive: {
    borderBottomColor: colors.primary,
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTabTextActive: {
    color: colors.primary,
  },
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
  ttHeaderCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e9ff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  ttHeaderLeft: { flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  ttSessionText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  ttCardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  ttCardSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  ttHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  publishBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  unpublishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unpublishBtnText: { color: '#d97706', fontSize: 11, fontWeight: '700' },
  deleteTtBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteTtBtnText: { color: '#dc2626', fontSize: 11, fontWeight: '700' },
  dayTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 8,
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
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  addSlotEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addSlotEmptyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  bottomAddSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    marginTop: 6,
  },
  bottomAddSlotText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  teacherSelectorBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  teacherSelectLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 4 },
  teacherChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  teacherChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  teacherChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  teacherChipTextActive: { color: '#ffffff' },
  teacherInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  teacherAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarText: { color: '#7c3aed', fontWeight: '800', fontSize: 16 },
  teacherNameText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  teacherDesignationText: { fontSize: 11, color: '#64748b', marginTop: 1 },
  reloadTeacherBtn: { padding: 8, borderRadius: 8, backgroundColor: '#eff6ff' },
  teacherFreeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  periodBadgeFree: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBadgeFreeText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  freeSlotTitle: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  freeSlotSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  modalSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  subjectTeacherBadge: { fontSize: 11, color: '#10b981', fontWeight: '700' },
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
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  modalChipTextActive: { color: '#ffffff' },
  sessionChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sessionChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  sessionChipTextActive: { color: '#ffffff' },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  modalDeleteText: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
