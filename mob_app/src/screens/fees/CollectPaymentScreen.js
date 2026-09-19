// mob_app/src/screens/fees/CollectPaymentScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const C = { primary: '#16a34a', green: '#16a34a', warning: '#d97706', error: '#dc2626', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0' };

export default function CollectPaymentScreen() {
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dueRecords, setDueRecords] = useState([]);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [searching, setSearching] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const searchStudent = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelectedStudent(null);
    try {
      const res = await client.get('/principal/fees/student-search', { params: { q: query } });
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setStudents([]);
    } finally {
      setSearching(false);
    }
  };

  const selectStudent = async (stu) => {
    setSelectedStudent(stu);
    try {
      const res = await client.get(`/principal/fees/student-records/${stu.id}`);
      const recs = Array.isArray(res.data) ? res.data : res.data?.records || [];
      const unpaid = recs.filter(r => r.status !== 'PAID');
      setDueRecords(unpaid);
      const totalDue = unpaid.reduce((sum, r) => sum + (r.effective_due ? r.effective_due() : (r.amount_due - (r.amount_paid || 0))), 0);
      setAmount(totalDue > 0 ? String(totalDue) : '');
    } catch {
      setDueRecords([]);
    }
  };

  const handleCollect = async () => {
    if (!selectedStudent || !amount || Number(amount) <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount');
      return;
    }
    setCollecting(true);
    try {
      await client.post('/principal/fees/collect', {
        student_id: selectedStudent.id,
        amount: Number(amount),
        payment_mode: mode,
        remarks: 'Mobile POS collection',
      });
      Alert.alert('Payment Recorded', `Successfully collected ₹${Number(amount).toLocaleString('en-IN')} for ${selectedStudent.name}`);
      setSelectedStudent(null);
      setDueRecords([]);
      setAmount('');
      setQuery('');
      setStudents([]);
    } catch (err) {
      Alert.alert('Collection Error', err.response?.data?.error || 'Failed to collect payment');
    } finally {
      setCollecting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collect Fee</Text>
        <Text style={styles.headerSub}>Mobile Point of Sale (POS)</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Search Student */}
        <View style={styles.card}>
          <Text style={styles.label}>Search Student</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Name or Admission No..."
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={searchStudent}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchStudent} disabled={searching}>
              {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {students.length > 0 && !selectedStudent && (
            <View style={{ marginTop: 10 }}>
              {students.map((s) => (
                <TouchableOpacity key={s.id} style={styles.studentItem} onPress={() => selectStudent(s)}>
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: C.text }}>{s.name}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>Class: {s.class_name || '—'} · Adm: {s.admission_no}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Selected Student Details & Payment form */}
        {selectedStudent && (
          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{selectedStudent.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted }}>Adm #{selectedStudent.admission_no} · Class {selectedStudent.class_name || '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                <Text style={{ fontSize: 12, color: C.error, fontWeight: '700' }}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Amount to Collect (₹)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12, fontSize: 18, fontWeight: '800' }]}
              placeholder="0.00"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.modeRow}>
              {['CASH', 'UPI', 'CARD', 'CHEQUE'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCollect} disabled={collecting}>
              {collecting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="receipt-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Confirm Payment Receipt</Text>
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
  header: { backgroundColor: '#16a34a', padding: 20, paddingTop: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  searchBtn: { backgroundColor: '#16a34a', borderRadius: 10, width: 44, alignItems: 'center', justifyContent: 'center' },
  studentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9' },
  modeBtnActive: { backgroundColor: '#16a34a' },
  modeText: { fontSize: 11, fontWeight: '700', color: C.muted },
  modeTextActive: { color: '#fff' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
