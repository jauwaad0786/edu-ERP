// mob_app/src/screens/hr/EmployeesScreen.js
// Institutional Staff & Employee Directory — 100% mirrors Web ERP EmployeeDirectory.jsx
// Handles full staff lifecycle, role classification, contact shortcuts, and new staff onboarding.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const STAFF_ROLES = [
  'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'RECEPTIONIST',
  'HOSTEL', 'TRANSPORT', 'HR', 'VICE_PRINCIPAL', 'DRIVER',
];

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'INTERN'];
const STATUS_OPTIONS = ['ACTIVE', 'PROBATION', 'INACTIVE'];

const EMPTY_EMPLOYEE_FORM = {
  name: '',
  email: '',
  phone: '',
  role: 'TEACHER',
  employee_id: '',
  department: '',
  designation: '',
  salary: '',
  gender: 'MALE',
  employment_type: 'PERMANENT',
  qualification: '',
  experience_years: '0',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  aadhaar_number: '',
};

export default function EmployeesScreen({ navigation }) {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'TEACHER' | 'STAFF'
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [saving, setSaving] = useState(false);

  // Employee Detail Modal
  const [selectedEmp, setSelectedEmp] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const [empRes, deptRes] = await Promise.all([
        client.get('/hrms/employees', { params }).catch(() => ({ data: [] })),
        client.get('/hrms/departments').catch(() => ({ data: [] })),
      ]);

      const empList = Array.isArray(empRes.data)
        ? empRes.data
        : empRes.data?.employees || empRes.data?.staff || empRes.data?.data || [];
      setEmployees(empList);
      setDepartments(deptRes.data || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load employee directory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateEmployee = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      Alert.alert('Required', 'Please enter employee name and valid email address.');
      return;
    }
    try {
      setSaving(true);
      await client.post('/hrms/employees', {
        ...form,
        salary: form.salary ? parseFloat(form.salary) : 0,
      });
      Alert.alert('Employee Created', `${form.name} onboarded successfully!`);
      setShowAddModal(false);
      setForm(EMPTY_EMPLOYEE_FORM);
      loadData();
    } catch (err) {
      Alert.alert('Creation Failed', err.response?.data?.error || err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${clean.length === 10 ? '91' + clean : clean}`);
  };

  const renderEmployee = ({ item }) => {
    const isTeacher = (item.role || '').toUpperCase() === 'TEACHER';
    const isActive = (item.status || 'ACTIVE') === 'ACTIVE';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => setSelectedEmp(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, isTeacher && styles.avatarTeacher]}>
            <Text style={[styles.avatarText, isTeacher && styles.avatarTextTeacher]}>
              {(item.name || item.first_name || 'E')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>{item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim()}</Text>
            <Text style={styles.sub}>
              {item.designation || item.role || 'Staff'} • {item.department || 'General'}
            </Text>
            {item.employee_id ? (
              <Text style={styles.empIdText}>ID: {item.employee_id}</Text>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: isActive ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.badgeText, { color: isActive ? '#15803d' : '#dc2626' }]}>
              {item.status || 'ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactText}>
              <Ionicons name="mail-outline" size={12} color="#64748b" /> {item.email || '—'}
            </Text>
          </View>
          {item.phone || item.mobile_number ? (
            <View style={styles.actionIconGroup}>
              <TouchableOpacity
                style={styles.iconBtnCall}
                onPress={() => handleCall(item.phone || item.mobile_number)}
              >
                <Ionicons name="call" size={13} color="#15803d" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtnWa}
                onPress={() => handleWhatsApp(item.phone || item.mobile_number)}
              >
                <Ionicons name="logo-whatsapp" size={13} color="#059669" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Staff & Faculty Directory</Text>
          <Text style={styles.headerSubtitle}>{employees.length} Institutional Staff Records</Text>
        </View>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.addHeaderBtnText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      {/* Role Type Filter Tabs */}
      <View style={styles.filterBar}>
        {[
          { key: 'ALL', label: 'All Staff' },
          { key: 'TEACHER', label: 'Teachers' },
          { key: 'STAFF', label: 'Non-Teaching' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filterChip, typeFilter === t.key && styles.filterChipActive]}
            onPress={() => setTypeFilter(t.key)}
          >
            <Text style={[styles.filterChipText, typeFilter === t.key && styles.filterChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, designation, department..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#be123c" />
          <Text style={styles.loadingText}>Loading staff directory...</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderEmployee}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Employees Found</Text>
              <Text style={styles.emptySubtitle}>Tap "Add Staff" above to register new teachers or personnel.</Text>
            </View>
          }
        />
      )}

      {/* Add Employee Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Onboard New Employee</Text>
                <Text style={styles.modalSheetSub}>Faculty, administration or support staff</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Full Name */}
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ramesh Kumar Sharma"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              />

              {/* Email & Phone */}
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="email@school.com"
                    placeholderTextColor="#94a3b8"
                    value={form.email}
                    onChangeText={(v) => setForm(f => ({ ...f, email: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    placeholder="10-digit number"
                    placeholderTextColor="#94a3b8"
                    value={form.phone}
                    onChangeText={(v) => setForm(f => ({ ...f, phone: v }))}
                  />
                </View>
              </View>

              {/* Institutional Role Selection */}
              <Text style={styles.fieldLabel}>Institutional Role:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {STAFF_ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, form.role === r && styles.roleChipActive]}
                    onPress={() => setForm(f => ({ ...f, role: r }))}
                  >
                    <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Designation & Department */}
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Designation</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. PGT Mathematics"
                    placeholderTextColor="#94a3b8"
                    value={form.designation}
                    onChangeText={(v) => setForm(f => ({ ...f, designation: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Department</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Science / Admin"
                    placeholderTextColor="#94a3b8"
                    value={form.department}
                    onChangeText={(v) => setForm(f => ({ ...f, department: v }))}
                  />
                </View>
              </View>

              {/* Monthly Salary & Employee ID */}
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Monthly Salary (₹)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 35000"
                    placeholderTextColor="#94a3b8"
                    value={form.salary}
                    onChangeText={(v) => setForm(f => ({ ...f, salary: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Employee Code / ID</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. EMP-104"
                    placeholderTextColor="#94a3b8"
                    value={form.employee_id}
                    onChangeText={(v) => setForm(f => ({ ...f, employee_id: v }))}
                  />
                </View>
              </View>

              {/* Employment Type */}
              <Text style={styles.fieldLabel}>Employment Type:</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {EMPLOYMENT_TYPES.slice(0, 3).map(et => (
                  <TouchableOpacity
                    key={et}
                    style={[styles.typeChip, form.employment_type === et && styles.typeChipActive]}
                    onPress={() => setForm(f => ({ ...f, employment_type: et }))}
                  >
                    <Text style={[styles.typeChipText, form.employment_type === et && styles.typeChipTextActive]}>
                      {et}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bank Details */}
              <Text style={styles.sectionHeader}>Bank & Financial Details</Text>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. SBI / HDFC"
                    placeholderTextColor="#94a3b8"
                    value={form.bank_name}
                    onChangeText={(v) => setForm(f => ({ ...f, bank_name: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Account No"
                    placeholderTextColor="#94a3b8"
                    value={form.account_number}
                    onChangeText={(v) => setForm(f => ({ ...f, account_number: v }))}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                disabled={saving}
                onPress={handleCreateEmployee}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Onboard Employee</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Employee Details Modal */}
      <Modal visible={!!selectedEmp} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalCenterHeader}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{(selectedEmp?.name || 'E')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.modalCenterName}>{selectedEmp?.name}</Text>
                <Text style={styles.modalCenterSub}>{selectedEmp?.designation || selectedEmp?.role}</Text>
                <Text style={styles.modalCenterDept}>{selectedEmp?.department || 'Institution'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEmp(null)}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.detailRow}>
                Email: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{selectedEmp?.email || '—'}</Text>
              </Text>
              <Text style={styles.detailRow}>
                Phone: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{selectedEmp?.phone || selectedEmp?.mobile_number || '—'}</Text>
              </Text>
              <Text style={styles.detailRow}>
                Employee ID: <Text style={{ fontWeight: '600', color: '#be123c' }}>{selectedEmp?.employee_id || 'N/A'}</Text>
              </Text>
              <Text style={styles.detailRow}>
                Employment: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{selectedEmp?.employment_type || 'PERMANENT'}</Text>
              </Text>
              {selectedEmp?.salary ? (
                <Text style={styles.detailRow}>
                  Monthly Salary: <Text style={{ fontWeight: '700', color: '#15803d' }}>₹{selectedEmp?.salary}</Text>
                </Text>
              ) : null}
            </View>

            <View style={styles.modalCenterActions}>
              <TouchableOpacity
                style={styles.modalCallBtn}
                onPress={() => handleCall(selectedEmp?.phone || selectedEmp?.mobile_number)}
              >
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={styles.modalCallBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalWaBtn}
                onPress={() => handleWhatsApp(selectedEmp?.phone || selectedEmp?.mobile_number)}
              >
                <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                <Text style={styles.modalWaBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#be123c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: '#be123c' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTeacher: { backgroundColor: '#e0e7ff' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#be123c' },
  avatarTextTeacher: { color: '#4338ca' },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  empIdText: { fontSize: 10, fontWeight: '700', color: '#be123c', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  contactText: { fontSize: 11, color: '#64748b' },
  actionIconGroup: { flexDirection: 'row', gap: 6 },
  iconBtnCall: { backgroundColor: '#dcfce7', padding: 6, borderRadius: 6 },
  iconBtnWa: { backgroundColor: '#d1fae5', padding: 6, borderRadius: 6 },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#64748b' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#be123c', marginVertical: 8 },
  formRow: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 9,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  roleChipActive: { backgroundColor: '#be123c' },
  roleChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  roleChipTextActive: { color: '#fff' },

  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  typeChipActive: { backgroundColor: '#be123c' },
  typeChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#fff' },

  submitBtn: {
    backgroundColor: '#be123c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalCenterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: { fontSize: 20, fontWeight: '800', color: '#be123c' },
  modalCenterName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalCenterSub: { fontSize: 12, color: '#64748b' },
  modalCenterDept: { fontSize: 11, color: '#be123c', fontWeight: '600' },
  detailBox: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, gap: 6, marginBottom: 14 },
  detailRow: { fontSize: 13, color: '#334155' },
  modalCenterActions: { flexDirection: 'row', gap: 10 },
  modalCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modalCallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalWaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  modalWaBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
