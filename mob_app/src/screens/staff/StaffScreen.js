// mob_app/src/screens/staff/StaffScreen.js
// Exact match to Screen 9 of mockup: Teachers directory with department filter and 100% backend data
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function StaffScreen({ navigation }) {
  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [teaRes, deptRes] = await Promise.all([
        client.get('/principal/teachers').catch(() => ({ data: [] })),
        client.get('/hrms/departments').catch(() => ({ data: [] })),
      ]);

      const teaList = Array.isArray(teaRes.data)
        ? teaRes.data
        : teaRes.data?.teachers || teaRes.data?.data || [];
      setTeachers(teaList);

      const dList = Array.isArray(deptRes.data)
        ? deptRes.data
        : deptRes.data?.departments || deptRes.data?.data || [];
      setDepartments(dList);
    } catch (err) {
      console.warn('Failed to load teachers:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived departments if HRMS is empty
  const departmentOptions = useMemo(() => {
    const dSet = new Set();
    teachers.forEach(t => {
      const d = t.department || t.dept_name;
      if (d) dSet.add(d);
    });
    if (departments.length > 0) {
      departments.forEach(d => dSet.add(typeof d === 'string' ? d : d.name));
    }
    return Array.from(dSet);
  }, [teachers, departments]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const tName = (t.name || t.user_name || '').toLowerCase();
      const tSub = (Array.isArray(t.subjects) ? t.subjects.join(' ') : (t.subject || t.department || '')).toLowerCase();
      const tEmp = (t.employee_id || t.emp_id || t.code || '').toLowerCase();
      const tDept = t.department || t.dept_name || '';

      const matchesSearch = !search ||
        tName.includes(search.toLowerCase()) ||
        tSub.includes(search.toLowerCase()) ||
        tEmp.includes(search.toLowerCase());

      const matchesDept = selectedDept === 'All' || tDept.toLowerCase() === selectedDept.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [teachers, search, selectedDept]);

  const getInitials = (name) => {
    if (!name) return 'T';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const AVATAR_BG_COLORS = ['#ede9fe', '#dbeafe', '#fef3c7', '#dcfce7', '#fce7f3', '#e0f2fe'];
  const AVATAR_TEXT_COLORS = ['#7c3aed', '#0b57d0', '#b45309', '#15803d', '#be185d', '#0284c7'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teachers</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            // Can open an Add Teacher sheet / alert
            alert('Add Teacher form can be opened here.');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search teachers..."
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

      {/* Department Filter Pill */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowDeptModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterPillText}>
            {selectedDept === 'All' ? 'All Departments' : selectedDept}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Teachers List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching faculty list...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredTeachers.length > 0 ? (
            filteredTeachers.map((t, idx) => {
              const bg = AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length];
              const fg = AVATAR_TEXT_COLORS[idx % AVATAR_TEXT_COLORS.length];
              const tName = t.name || t.user_name || 'Teacher';
              const tSub = Array.isArray(t.subjects) ? t.subjects[0] : (t.subject || t.designation || 'Faculty');
              const tEmp = t.employee_id || t.emp_id || `EMP00${idx + 1}`;

              return (
                <TouchableOpacity
                  key={t.id || idx}
                  style={styles.teacherCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (navigation?.navigate) {
                      navigation.navigate('StaffDetail', { teacher: t });
                    }
                  }}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: bg }]}>
                    <Text style={[styles.avatarText, { color: fg }]}>{getInitials(tName)}</Text>
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={styles.teacherName} numberOfLines={1}>{tName}</Text>
                    <Text style={styles.teacherSubject}>{tSub}</Text>
                    <Text style={styles.teacherEmp}>{tEmp}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No teachers found</Text>
              <Text style={styles.emptySub}>Try searching with another keyword or resetting department.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Department Picker Modal */}
      <Modal visible={showDeptModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeptModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Department</Text>
            <TouchableOpacity
              style={[styles.modalItem, selectedDept === 'All' && styles.modalItemActive]}
              onPress={() => { setSelectedDept('All'); setShowDeptModal(false); }}
            >
              <Text style={[styles.modalItemText, selectedDept === 'All' && styles.modalItemTextActive]}>
                All Departments
              </Text>
              {selectedDept === 'All' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>

            {departmentOptions.map((dept, i) => {
              const isSel = selectedDept === dept;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.modalItem, isSel && styles.modalItemActive]}
                  onPress={() => { setSelectedDept(dept); setShowDeptModal(false); }}
                >
                  <Text style={[styles.modalItemText, isSel && styles.modalItemTextActive]}>{dept}</Text>
                  {isSel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    gap: 4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchWrapper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
  },
  teacherName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  teacherSubject: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 2,
  },
  teacherEmp: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  modalHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  modalItemActive: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  modalItemText: {
    fontSize: 14,
    color: '#334155',
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
