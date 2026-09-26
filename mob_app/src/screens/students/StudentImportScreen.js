// mob_app/src/screens/students/StudentImportScreen.js
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
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  text: '#1e293b',
  muted: '#64748b',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
};

export default function StudentImportScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [session, setSession] = useState('2024-25');
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Manual Quick Entry Rows
  const [rows, setRows] = useState([
    { name: '', roll_number: '', admission_no: '', gender: 'Male', parent_phone: '', father_name: '' },
    { name: '', roll_number: '', admission_no: '', gender: 'Female', parent_phone: '', father_name: '' },
    { name: '', roll_number: '', admission_no: '', gender: 'Male', parent_phone: '', father_name: '' },
  ]);

  const [saving, setSaving] = useState(false);

  // Load classes
  const loadClasses = useCallback(async () => {
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
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
      }

      if (sessRes.data?.current_session) {
        setSession(sessRes.data.current_session);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMeta(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const updateRow = (index, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { name: '', roll_number: '', admission_no: '', gender: 'Male', parent_phone: '', father_name: '' },
    ]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleImportSubmit = async () => {
    if (!selectedClassId) {
      Alert.alert('Class Required', 'Please select the target class first.');
      return;
    }

    const validRows = rows.filter((r) => r.name.trim() !== '');
    if (validRows.length === 0) {
      Alert.alert('No Student Data', 'Please enter at least one student name.');
      return;
    }

    setSaving(true);
    let successCount = 0;
    const errors = [];

    // Submit valid students sequentially or in batch
    for (const r of validRows) {
      try {
        const payload = {
          name: r.name.trim(),
          class_id: selectedClassId,
          roll_number: r.roll_number.trim() || undefined,
          admission_no: r.admission_no.trim() || undefined,
          gender: r.gender,
          parent_phone: r.parent_phone.trim() || undefined,
          father_name: r.father_name.trim() || undefined,
          session: session,
          status: 'ACTIVE',
        };

        await client.post('/principal/students', payload);
        successCount += 1;
      } catch (err) {
        errors.push(`${r.name}: ${err.response?.data?.error || 'Failed'}`);
      }
    }

    setSaving(false);

    if (errors.length === 0) {
      Alert.alert(
        'Import Succeeded ✓',
        `Successfully imported and registered all ${successCount} students!`,
        [{ text: 'OK', onPress: () => (navigation?.goBack ? navigation.goBack() : null) }]
      );
    } else {
      Alert.alert(
        'Partial Import Completed',
        `Imported ${successCount} students. ${errors.length} failed:\n${errors.slice(0, 3).join('\n')}`
      );
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
          <Text style={styles.headerTitle}>Bulk Student Import</Text>
          <Text style={styles.headerSub}>Rapid student registration & enrollment</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Class Selection */}
        <Card padding={16}>
          <Text style={styles.sectionTitle}>1. Target Class & Academic Session</Text>
          <Text style={styles.sectionSub}>All registered students will be assigned to this class.</Text>

          <Text style={styles.inputLabel}>Select Class *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {classes.map((cls) => {
              const isSel = selectedClassId === cls.id;
              return (
                <TouchableOpacity
                  key={cls.id}
                  style={[styles.classChip, isSel && styles.classChipActive]}
                  onPress={() => setSelectedClassId(cls.id)}
                >
                  <Text style={[styles.classChipText, isSel && styles.classChipTextActive]}>
                    {cls.name} ({cls.section || 'A'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.inputLabel}>Session: {session}</Text>
          </View>
        </Card>

        {/* Student Data Entry Rows */}
        <Card padding={16} style={{ marginTop: 14 }}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.sectionTitle}>2. Student Roster ({rows.length} rows)</Text>
            <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addRowBtnText}>Add Row</Text>
            </TouchableOpacity>
          </View>

          {rows.map((row, idx) => (
            <View key={idx} style={styles.rowCard}>
              <View style={styles.rowIndexBox}>
                <Text style={styles.rowIndexText}>#{idx + 1}</Text>
                {rows.length > 1 && (
                  <TouchableOpacity onPress={() => removeRow(idx)}>
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flex: 1, gap: 8 }}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Student Full Name *"
                  placeholderTextColor={C.muted}
                  value={row.name}
                  onChangeText={(val) => updateRow(idx, 'name', val)}
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Roll No."
                    placeholderTextColor={C.muted}
                    value={row.roll_number}
                    onChangeText={(val) => updateRow(idx, 'roll_number', val)}
                  />
                  <TextInput
                    style={[styles.textInput, { flex: 1.5 }]}
                    placeholder="Adm. No. (Optional)"
                    placeholderTextColor={C.muted}
                    value={row.admission_no}
                    onChangeText={(val) => updateRow(idx, 'admission_no', val)}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Father Name"
                    placeholderTextColor={C.muted}
                    value={row.father_name}
                    onChangeText={(val) => updateRow(idx, 'father_name', val)}
                  />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Parent Phone"
                    placeholderTextColor={C.muted}
                    keyboardType="phone-pad"
                    value={row.parent_phone}
                    onChangeText={(val) => updateRow(idx, 'parent_phone', val)}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted }}>Gender:</Text>
                  {['Male', 'Female'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, row.gender === g && styles.genderChipActive]}
                      onPress={() => updateRow(idx, 'gender', g)}
                    >
                      <Text style={[styles.genderChipText, row.gender === g && styles.genderChipTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ))}

          {/* Add more button */}
          <TouchableOpacity style={styles.addMoreBottomBtn} onPress={addRow}>
            <Ionicons name="add-circle-outline" size={18} color={C.primary} />
            <Text style={styles.addMoreBottomBtnText}>Add Another Student</Text>
          </TouchableOpacity>
        </Card>

        {/* Submit Import Action */}
        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.7 }]}
          onPress={handleImportSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Import & Register Students</Text>
            </>
          )}
        </TouchableOpacity>
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

  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  sectionSub: { fontSize: 12, color: C.muted, marginTop: 2, marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', marginBottom: 6 },
  chipsScroll: { gap: 8, paddingBottom: 4 },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: C.border,
  },
  classChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  classChipText: { fontSize: 12, fontWeight: '700', color: C.text },
  classChipTextActive: { color: '#fff' },

  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addRowBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  rowCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    marginBottom: 10,
  },
  rowIndexBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 6,
  },
  rowIndexText: { fontSize: 12, fontWeight: '800', color: C.primary },

  textInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: C.text,
  },
  genderChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
  },
  genderChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  genderChipText: { fontSize: 11, fontWeight: '700', color: C.text },
  genderChipTextActive: { color: '#fff' },

  addMoreBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  addMoreBottomBtnText: { fontSize: 13, fontWeight: '700', color: C.primary },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
