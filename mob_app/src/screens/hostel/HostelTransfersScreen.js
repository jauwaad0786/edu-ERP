// mob_app/src/screens/hostel/HostelTransfersScreen.js
// Hostel Transfers & Vacate Operations — 100% mirrors Web ERP HostelTransfers.jsx
// Handles room/bed swaps, relocation across buildings/floors, and clearance vacated logs.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

export default function HostelTransfersScreen({ navigation }) {
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Transfer Modal State
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferType, setTransferType] = useState('BED'); // 'BED' | 'ROOM' | 'HOSTEL'
  const [transferReason, setTransferReason] = useState('');
  const [targetHostelId, setTargetHostelId] = useState('');
  const [targetRoomMap, setTargetRoomMap] = useState([]);
  const [targetBed, setTargetBed] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Vacate Modal State
  const [vacateTarget, setVacateTarget] = useState(null);
  const [vacateReason, setVacateReason] = useState('');
  const [vacating, setVacating] = useState(false);

  // Load Hostels list
  useEffect(() => {
    client.get('/hostel/hostels')
      .then(r => setHostels(r.data || []))
      .catch(() => {});
  }, []);

  // Load Allocations via room-map
  const loadAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const targetIds = selectedHostelId ? [selectedHostelId] : hostels.map(h => h.id);
      if (targetIds.length === 0) {
        setAllocations([]);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        targetIds.map(id =>
          client.get(`/hostel/hostels/${id}/room-map`)
            .then(r => ({ hostelId: id, data: r.data || [] }))
            .catch(() => ({ hostelId: id, data: [] }))
        )
      );

      const rows = [];
      results.forEach(({ hostelId, data }) => {
        const hostel = hostels.find(h => h.id === Number(hostelId));
        data.forEach(building => {
          building.floors?.forEach(floor => {
            floor.rooms?.forEach(room => {
              room.beds?.forEach(bed => {
                if (bed.status === 'OCCUPIED' && (bed.student_name || bed.student_id)) {
                  rows.push({
                    bed_id: bed.id,
                    student_id: bed.student_id,
                    allocation_id: bed.allocation_id || bed.id,
                    student_name: bed.student_name || 'Resident',
                    hostel_name: hostel?.name || 'Main Hostel',
                    building_name: building.name,
                    floor_name: floor.name,
                    room_number: room.room_number,
                    bed_number: bed.bed_number,
                  });
                }
              });
            });
          });
        });
      });

      setAllocations(rows);
    } catch (e) {
      Alert.alert('Error', 'Failed to load resident room allocations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHostelId, hostels]);

  useEffect(() => {
    if (hostels.length) {
      loadAllocations();
    }
  }, [hostels, loadAllocations]);

  // Load target room map for transfer
  useEffect(() => {
    if (!targetHostelId) {
      setTargetRoomMap([]);
      setTargetBed(null);
      return;
    }
    setMapLoading(true);
    client.get(`/hostel/hostels/${targetHostelId}/room-map`)
      .then(r => setTargetRoomMap(r.data || []))
      .catch(() => Alert.alert('Error', 'Failed to load rooms for transfer destination'))
      .finally(() => setMapLoading(false));
  }, [targetHostelId]);

  const openTransferModal = (item) => {
    setTransferTarget(item);
    setTargetHostelId(selectedHostelId || (hostels[0]?.id?.toString() || ''));
    setTargetBed(null);
    setTransferReason('');
    setTransferType('BED');
  };

  const handleConfirmTransfer = async () => {
    if (!targetBed) {
      Alert.alert('Required', 'Please select a vacant new bed destination.');
      return;
    }
    try {
      setTransferring(true);
      await client.post(`/hostel/admission/${transferTarget.allocation_id}/transfer`, {
        new_bed_id: targetBed.id,
        transfer_type: transferType,
        reason: transferReason || 'Resident relocation requested',
      });
      Alert.alert('Transfer Successful', `${transferTarget.student_name} relocated to Bed ${targetBed.bed_number} (Room ${targetBed.room_number}).`);
      setTransferTarget(null);
      loadAllocations();
    } catch (err) {
      Alert.alert('Transfer Failed', err.response?.data?.error || err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const handleConfirmVacate = async () => {
    try {
      setVacating(true);
      await client.post(`/hostel/admission/${vacateTarget.allocation_id}/vacate`, {
        reason: vacateReason || 'Student cleared from hostel',
      });
      Alert.alert('Vacated', `${vacateTarget.student_name} vacated.`);
      setVacateTarget(null);
      setVacateReason('');
      loadAllocations();
    } catch (err) {
      Alert.alert('Vacate Failed', err.response?.data?.error || err.message || 'Failed to vacate');
    } finally {
      setVacating(false);
    }
  };

  const filteredAllocations = allocations.filter(a =>
    !search || a.student_name.toLowerCase().includes(search.toLowerCase()) ||
    a.room_number?.toString().includes(search)
  );

  const renderAllocation = ({ item }) => (
    <View style={styles.allocCard}>
      <View style={styles.allocHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.student_name || 'R')[0]}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.residentName}>{item.student_name}</Text>
          <Text style={styles.residentSub}>
            {item.hostel_name} • {item.building_name}
          </Text>
        </View>
        <View style={styles.currentBedBadge}>
          <Text style={styles.currentBedBadgeText}>
            R-{item.room_number} • Bed {item.bed_number}
          </Text>
        </View>
      </View>

      <View style={styles.allocActions}>
        <TouchableOpacity
          style={styles.transferBtn}
          onPress={() => openTransferModal(item)}
        >
          <Ionicons name="swap-horizontal" size={15} color="#4338ca" />
          <Text style={styles.transferBtnText}>Transfer Bed / Room</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vacateBtn}
          onPress={() => setVacateTarget(item)}
        >
          <Ionicons name="exit-outline" size={15} color="#ef4444" />
          <Text style={styles.vacateBtnText}>Vacate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Hostel Transfers & Vacate</Text>
          <Text style={styles.headerSubtitle}>Relocate residents or process clearance</Text>
        </View>
      </View>

      {/* Hostel Filter Bar */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedHostelId && styles.filterChipActive]}
            onPress={() => setSelectedHostelId('')}
          >
            <Text style={[styles.filterChipText, !selectedHostelId && styles.filterChipTextActive]}>
              All Hostels
            </Text>
          </TouchableOpacity>
          {hostels.map(h => {
            const active = selectedHostelId === h.id.toString() || selectedHostelId === h.id;
            return (
              <TouchableOpacity
                key={h.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedHostelId(h.id.toString())}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name or room number..."
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
          <ActivityIndicator size="large" color="#4338ca" />
          <Text style={styles.loadingText}>Loading resident allocations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAllocations}
          keyExtractor={(item, index) => `${item.bed_id}-${index}`}
          renderItem={renderAllocation}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadAllocations();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Active Allocations</Text>
              <Text style={styles.emptySubtitle}>All beds in this hostel appear to be vacant.</Text>
            </View>
          }
        />
      )}

      {/* Transfer Modal */}
      <Modal visible={!!transferTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopBar}>
              <View>
                <Text style={styles.modalSheetTitle}>Relocate Resident</Text>
                <Text style={styles.modalSheetSub}>
                  {transferTarget?.student_name} (Current: R-{transferTarget?.room_number}, Bed {transferTarget?.bed_number})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTransferTarget(null)}>
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Transfer Type Selector */}
              <Text style={styles.modalSectionLabel}>Relocation Scope:</Text>
              <View style={styles.typeButtonGroup}>
                {['BED', 'ROOM', 'HOSTEL'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, transferType === t && styles.typeBtnActive]}
                    onPress={() => setTransferType(t)}
                  >
                    <Text style={[styles.typeBtnText, transferType === t && styles.typeBtnTextActive]}>
                      {t === 'BED' ? 'Same Room (Bed)' : t === 'ROOM' ? 'Another Room' : 'Other Hostel'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Target Hostel Picker if HOSTEL */}
              {transferType === 'HOSTEL' ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.modalSectionLabel}>Destination Hostel:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                    {hostels.map(h => {
                      const active = targetHostelId === h.id.toString() || targetHostelId === h.id;
                      return (
                        <TouchableOpacity
                          key={h.id}
                          style={[styles.filterChip, active && styles.filterChipActive]}
                          onPress={() => setTargetHostelId(h.id.toString())}
                        >
                          <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                            {h.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Destination Vacant Beds Picker */}
              <Text style={styles.modalSectionLabel}>Select Destination Vacant Bed:</Text>
              {mapLoading ? (
                <ActivityIndicator size="small" color="#4338ca" style={{ marginVertical: 20 }} />
              ) : (
                targetRoomMap.map((b, bIdx) => (
                  <View key={bIdx} style={{ marginBottom: 12 }}>
                    <Text style={styles.modalBuilding}>{b.name}</Text>
                    {b.floors?.map((fl, fIdx) => (
                      <View key={fIdx} style={{ marginLeft: 6, marginBottom: 8 }}>
                        <Text style={styles.modalFloor}>Floor: {fl.name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {fl.rooms?.map((rm, rIdx) => (
                            <View key={rIdx} style={styles.miniRoomCard}>
                              <Text style={styles.miniRoomNum}>R-{rm.room_number}</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {rm.beds?.map(bd => {
                                  const isVacant = bd.status === 'VACANT';
                                  const isSelected = targetBed?.id === bd.id;
                                  return (
                                    <TouchableOpacity
                                      key={bd.id}
                                      disabled={!isVacant}
                                      style={[
                                        styles.miniBedBtn,
                                        !isVacant && styles.miniBedBtnOccupied,
                                        isSelected && styles.miniBedBtnSelected,
                                      ]}
                                      onPress={() =>
                                        setTargetBed({
                                          ...bd,
                                          room_number: rm.room_number,
                                          building_name: b.name,
                                        })
                                      }
                                    >
                                      <Text
                                        style={[
                                          styles.miniBedText,
                                          isSelected && { color: '#fff' },
                                          !isVacant && { color: '#94a3b8' },
                                        ]}
                                      >
                                        B{bd.bed_number}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              )}

              {/* Target Bed Banner */}
              {targetBed ? (
                <View style={styles.targetBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                  <Text style={styles.targetBannerText}>
                    Selected: {targetBed.building_name} • Room {targetBed.room_number} • Bed {targetBed.bed_number}
                  </Text>
                </View>
              ) : null}

              {/* Reason input */}
              <Text style={[styles.modalSectionLabel, { marginTop: 12 }]}>Transfer Reason:</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Reason for transfer (e.g. mutual room swap, medical request)..."
                placeholderTextColor="#94a3b8"
                value={transferReason}
                onChangeText={setTransferReason}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, (!targetBed || transferring) && styles.modalSubmitBtnDisabled]}
              disabled={!targetBed || transferring}
              onPress={handleConfirmTransfer}
            >
              {transferring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Confirm Relocation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vacate Modal */}
      <Modal visible={!!vacateTarget} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeaderCenter}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.modalTitleCenter}>Confirm Clearance & Vacate</Text>
            </View>
            <Text style={styles.modalBodyCenter}>
              Clear <Text style={{ fontWeight: '700' }}>{vacateTarget?.student_name}</Text> from Bed{' '}
              {vacateTarget?.bed_number} (Room {vacateTarget?.room_number})?
            </Text>
            <TextInput
              style={styles.modalInputBox}
              placeholder="Reason for leaving (e.g. graduation, fee clearance)..."
              placeholderTextColor="#94a3b8"
              value={vacateReason}
              onChangeText={setVacateReason}
            />
            <View style={styles.modalActionsCenter}>
              <TouchableOpacity
                style={styles.modalCenterCancel}
                onPress={() => {
                  setVacateTarget(null);
                  setVacateReason('');
                }}
              >
                <Text style={styles.modalCenterCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCenterConfirm}
                disabled={vacating}
                onPress={handleConfirmVacate}
              >
                {vacating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalCenterConfirmText}>Clear Bed</Text>
                )}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },

  filterScrollWrapper: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: { backgroundColor: '#4338ca', borderColor: '#4338ca' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
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

  allocCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  allocHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#4338ca' },
  residentName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  residentSub: { fontSize: 12, color: '#64748b', marginTop: 1 },

  currentBedBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  currentBedBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  allocActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  transferBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e7ff',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  transferBtnText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  vacateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  vacateBtnText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  // Transfer Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalSheetTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  modalSheetSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  typeButtonGroup: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: '#4338ca' },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  typeBtnTextActive: { color: '#fff' },

  modalBuilding: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalFloor: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  miniRoomCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 6,
  },
  miniRoomNum: { fontSize: 10, fontWeight: '700', color: '#475569', marginBottom: 4 },
  miniBedBtn: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  miniBedBtnOccupied: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  miniBedBtnSelected: { backgroundColor: '#4338ca', borderColor: '#312e81' },
  miniBedText: { fontSize: 9, fontWeight: '700', color: '#15803d' },

  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  targetBannerText: { fontSize: 12, fontWeight: '700', color: '#15803d', marginLeft: 8 },

  modalTextInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalSubmitBtn: {
    backgroundColor: '#4338ca',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSubmitBtnDisabled: { backgroundColor: '#94a3b8' },
  modalSubmitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Center Modal for Vacate
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  modalHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  modalTitleCenter: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalBodyCenter: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 12 },
  modalInputBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalActionsCenter: { flexDirection: 'row', gap: 10 },
  modalCenterCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCenterCancelText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modalCenterConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  modalCenterConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
