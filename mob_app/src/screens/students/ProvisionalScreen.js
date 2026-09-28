// mob_app/src/screens/students/ProvisionalScreen.js
// 100% Feature Parity with Web ERP ProvisionalAdmissionsPage.jsx & backend APIs
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

  // Complete Admission Action Modal
  const [targetStudent, setTargetStudent] = useState(null);
  const [confirming, setConfirming] = useState(false);

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

  // Instant Confirm Admission (Backend endpoint: /principal/students/:id/confirm-admission)
  const handleInstantConfirm = async (stu) => {
    setConfirming(true);
    try {
      const res = await client.post(`/principal/students/${stu.id}/confirm-admission`, {
        session: stu.session || '2026-27',
      });
      Alert.alert(
        'Admission Confirmed!',
        res.data?.message || `${stu.name} has been officially confirmed and enrolled!`
      );
      setTargetStudent(null);
      loadData();
    } catch (err) {
      Alert.alert('Confirmation Failed', err.response?.data?.error || 'Could not confirm admission.');
    } finally {
      setConfirming(false);
    }
  };

  // Cancel Provisional Seat
  const handleCancelApplication = (stu) => {
    Alert.alert(
      'Cancel Provisional Seat',
      `Are you sure you want to cancel the provisional inquiry for ${stu.name}? This will release the held admission.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Seat',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/principal/students/${stu.id}`);
              Alert.alert('Cancelled', 'Provisional seat released.');
              setTargetStudent(null);
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
            <Text style={styles.headerSub}>
              {students.length} Pending Fee Clearance
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New Inquiry</Text>
        </TouchableOpacity>
      </View>

      {/* Warning Notice Banner */}
      <View style={styles.alertBanner}>
        <Ionicons name="time" size={18} color="#b45309" />
        <Text style={styles.alertBannerText}>
          Provisional applicants have temporary PROV- IDs and are excluded from official rosters until fee clearance.
        </Text>
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
                      <Ionicons name="call" size={13} color="#0b57d0" />
                      <Text style={[styles.contactChipText, { color: '#0b57d0' }]}>Call</Text>
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
                      <Ionicons name="logo-whatsapp" size={13} color="#16a34a" />
                      <Text style={[styles.contactChipText, { color: '#16a34a' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.contactChip, { backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1 }]}
                    onPress={() => setTargetStudent(stu)}
                  >
                    <Ionicons name="flash-outline" size={13} color="#b45309" />
                    <Text style={[styles.contactChipText, { color: '#b45309', fontWeight: '800' }]}>
                      Complete Admission →
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.contactChip, { backgroundColor: '#fef2f2' }]}
                    onPress={() => handleCancelApplication(stu)}
                  >
                    <Ionicons name="trash-outline" size={13} color="#dc2626" />
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

      {/* Complete Admission Choice Modal (Matching Web ERP) */}
      {targetStudent && (
        <Modal visible={Boolean(targetStudent)} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: 500 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Complete Admission</Text>
                  <Text style={styles.modalSub}>{targetStudent.name} (#{targetStudent.admission_no})</Text>
                </View>
                <TouchableOpacity onPress={() => setTargetStudent(null)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                {/* Option 1: Collect Fee & Auto Confirm */}
                <TouchableOpacity
                  style={styles.choiceCard}
                  onPress={() => {
                    const st = targetStudent;
                    setTargetStudent(null);
                    navigation.navigate('FeeCollect', { student: st });
                  }}
                >
                  <View style={styles.choiceIconBox}>
                    <Ionicons name="card" size={22} color="#15803d" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>Collect Admission Fee &amp; Auto-Confirm</Text>
                    <Text style={styles.choiceDesc}>
                      Issue official receipt and promote status immediately to Confirmed (Active).
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#15803d" />
                </TouchableOpacity>

                {/* Option 2: Instant Confirm */}
                <TouchableOpacity
                  style={[styles.choiceCard, { borderColor: '#93c5fd', backgroundColor: '#eff6ff' }]}
                  onPress={() => handleInstantConfirm(targetStudent)}
                  disabled={confirming}
                >
                  <View style={[styles.choiceIconBox, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="flash" size={22} color="#1d4ed8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.choiceTitle, { color: '#1d4ed8' }]}>
                      {confirming ? 'Confirming...' : 'Instant Confirm Without Fee'}
                    </Text>
                    <Text style={[styles.choiceDesc, { color: '#2563eb' }]}>
                      Directly clears provisional hold and generates official active student enrollment.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#1d4ed8" />
                </TouchableOpacity>

                {/* Option 3: Complete Dossier */}
                <TouchableOpacity
                  style={[styles.choiceCard, { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }]}
                  onPress={() => {
                    const st = targetStudent;
                    setTargetStudent(null);
                    navigation.navigate('StudentDetail', { student: st, student_id: st.id });
                  }}
                >
                  <View style={[styles.choiceIconBox, { backgroundColor: '#e2e8f0' }]}>
                    <Ionicons name="person" size={22} color="#334155" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.choiceTitle, { color: '#1e293b' }]}>Complete Profile &amp; KYC</Text>
                    <Text style={styles.choiceDesc}>
                      Update student photograph, national ID documents, address, and academic records.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#334155" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
              <View style={styles.classChipsRow}>
                {classes.map(c => {
                  const isSel = String(classId) === String(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.miniClassChip, isSel && styles.miniClassChipActive]}
                      onPress={() => setClassId(String(c.id))}
                    >
                      <Text style={[styles.miniClassChipText, isSel && styles.miniClassChipTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Father's / Guardian's Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Rajesh Sharma"
                placeholderTextColor="#94a3b8"
                value={fatherName}
                onChangeText={setFatherName}
              />

              <Text style={styles.fieldLabel}>Primary Contact Phone (10 digits) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 9876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={parentPhone}
                onChangeText={setParentPhone}
              />

              <Text style={styles.fieldLabel}>Academic Session</Text>
              <TextInput
                style={styles.input}
                value={session}
                onChangeText={setSession}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateInquiry}
                disabled={savingInquiry}
              >
                {savingInquiry ? (
                  <ActivityIndicator color="#fff" />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b57d0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  headerSub: { fontSize: 11, color: '#bfdbfe', marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  alertBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#92400e',
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  chipsBar: { marginVertical: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 20, gap: 10 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  candidateName: { fontSize: 14.5, fontWeight: '700', color: '#0f172a' },
  candidateMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  guardianText: { fontSize: 11.5, color: '#334155', marginTop: 2, fontWeight: '600' },
  provisionalBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  provisionalBadgeText: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap',
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  contactChipText: { fontSize: 11, fontWeight: '700' },
  centerBox: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 13, color: '#64748b', marginTop: 10 },
  emptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0f172a',
  },
  classChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  miniClassChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  miniClassChipActive: { backgroundColor: colors.primary },
  miniClassChipText: { fontSize: 12, color: '#475569' },
  miniClassChipTextActive: { color: '#ffffff', fontWeight: '700' },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitBtnText: { color: '#ffffff', fontSize: 13.5, fontWeight: '700' },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  choiceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTitle: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  choiceDesc: { fontSize: 11, color: '#166534', marginTop: 2 },
});
