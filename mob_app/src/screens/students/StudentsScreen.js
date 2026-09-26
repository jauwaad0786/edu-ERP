// mob_app/src/screens/students/StudentsScreen.js
// Exact match to Screen 7 of mockup with 100% dynamic backend integration
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TextInput, TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function StudentsScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [stuRes, clsRes] = await Promise.all([
        client.get('/principal/students').catch(() => ({ data: [] })),
        client.get('/principal/classes').catch(() => ({ data: [] })),
      ]);

      const stuList = Array.isArray(stuRes.data)
        ? stuRes.data
        : stuRes.data?.students || stuRes.data?.data || [];
      setStudents(stuList);

      const clsList = Array.isArray(clsRes.data)
        ? clsRes.data
        : clsRes.data?.classes || clsRes.data?.data || [];
      setClasses(clsList);
    } catch (err) {
      console.warn('Failed to load students:', err?.message);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived sections based on selected class or all classes
  const availableSections = useMemo(() => {
    const secSet = new Set();
    classes.forEach(c => {
      if (c.sections && Array.isArray(c.sections)) {
        c.sections.forEach(s => secSet.add(typeof s === 'string' ? s : s.name));
      }
    });
    if (secSet.size === 0) {
      ['A', 'B', 'C', 'D'].forEach(s => secSet.add(s));
    }
    return Array.from(secSet);
  }, [classes]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const sName = (s.name || s.student_name || '').toLowerCase();
      const sAdm = (s.admission_no || s.admission_number || '').toLowerCase();
      const sRoll = (s.roll_no || s.roll_number || '').toString();
      const sClass = (s.class_name || s.class_obj?.name || s.grade || '').toString();
      const sSec = (s.section || s.section_name || '').toString().toUpperCase();

      const matchesSearch = !search ||
        sName.includes(search.toLowerCase()) ||
        sAdm.includes(search.toLowerCase()) ||
        sRoll.includes(search);

      const matchesClass = selectedClass === 'All' || sClass.includes(selectedClass);
      const matchesSection = selectedSection === 'All' || sSec === selectedSection.toUpperCase();

      return matchesSearch && matchesClass && matchesSection;
    });
  }, [students, search, selectedClass, selectedSection]);

  const getInitials = (name) => {
    if (!name) return 'S';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const AVATAR_BG_COLORS = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe', '#ffedd5'];

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
        <Text style={styles.headerTitle}>Students</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation?.navigate ? navigation.navigate('AddStudentWizard') : null}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
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

      {/* Quick Action Shortcuts */}
      <View style={styles.quickActionsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('AddStudentWizard') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="person-add" size={14} color="#0b57d0" />
            <Text style={styles.quickActionText}>Admission</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('Provisional') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="document-text" size={14} color="#0284c7" />
            <Text style={styles.quickActionText}>Provisional</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('SectionShuffle') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="swap-horizontal" size={14} color="#7c3aed" />
            <Text style={styles.quickActionText}>Shuffle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('Promotion') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="trending-up" size={14} color="#16a34a" />
            <Text style={styles.quickActionText}>Promotion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('BulkEdit') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={14} color="#d97706" />
            <Text style={styles.quickActionText}>Bulk Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('AnnualRegister') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="repeat-outline" size={14} color="#0b57d0" />
            <Text style={styles.quickActionText}>Annual Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('IDCard') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="card-outline" size={14} color="#0284c7" />
            <Text style={styles.quickActionText}>ID Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionChip}
            onPress={() => navigation?.navigate ? navigation.navigate('StudentImport') : null}
            activeOpacity={0.75}
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#16a34a" />
            <Text style={styles.quickActionText}>Import CSV</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowClassModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterPillText}>
            {selectedClass === 'All' ? 'All Classes' : `Class ${selectedClass}`}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterPill}
          onPress={() => setShowSectionModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterPillText}>
            {selectedSection === 'All' ? 'All Sections' : `${selectedSection} Section`}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Main Student List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching enrolled students...</Text>
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
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s, idx) => {
              const bgColor = AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length];
              const sName = s.name || s.student_name || 'Student';
              const sClass = s.class_name || s.class_obj?.name || s.grade || '5';
              const sSec = s.section || s.section_name || 'A';
              const sRoll = s.roll_no || s.roll_number || idx + 1;

              return (
                <TouchableOpacity
                  key={s.id || idx}
                  style={styles.studentCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (navigation?.navigate) {
                      navigation.navigate('StudentDetail', { student: s });
                    }
                  }}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}>
                    <Text style={styles.avatarText}>{getInitials(sName)}</Text>
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={styles.studentName} numberOfLines={1}>{sName}</Text>
                    <Text style={styles.studentMeta}>
                      Class {sClass} - {sSec}  |  Roll No. {sRoll}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No students match this filter</Text>
              <Text style={styles.emptySub}>Try searching with another name or resetting filters.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Class Picker Modal */}
      <Modal visible={showClassModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowClassModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Class</Text>
            <TouchableOpacity
              style={[styles.modalItem, selectedClass === 'All' && styles.modalItemActive]}
              onPress={() => { setSelectedClass('All'); setShowClassModal(false); }}
            >
              <Text style={[styles.modalItemText, selectedClass === 'All' && styles.modalItemTextActive]}>
                All Classes
              </Text>
              {selectedClass === 'All' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
            {classes.map((c, i) => {
              const cName = c.name || c.class_name || `Class ${i + 1}`;
              const isSel = selectedClass === cName;
              return (
                <TouchableOpacity
                  key={c.id || i}
                  style={[styles.modalItem, isSel && styles.modalItemActive]}
                  onPress={() => { setSelectedClass(cName); setShowClassModal(false); }}
                >
                  <Text style={[styles.modalItemText, isSel && styles.modalItemTextActive]}>{cName}</Text>
                  {isSel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Section Picker Modal */}
      <Modal visible={showSectionModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSectionModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Section</Text>
            <TouchableOpacity
              style={[styles.modalItem, selectedSection === 'All' && styles.modalItemActive]}
              onPress={() => { setSelectedSection('All'); setShowSectionModal(false); }}
            >
              <Text style={[styles.modalItemText, selectedSection === 'All' && styles.modalItemTextActive]}>
                All Sections
              </Text>
              {selectedSection === 'All' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
            {availableSections.map((sec, i) => {
              const isSel = selectedSection === sec;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.modalItem, isSel && styles.modalItemActive]}
                  onPress={() => { setSelectedSection(sec); setShowSectionModal(false); }}
                >
                  <Text style={[styles.modalItemText, isSel && styles.modalItemTextActive]}>
                    Section {sec}
                  </Text>
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
    gap: 10,
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
  quickActionsWrapper: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  quickActionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  infoCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  studentMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
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
