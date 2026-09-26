// mob_app/src/screens/hostel/RoomMapScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const BED_STATUS_COLORS = {
  VACANT: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', icon: 'bed-outline' },
  OCCUPIED: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: 'person' },
  MAINTENANCE: { bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: 'construct-outline' },
  BLOCKED: { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', icon: 'lock-closed-outline' },
};

export default function RoomMapScreen({ navigation }) {
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [buildingsData, setBuildingsData] = useState([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VACANT' | 'OCCUPIED'

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Allocate Modal State
  const [allocateModalVisible, setAllocateModalVisible] = useState(false);
  const [targetBed, setTargetBed] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [allocating, setAllocating] = useState(false);

  // 1. Fetch Hostels list
  const loadHostels = useCallback(async () => {
    try {
      const res = await client.get('/hostel/hostels').catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : [];
      setHostels(list);
      if (list.length > 0 && !selectedHostelId) {
        setSelectedHostelId(list[0].id);
      }
    } catch {
      setHostels([]);
    }
  }, [selectedHostelId]);

  // 2. Fetch Room Map for Selected Hostel
  const loadRoomMap = useCallback(async (isRefresh = false) => {
    if (!selectedHostelId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get(`/hostel/hostels/${selectedHostelId}/room-map`).catch(() => ({ data: [] }));
      const bList = Array.isArray(res.data) ? res.data : [];
      setBuildingsData(bList);

      if (bList.length > 0) {
        if (!selectedBuildingId || !bList.find(b => b.id === selectedBuildingId)) {
          setSelectedBuildingId(bList[0].id);
          const firstFloor = bList[0].floors?.[0];
          setSelectedFloorId(firstFloor ? firstFloor.id : null);
        }
      }
    } catch {
      setBuildingsData([]);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedHostelId, selectedBuildingId]);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  useEffect(() => {
    loadRoomMap();
  }, [loadRoomMap]);

  // Get active building and floors
  const activeBuilding = useMemo(() => {
    return buildingsData.find(b => b.id === selectedBuildingId) || buildingsData[0] || null;
  }, [buildingsData, selectedBuildingId]);

  const activeFloors = activeBuilding?.floors || [];

  const activeFloor = useMemo(() => {
    return activeFloors.find(f => f.id === selectedFloorId) || activeFloors[0] || null;
  }, [activeFloors, selectedFloorId]);

  const roomsList = activeFloor?.rooms || [];

  // Filter rooms based on status filter
  const filteredRooms = useMemo(() => {
    if (statusFilter === 'ALL') return roomsList;
    return roomsList.filter(r => {
      const beds = r.beds || [];
      if (statusFilter === 'VACANT') return beds.some(b => b.status === 'VACANT');
      if (statusFilter === 'OCCUPIED') return beds.some(b => b.status === 'OCCUPIED');
      return true;
    });
  }, [roomsList, statusFilter]);

  // Calculate Metrics
  const totalBeds = useMemo(() => {
    let count = 0;
    roomsList.forEach(r => { count += (r.beds || []).length; });
    return count;
  }, [roomsList]);

  const vacantBeds = useMemo(() => {
    let count = 0;
    roomsList.forEach(r => {
      (r.beds || []).forEach(b => { if (b.status === 'VACANT') count++; });
    });
    return count;
  }, [roomsList]);

  const occupiedBeds = totalBeds - vacantBeds;

  // Student Search for Bed Allocation
  const searchStudents = async () => {
    if (!studentSearch.trim()) return;
    setSearchingStudents(true);
    try {
      const res = await client.get('/principal/students', {
        params: { search: studentSearch.trim(), per_page: 10 },
      }).catch(() => null);

      const list = Array.isArray(res?.data) ? res.data : (res?.data?.students || res?.data?.data || []);
      setStudentResults(list);
    } catch {
      setStudentResults([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Open Bed Allocation modal
  const handleBedTap = (bed, room) => {
    if (bed.status === 'VACANT') {
      setTargetBed({ ...bed, room_number: room.room_number, room_id: room.id });
      setSelectedStudent(null);
      setStudentResults([]);
      setStudentSearch('');
      setAllocateModalVisible(true);
    } else if (bed.status === 'OCCUPIED') {
      Alert.alert(
        `Bed ${bed.bed_number} (Room ${room.room_number})`,
        `Occupant: ${bed.student_name || 'Allocated Student'}\nStatus: Occupied`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Vacate Bed',
            style: 'destructive',
            onPress: () => confirmVacate(bed.allocation_id || bed.id),
          },
        ]
      );
    }
  };

  // Confirm Bed Allocation
  const handleConfirmAllocate = async () => {
    if (!selectedStudent || !targetBed) {
      Alert.alert('Selection Error', 'Please select a student to allocate to this bed.');
      return;
    }

    setAllocating(true);
    try {
      await client.post('/hostel/allocations', {
        student_id: selectedStudent.id,
        bed_id: targetBed.id,
        check_in_date: new Date().toISOString().split('T')[0],
      });

      Alert.alert('Bed Allocated', `${selectedStudent.name} assigned to Bed ${targetBed.bed_number} (Room ${targetBed.room_number}).`);
      setAllocateModalVisible(false);
      loadRoomMap();
    } catch (err) {
      Alert.alert('Allocation Failed', err.response?.data?.error || 'Could not allocate bed.');
    } finally {
      setAllocating(false);
    }
  };

  // Confirm Vacate
  const confirmVacate = async (allocId) => {
    try {
      await client.post(`/hostel/allocations/${allocId}/vacate`, {
        vacate_date: new Date().toISOString().split('T')[0],
      });
      Alert.alert('Vacated', 'Bed has been marked vacant.');
      loadRoomMap();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not vacate bed.');
    }
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
            <Text style={styles.headerTitle}>Hostel Room Map</Text>
            <Text style={styles.headerSub}>Visual Bed Matrix & Occupancy</Text>
          </View>
        </View>
      </View>

      {/* Buildings & Floors Horizontal Chips */}
      {buildingsData.length > 0 && (
        <View style={styles.buildingBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {buildingsData.map(b => {
              const isSel = selectedBuildingId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.buildingChip, isSel && styles.buildingChipActive]}
                  onPress={() => {
                    setSelectedBuildingId(b.id);
                    setSelectedFloorId(b.floors?.[0]?.id || null);
                  }}
                >
                  <Text style={[styles.buildingChipText, isSel && styles.buildingChipTextActive]}>{b.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Floor Selector Chips */}
      {activeFloors.length > 0 && (
        <View style={styles.floorBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {activeFloors.map(f => {
              const isSel = selectedFloorId === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.floorChip, isSel && styles.floorChipActive]}
                  onPress={() => setSelectedFloorId(f.id)}
                >
                  <Text style={[styles.floorChipText, isSel && styles.floorChipTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* KPI Counters & Filter Row */}
      <View style={styles.metricsBar}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Total Beds</Text>
            <Text style={styles.metricValue}>{totalBeds}</Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.metricLabel, { color: '#16a34a' }]}>Vacant</Text>
            <Text style={[styles.metricValue, { color: '#16a34a' }]}>{vacantBeds}</Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: '#fee2e2' }]}>
            <Text style={[styles.metricLabel, { color: '#dc2626' }]}>Occupied</Text>
            <Text style={[styles.metricValue, { color: '#dc2626' }]}>{occupiedBeds}</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {['ALL', 'VACANT', 'OCCUPIED'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Room Grid */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading hostel room map...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRoomMap(true)} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredRooms.length > 0 ? (
            filteredRooms.map(room => (
              <View key={room.id} style={styles.roomCard}>
                <View style={styles.roomHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.roomNumber}>Room #{room.room_number}</Text>
                    {room.is_ac && (
                      <View style={styles.acBadge}>
                        <Text style={styles.acBadgeText}>AC</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.roomType}>{room.room_type || 'Double Sharing'}</Text>
                </View>

                {/* Beds Grid */}
                <View style={styles.bedsGrid}>
                  {(room.beds || []).map(bed => {
                    const st = BED_STATUS_COLORS[bed.status] || BED_STATUS_COLORS.VACANT;
                    const isOccupied = bed.status === 'OCCUPIED';

                    return (
                      <TouchableOpacity
                        key={bed.id}
                        style={[styles.bedCard, { backgroundColor: st.bg, borderColor: st.border }]}
                        onPress={() => handleBedTap(bed, room)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={st.icon} size={20} color={st.text} />
                        <Text style={[styles.bedNumberText, { color: st.text }]}>
                          Bed {bed.bed_number}
                        </Text>
                        <Text style={[styles.bedStatusText, { color: st.text }]} numberOfLines={1}>
                          {isOccupied ? (bed.student_name || 'Occupied') : 'Vacant'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="home-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Rooms Configured</Text>
              <Text style={styles.emptySub}>No rooms match the selected building, floor, or status filter.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Allocate Bed Modal */}
      <Modal visible={allocateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Allocate Bed {targetBed?.bed_number} (Room {targetBed?.room_number})
              </Text>
              <TouchableOpacity onPress={() => setAllocateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Search Student to Allocate</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Student Name or Admission No..."
                  placeholderTextColor="#94a3b8"
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  onSubmitEditing={searchStudents}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={searchStudents} disabled={searchingStudents}>
                  {searchingStudents ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Student Results */}
              {studentResults.length > 0 && !selectedStudent && (
                <View style={styles.studentDropdown}>
                  {studentResults.map(stu => (
                    <TouchableOpacity
                      key={stu.id}
                      style={styles.studentOption}
                      onPress={() => setSelectedStudent(stu)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentOptionName}>{stu.name}</Text>
                        <Text style={styles.studentOptionMeta}>
                          Adm #{stu.admission_no || '—'} · Class: {stu.class_name || '—'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected Student Card */}
              {selectedStudent && (
                <View style={styles.selectedStudentCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedStudentName}>{selectedStudent.name}</Text>
                    <Text style={styles.selectedStudentSub}>
                      Adm #{selectedStudent.admission_no} · Class {selectedStudent.class_name || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)}>
                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, allocating && { opacity: 0.7 }]}
                onPress={handleConfirmAllocate}
                disabled={allocating || !selectedStudent}
              >
                {allocating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Bed Allocation</Text>
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
  buildingBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  buildingChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  buildingChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  buildingChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  buildingChipTextActive: { color: '#ffffff' },
  floorBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  floorChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  floorChipActive: { backgroundColor: '#e0f2fe' },
  floorChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  floorChipTextActive: { color: '#0284c7', fontWeight: '800' },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metricPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  metricValue: { fontSize: 13, fontWeight: '900', color: '#1e293b' },
  filterChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  filterChipTextActive: { color: '#ffffff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  roomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  roomNumber: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  acBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  acBadgeText: { fontSize: 10, fontWeight: '800', color: '#0284c7' },
  roomType: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  bedsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedCard: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bedNumberText: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  bedStatusText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
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
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
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
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentDropdown: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  studentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  studentOptionName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  studentOptionMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  selectedStudentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  selectedStudentName: { fontSize: 14, fontWeight: '800', color: '#0b57d0' },
  selectedStudentSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
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
