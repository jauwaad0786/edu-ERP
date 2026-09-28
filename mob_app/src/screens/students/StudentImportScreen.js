// mob_app/src/screens/students/StudentImportScreen.js
// 100% Feature Parity with Web ERP StudentImportPage.jsx & backend /api/principal/students/import/confirm
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function StudentImportScreen({ navigation }) {
  // Mode: 'table' (Interactive Roster Entry) vs 'csv' (Paste CSV Data)
  const [mode, setMode] = useState('table');
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [session, setSession] = useState('2026-27');
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Table Mode: Quick Entry Rows
  const [rows, setRows] = useState([
    { name: '', roll_number: '', admission_no: '', section: 'A', parent_phone: '', father_name: '' },
    { name: '', roll_number: '', admission_no: '', section: 'A', parent_phone: '', father_name: '' },
    { name: '', roll_number: '', admission_no: '', section: 'A', parent_phone: '', father_name: '' },
  ]);

  // CSV Mode: Raw CSV Paste Text
  const [csvText, setCsvText] = useState(
    'Name,Admission No,Roll No,Class,Section,Parent Phone\nAarav Sharma,ADM2026-101,1,10th,A,9876543210\nAnanya Verma,ADM2026-102,2,10th,A,9876543211'
  );

  const [saving, setSaving] = useState(false);

  // Load classes & sessions
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
      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
      }

      const sList = sessRes.data?.sessions || [];
      setSessions(sList);
      if (sList.length > 0) {
        setSession(sList[0]);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMeta(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

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
      { name: '', roll_number: '', admission_no: '', section: 'A', parent_phone: '', father_name: '' },
    ]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Bulk Import via backend /import/confirm
  const handleImportSubmit = async () => {
    const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

    let importRows = [];

    if (mode === 'table') {
      const valid = rows.filter((r) => r.name.trim() !== '');
      if (valid.length === 0) {
        Alert.alert('No Student Data', 'Please enter at least one student name.');
        return;
      }

      importRows = valid.map((r) => ({
        name: r.name.trim(),
        admission_no: r.admission_no.trim() || undefined,
        roll_number: r.roll_number.trim() || undefined,
        class_name: selectedClass?.name || 'Class',
        section: r.section || selectedClass?.section || 'A',
        session: session,
        parent_phone: r.parent_phone.trim() || undefined,
      }));
    } else {
      // Parse CSV text lines
      const lines = csvText.trim().split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        Alert.alert('CSV Error', 'Please paste CSV content with header and at least 1 data row.');
        return;
      }

      // Check header
      const dataLines = lines[0].toLowerCase().includes('name') ? lines.slice(1) : lines;
      importRows = dataLines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          name: parts[0] || 'Student',
          admission_no: parts[1] || undefined,
          roll_number: parts[2] || undefined,
          class_name: parts[3] || selectedClass?.name || 'Class',
          section: parts[4] || 'A',
          parent_phone: parts[5] || undefined,
          session: session,
        };
      }).filter((r) => r.name && r.name !== 'Student');
    }

    if (importRows.length === 0) {
      Alert.alert('No Valid Data', 'No valid student rows to import.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Import',
      `Import and register ${importRows.length} student records for Session ${session}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute Import',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await client.post('/principal/students/import/confirm', {
                session,
                rows: importRows,
              });

              Alert.alert(
                'Import Succeeded ✓',
                res.data?.message || `Successfully imported ${res.data?.imported_new || importRows.length} student records!`,
                [{ text: 'OK', onPress: () => navigation?.goBack() }]
              );
            } catch (err) {
              Alert.alert('Import Failed', err.response?.data?.error || 'Could not complete bulk import.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Bulk Student Import</Text>
          <Text style={styles.headerSub}>Fast Multi-Student Enrollment</Text>
        </View>
      </View>

      {/* Mode Switcher */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'table' && styles.modeTabActive]}
          onPress={() => setMode('table')}
        >
          <Ionicons name="grid-outline" size={15} color={mode === 'table' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'table' && styles.modeTabTextActive]}>
            Fast Roster Entry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === 'csv' && styles.modeTabActive]}
          onPress={() => setMode('csv')}
        >
          <Ionicons name="document-text-outline" size={15} color={mode === 'csv' ? colors.primary : '#64748b'} />
          <Text style={[styles.modeTabText, mode === 'csv' && styles.modeTabTextActive]}>
            Paste CSV Data
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Session and Class Selectors */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target Academic Class &amp; Session</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Academic Session</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                {sessions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, session === s && styles.chipActive]}
                    onPress={() => setSession(s)}
                  >
                    <Text style={[styles.chipText, session === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.fieldLabel}>Target Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
              {classes.map((c) => {
                const isSel = selectedClassId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, isSel && styles.chipActive]}
                    onPress={() => setSelectedClassId(c.id)}
                  >
                    <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                      {c.name} - {c.section}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Mode 1: Table Entry */}
        {mode === 'table' ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.cardTitle}>Student Entries ({rows.length})</Text>
              <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                <Ionicons name="add" size={16} color="#0b57d0" />
                <Text style={styles.addRowBtnText}>+ Add Row</Text>
              </TouchableOpacity>
            </View>

            {rows.map((row, idx) => (
              <View key={idx} style={styles.entryRowCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.rowBadge}>Student #{idx + 1}</Text>
                  {rows.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(idx)}>
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.rowInputsGrid}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.miniLabel}>Full Legal Name *</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="e.g. Aarav Sharma"
                      value={row.name}
                      onChangeText={(t) => updateRow(idx, 'name', t)}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Roll No</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="101"
                      value={row.roll_number}
                      onChangeText={(t) => updateRow(idx, 'roll_number', t)}
                    />
                  </View>
                </View>

                <View style={styles.rowInputsGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Admission No</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="ADM-001"
                      value={row.admission_no}
                      onChangeText={(t) => updateRow(idx, 'admission_no', t)}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Parent Mobile</Text>
                    <TextInput
                      style={styles.miniInput}
                      placeholder="9876543210"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={row.parent_phone}
                      onChangeText={(t) => updateRow(idx, 'parent_phone', t)}
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addRowBottomBtn} onPress={addRow}>
              <Ionicons name="add-circle-outline" size={18} color="#0b57d0" />
              <Text style={styles.addRowBottomBtnText}>Add Another Student</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Mode 2: Paste CSV */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paste Comma-Separated Data</Text>
            <Text style={styles.subText}>
              Format: Name, Admission No, Roll No, Class, Section, Parent Phone
            </Text>
            <TextInput
              style={styles.csvTextArea}
              multiline
              value={csvText}
              onChangeText={setCsvText}
              placeholder="Paste CSV rows here..."
            />
          </View>
        )}

        {/* Submit Action */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleImportSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>Execute Batch Student Import</Text>
            </>
          )}
        </TouchableOpacity>
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
  modeContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  modeTabActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  scrollContent: { padding: 14, gap: 12, paddingBottom: 40 },
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
  },
  subText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    gap: 2,
  },
  addRowBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0b57d0',
  },
  entryRowCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 6,
    gap: 6,
  },
  rowBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b57d0',
  },
  rowInputsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  miniLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  miniInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: '#0f172a',
  },
  addRowBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    gap: 6,
    marginTop: 6,
  },
  addRowBottomBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0b57d0',
  },
  csvTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    fontFamily: 'monospace',
    height: 160,
    textAlignVertical: 'top',
    color: '#0f172a',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    gap: 6,
  },
  submitBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
});
