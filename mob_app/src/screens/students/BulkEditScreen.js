// mob_app/src/screens/students/BulkEditScreen.js
// 100% Feature Parity with Web ERP BulkEditPage.jsx and backend student_lifecycle APIs
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUSES = ['ACTIVE', 'PROMOTED', 'RETAINED', 'GRADUATED', 'WITHDRAWN', 'LEFT'];
const STREAMS = ['General', 'Science (PCM)', 'Science (PCB)', 'Commerce', 'Humanities / Arts'];
const HOUSES = ['Red', 'Blue', 'Green', 'Yellow'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const ACADEMIC_FIELD_OPTIONS = [
  { key: 'section', label: 'Section', values: SECTIONS },
  { key: 'stream',  label: 'Academic Stream', values: STREAMS },
  { key: 'house',   label: 'School House', values: HOUSES },
  { key: 'status',  label: 'Enrollment Status', values: STATUSES },
];

const PERMANENT_FIELD_OPTIONS = [
  { key: 'category',    label: 'Category / Caste', values: CATEGORIES },
  { key: 'blood_group', label: 'Blood Group', values: BLOOD_GROUPS },
  { key: 'religion',    label: 'Religion', values: ['Hinduism', 'Islam', 'Christianity', 'Sikhism', 'Buddhism', 'Jainism', 'Other'] },
  { key: 'nationality', label: 'Nationality', values: ['Indian', 'Other'] },
];

export default function BulkEditScreen({ route, navigation }) {
  const { selectedIds: initialSelectedIds, session: initialSession } = route?.params || {};

  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(initialSession || '2026-27');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedIds, setSelectedIds] = useState(
    new Set(initialSelectedIds ? initialSelectedIds : [])
  );

  // Field type: 'ACADEMIC' | 'PERMANENT'
  const [fieldType, setFieldType] = useState('ACADEMIC');
  const [selectedFieldKey, setSelectedFieldKey] = useState('stream');
  const [selectedValue, setSelectedValue] = useState('');

  // Diff Preview
  const [previewDiff, setPreviewDiff] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [search, setSearch] = useState('');

  // Load Classes & Sessions
  useEffect(() => {
    Promise.all([
      client.get('/principal/classes').catch(() => ({ data: [] })),
      client.get('/principal/students/sessions').catch(() => ({ data: {} })),
    ]).then(([clsRes, sessRes]) => {
      const clsList = Array.isArray(clsRes.data) ? clsRes.data : clsRes.data?.classes || [];
      setClasses(clsList);
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(String(clsList[0].id));
      }

      const sList = sessRes.data?.sessions || [];
      setSessions(sList);
      if (sList.length > 0 && !initialSession) {
        setSession(sList[0]);
      }
    }).catch(() => {});
  }, [initialSession, selectedClassId]);

  // Load Students for Selected Class & Session
  const loadStudents = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    try {
      const res = await client.get('/principal/students', {
        params: { class_id: selectedClassId, session, per_page: 100 },
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.students || res.data?.data || [];
      setStudents(list);
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
    setPreviewDiff(null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
    setPreviewDiff(null);
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

  const availableFieldOptions = fieldType === 'ACADEMIC' ? ACADEMIC_FIELD_OPTIONS : PERMANENT_FIELD_OPTIONS;

  // Generate Preview Diff
  const handleGeneratePreview = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Selection Required', 'Please select at least 1 student to edit.');
      return;
    }
    if (!selectedValue.trim()) {
      Alert.alert('Value Required', 'Please select or enter the new target value.');
      return;
    }

    setLoadingPreview(true);
    try {
      const payload = {
        student_ids: Array.from(selectedIds),
        field: selectedFieldKey,
        value: selectedValue.trim(),
        session: session || '2026-27',
      };

      const res = await client.post('/principal/students/bulk-edit/preview', payload);
      setPreviewDiff(res.data);
    } catch (err) {
      Alert.alert('Preview Error', err.response?.data?.error || 'Could not generate preview diff.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Confirm and Execute Bulk Update
  const handleConfirmBulkEdit = async () => {
    if (!previewDiff) return;

    Alert.alert(
      'Apply Bulk Changes?',
      `Are you sure you want to update ${previewDiff.affected_count || selectedIds.size} student record(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Apply',
          onPress: async () => {
            setExecuting(true);
            try {
              const payload = {
                student_ids: Array.from(selectedIds),
                field: selectedFieldKey,
                value: selectedValue.trim(),
                session: session || '2026-27',
              };

              const res = await client.post('/principal/students/bulk-edit/confirm', payload);
              Alert.alert('Bulk Edit Complete ✓', res.data?.message || 'Selected student records successfully updated!', [
                {
                  text: 'OK',
                  onPress: () => {
                    setPreviewDiff(null);
                    setSelectedIds(new Set());
                    loadStudents();
                  },
                },
              ]);
            } catch (err) {
              Alert.alert('Execution Error', err.response?.data?.error || 'Could not execute bulk edit.');
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
          onPress={() => navigation?.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Students Bulk Edit</Text>
          <Text style={styles.headerSub}>Safe Batch Attribute Updates &amp; Preview</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Filter & Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Target Roster</Text>
          <View style={styles.filterRow}>
            {/* Session Selector */}
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Academic Session</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                {sessions.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.smallChip, session === s && styles.smallChipActive]}
                    onPress={() => setSession(s)}
                  >
                    <Text style={[styles.smallChipText, session === s && styles.smallChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Class Selector */}
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
              {classes.map(c => {
                const isSel = String(selectedClassId) === String(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.smallChip, isSel && styles.smallChipActive]}
                    onPress={() => setSelectedClassId(String(c.id))}
                  >
                    <Text style={[styles.smallChipText, isSel && styles.smallChipTextActive]}>
                      {c.name} - {c.section}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter roster by student name or roll no..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Selection Counter & Select All */}
          <View style={styles.rosterActionBar}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={toggleSelectAll}>
              <Ionicons
                name={selectedIds.size > 0 && selectedIds.size === filteredStudents.length ? 'checkbox' : 'square-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Select All</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
              {selectedIds.size} student{selectedIds.size === 1 ? '' : 's'} selected
            </Text>
          </View>

          {/* Student Checkbox List */}
          {loadingStudents ? (
            <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
          ) : (
            <View style={{ maxHeight: 220 }}>
              <ScrollView nestedScrollEnabled style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                {filteredStudents.map(s => {
                  const isChecked = selectedIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.studentRow, isChecked && { backgroundColor: '#f0f9ff' }]}
                      onPress={() => toggleStudent(s.id)}
                    >
                      <Ionicons
                        name={isChecked ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isChecked ? colors.primary : '#cbd5e1'}
                      />
                      <Text style={styles.rowStudentName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowStudentMeta}>Roll #{s.roll_no || s.roll_number || '—'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Step 2: Attribute to Update */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Choose Field &amp; Target Value</Text>

          {/* Type Toggle: Academic vs Permanent */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeBtn, fieldType === 'ACADEMIC' && styles.typeBtnActive]}
              onPress={() => {
                setFieldType('ACADEMIC');
                setSelectedFieldKey('stream');
                setSelectedValue('');
                setPreviewDiff(null);
              }}
            >
              <Text style={[styles.typeBtnText, fieldType === 'ACADEMIC' && styles.typeBtnTextActive]}>
                Academic Data (Session Only)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, fieldType === 'PERMANENT' && styles.typeBtnActive]}
              onPress={() => {
                setFieldType('PERMANENT');
                setSelectedFieldKey('category');
                setSelectedValue('');
                setPreviewDiff(null);
              }}
            >
              <Text style={[styles.typeBtnText, fieldType === 'PERMANENT' && styles.typeBtnTextActive]}>
                Permanent Profile (All Years)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Field Selection */}
          <Text style={[styles.label, { marginTop: 10 }]}>Select Field to Batch Update</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
            {availableFieldOptions.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.fieldChip, selectedFieldKey === f.key && styles.fieldChipActive]}
                onPress={() => {
                  setSelectedFieldKey(f.key);
                  setSelectedValue('');
                  setPreviewDiff(null);
                }}
              >
                <Text style={[styles.fieldChipText, selectedFieldKey === f.key && styles.fieldChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Preset Value Pickers */}
          <Text style={[styles.label, { marginTop: 8 }]}>Select Target Value</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
            {availableFieldOptions.find(f => f.key === selectedFieldKey)?.values.map(val => (
              <TouchableOpacity
                key={val}
                style={[styles.smallChip, selectedValue === val && styles.smallChipActive]}
                onPress={() => {
                  setSelectedValue(val);
                  setPreviewDiff(null);
                }}
              >
                <Text style={[styles.smallChipText, selectedValue === val && styles.smallChipTextActive]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Custom text input if needed */}
          <TextInput
            style={styles.customValueInput}
            placeholder="Or enter custom value manually..."
            value={selectedValue}
            onChangeText={t => {
              setSelectedValue(t);
              setPreviewDiff(null);
            }}
          />

          <TouchableOpacity
            style={styles.previewBtn}
            onPress={handleGeneratePreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="eye-outline" size={16} color="#ffffff" />
                <Text style={styles.previewBtnText}>Generate Changes Diff Preview</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 3: Diff Preview & Confirm */}
        {previewDiff && (
          <View style={styles.diffCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.diffTitle}>3. Changes Preview ({previewDiff.affected_count} students)</Text>
              <View style={[styles.pill, { backgroundColor: previewDiff.is_academic_year ? '#eff6ff' : '#fef3c7' }]}>
                <Text style={[styles.pillText, { color: previewDiff.is_academic_year ? '#1e40af' : '#b45309' }]}>
                  {previewDiff.field_category}
                </Text>
              </View>
            </View>

            {previewDiff.warning ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={16} color="#b45309" />
                <Text style={styles.warningText}>{previewDiff.warning}</Text>
              </View>
            ) : null}

            <View style={styles.diffTable}>
              <View style={styles.diffHeaderRow}>
                <Text style={[styles.diffColHeader, { flex: 2 }]}>Student</Text>
                <Text style={[styles.diffColHeader, { flex: 1 }]}>Old</Text>
                <Text style={[styles.diffColHeader, { flex: 1 }]}>New</Text>
              </View>
              {previewDiff.preview?.slice(0, 10).map((d, i) => (
                <View key={d.student_id || i} style={styles.diffRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.diffStudentName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.diffStudentMeta}>Adm: {d.admission_no}</Text>
                  </View>
                  <Text style={[styles.diffOldVal, { flex: 1 }]}>{d.old_value || '—'}</Text>
                  <Text style={[styles.diffNewVal, { flex: 1 }]}>{d.new_value}</Text>
                </View>
              ))}
              {previewDiff.preview?.length > 10 && (
                <Text style={styles.moreText}>
                  + {previewDiff.preview.length - 10} more students will be updated
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirmBulkEdit}
              disabled={executing}
            >
              {executing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                  <Text style={styles.confirmBtnText}>Confirm &amp; Apply Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  headerSub: { fontSize: 11, color: '#bfdbfe', marginTop: 1 },
  scrollContent: { padding: 14, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  smallChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallChipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12.5,
    color: '#0f172a',
    paddingVertical: 0,
  },
  rosterActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 8,
  },
  rowStudentName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowStudentMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    marginVertical: 6,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  typeBtnTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  fieldChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  fieldChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: colors.primary,
  },
  fieldChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  fieldChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  customValueInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    color: '#0f172a',
    marginTop: 4,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 12,
  },
  previewBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  diffCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#86efac',
    gap: 10,
  },
  diffTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#15803d',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  warningText: {
    fontSize: 11,
    color: '#92400e',
    flex: 1,
  },
  diffTable: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  diffHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  diffColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  diffStudentName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  diffStudentMeta: {
    fontSize: 10,
    color: '#94a3b8',
  },
  diffOldVal: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
  },
  diffNewVal: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '800',
  },
  moreText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
