// mob_app/src/screens/hostel/HostelAdmissionScreen.js
// Hostel Admission & Resident Allotment — 100% mirrors Web ERP HostelAdmission.jsx
// Handles student bed allotment, room hierarchy selection, resident directory & vacate clearance.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function HostelAdmissionScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('RESIDENTS'); // 'RESIDENTS' | 'ALLOCATE'

  // Resident Directory
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Vacate Modal
  const [vacateTarget, setVacateTarget] = useState(null);
  const [vacateReason, setVacateReason] = useState('');
  const [vacating, setVacating] = useState(false);

  // Allocation State
  const [hostels, setHostels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [roomMap, setRoomMap] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);

  // Student Search for Allocation
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Selected Bed
  const [selectedBed, setSelectedBed] = useState(null);
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  // Load Hostels & Classes
  useEffect(() => {
    client.get('/hostel/hostels').then(r => setHostels(r.data || [])).catch(() => {});
    client.get('/principal/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  // Fetch Admitted Residents
  const fetchAdmissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await client.get('/hostel/admissions', { params });
      setAdmissions(res.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to load hostel residents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAdmissions();
  }, [fetchAdmissions]);

  // Search Eligible Students for Allotment
  useEffect(() => {
    if (activeTab !== 'ALLOCATE' || selectedStudent) return;
    if (!studentSearch.trim() && !classFilter) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const params = {};
        if (studentSearch.trim()) params.search = studentSearch.trim();
        if (classFilter) params.class_id = classFilter;
        const res = await client.get('/hostel/students/search-eligible', { params });
        setStudentResults(res.data || []);
      } catch (e) {
        setStudentResults([]);
      } finally {
        setSearchingStudents(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch, classFilter, activeTab, selectedStudent]);

  // Load Visual Room Map when Hostel Selected
  useEffect(() => {
    if (!selectedHostelId) {
      setRoomMap([]);
      setSelectedBed(null);
      return;
    }
    setMapLoading(true);
    client.get(`/hostel/hostels/${selectedHostelId}/room-map`)
      .then(r => setRoomMap(r.data || []))
      .catch(() => Alert.alert('Error', 'Failed to load rooms for selected hostel'))
      .finally(() => setMapLoading(false));
  }, [selectedHostelId]);

  // Confirm Admission
  const handleConfirmAdmission = async () => {
    if (!selectedStudent) {
      Alert.alert('Required', 'Please search and select a student first.');
      return;
    }
    if (!selectedBed) {
      Alert.alert('Required', 'Please select an available (vacant) bed from the room list.');
      return;
    }

    try {
      setSubmittingAdmission(true);
      await client.post('/hostel/admission', {
        student_id: selectedStudent.student_id || selectedStudent.id,
        bed_id: selectedBed.id,
      });

      Alert.alert(
        'Admission Successful',
        `${selectedStudent.name} has been allotted Bed ${selectedBed.bed_number} (Room ${selectedBed.room_number}).`
      );

      // Reset
      setSelectedStudent(null);
      setSelectedBed(null);
      setStudentSearch('');
      setActiveTab('RESIDENTS');
      fetchAdmissions();
    } catch (err) {
      Alert.alert('Admission Failed', err.response?.data?.error || err.message || 'Error allotting bed');
    } finally {
      setSubmittingAdmission(false);
    }
  };

  // Confirm Vacate Bed
  const handleVacateConfirm = async () => {
    if (!vacateTarget?.allocation_id) {
      Alert.alert('Error', 'Allocation record ID missing.');
      return;
    }
    try {
      setVacating(true);
      await client.post(`/hostel/admission/${vacateTarget.allocation_id}/vacate`, {
        reason: vacateReason || 'Student vacated hostel',
      });
      Alert.alert('Bed Vacated', `${vacateTarget.student_name || 'Student'} has been cleared from hostel.`);
      setVacateTarget(null);
      setVacateReason('');
      fetchAdmissions();
    } catch (err) {
      Alert.alert('Vacate Failed', err.response?.data?.error || err.message || 'Failed to process vacate');
    } finally {
      setVacating(false);
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

  // Render Resident Card
  const renderResident = ({ item }) => {
    const feeStatus = item.fee_status || 'PENDING';
    const feeBg = feeStatus === 'PAID' ? '#dcfce7' : feeStatus === 'PARTIAL' ? '#fef3c7' : '#fee2e2';
    const feeColor = feeStatus === 'PAID' ? '#15803d' : feeStatus === 'PARTIAL' ? '#b45309' : '#dc2626';

    return (
      <View style={styles.residentCard}>
        <View style={styles.residentHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(item.student_name || 'S')[0]}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.studentName}>{item.student_name}</Text>
            <Text style={styles.studentSub}>
              {item.class_name ? `Class: ${item.class_name} • ` : ''}Adm: {item.admission_no || item.roll_number || 'N/A'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: feeBg }]}>
            <Text style={[styles.badgeText, { color: feeColor }]}>{feeStatus}</Text>
          </View>
        </View>

        <View style={styles.bedInfoBox}>
          <View style={styles.bedInfoCol}>
            <Text style={styles.infoLabel}>HOSTEL & ROOM</Text>
            <Text style={styles.infoVal}>
              {item.hostel_name || 'Main Hostel'} • R-{item.room_number || '—'}
            </Text>
          </View>
          <View style={styles.bedInfoCol}>
            <Text style={styles.infoLabel}>BED NUMBER</Text>
            <Text style={[styles.infoVal, { color: '#4338ca', fontWeight: '800' }]}>
              Bed {item.bed_number || '—'}
            </Text>
          </View>
        </View>

        {item.guardian_phone || item.parent_phone ? (
          <View style={styles.contactRow}>
            <Text style={styles.contactText}>
              <Ionicons name="call-outline" size={13} color="#64748b" /> Guardian: {item.guardian_phone || item.parent_phone}
            </Text>
            <View style={styles.actionIconGroup}>
              <TouchableOpacity
                style={styles.iconBtnCall}
                onPress={() => handleCall(item.guardian_phone || item.parent_phone)}
              >
                <Ionicons name="call" size={14} color="#15803d" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtnWa}
                onPress={() => handleWhatsApp(item.guardian_phone || item.parent_phone)}
              >
                <Ionicons name="logo-whatsapp" size={14} color="#059669" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.vacateBtn}
            onPress={() => setVacateTarget(item)}
          >
            <Ionicons name="exit-outline" size={14} color="#ef4444" />
            <Text style={styles.vacateBtnText}>Vacate Bed</Text>
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
          <Text style={styles.headerTitle}>Hostel Admissions</Text>
          <Text style={styles.headerSubtitle}>Student Bed Allotment & Residents</Text>
        </View>
      </View>

      {/* Segmented Control Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'RESIDENTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('RESIDENTS')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'RESIDENTS' ? '#4338ca' : '#64748b'}
          />
          <Text style={[styles.tabText, activeTab === 'RESIDENTS' && styles.tabTextActive]}>
            Residents ({admissions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ALLOCATE' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ALLOCATE')}
        >
          <Ionicons
            name="bed-outline"
            size={16}
            color={activeTab === 'ALLOCATE' ? '#4338ca' : '#64748b'}
          />
          <Text style={[styles.tabText, activeTab === 'ALLOCATE' && styles.tabTextActive]}>
            Allot New Bed
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'RESIDENTS' ? (
        /* Resident List View */
        <View style={{ flex: 1 }}>
          {/* Search Box */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search resident by student or room..."
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
              <Text style={styles.loadingText}>Loading residents...</Text>
            </View>
          ) : (
            <FlatList
              data={admissions}
              keyExtractor={(item, index) => item.allocation_id?.toString() || index.toString()}
              renderItem={renderResident}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAdmissions();
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="bed-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No Hostel Residents Found</Text>
                  <Text style={styles.emptySubtitle}>
                    Switch to the "Allot New Bed" tab to register students in hostel.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        /* Allocate New Bed View */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Step 1: Student Selection */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Select Student</Text>
            </View>

            {selectedStudent ? (
              <View style={styles.selectedStudentBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedStudentName}>{selectedStudent.name}</Text>
                  <Text style={styles.selectedStudentSub}>
                    {selectedStudent.class_name ? `Class: ${selectedStudent.class_name} • ` : ''}
                    Roll: {selectedStudent.roll_number || 'N/A'} • Gender: {selectedStudent.gender || '—'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeStudentBtn}
                  onPress={() => setSelectedStudent(null)}
                >
                  <Text style={styles.changeStudentBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.inputRow}>
                  <Ionicons name="search-outline" size={18} color="#94a3b8" />
                  <TextInput
                    style={styles.plainInput}
                    placeholder="Search eligible student name or roll..."
                    placeholderTextColor="#94a3b8"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                  />
                  {searchingStudents ? <ActivityIndicator size="small" color="#4338ca" /> : null}
                </View>

                {studentResults.length > 0 ? (
                  <View style={styles.dropdownResults}>
                    {studentResults.map((s) => (
                      <TouchableOpacity
                        key={s.id || s.student_id}
                        style={styles.studentResultRow}
                        onPress={() => {
                          setSelectedStudent(s);
                          setStudentResults([]);
                          setStudentSearch('');
                        }}
                      >
                        <Ionicons name="person-outline" size={16} color="#4338ca" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.resName}>{s.name}</Text>
                          <Text style={styles.resSub}>Class: {s.class_name || 'N/A'} • Roll: {s.roll_number || '—'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Step 2: Select Hostel & Bed */}
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Choose Hostel & Bed</Text>
            </View>

            {/* Hostel Selector Chips */}
            <Text style={styles.subHeading}>Select Hostel Building:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {hostels.map((h) => {
                const active = selectedHostelId === h.id.toString() || selectedHostelId === h.id;
                return (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.hostelChip, active && styles.hostelChipActive]}
                    onPress={() => setSelectedHostelId(h.id.toString())}
                  >
                    <Ionicons
                      name="business-outline"
                      size={14}
                      color={active ? '#fff' : '#475569'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.hostelChipText, active && styles.hostelChipTextActive]}>
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Room & Bed Picker */}
            {mapLoading ? (
              <ActivityIndicator size="small" color="#4338ca" style={{ marginVertical: 20 }} />
            ) : selectedHostelId ? (
              <View>
                {roomMap.length === 0 ? (
                  <Text style={styles.noBedsText}>No room configuration found for this hostel.</Text>
                ) : (
                  roomMap.map((building, bIdx) => (
                    <View key={bIdx} style={styles.buildingGroup}>
                      <Text style={styles.buildingTitle}>🏢 {building.name}</Text>
                      {building.floors?.map((floor, fIdx) => (
                        <View key={fIdx} style={styles.floorGroup}>
                          <Text style={styles.floorTitle}>Floor: {floor.name}</Text>
                          <View style={styles.roomsGrid}>
                            {floor.rooms?.map((room, rIdx) => (
                              <View key={rIdx} style={styles.roomBox}>
                                <Text style={styles.roomNum}>Room {room.room_number}</Text>
                                <View style={styles.bedsGrid}>
                                  {room.beds?.map((bed) => {
                                    const isVacant = bed.status === 'VACANT';
                                    const isSelected = selectedBed?.id === bed.id;
                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={[
                                          styles.bedButton,
                                          !isVacant && styles.bedButtonOccupied,
                                          isSelected && styles.bedButtonSelected,
                                        ]}
                                        disabled={!isVacant}
                                        onPress={() =>
                                          setSelectedBed({
                                            ...bed,
                                            room_number: room.room_number,
                                            floor_name: floor.name,
                                            building_name: building.name,
                                          })
                                        }
                                      >
                                        <Ionicons
                                          name={isVacant ? 'bed-outline' : 'person'}
                                          size={13}
                                          color={
                                            isSelected ? '#fff' : isVacant ? '#15803d' : '#94a3b8'
                                          }
                                        />
                                        <Text
                                          style={[
                                            styles.bedButtonText,
                                            isSelected && styles.bedButtonTextSelected,
                                            !isVacant && styles.bedButtonTextOccupied,
                                          ]}
                                        >
                                          B{bed.bed_number}
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
              </View>
            ) : (
              <Text style={styles.noBedsText}>Select a hostel building to view vacant beds.</Text>
            )}

            {/* Selected Bed Banner */}
            {selectedBed ? (
              <View style={styles.selectedBedBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#15803d" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.selectedBedTitle}>
                    Bed {selectedBed.bed_number} Selected
                  </Text>
                  <Text style={styles.selectedBedSub}>
                    {selectedBed.building_name} • Room {selectedBed.room_number}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selectedStudent || !selectedBed || submittingAdmission) && styles.submitBtnDisabled,
            ]}
            disabled={!selectedStudent || !selectedBed || submittingAdmission}
            onPress={handleConfirmAdmission}
          >
            {submittingAdmission ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Confirm Bed Allocation</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Vacate Modal */}
      <Modal visible={!!vacateTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.modalTitle}>Confirm Hostel Vacate</Text>
            </View>
            <Text style={styles.modalBody}>
              Are you sure you want to vacate{' '}
              <Text style={{ fontWeight: '700' }}>{vacateTarget?.student_name}</Text> from Bed{' '}
              {vacateTarget?.bed_number} (Room {vacateTarget?.room_number})?
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for leaving (e.g. course completed, day scholar)..."
              placeholderTextColor="#94a3b8"
              value={vacateReason}
              onChangeText={setVacateReason}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setVacateTarget(null);
                  setVacateReason('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                disabled={vacating}
                onPress={handleVacateConfirm}
              >
                {vacating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Vacate</Text>
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

  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  tabBtnActive: { backgroundColor: '#e0e7ff' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#4338ca' },

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

  residentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  residentHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#4338ca' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  studentSub: { fontSize: 12, color: '#64748b', marginTop: 1 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  bedInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  bedInfoCol: { flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 2 },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  contactText: { fontSize: 12, color: '#64748b' },
  actionIconGroup: { flexDirection: 'row', gap: 8 },
  iconBtnCall: {
    backgroundColor: '#dcfce7',
    padding: 6,
    borderRadius: 6,
  },
  iconBtnWa: {
    backgroundColor: '#d1fae5',
    padding: 6,
    borderRadius: 6,
  },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vacateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  vacateBtnText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  // Allocation Form Styles
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepNumberText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },

  selectedStudentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    padding: 12,
    borderRadius: 8,
  },
  selectedStudentName: { fontSize: 14, fontWeight: '700', color: '#312e81' },
  selectedStudentSub: { fontSize: 12, color: '#4338ca', marginTop: 2 },
  changeStudentBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeStudentBtnText: { fontSize: 12, fontWeight: '600', color: '#4338ca' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  plainInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a' },

  dropdownResults: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 180,
  },
  studentResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  resSub: { fontSize: 11, color: '#64748b' },

  subHeading: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  hostelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  hostelChipActive: { backgroundColor: '#4338ca' },
  hostelChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  hostelChipTextActive: { color: '#fff' },

  noBedsText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginVertical: 12 },

  buildingGroup: { marginTop: 10 },
  buildingTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  floorGroup: { marginLeft: 6, marginBottom: 10 },
  floorTitle: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    minWidth: 100,
  },
  roomNum: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6 },
  bedsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  bedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  bedButtonOccupied: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  bedButtonSelected: {
    backgroundColor: '#4338ca',
    borderColor: '#312e81',
  },
  bedButtonText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  bedButtonTextOccupied: { color: '#94a3b8' },
  bedButtonTextSelected: { color: '#fff' },

  selectedBedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  selectedBedTitle: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  selectedBedSub: { fontSize: 11, color: '#166534' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4338ca',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalBody: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  modalConfirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
