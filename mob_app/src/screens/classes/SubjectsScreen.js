// mob_app/src/screens/classes/SubjectsScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const SUBJECT_TYPES = ['THEORY', 'PRACTICAL', 'BOTH'];

export default function SubjectsScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add Subject Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectType, setSubjectType] = useState('THEORY');
  const [creditHours, setCreditHours] = useState('4');
  const [targetClassId, setTargetClassId] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [targetTeacherId, setTargetTeacherId] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('33');
  const [saving, setSaving] = useState(false);

  // Load Data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [subRes, clsRes, tchRes] = await Promise.all([
        client.get('/principal/subjects').catch(() => ({ data: [] })),
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/teachers').catch(() => ({ data: [] })),
      ]);

      const subList = Array.isArray(subRes.data)
        ? subRes.data
        : subRes.data?.subjects || subRes.data?.data || [];
      setSubjects(subList);

      const clsList = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      setClasses(clsList);
      if (clsList.length > 0 && !targetClassId) {
        setTargetClassId(String(clsList[0].id));
      }

      const tList = Array.isArray(tchRes.data) ? tchRes.data : tchRes.data?.teachers || [];
      setTeachers(tList);
    } catch {
      setSubjects([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [targetClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q));

      const matchClass = selectedClassId === 'ALL' ||
        String(s.class_id) === String(selectedClassId) ||
        (Array.isArray(s.class_ids) && s.class_ids.includes(Number(selectedClassId)));

      return matchSearch && matchClass;
    });
  }, [subjects, search, selectedClassId]);

  // Add Subject Submit
  const handleCreateSubject = async () => {
    if (!subjectName.trim()) {
      Alert.alert('Required', 'Please enter a Subject Name.');
      return;
    }

    setSaving(true);
    try {
      await client.post('/principal/subjects', {
        name: subjectName.trim(),
        code: subjectCode.trim() || subjectName.trim().slice(0, 4).toUpperCase(),
        subject_type: subjectType,
        credit_hours: parseInt(creditHours, 10) || 3,
        class_id: targetClassId ? parseInt(targetClassId, 10) : null,
        teacher_id: targetTeacherId ? parseInt(targetTeacherId, 10) : null,
        max_marks: parseInt(maxMarks, 10) || 100,
        pass_marks: parseInt(passMarks, 10) || 33,
      });

      Alert.alert('Subject Added', `Subject "${subjectName.trim()}" successfully created!`);
      setModalVisible(false);
      setSubjectName('');
      setSubjectCode('');
      setTargetTeacherId('');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = (sub) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${sub.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/subjects/${sub.id}`);
              Alert.alert('Deleted', 'Subject deleted successfully.');
              loadData(true);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete subject.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Subject Catalog</Text>
          <Text style={styles.headerSub}>Curriculum subjects & credit allocations</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subjects by name or code..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Class Filter Bar */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedClassId === 'ALL' && styles.filterChipActive]}
            onPress={() => setSelectedClassId('ALL')}
          >
            <Text style={[styles.filterChipText, selectedClassId === 'ALL' && styles.filterChipTextActive]}>
              All Classes
            </Text>
          </TouchableOpacity>
          {classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.filterChip, String(selectedClassId) === String(c.id) && styles.filterChipActive]}
              onPress={() => setSelectedClassId(String(c.id))}
            >
              <Text style={[styles.filterChipText, String(selectedClassId) === String(c.id) && styles.filterChipTextActive]}>
                Class {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subject catalog...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredSubjects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Subjects Found</Text>
              <Text style={styles.emptySub}>No subjects match your filter or search query.</Text>
            </View>
          ) : (
            filteredSubjects.map(sub => {
              const isPractical = sub.subject_type === 'PRACTICAL';
              const isBoth = sub.subject_type === 'BOTH';

              return (
                <View key={sub.id} style={styles.subjectCard}>
                  <View style={styles.subjectTop}>
                    <View style={styles.subjectNameRow}>
                      <Ionicons name="bookmark" size={18} color="#0b57d0" />
                      <Text style={styles.subjectName}>{sub.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.typeBadge, isPractical && styles.practicalBadge, isBoth && styles.bothBadge]}>
                        <Text style={[styles.typeText, isPractical && { color: '#d97706' }, isBoth && { color: '#7c3aed' }]}>
                          {sub.subject_type || 'THEORY'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteSubject(sub)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.subjectMetaRow}>
                    <Text style={styles.metaItem}>Code: <Text style={styles.metaVal}>{sub.code || '—'}</Text></Text>
                    <Text style={styles.metaItem}>Credits: <Text style={styles.metaVal}>{sub.credit_hours || 3} hrs</Text></Text>
                    <Text style={styles.metaItem}>Class: <Text style={styles.metaVal}>{sub.class_name || 'All'}</Text></Text>
                  </View>

                  <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <Text style={styles.metaItem}>
                      Faculty Teacher: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{sub.teacher_name || 'Not assigned'}</Text>
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Subject Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Subject</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }}>
              <Text style={styles.fieldLabel}>Subject Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mathematics / Physics / English"
                placeholderTextColor="#94a3b8"
                value={subjectName}
                onChangeText={setSubjectName}
              />

              <Text style={styles.fieldLabel}>Subject Code</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MATH-10"
                placeholderTextColor="#94a3b8"
                value={subjectCode}
                onChangeText={setSubjectCode}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Subject Type</Text>
              <View style={styles.typeSelectorRow}>
                {SUBJECT_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, subjectType === t && styles.typePillActive]}
                    onPress={() => setSubjectType(t)}
                  >
                    <Text style={[styles.typePillText, subjectType === t && styles.typePillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Target Class Binding</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {classes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.classPill, String(targetClassId) === String(c.id) && styles.classPillActive]}
                    onPress={() => setTargetClassId(String(c.id))}
                  >
                    <Text style={[styles.classPillText, String(targetClassId) === String(c.id) && styles.classPillTextActive]}>
                      Class {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Assign Subject Faculty Teacher</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {teachers.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.classPill, String(targetTeacherId) === String(t.id) && styles.classPillActive]}
                    onPress={() => setTargetTeacherId(String(t.id))}
                  >
                    <Text style={[styles.classPillText, String(targetTeacherId) === String(t.id) && styles.classPillTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Max Marks</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="100"
                    placeholderTextColor="#94a3b8"
                    value={maxMarks}
                    onChangeText={setMaxMarks}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Pass Marks</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="33"
                    placeholderTextColor="#94a3b8"
                    value={passMarks}
                    onChangeText={setPassMarks}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Credit / Teaching Hours per Week</Text>
              <TextInput
                style={styles.input}
                placeholder="3"
                placeholderTextColor="#94a3b8"
                value={creditHours}
                onChangeText={setCreditHours}
                keyboardType="numeric"
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleCreateSubject}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Subject</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
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
  filterWrapper: {
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterChipActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  subjectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  practicalBadge: {
    backgroundColor: '#fef3c7',
  },
  bothBadge: {
    backgroundColor: '#f3e8ff',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0b57d0',
  },
  subjectMetaRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaItem: {
    fontSize: 11,
    color: '#64748b',
  },
  metaVal: {
    fontWeight: '700',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 12,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typePillActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  typePillTextActive: {
    color: '#ffffff',
  },
  classPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  classPillActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  classPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  classPillTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
