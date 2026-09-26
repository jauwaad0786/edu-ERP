// mob_app/src/screens/students/ProvisionalScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function ProvisionalScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');

  // New Provisional Inquiry Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [session, setSession] = useState('2026-27');
  const [savingInquiry, setSavingInquiry] = useState(false);

  // Load Data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [resStu, resCls] = await Promise.all([
        client.get('/principal/students', { params: { status: 'PROVISIONAL', per_page: 50 } }),
        client.get('/principal/classes'),
      ]);

      const raw = resStu.data;
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (raw?.students || []));
      setStudents(list);

      const clsList = Array.isArray(resCls.data) ? resCls.data : (resCls.data?.classes || []);
      setClasses(clsList);
      if (clsList.length > 0 && !classId) {
        setClassId(String(clsList[0].id));
      }
    } catch {
      setStudents([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter students
  const filteredList = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.admission_no && s.admission_no.toLowerCase().includes(q)) ||
        (s.parent_phone && s.parent_phone.includes(q)) ||
        (s.father_name && s.father_name.toLowerCase().includes(q));

      const matchClass = !selectedClassId || String(s.class_id) === String(selectedClassId);
      return matchSearch && matchClass;
    });
  }, [students, search, selectedClassId]);

  // Submit New Provisional Inquiry
  const handleCreateInquiry = async () => {
    if (!fullName.trim() || !parentPhone.trim() || !classId) {
      Alert.alert('Validation Error', 'Please enter Student Name, 10-digit Phone, and select a Class.');
      return;
    }

    setSavingInquiry(true);
    try {
      await client.post('/principal/students', {
        name: fullName.trim(),
        first_name: fullName.trim().split(' ')[0],
        last_name: fullName.trim().split(' ').slice(1).join(' ') || '.',
        class_id: Number(classId),
        section: 'A',
        father_name: fatherName.trim() || 'Parent',
        parent_phone: parentPhone.trim(),
        session: session.trim() || '2026-27',
        status: 'PROVISIONAL',
        password: '12345',
      });

      Alert.alert('Inquiry Registered', `Provisional registration logged for ${fullName.trim()}.`);
      setModalVisible(false);
      setFullName('');
      setFatherName('');
      setParentPhone('');
      loadData();
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.error || 'Could not register inquiry.');
    } finally {
      setSavingInquiry(false);
    }
  };

  // Convert to Full Active Admission
  const handleConfirmAdmission = (stu) => {
    Alert.alert(
      'Confirm Admission',
      `Clear provisional hold and confirm full admission for ${stu.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Collect Fee',
          onPress: () => {
            navigation.navigate('FeeCollect', { student: stu });
          },
        },
      ]
    );
  };

  // Cancel Provisional Seat
  const handleCancelApplication = (stu) => {
    Alert.alert(
      'Cancel Provisional Seat',
      `Are you sure you want to cancel the provisional inquiry for ${stu.name}?`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/students/${stu.id}`);
              Alert.alert('Cancelled', 'Provisional seat released.');
              loadData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Could not release seat.');
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack() && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Provisional Admissions</Text>
            <Text style={styles.headerSub}>Inquiries & Seat Reservations</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New Inquiry</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by candidate name, phone or adm no..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {Boolean(search) && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Class Filter Chips */}
      {classes.length > 0 && (
        <View style={styles.chipsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            <TouchableOpacity
              style={[styles.chip, !selectedClassId && styles.chipActive]}
              onPress={() => setSelectedClassId('')}
            >
              <Text style={[styles.chipText, !selectedClassId && styles.chipTextActive]}>All Classes</Text>
            </TouchableOpacity>
            {classes.map(c => {
              const isSel = String(selectedClassId) === String(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, isSel && styles.chipActive]}
                  onPress={() => setSelectedClassId(String(c.id))}
                >
                  <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Candidate List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching provisional applicants...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredList.length > 0 ? (
            filteredList.map((stu, idx) => (
              <View key={stu.id || idx} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.candidateName}>{stu.name}</Text>
                    <Text style={styles.candidateMeta}>
                      Provisional ID: #{stu.admission_no || stu.id} · Class: {stu.class_name || stu.class?.name || 'Class 1'}
                    </Text>
                    {Boolean(stu.father_name) && (
                      <Text style={styles.guardianText}>Father/Guardian: {stu.father_name}</Text>
                    )}
                  </View>
                  <View style={styles.provisionalBadge}>
                    <Text style={styles.provisionalBadgeText}>PROVISIONAL</Text>
                  </View>
                </View>

                {/* Contact and Actions Row */}
                <View style={styles.actionsRow}>
                  {Boolean(stu.parent_phone) && (
                    <TouchableOpacity
                      style={[styles.contactChip, { backgroundColor: '#eff6ff' }]}
                      onPress={() => Linking.openURL(`tel:${stu.parent_phone}`)}
                    >
                      <Ionicons name="call" size={14} color="#0b57d0" />
                      <Text style={[styles.contactChipText, { color: '#0b57d0' }]}>Call Parent</Text>
                    </TouchableOpacity>
                  )}

                  {Boolean(stu.parent_phone) && (
                    <TouchableOpacity
                      style={[styles.contactChip, { backgroundColor: '#dcfce7' }]}
                      onPress={() => {
                        const num = stu.parent_phone.replace(/\D/g, '');
                        const intl = num.length === 10 ? `91${num}` : num;
                        Linking.openURL(`https://wa.me/${intl}?text=Hello%2C%20regarding%20provisional%20admission%20of%20${encodeURIComponent(stu.name)}`).catch(() => {});
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#16a34a" />
                      <Text style={[styles.contactChipText, { color: '#16a34a' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.contactChip, { backgroundColor: '#fef3c7' }]}
                    onPress={() => handleConfirmAdmission(stu)}
                  >
                    <Ionicons name="checkmark-circle" size={14} color="#d97706" />
                    <Text style={[styles.contactChipText, { color: '#d97706' }]}>Confirm Admission</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.contactChip, { backgroundColor: '#fee2e2' }]}
                    onPress={() => handleCancelApplication(stu)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="person-add-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Provisional Inquiries</Text>
              <Text style={styles.emptySub}>No pending applicant inquiries found. Tap "New Inquiry" to register.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* New Inquiry Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Provisional Inquiry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Applicant Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Ananya Sharma"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.fieldLabel}>Target Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {classes.map(c => {
                    const isSel = String(classId) === String(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.modalChip, isSel && styles.modalChipActive]}
                        onPress={() => setClassId(String(c.id))}
                      >
                        <Text style={[styles.modalChipText, isSel && styles.modalChipTextActive]}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Father / Guardian Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Rajesh Sharma"
                placeholderTextColor="#94a3b8"
                value={fatherName}
                onChangeText={setFatherName}
              />

              <Text style={styles.fieldLabel}>Parent Mobile Number (10 Digits) *</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={parentPhone}
                onChangeText={setParentPhone}
              />

              <Text style={styles.fieldLabel}>Academic Session</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-27"
                placeholderTextColor="#94a3b8"
                value={session}
                onChangeText={setSession}
              />

              <TouchableOpacity
                style={[styles.submitBtn, savingInquiry && { opacity: 0.7 }]}
                onPress={handleCreateInquiry}
                disabled={savingInquiry}
              >
                {savingInquiry ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Register Provisional Seat</Text>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  chipsBar: { paddingVertical: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  candidateName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  candidateMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  guardianText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  provisionalBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  provisionalBadgeText: { fontSize: 10, fontWeight: '800', color: '#d97706' },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactChipText: { fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
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
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: {
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
  modalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalChipActive: { backgroundColor: colors.primary },
  modalChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  modalChipTextActive: { color: '#ffffff' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
