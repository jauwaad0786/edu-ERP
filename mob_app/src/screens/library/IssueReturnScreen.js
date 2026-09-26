// mob_app/src/screens/library/IssueReturnScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const RETURN_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST'];

export default function IssueReturnScreen({ navigation }) {
  const { user } = useAuth();
  const canCirculate = ['LIBRARIAN', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'OVERDUE' | 'HISTORY'

  // Return Book Modal
  const [returnModal, setReturnModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returning, setReturning] = useState(false);

  // New Issue Modal
  const [issueModal, setIssueModal] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [bookBarcode, setBookBarcode] = useState('');
  const [issuing, setIssuing] = useState(false);

  // Load Issues
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await client.get('/library/issues').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.issues || []);
      setIssues(list);
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search Eligible Members for New Issue
  const searchMembers = async (q) => {
    setMemberQuery(q);
    if (!q || q.length < 2) {
      setEligibleMembers([]);
      return;
    }
    try {
      const res = await client.get('/library/members/search-eligible', { params: { q } });
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setEligibleMembers(list);
    } catch {
      setEligibleMembers([]);
    }
  };

  // Submit Issue Book
  const handleIssueBook = async () => {
    if (!selectedMember) {
      Alert.alert('Required', 'Please select a borrower member.');
      return;
    }
    if (!bookBarcode.trim()) {
      Alert.alert('Required', 'Please enter a book barcode or accession number.');
      return;
    }

    setIssuing(true);
    try {
      await client.post('/library/issue', {
        member_id: selectedMember.id,
        barcode: bookBarcode.trim(),
      });

      Alert.alert('Book Issued', `Successfully issued to ${selectedMember.name}`);
      setIssueModal(false);
      setSelectedMember(null);
      setBookBarcode('');
      setMemberQuery('');
      setEligibleMembers([]);
      loadData(true);
    } catch (err) {
      Alert.alert('Issue Failed', err?.response?.data?.error || err?.response?.data?.message || 'Could not issue book.');
    } finally {
      setIssuing(false);
    }
  };

  // Submit Return Book
  const handleReturnBook = async () => {
    if (!selectedIssue) return;
    setReturning(true);
    try {
      const payload = {
        issue_id: selectedIssue.id,
        remarks: returnRemarks.trim(),
      };
      if (returnCondition === 'LOST') payload.mark_lost = true;
      if (returnCondition === 'DAMAGED') payload.mark_damaged = true;

      const res = await client.post('/library/return', payload);
      const fineMsg = res.data?.fine_created ? ` Overdue/Damage fine ₹${res.data?.fine_amount} recorded.` : '';
      Alert.alert('Book Returned', `Book returned successfully.${fineMsg}`);
      setReturnModal(false);
      setSelectedIssue(null);
      setReturnRemarks('');
      setReturnCondition('GOOD');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || err?.response?.data?.message || 'Failed to process return.');
    } finally {
      setReturning(false);
    }
  };

  // Renew Book
  const handleRenewBook = (issue) => {
    Alert.alert(
      'Renew Book Loan',
      `Extend due date for "${issue.book_title || issue.book?.title || 'Book'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: async () => {
            try {
              await client.post(`/library/issue/${issue.id}/renew`);
              Alert.alert('Renewed', 'Due date extended successfully.');
              loadData(true);
            } catch (err) {
              Alert.alert('Cannot Renew', err?.response?.data?.error || 'Renewal limit reached or reserved by another reader.');
            }
          },
        },
      ]
    );
  };

  // KPIs
  const activeIssues = issues.filter(i => (i.status || 'ISSUED') === 'ISSUED');
  const overdueIssues = issues.filter(i => (i.status || 'ISSUED') === 'ISSUED' && (i.overdue_days > 0 || i.is_overdue));
  const returnedIssues = issues.filter(i => i.status === 'RETURNED');

  // Filtered List
  const filteredIssues = issues.filter(i => {
    const q = search.trim().toLowerCase();
    const title = (i.book_title || i.book?.title || '').toLowerCase();
    const member = (i.member_name || i.member?.user?.name || '').toLowerCase();
    const barcode = (i.barcode || i.copy?.barcode || '').toLowerCase();
    const matchesSearch = !q || title.includes(q) || member.includes(q) || barcode.includes(q);

    if (!matchesSearch) return false;

    if (activeTab === 'ACTIVE') return (i.status || 'ISSUED') === 'ISSUED';
    if (activeTab === 'OVERDUE') return (i.status || 'ISSUED') === 'ISSUED' && (i.overdue_days > 0 || i.is_overdue);
    if (activeTab === 'HISTORY') return i.status !== 'ISSUED';

    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Issue & Returns</Text>
            <Text style={styles.headerSub}>Circulation Desk & Loan Management</Text>
          </View>
        </View>

        {canCirculate && (
          <TouchableOpacity style={styles.topBtn} onPress={() => setIssueModal(true)}>
            <Ionicons name="swap-horizontal" size={16} color="#0891b2" />
            <Text style={styles.topBtnText}>Issue Book</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiValue}>{activeIssues.length}</Text>
          <Text style={styles.kpiLabel}>ACTIVE LOANS</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{overdueIssues.length}</Text>
          <Text style={styles.kpiLabel}>OVERDUE</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{returnedIssues.length}</Text>
          <Text style={styles.kpiLabel}>RETURNED</Text>
        </View>
      </View>

      {/* Search & Tabs */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by book title, borrower, or barcode..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'ACTIVE', label: `Active (${activeIssues.length})` },
            { key: 'OVERDUE', label: `Overdue (${overdueIssues.length})` },
            { key: 'HISTORY', label: 'History' },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0891b2" />
          <Text style={styles.loadingText}>Loading circulation records...</Text>
        </View>
      ) : filteredIssues.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
        >
          <Ionicons name="swap-horizontal-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Loan Records Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No loan transactions match your search.' : 'No active books currently issued out.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#0891b2']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredIssues.map((iss, idx) => {
            const bTitle = iss.book_title || iss.book?.title || 'Book Title';
            const mName = iss.member_name || iss.member?.user?.name || 'Borrower';
            const isOverdue = (iss.status || 'ISSUED') === 'ISSUED' && (iss.overdue_days > 0 || iss.is_overdue);
            const barcode = iss.barcode || iss.copy?.barcode || '';

            return (
              <View key={iss.id || idx} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardBookTitle}>{bTitle}</Text>
                    {barcode ? <Text style={styles.barcodeText}>Barcode: {barcode}</Text> : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isOverdue
                        ? { backgroundColor: '#fee2e2' }
                        : iss.status === 'RETURNED'
                        ? { backgroundColor: '#f1f5f9' }
                        : { backgroundColor: '#e0f2fe' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isOverdue
                          ? { color: '#dc2626' }
                          : iss.status === 'RETURNED'
                          ? { color: '#64748b' }
                          : { color: '#0369a1' },
                      ]}
                    >
                      {isOverdue ? `${iss.overdue_days || 1}d OVERDUE` : (iss.status || 'ISSUED')}
                    </Text>
                  </View>
                </View>

                {/* Borrower details */}
                <View style={styles.borrowerRow}>
                  <View style={styles.borrowerAvatar}>
                    <Ionicons name="person" size={14} color="#0891b2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.borrowerName}>{mName}</Text>
                    <Text style={styles.borrowerSub}>
                      {iss.class_name ? `Class ${iss.class_name}` : 'Library Member'} • Issued: {iss.issue_date || '—'}
                    </Text>
                  </View>
                </View>

                {/* Dates & Due */}
                <View style={styles.datesBar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={13} color="#64748b" />
                    <Text style={styles.datesText}>Due: {iss.due_date || '—'}</Text>
                  </View>
                  {isOverdue && (
                    <Text style={styles.finePreviewText}>
                      Est. Fine: ₹{iss.estimated_fine || (iss.overdue_days || 1) * 2}
                    </Text>
                  )}
                </View>

                {/* Actions for Active Loans */}
                {canCirculate && iss.status === 'ISSUED' && (
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.renewBtn}
                      onPress={() => handleRenewBook(iss)}
                    >
                      <Ionicons name="refresh" size={14} color="#0891b2" />
                      <Text style={styles.renewBtnText}>Renew</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.returnBtn}
                      onPress={() => {
                        setSelectedIssue(iss);
                        setReturnModal(true);
                      }}
                    >
                      <Ionicons name="checkmark-done" size={14} color="#ffffff" />
                      <Text style={styles.returnBtnText}>Return Book</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Return Book Modal */}
      <Modal
        visible={returnModal}
        animationType="slide"
        transparent
        onRequestClose={() => setReturnModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receive Book Return</Text>
                <Text style={styles.modalSub}>{selectedIssue?.book_title || 'Book'}</Text>
              </View>
              <TouchableOpacity onPress={() => setReturnModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>BOOK CONDITION ON RETURN</Text>
              <View style={styles.conditionRow}>
                {RETURN_CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.conditionChip, returnCondition === c && styles.conditionChipActive]}
                    onPress={() => setReturnCondition(c)}
                  >
                    <Text style={[styles.conditionText, returnCondition === c && styles.conditionTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>REMARKS (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Returned on time / minor spine wear"
                placeholderTextColor="#94a3b8"
                value={returnRemarks}
                onChangeText={setReturnRemarks}
              />

              <TouchableOpacity
                style={[styles.submitBtn, returning && { opacity: 0.7 }]}
                onPress={handleReturnBook}
                disabled={returning}
              >
                {returning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Confirm Return</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Issue Book Modal */}
      <Modal
        visible={issueModal}
        animationType="slide"
        transparent
        onRequestClose={() => setIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Issue Book</Text>
                <Text style={styles.modalSub}>Loan a book copy to student or faculty</Text>
              </View>
              <TouchableOpacity onPress={() => setIssueModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>SEARCH BORROWER (STUDENT / TEACHER) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Type name, roll number, or card..."
                placeholderTextColor="#94a3b8"
                value={memberQuery}
                onChangeText={searchMembers}
              />

              {eligibleMembers.length > 0 && !selectedMember && (
                <View style={styles.memberDropdown}>
                  {eligibleMembers.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.memberItem}
                      onPress={() => setSelectedMember(m)}
                    >
                      <Ionicons name="person" size={14} color="#0891b2" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberNameText}>{m.name || m.user?.name}</Text>
                        <Text style={styles.memberMetaText}>
                          {m.member_type} • Card: {m.card_number || '—'}
                        </Text>
                      </View>
                      <Text style={styles.memberSelectText}>Select</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedMember && (
                <View style={styles.selectedMemberBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedMemberName}>{selectedMember.name || selectedMember.user?.name}</Text>
                    <Text style={styles.selectedMemberCard}>
                      Card: {selectedMember.card_number || 'LIB-CARD'} • {selectedMember.member_type}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedMember(null)}>
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.inputLabel}>BOOK COPY BARCODE / ACCESSION NUMBER *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 13-digit barcode or ACC-2026-000001"
                placeholderTextColor="#94a3b8"
                value={bookBarcode}
                onChangeText={setBookBarcode}
              />

              <TouchableOpacity
                style={[styles.submitBtn, issuing && { opacity: 0.7 }]}
                onPress={handleIssueBook}
                disabled={issuing}
              >
                {issuing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Issue Book Now</Text>
                  </>
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0891b2',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerBackBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 11,
    color: '#cffafe',
    marginTop: 1,
  },
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0891b2',
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  kpiTile: {
    flex: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 2,
  },
  tabRow: {
    flexDirection: 'row',
    marginVertical: 10,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: '#0891b2',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardBookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  barcodeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  borrowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  borrowerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borrowerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  borrowerSub: {
    fontSize: 11,
    color: '#64748b',
  },
  datesBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  datesText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  finePreviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  renewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  renewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0891b2',
  },
  returnBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0891b2',
  },
  returnBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  conditionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  conditionChipActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  conditionTextActive: {
    color: '#ffffff',
  },
  memberDropdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    maxHeight: 140,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  memberMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  memberSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891b2',
  },
  selectedMemberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  selectedMemberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  selectedMemberCard: {
    fontSize: 11,
    color: '#0284c7',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
