// mob_app/src/screens/students/BulkEditScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function BulkEditScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState('2026-27');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Edit Tab: 'ACADEMIC' | 'DEMOGRAPHIC'
  const [activeTab, setActiveTab] = useState('ACADEMIC');

  // Fields to batch update
  const [rollPrefix, setRollPrefix] = useState('');
  const [stream, setStream] = useState('');
  const [house, setHouse] = useState('');
  const [status, setStatus] = useState('');

  const [category, setCategory] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');

  // Execution
  const [executing, setExecuting] = useState(false);
  const [search, setSearch] = useState('');

  // Load Classes & Sessions
  useEffect(() => {
    client.get('/principal/classes').then(r => {
      const list = Array.isArray(r.data) ? r.data : r.data?.classes || [];
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(String(list[0].id));
      }
    }).catch(() => {});

    client.get('/principal/students/sessions').then(r => {
      const sList = r.data?.sessions || [];
      setSessions(sList);
      if (sList.length > 0) setSession(sList[0]);
    }).catch(() => {});
  }, [selectedClassId]);

  // Load Students for Selected Class
  const loadStudents = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    try {
      const res = await client.get('/principal/students', {
        params: { class_id: selectedClassId, session, per_page: 100 },
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.students || res.data?.data || [];
      setStudents(list);
      setSelectedIds(new Set());
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClassId, session]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const toggleStudent = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.admission_no && s.admission_no.toLowerCase().includes(q)) ||
      (s.roll_no && String(s.roll_no).includes(q))
    );
  }, [students, search]);

  // Execute Batch Update
  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Selection Required', 'Please select at least 1 student to update.');
      return;
    }

    const updates = {};
    if (activeTab === 'ACADEMIC') {
      if (rollPrefix.trim()) updates.roll_number_prefix = rollPrefix.trim();
      if (stream.trim()) updates.stream = stream.trim();
      if (house.trim()) updates.house = house.trim();
      if (status.trim()) updates.status = status.trim();
    } else {
      if (category) updates.category = category;
      if (bloodGroup) updates.blood_group = bloodGroup;
      if (address.trim()) updates.address = address.trim();
    }

    if (Object.keys(updates).length === 0) {
      Alert.alert('No Changes', 'Please enter at least one field value to apply.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Update',
      `Apply these changes to ${selectedIds.size} selected student(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Batch Update',
          onPress: async () => {
            setExecuting(true);
            try {
              const payload = {
                student_ids: Array.from(selectedIds),
                updates,
              };

              const res = await client.post('/principal/students/bulk-edit/confirm', payload).catch(() => {
                return client.post('/principal/students/bulk-update', payload);
              });

              Alert.alert('Success', res.data?.message || 'Students successfully updated!');
              loadStudents();
            } catch (err) {
              Alert.alert('Update Failed', err?.response?.data?.error || 'Failed to update student batch.');
            } finally {
              setExecuting(false);
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
          <Text style={styles.headerTitle}>Bulk Student Edit</Text>
          <Text style={styles.headerSub}>Batch update fields across student roster</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Class Selector */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SELECT CLASS ROSTER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {classes.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pill, String(selectedClassId) === String(c.id) && styles.pillActive]}
                onPress={() => setSelectedClassId(String(c.id))}
              >
                <Text style={[styles.pillText, String(selectedClassId) === String(c.id) && styles.pillTextActive]}>
                  Class {c.name} {c.section ? `(${c.section})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Edit Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'ACADEMIC' && styles.tabBtnActive]}
            onPress={() => setActiveTab('ACADEMIC')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'ACADEMIC' && styles.tabBtnTextActive]}>
              Academic Attributes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'DEMOGRAPHIC' && styles.tabBtnActive]}
            onPress={() => setActiveTab('DEMOGRAPHIC')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'DEMOGRAPHIC' && styles.tabBtnTextActive]}>
              Demographics & KYC
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Fields */}
        <View style={styles.card}>
          {activeTab === 'ACADEMIC' ? (
            <>
              <Text style={styles.fieldLabel}>House Allotment</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Red / Blue / Gandhi / Tagore"
                placeholderTextColor="#94a3b8"
                value={house}
                onChangeText={setHouse}
              />

              <Text style={styles.fieldLabel}>Academic Stream</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Science / Commerce / Arts"
                placeholderTextColor="#94a3b8"
                value={stream}
                onChangeText={setStream}
              />

              <Text style={styles.fieldLabel}>Roll Number Prefix</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 26-X-"
                placeholderTextColor="#94a3b8"
                value={rollPrefix}
                onChangeText={setRollPrefix}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Social Category</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(category === cat ? '' : cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Blood Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {BLOOD_GROUPS.map(bg => (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.chip, bloodGroup === bg && styles.chipActive]}
                    onPress={() => setBloodGroup(bloodGroup === bg ? '' : bg)}
                  >
                    <Text style={[styles.chipText, bloodGroup === bg && styles.chipTextActive]}>{bg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Residential Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Batch address update"
                placeholderTextColor="#94a3b8"
                value={address}
                onChangeText={setAddress}
              />
            </>
          )}
        </View>

        {/* Student Checklist */}
        <View style={styles.card}>
          <View style={styles.rosterHeader}>
            <Text style={styles.cardLabel}>
              STUDENTS TO UPDATE ({selectedIds.size}/{filteredStudents.length})
            </Text>
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={styles.selectAllText}>
                {selectedIds.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingStudents ? (
            <ActivityIndicator size="small" color="#0b57d0" style={{ marginVertical: 16 }} />
          ) : filteredStudents.length === 0 ? (
            <Text style={styles.emptyNote}>No students found in this class.</Text>
          ) : (
            filteredStudents.map(st => {
              const isSelected = selectedIds.has(st.id);
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.studentRow, isSelected && styles.studentRowSelected]}
                  onPress={() => toggleStudent(st.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={isSelected ? '#0b57d0' : '#94a3b8'}
                  />
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{st.name || st.student_name}</Text>
                    <Text style={styles.studentMeta}>
                      Adm: {st.admission_no || '—'} • Roll: {st.roll_no || '—'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={handleBatchUpdate}
          disabled={executing}
          activeOpacity={0.8}
        >
          {executing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="save" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.applyBtnText}>Apply Batch Updates ({selectedIds.size})</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
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
  pillScroll: {
    marginBottom: 4,
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
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#0b57d0',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0b57d0',
    borderColor: '#0b57d0',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  rosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b57d0',
  },
  emptyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  studentRowSelected: {
    backgroundColor: '#eff6ff',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  studentMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
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
  },
  applyBtn: {
    backgroundColor: '#0b57d0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
