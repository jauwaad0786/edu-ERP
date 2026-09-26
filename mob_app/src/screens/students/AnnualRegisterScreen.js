// mob_app/src/screens/students/AnnualRegisterScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

const C = {
  primary: '#0b57d0',
  primaryDark: '#0842a0',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

export default function AnnualRegisterScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [houses, setHouses] = useState(['Red', 'Blue', 'Green', 'Yellow']);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Form fields for new session enrollment
  const [targetSession, setTargetSession] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [section, setSection] = useState('A');
  const [rollNumber, setRollNumber] = useState('');
  const [stream, setStream] = useState('General');
  const [house, setHouse] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Load classes and sessions
  const loadMetadata = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [clsRes, sessRes] = await Promise.all([
        client.get('/principal/classes').catch(() => ({ data: [] })),
        client.get('/principal/students/sessions').catch(() => ({ data: {} })),
      ]);

      const clsList = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      setClasses(clsList);
      if (clsList.length > 0 && !targetClassId) {
        setTargetClassId(clsList[0].id);
        setSection(clsList[0].section || 'A');
      }

      const sessData = sessRes.data || {};
      const sessList = sessData.sessions || ['2024-25', '2025-26', '2026-27'];
      setSessions(sessList);
      if (sessData.houses && Array.isArray(sessData.houses)) {
        setHouses(sessData.houses);
      }

      // Default target session: next session after current
      if (sessData.current_session) {
        const curr = sessData.current_session;
        const idx = sessList.indexOf(curr);
        if (idx !== -1 && idx + 1 < sessList.length) {
          setTargetSession(sessList[idx + 1]);
        } else {
          setTargetSession(curr);
        }
      } else if (sessList.length > 0) {
        setTargetSession(sessList[0]);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMeta(false);
    }
  }, [targetClassId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Search existing student
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Search Required', 'Please enter a student name or admission number to search.');
      return;
    }

    setSearching(true);
    try {
      const res = await client.get('/principal/students', {
        params: { search: searchTerm.trim(), per_page: 20 },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.students || res.data?.data || [];
      setSearchResults(list);
      if (list.length === 0) {
        Alert.alert('No Results', `No existing student found matching "${searchTerm.trim()}".`);
      }
    } catch (err) {
      Alert.alert('Search Error', err.response?.data?.error || 'Failed to search students.');
    } finally {
      setSearching(false);
    }
  };

  const handlePickStudent = (stu) => {
    setSelectedStudent(stu);
    setSearchResults([]);
    setRollNumber(stu.roll_no || stu.roll_number || '');
    setHouse(stu.house || '');
    setStream(stu.stream || 'General');

    // Suggest next class if available
    if (stu.class_id && classes.length > 0) {
      const currIdx = classes.findIndex((c) => c.id === stu.class_id);
      if (currIdx !== -1 && currIdx + 1 < classes.length) {
        setTargetClassId(classes[currIdx + 1].id);
        setSection(classes[currIdx + 1].section || 'A');
      } else {
        setTargetClassId(stu.class_id);
        setSection(stu.section || 'A');
      }
    }
  };

  // Submit annual re-registration
  const handleSubmit = async () => {
    if (!selectedStudent) {
      Alert.alert('Selection Required', 'Please search and select a student first.');
      return;
    }
    if (!targetSession || !targetClassId) {
      Alert.alert('Incomplete Form', 'Please choose the target session and class.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        student_id: selectedStudent.id,
        session: targetSession,
        class_id: parseInt(targetClassId, 10),
        section: section || 'A',
        roll_number: rollNumber.trim() || undefined,
        stream: stream || undefined,
        house: house || undefined,
        remarks: remarks.trim() || 'Annual student re-registration',
      };

      const res = await client.post('/principal/students/annual-register', payload);
      Alert.alert(
        'Re-Registration Complete ✓',
        res.data?.message || `${selectedStudent.name} successfully registered for session ${targetSession}!`
      );
      setSelectedStudent(null);
      setSearchTerm('');
      setRollNumber('');
      setRemarks('');
    } catch (err) {
      Alert.alert(
        'Registration Failed',
        err.response?.data?.error || 'Could not complete annual re-registration.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Annual Re-Registration</Text>
          <Text style={styles.headerSub}>Renew enrollments without duplicate accounts</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Find Continuing Student */}
        <Card padding={16}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="search-outline" size={18} color={C.primary} />
            <Text style={styles.cardTitle}>1. Search Continuing Student</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Search by student name, admission number, or roll number.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Rahul Sharma, ADM-2024-001..."
              placeholderTextColor={C.muted}
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={[styles.searchBtn, searching && { opacity: 0.7 }]}
              onPress={handleSearch}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={16} color="#fff" />
                  <Text style={styles.searchBtnText}>Find</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown List */}
          {searchResults.length > 0 && (
            <View style={styles.resultsBox}>
              <Text style={styles.resultsHeader}>Matching Students ({searchResults.length}):</Text>
              {searchResults.map((stu) => (
                <TouchableOpacity
                  key={stu.id}
                  style={styles.resultItem}
                  onPress={() => handlePickStudent(stu)}
                >
                  <View style={styles.resultAvatar}>
                    <Text style={styles.resultAvatarText}>
                      {(stu.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.resultName}>{stu.name}</Text>
                    <Text style={styles.resultMeta}>
                      Adm: #{stu.admission_no || '—'} · Class: {stu.class_name || stu.grade || '—'} ({stu.section || 'A'})
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={20} color={C.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Student Banner */}
          {selectedStudent && (
            <View style={styles.selectedBanner}>
              <View style={styles.selectedAvatar}>
                <Ionicons name="person" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.selectedName}>{selectedStudent.name}</Text>
                <Text style={styles.selectedMeta}>
                  Adm: #{selectedStudent.admission_no || '—'} · Current: {selectedStudent.class_name || '—'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Ionicons name="close-circle" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Step 2: New Session Enrollment Details */}
        <Card padding={16} style={{ marginTop: 14 }}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="calendar-outline" size={18} color={C.primary} />
            <Text style={styles.cardTitle}>2. Target Session & Class</Text>
          </View>

          {/* Target Session Chips */}
          <Text style={styles.inputLabel}>Academic Session *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {sessions.map((sess) => {
              const isSel = targetSession === sess;
              return (
                <TouchableOpacity
                  key={sess}
                  style={[styles.sessionChip, isSel && styles.sessionChipActive]}
                  onPress={() => setTargetSession(sess)}
                >
                  <Text style={[styles.sessionChipText, isSel && styles.sessionChipTextActive]}>
                    {sess}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Target Class Selection */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Target Class *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {classes.map((cls) => {
              const isSel = targetClassId === cls.id;
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classChip, isSel && styles.classChipActive]}
                  onPress={() => {
                    setTargetClassId(cls.id);
                    setSection(cls.section || 'A');
                  }}
                >
                  <Text style={[styles.classChipText, isSel && styles.classChipTextActive]}>
                    {cls.name} ({cls.section || 'A'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Roll Number & Section */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>New Roll Number</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 15"
                placeholderTextColor={C.muted}
                value={rollNumber}
                onChangeText={setRollNumber}
              />
            </View>
            <View style={{ width: 100 }}>
              <Text style={styles.inputLabel}>Section</Text>
              <TextInput
                style={styles.formInput}
                placeholder="A"
                placeholderTextColor={C.muted}
                value={section}
                onChangeText={setSection}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* House & Stream */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>House</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Blue / Tagore"
                placeholderTextColor={C.muted}
                value={house}
                onChangeText={setHouse}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Stream</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Science / General"
                placeholderTextColor={C.muted}
                value={stream}
                onChangeText={setStream}
              />
            </View>
          </View>

          {/* Remarks */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Registration Remarks</Text>
          <TextInput
            style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
            placeholder="e.g. Promoted to Class 6, fees cleared"
            placeholderTextColor={C.muted}
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selectedStudent || saving) && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={!selectedStudent || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Complete Re-Registration</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  cardSubtitle: { fontSize: 12, color: C.muted, marginBottom: 12 },

  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  resultsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 8,
    marginTop: 10,
  },
  resultsHeader: { fontSize: 11, fontWeight: '800', color: C.muted, marginBottom: 6, textTransform: 'uppercase' },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: { fontSize: 12, fontWeight: '800', color: C.primary },
  resultName: { fontSize: 13, fontWeight: '700', color: C.text },
  resultMeta: { fontSize: 11, color: C.muted },

  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  selectedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedName: { fontSize: 14, fontWeight: '800', color: C.primaryDark },
  selectedMeta: { fontSize: 11, color: C.muted, marginTop: 2 },

  inputLabel: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6 },
  chipsScroll: { gap: 8, paddingBottom: 4 },
  sessionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: C.border,
  },
  sessionChipActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  sessionChipText: { fontSize: 12, fontWeight: '700', color: C.text },
  sessionChipTextActive: { color: '#fff' },

  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: C.border,
  },
  classChipActive: { backgroundColor: C.primary, borderColor: C.primaryDark },
  classChipText: { fontSize: 12, fontWeight: '700', color: C.text },
  classChipTextActive: { color: '#fff' },

  formInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: C.text,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
