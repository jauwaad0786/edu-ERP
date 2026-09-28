// mob_app/src/screens/library/ReservationsScreen.js
// Library Book Reservations & Hold Queue — 100% mirrors Web ERP LibraryReservations.jsx
// Handles book reservation waitlist, notification alerts, and hold queue fulfillment.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function ReservationsScreen({ navigation }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('WAITING');
  const [refreshing, setRefreshing] = useState(false);

  // New Reservation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get(`/library/reservations?status=${statusFilter}`);
      setReservations(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load reservations list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Book Search Debounce
  useEffect(() => {
    if (!showCreateModal || selectedBook || !bookSearch.trim()) {
      setBookResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await client.get(`/library/books?search=${encodeURIComponent(bookSearch.trim())}&per_page=6`);
        setBookResults(res.data?.data || res.data || []);
      } catch (e) {
        setBookResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [bookSearch, showCreateModal, selectedBook]);

  // Member Search Debounce
  useEffect(() => {
    if (!showCreateModal || selectedMember || !memberSearch.trim()) {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await client.get(`/library/members?search=${encodeURIComponent(memberSearch.trim())}`);
        setMemberResults(res.data || []);
      } catch (e) {
        setMemberResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, showCreateModal, selectedMember]);

  const handleCreateReservation = async () => {
    if (!selectedBook || !selectedMember) {
      Alert.alert('Required', 'Please select both a Book and a Member.');
      return;
    }
    try {
      setSubmitting(true);
      await client.post('/library/reservations', {
        book_id: selectedBook.id,
        member_id: selectedMember.id,
      });
      Alert.alert('Reserved', `Book hold placed for ${selectedMember.name}.`);
      setShowCreateModal(false);
      setSelectedBook(null);
      setSelectedMember(null);
      setBookSearch('');
      setMemberSearch('');
      fetchReservations();
    } catch (err) {
      Alert.alert('Reservation Failed', err.response?.data?.error || 'Failed to place reservation hold');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (item) => {
    Alert.alert(
      'Cancel Hold',
      `Cancel reservation hold for "${item.book_title || item.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingId(item.id);
              await client.post(`/library/reservations/${item.id}/cancel`);
              Alert.alert('Cancelled', 'Hold removed from reservation queue.');
              fetchReservations();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to cancel hold');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const renderReservation = ({ item }) => {
    const isWaiting = item.status === 'WAITING';
    const isNotified = item.status === 'NOTIFIED';
    const isFulfilled = item.status === 'FULFILLED';

    const badgeBg = isWaiting ? '#fef3c7' : isNotified ? '#e0f2fe' : isFulfilled ? '#dcfce7' : '#f1f5f9';
    const badgeColor = isWaiting ? '#b45309' : isNotified ? '#0284c7' : isFulfilled ? '#15803d' : '#64748b';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bookTitle}>{item.book_title || item.title || 'Book'}</Text>
            <Text style={styles.authorSub}>by {item.author || 'Author'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.memberBox}>
          <Ionicons name="person-outline" size={14} color="#0284c7" />
          <Text style={styles.memberNameText}>
            Member: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.member_name || item.name}</Text>
          </Text>
          {item.member_type ? (
            <Text style={styles.memberTypeTag}>({item.member_type})</Text>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            <Ionicons name="time-outline" size={12} color="#64748b" /> Reserved on {item.created_at || '—'}
          </Text>
          {item.notified_at ? (
            <Text style={[styles.metaText, { color: '#0284c7', fontWeight: '600' }]}>
              Notified: {item.notified_at}
            </Text>
          ) : null}
        </View>

        {isWaiting || isNotified ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              disabled={cancellingId === item.id}
              onPress={() => handleCancelReservation(item)}
            >
              {cancellingId === item.id ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
                  <Text style={styles.cancelBtnText}>Cancel Reservation Hold</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
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
          <Text style={styles.headerTitle}>Book Reservations</Text>
          <Text style={styles.headerSubtitle}>Hold Queue & Availability Alerts</Text>
        </View>
        <TouchableOpacity style={styles.reserveHeaderBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="bookmark" size={16} color="#fff" />
          <Text style={styles.reserveHeaderBtnText}>Place Hold</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Service Navigation Strip */}
      <View style={styles.serviceNavStrip}>
        <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Books')}>
          <Ionicons name="book" size={14} color="#64748b" />
          <Text style={styles.serviceNavText}>Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('IssueReturn')}>
          <Ionicons name="swap-horizontal" size={14} color="#64748b" />
          <Text style={styles.serviceNavText}>Desk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Members')}>
          <Ionicons name="card" size={14} color="#64748b" />
          <Text style={styles.serviceNavText}>Members</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
          <Ionicons name="bookmark" size={14} color="#0891b2" />
          <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>Holds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Fines')}>
          <Ionicons name="cash" size={14} color="#64748b" />
          <Text style={styles.serviceNavText}>Fines</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {['WAITING', 'NOTIFIED', 'FULFILLED', 'CANCELLED'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading reservation queue...</Text>
        </View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderReservation}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchReservations();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmarks-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Holds in {statusFilter} Queue</Text>
              <Text style={styles.emptySubtitle}>All library books are readily available or holds are cleared.</Text>
            </View>
          }
        />
      )}

      {/* Place Hold Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Reserve / Hold Book</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Step 1: Select Book */}
              <Text style={styles.modalFieldLabel}>1. Select Book Title:</Text>
              {selectedBook ? (
                <View style={styles.selectedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedTitle}>{selectedBook.title}</Text>
                    <Text style={styles.selectedSub}>by {selectedBook.author} • ISBN: {selectedBook.isbn || '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBook(null)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchRowInput}
                      placeholder="Search book title or author..."
                      placeholderTextColor="#94a3b8"
                      value={bookSearch}
                      onChangeText={setBookSearch}
                    />
                  </View>
                  {bookResults.length > 0 ? (
                    <View style={styles.resultsDrop}>
                      {bookResults.map(b => (
                        <TouchableOpacity
                          key={b.id}
                          style={styles.resultItem}
                          onPress={() => {
                            setSelectedBook(b);
                            setBookResults([]);
                            setBookSearch('');
                          }}
                        >
                          <Text style={styles.resultTitle}>{b.title}</Text>
                          <Text style={styles.resultDesc}>by {b.author}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              {/* Step 2: Select Member */}
              <Text style={[styles.modalFieldLabel, { marginTop: 14 }]}>2. Select Member:</Text>
              {selectedMember ? (
                <View style={styles.selectedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedTitle}>{selectedMember.name}</Text>
                    <Text style={styles.selectedSub}>Card: {selectedMember.card_number || `LIB-${selectedMember.id}`}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedMember(null)}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchRowInput}
                      placeholder="Search member name or card..."
                      placeholderTextColor="#94a3b8"
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                    />
                  </View>
                  {memberResults.length > 0 ? (
                    <View style={styles.resultsDrop}>
                      {memberResults.map(m => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.resultItem}
                          onPress={() => {
                            setSelectedMember(m);
                            setMemberResults([]);
                            setMemberSearch('');
                          }}
                        >
                          <Text style={styles.resultTitle}>{m.name}</Text>
                          <Text style={styles.resultDesc}>Card: {m.card_number || `LIB-${m.id}`} • {m.member_type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, (!selectedBook || !selectedMember || submitting) && styles.submitBtnDisabled]}
                disabled={!selectedBook || !selectedMember || submitting}
                onPress={handleCreateReservation}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Place Book Hold</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  reserveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  reserveHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  bookTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  authorSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  memberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    padding: 8,
    marginVertical: 10,
    gap: 6,
  },
  memberNameText: { fontSize: 12, color: '#334155' },
  memberTypeTag: { fontSize: 11, color: '#64748b' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 11, color: '#64748b' },

  cardActions: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },

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
    maxHeight: '90%',
  },
  modalSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
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
  resultsDrop: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 140,
  },
  resultItem: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  resultTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  resultDesc: { fontSize: 11, color: '#64748b' },

  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
  },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  selectedSub: { fontSize: 12, color: '#64748b' },
  changeLink: { fontSize: 12, fontWeight: '600', color: '#0284c7' },

  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  serviceNavStrip: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'space-around',
  },
  serviceNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  serviceNavTabActive: {
    backgroundColor: '#ecfeff',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#0891b2',
    fontWeight: '700',
  },
});
