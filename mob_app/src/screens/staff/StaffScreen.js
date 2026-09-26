// mob_app/src/screens/staff/StaffScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const ROLE_CATEGORIES = ['All', 'Teaching', 'Admin', 'Support'];

export default function StaffScreen({ navigation }) {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role?.value : String(user?.role || '');
  const isPrincipalOrAdmin = ['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'HR'].includes(role);

  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: '',
    designation: 'Teacher',
  });

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [teaRes, empRes, deptRes] = await Promise.all([
        client.get('/principal/teachers').catch(() => ({ data: [] })),
        client.get('/hrms/employees').catch(() => ({ data: [] })),
        client.get('/hrms/departments').catch(() => ({ data: [] })),
      ]);

      const teaList = Array.isArray(teaRes.data)
        ? teaRes.data
        : teaRes.data?.teachers || teaRes.data?.data || [];

      const empList = Array.isArray(empRes.data)
        ? empRes.data
        : empRes.data?.employees || empRes.data?.staff || [];

      // Combine teachers and employees, avoiding duplicates by id/email
      const map = new Map();
      teaList.forEach(t => {
        map.set(t.id || t.email, {
          ...t,
          category: 'Teaching',
          designation: t.designation || 'Teacher',
        });
      });

      empList.forEach(e => {
        const key = e.id || e.email;
        if (!map.has(key)) {
          const des = (e.designation || e.role || '').toLowerCase();
          const cat = des.includes('teacher') || des.includes('faculty') ? 'Teaching' :
                      des.includes('admin') || des.includes('account') || des.includes('clerk') ? 'Admin' : 'Support';
          map.set(key, { ...e, category: cat });
        }
      });

      setStaffList(Array.from(map.values()));

      const dList = Array.isArray(deptRes.data)
        ? deptRes.data
        : deptRes.data?.departments || deptRes.data?.data || [];
      setDepartments(dList);
    } catch (err) {
      console.warn('Failed to load staff directory:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived departments list
  const departmentOptions = useMemo(() => {
    const dSet = new Set();
    staffList.forEach(s => {
      const d = s.department || s.dept_name;
      if (d) dSet.add(d);
    });
    departments.forEach(d => {
      const name = typeof d === 'string' ? d : d.name;
      if (name) dSet.add(name);
    });
    return ['All', ...Array.from(dSet)];
  }, [staffList, departments]);

  const filteredStaff = useMemo(() => {
    return staffList.filter(s => {
      const name = (s.name || s.user_name || '').toLowerCase();
      const sub = (Array.isArray(s.subjects) ? s.subjects.join(' ') : (s.subject || '')).toLowerCase();
      const empId = (s.employee_id || s.emp_id || '').toLowerCase();
      const dept = s.department || s.dept_name || '';

      const matchesSearch = !search ||
        name.includes(search.toLowerCase()) ||
        sub.includes(search.toLowerCase()) ||
        empId.includes(search.toLowerCase());

      const matchesCat = activeCategory === 'All' || s.category === activeCategory;
      const matchesDept = selectedDept === 'All' || dept.toLowerCase() === selectedDept.toLowerCase();

      return matchesSearch && matchesCat && matchesDept;
    });
  }, [staffList, search, activeCategory, selectedDept]);

  const stats = useMemo(() => {
    const total = staffList.length;
    const teaching = staffList.filter(s => s.category === 'Teaching').length;
    const admin = staffList.filter(s => s.category === 'Admin').length;
    const support = total - teaching - admin;
    return { total, teaching, admin, support };
  }, [staffList]);

  const handleAddStaff = async () => {
    if (!newStaff.name.trim() || !newStaff.email.trim()) {
      Alert.alert('Validation Error', 'Please enter staff name and email address.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/principal/teachers', {
        name: newStaff.name.trim(),
        email: newStaff.email.trim(),
        phone: newStaff.phone.trim() || undefined,
        employee_id: newStaff.employee_id.trim() || undefined,
        department: newStaff.department.trim() || undefined,
        designation: newStaff.designation.trim() || 'Teacher',
      });

      Alert.alert('Success', `Staff member ${newStaff.name} registered successfully.`);
      setShowAddModal(false);
      setNewStaff({ name: '', email: '', phone: '', employee_id: '', department: '', designation: 'Teacher' });
      loadData(true);
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.error || err.response?.data?.message || 'Could not add staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadIdCard = (s) => {
    const url = `${client.defaults.baseURL}/principal/teachers/${s.id}/id-card`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open ID card download link on this device.');
    });
  };

  const AVATAR_BG_COLORS = ['#ede9fe', '#dbeafe', '#fef3c7', '#dcfce7', '#fce7f3', '#e0f2fe'];
  const AVATAR_TEXT_COLORS = ['#7c3aed', '#0b57d0', '#b45309', '#15803d', '#be185d', '#0284c7'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Faculty & Staff Directory</Text>
            <Text style={styles.headerSubtitle}>{staffList.length} Registered Team Members</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.attendanceNavBtn}
            onPress={() => navigation?.navigate?.('StaffAttendance')}
          >
            <Ionicons name="finger-print-outline" size={16} color="#fff" />
            <Text style={styles.attendanceNavBtnText}>Attendance</Text>
          </TouchableOpacity>

          {isPrincipalOrAdmin && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* KPI Stats Ribbon */}
      <View style={styles.statsRibbon}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats.total}</Text>
          <Text style={styles.statLbl}>Total Staff</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#0284c7' }]}>{stats.teaching}</Text>
          <Text style={styles.statLbl}>Teaching</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#7c3aed' }]}>{stats.admin}</Text>
          <Text style={styles.statLbl}>Admin</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#16a34a' }]}>{stats.support}</Text>
          <Text style={styles.statLbl}>Support</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, subject, or employee ID..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryRow}>
        {ROLE_CATEGORIES.map(cat => {
          const sel = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryBtn, sel && styles.categoryBtnActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryBtnText, sel && styles.categoryBtnTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Department Filter Chips */}
      {departmentOptions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deptScroll}
        >
          {departmentOptions.map(d => {
            const sel = selectedDept === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.deptChip, sel && styles.deptChipActive]}
                onPress={() => setSelectedDept(d)}
              >
                <Text style={[styles.deptChipText, sel && styles.deptChipTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Staff List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching staff records...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredStaff.length > 0 ? (
            <View style={{ gap: 10 }}>
              {filteredStaff.map((s, idx) => {
                const name = s.name || s.user_name || 'Staff Member';
                const designation = s.designation || s.subject || 'Faculty';
                const empId = s.employee_id || s.emp_id || `EMP${s.id}`;
                const dept = s.department || s.dept_name || 'General';
                const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                const colorIdx = idx % AVATAR_BG_COLORS.length;

                return (
                  <TouchableOpacity
                    key={s.id || idx}
                    style={styles.staffCard}
                    activeOpacity={0.7}
                    onPress={() => navigation?.navigate?.('StaffDetail', { teacher: s, teacher_id: s.id })}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: AVATAR_BG_COLORS[colorIdx] }]}>
                      <Text style={[styles.avatarText, { color: AVATAR_TEXT_COLORS[colorIdx] }]}>
                        {initials}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.staffName} numberOfLines={1}>{name}</Text>
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>{s.category || 'Staff'}</Text>
                        </View>
                      </View>
                      <Text style={styles.staffDesignation}>{designation} • {dept}</Text>
                      <Text style={styles.staffEmpId}>ID: {empId}</Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.idCardIconBtn}
                        onPress={() => handleDownloadIdCard(s)}
                      >
                        <Ionicons name="card-outline" size={16} color="#059669" />
                      </TouchableOpacity>
                      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyCardTitle}>No Staff Members Found</Text>
              <Text style={styles.emptyCardText}>Try clearing search filters or add a new faculty member.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Staff Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Faculty / Staff</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Dr. Rajesh Kumar"
                placeholderTextColor="#94a3b8"
                value={newStaff.name}
                onChangeText={v => setNewStaff(p => ({ ...p, name: v }))}
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="rajesh@school.edu"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newStaff.email}
                onChangeText={v => setNewStaff(p => ({ ...p, email: v }))}
              />

              <Text style={styles.inputLabel}>Mobile Phone</Text>
              <TextInput
                style={styles.textInput}
                placeholder="+91 98765 43210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={newStaff.phone}
                onChangeText={v => setNewStaff(p => ({ ...p, phone: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Employee Code</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="EMP042"
                    placeholderTextColor="#94a3b8"
                    value={newStaff.employee_id}
                    onChangeText={v => setNewStaff(p => ({ ...p, employee_id: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Department</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Science / Math"
                    placeholderTextColor="#94a3b8"
                    value={newStaff.department}
                    onChangeText={v => setNewStaff(p => ({ ...p, department: v }))}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Designation</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Senior Teacher"
                placeholderTextColor="#94a3b8"
                value={newStaff.designation}
                onChangeText={v => setNewStaff(p => ({ ...p, designation: v }))}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleAddStaff}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.modalSubmitBtnText}>Register Staff Member</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  attendanceNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attendanceNavBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRibbon: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 1 },
  statDivider: { width: 1, backgroundColor: '#f1f5f9' },
  searchWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b', paddingVertical: 0 },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  categoryBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  categoryBtnActive: { backgroundColor: '#0f172a' },
  categoryBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  categoryBtnTextActive: { color: '#fff' },
  deptScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  deptChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deptChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  deptChipText: { fontSize: 11, color: '#475569' },
  deptChipTextActive: { color: '#fff', fontWeight: '600' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  staffCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 16 },
  staffName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  catBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  catBadgeText: { fontSize: 9, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  staffDesignation: { fontSize: 12, color: '#64748b', marginTop: 2 },
  staffEmpId: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  idCardIconBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10 },
  emptyCardText: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 5, marginTop: 10 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  modalSubmitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  modalSubmitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
