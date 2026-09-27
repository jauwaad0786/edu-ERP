// mob_app/src/screens/library/MembersScreen.js
// Library Membership & Card Management — 100% mirrors Web ERP LibraryMembers.jsx
// Handles student/faculty library enrollment, borrowing permissions, and card status.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function MembersScreen({ navigation }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Enroll Modal State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollType, setEnrollType] = useState('STUDENT');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [searchingEligible, setSearchingEligible] = useState(false);

  // History / Detail Modal
  const [detailMember, setDetailMember] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.member_type = typeFilter;
      const res = await client.get('/library/members', { params });
      setMembers(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load library members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Search Eligible non-members for enrollment
  useEffect(() => {
    if (!showEnrollModal || !enrollSearch.trim()) {
      setEnrollResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingEligible(true);
      try {
        const res = await client.get('/library/members/search-eligible', {
          params: { search: enrollSearch.trim(), type: enrollType },
        });
        setEnrollResults(res.data || []);
      } catch (e) {
        setEnrollResults([]);
      } finally {
        setSearchingEligible(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [enrollSearch, enrollType, showEnrollModal]);

  const handleEnroll = async (userItem) => {
    if (userItem.is_member) {
      Alert.alert('Notice', 'User is already an enrolled library member.');
      return;
    }
    try {
      setEnrolling(true);
      await client.post('/library/members', {
        user_id: userItem.user_id,
        member_type: enrollType,
      });
      Alert.alert('Enrollment Successful', `${userItem.name} enrolled as library member.`);
      setShowEnrollModal(false);
      setEnrollSearch('');
      setEnrollResults([]);
      fetchMembers();
    } catch (err) {
      Alert.alert('Enrollment Failed', err.response?.data?.error || 'Failed to enroll member');
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await client.patch(`/library/members/${member.id}`, { status: nextStatus });
      Alert.alert('Status Updated', `Membership ${nextStatus.toLowerCase()} successfully.`);
      fetchMembers();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update member status');
    }
  };

  const viewHistory = async (member) => {
    setDetailMember(member);
    setHistoryLoading(true);
    try {
      const res = await client.get(`/library/members/${member.id}/history`);
      setHistoryRecords(res.data?.records || res.data || []);
    } catch (err) {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderMember = ({ item }) => {
    const isActive = (item.status || 'ACTIVE') === 'ACTIVE';
    const isTeacher = (item.member_type || '').toUpperCase() === 'TEACHER';

    return (
      <View style={styles.memberCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, isTeacher && { backgroundColor: '#fef3c7' }]}>
            <Ionicons
              name={isTeacher ? 'school' : 'person'}
              size={18}
              color={isTeacher ? '#b45309' : '#0284c7'}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.memberName}>{item.name || item.student_name || 'Member'}</Text>
            <Text style={styles.memberSub}>
              {item.member_type} • Card: {item.card_number || `LIB-${item.id}`}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.statusBadgeText, { color: isActive ? '#15803d' : '#dc2626' }]}>
              {item.status || 'ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>ACTIVE ISSUED</Text>
            <Text style={styles.kpiVal}>{item.active_issues_count || 0} books</Text>
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>TOTAL BORROWED</Text>
            <Text style={styles.kpiVal}>{item.total_borrowed_count || 0}</Text>
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>UNPAID FINES</Text>
            <Text style={[styles.kpiVal, { color: item.unpaid_fines > 0 ? '#dc2626' : '#15803d' }]}>
              ₹{item.unpaid_fines || 0}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.historyBtn} onPress={() => viewHistory(item)}>
            <Ionicons name="time-outline" size={14} color="#0284c7" />
            <Text style={styles.historyBtnText}>Borrow History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.blockBtn, isActive ? styles.blockBtnRed : styles.blockBtnGreen]}
            onPress={() => handleToggleStatus(item)}
          >
            <Ionicons
              name={isActive ? 'ban-outline' : 'checkmark-circle-outline'}
              size={14}
              color={isActive ? '#ef4444' : '#15803d'}
            />
            <Text style={[styles.blockBtnText, { color: isActive ? '#ef4444' : '#15803d' }]}>
              {isActive ? 'Block Card' : 'Activate Card'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
          <Text style={styles.headerTitle}>Library Members</Text>
          <Text style={styles.headerSubtitle}>Student & Staff Library Cards</Text>
        </View>
        <TouchableOpacity style={styles.enrollHeaderBtn} onPress={() => setShowEnrollModal(true)}>
          <Ionicons name="person-add" size={16} color="#fff" />
          <Text style={styles.enrollHeaderBtnText}>Enroll</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {[
          { key: '', label: 'All Members' },
          { key: 'STUDENT', label: 'Students' },
          { key: 'TEACHER', label: 'Teachers' },
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

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search member name or card number..."
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
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading library members...</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderMember}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchMembers();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Members Found</Text>
              <Text style={styles.emptySubtitle}>Tap "Enroll" above to grant library borrowing cards.</Text>
            </View>
          }
        />
      )}

      {/* Enroll Modal */}
      <Modal visible={showEnrollModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Enroll Library Member</Text>
              <TouchableOpacity onPress={() => setShowEnrollModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Type Switcher */}
            <View style={styles.typeSwitcher}>
              {['STUDENT', 'TEACHER'].map(st => (
                <TouchableOpacity
                  key={st}
                  style={[styles.typeSwitchBtn, enrollType === st && styles.typeSwitchBtnActive]}
                  onPress={() => setEnrollType(st)}
                >
                  <Text style={[styles.typeSwitchText, enrollType === st && styles.typeSwitchTextActive]}>
                    {st === 'STUDENT' ? 'Student Member' : 'Faculty / Teacher'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* User Search */}
            <Text style={styles.modalFieldLabel}>Search User Name or Admission No:</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchRowInput}
                placeholder={`Search eligible ${enrollType.toLowerCase()}...`}
                placeholderTextColor="#94a3b8"
                value={enrollSearch}
                onChangeText={setEnrollSearch}
              />
              {searchingEligible ? <ActivityIndicator size="small" color="#0284c7" /> : null}
            </View>

            <ScrollView style={{ maxHeight: 280, marginTop: 10 }}>
              {enrollResults.map(u => (
                <TouchableOpacity
                  key={u.user_id}
                  style={styles.eligibleRow}
                  disabled={u.is_member || enrolling}
                  onPress={() => handleEnroll(u)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eligibleName}>{u.name}</Text>
                    <Text style={styles.eligibleSub}>
                      {u.class_name ? `Class: ${u.class_name} • ` : ''}Roll: {u.roll_number || '—'}
                    </Text>
                  </View>
                  {u.is_member ? (
                    <Text style={styles.alreadyMemberBadge}>Enrolled</Text>
                  ) : (
                    <View style={styles.addBtnSmall}>
                      <Ionicons name="add" size={14} color="#fff" />
                      <Text style={styles.addBtnSmallText}>Enroll</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {enrollSearch && enrollResults.length === 0 && !searchingEligible ? (
                <Text style={styles.noResultsText}>No eligible users found matching query.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Borrow History Modal */}
      <Modal visible={!!detailMember} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeaderCenter}>
              <Ionicons name="book-outline" size={22} color="#0284c7" />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleCenter}>{detailMember?.name}</Text>
                <Text style={styles.modalSubCenter}>Borrowing & Issue History</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailMember(null)}>
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator size="large" color="#0284c7" style={{ marginVertical: 30 }} />
            ) : historyRecords.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>No past borrowing records found.</Text>
              </View>
            ) : (
              <FlatList
                data={historyRecords}
                keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.historyItem}>
                    <Text style={styles.historyBookTitle}>{item.book_title || item.title || 'Book'}</Text>
                    <Text style={styles.historyMeta}>
                      Issued: {item.issued_at || '—'} • Due: {item.due_date || '—'}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: item.returned_at ? '#15803d' : '#ea580c' }}>
                        {item.returned_at ? `Returned on ${item.returned_at}` : 'Currently Issued'}
                      </Text>
                      {item.fine_amount > 0 ? (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>
                          Fine: ₹{item.fine_amount}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
                style={{ maxHeight: 360 }}
              />
            )}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  enrollHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  enrollHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: '#0284c7' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#fff' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },

  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  memberSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  kpiCol: { flex: 1 },
  kpiLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
  kpiVal: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 2 },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  historyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  historyBtnText: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  blockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
  },
  blockBtnRed: { backgroundColor: '#fee2e2' },
  blockBtnGreen: { backgroundColor: '#dcfce7' },
  blockBtnText: { fontSize: 12, fontWeight: '600' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  // Sheet Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  typeSwitcher: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 3, marginBottom: 12 },
  typeSwitchBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  typeSwitchBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  typeSwitchText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  typeSwitchTextActive: { color: '#0284c7', fontWeight: '700' },

  modalFieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchRowInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  eligibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  eligibleName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  eligibleSub: { fontSize: 11, color: '#64748b' },
  alreadyMemberBadge: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  addBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  addBtnSmallText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  noResultsText: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 16 },

  // Center Modal
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalTitleCenter: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalSubCenter: { fontSize: 12, color: '#64748b' },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyBookTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  historyMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
});
