// mob_app/src/screens/classes/ClassesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = {
  primary: '#7c3aed',
  green: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

export default function ClassesScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    section: 'A',
    session: '2024-25',
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/principal/classes').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.classes || [];
      setClasses(list);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateClass = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a class name (e.g. 10th, 9th, Prep).');
      return;
    }
    setCreating(true);
    try {
      await client.post('/principal/classes', {
        name: form.name.trim(),
        section: form.section.trim().toUpperCase() || 'A',
        session: form.session.trim() || '2024-25',
      });
      Alert.alert('Success', `Class ${form.name} (${form.section || 'A'}) created successfully.`);
      setShowAddModal(false);
      setForm({ name: '', section: 'A', session: '2024-25' });
      load(true);
    } catch (err) {
      Alert.alert('Creation Failed', err.response?.data?.message || err.response?.data?.error || 'Failed to create class.');
    } finally {
      setCreating(false);
    }
  };

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.section || '').toLowerCase().includes(q) ||
      (c.class_teacher_name || c.teacher_name || '').toLowerCase().includes(q)
    );
  }, [classes, search]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {navigation?.canGoBack?.() && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Classes & Sections</Text>
              <Text style={styles.headerSub}>{classes.length} Academic Batches Configured</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Class</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search class, section, teacher..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Academic Navigation Chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            style={styles.chipBtn}
            onPress={() => navigation?.navigate?.('Subjects')}
          >
            <Ionicons name="book-outline" size={14} color="#ffffff" />
            <Text style={styles.chipBtnText}>Subjects</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chipBtn}
            onPress={() => navigation?.navigate?.('Timetable')}
          >
            <Ionicons name="calendar-outline" size={14} color="#ffffff" />
            <Text style={styles.chipBtnText}>Timetable</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chipBtn}
            onPress={() => navigation?.navigate?.('Curriculum')}
          >
            <Ionicons name="analytics-outline" size={14} color="#ffffff" />
            <Text style={styles.chipBtnText}>Coverage</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredClasses.length > 0 ? (
          filteredClasses.map((cls, i) => (
            <TouchableOpacity
              key={cls.id || i}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate('ClassDetail', { classId: cls.id, className: cls.name });
                }
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="school" size={20} color={C.primary} />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.className}>Class {cls.name} {cls.section ? `(${cls.section})` : ''}</Text>
                    <Text style={styles.sessionText}>Session: {cls.session || '2026-27'}</Text>
                  </View>
                </View>

                <View style={styles.badge}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>
                    {cls.student_count ?? cls.students_count ?? '—'} Students
                  </Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="person-outline" size={15} color={C.muted} style={{ marginRight: 6 }} />
                  <Text style={styles.meta} numberOfLines={1}>
                    Class Teacher: <Text style={{ fontWeight: '700', color: C.text }}>{cls.class_teacher_name || cls.teacher_name || 'Not assigned'}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}
                  onPress={() => navigation?.navigate?.('Students', { selectedClass: cls.name })}
                >
                  <Text style={styles.viewStudentsText}>Students</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="school-outline" size={48} color={C.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>
              {search ? 'No classes match your search' : 'No classes configured'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Class Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Create Academic Class</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Class Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 10th, 9th, 1st, Prep"
              placeholderTextColor="#94a3b8"
              value={form.name}
              onChangeText={(v) => setForm(prev => ({ ...prev, name: v }))}
            />

            <Text style={styles.inputLabel}>Section</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. A, B, C (default: A)"
              placeholderTextColor="#94a3b8"
              value={form.section}
              onChangeText={(v) => setForm(prev => ({ ...prev, section: v }))}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Academic Session</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2024-25"
              placeholderTextColor="#94a3b8"
              value={form.session}
              onChangeText={(v) => setForm(prev => ({ ...prev, session: v }))}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={{ fontWeight: '600', color: '#64748b' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.primary }]}
                onPress={handleCreateClass}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontWeight: '700', color: '#fff' }}>Create Class</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#7c3aed',
    padding: 16,
    paddingTop: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  addBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13, marginLeft: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  sessionText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  meta: { fontSize: 12, color: '#64748b', flex: 1 },
  viewStudentsText: { fontSize: 12, fontWeight: '700', color: '#7c3aed', marginRight: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  chipBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
