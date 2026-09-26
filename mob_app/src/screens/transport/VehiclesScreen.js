// mob_app/src/screens/transport/VehiclesScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const VEHICLE_TYPES = ['BUS', 'VAN', 'MINIBUS', 'CAR'];

export default function VehiclesScreen({ navigation }) {
  const { user } = useAuth();
  const canManage = ['PRINCIPAL', 'ADMIN', 'TRANSPORT', 'SUPER_ADMIN'].includes(user?.role);

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Passenger Roster Modal
  const [rosterModal, setRosterModal] = useState(false);
  const [rosterVehicle, setRosterVehicle] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Add Vehicle Modal
  const [addModal, setAddModal] = useState(false);
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('BUS');
  const [newCapacity, setNewCapacity] = useState('40');
  const [newDriverId, setNewDriverId] = useState('');
  const [newInsuranceExpiry, setNewInsuranceExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Vehicles
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [vRes, dRes] = await Promise.all([
        client.get('/transport/vehicles').catch(() => ({ data: [] })),
        client.get('/transport/drivers').catch(() => ({ data: [] })),
      ]);

      const vList = Array.isArray(vRes.data) ? vRes.data : (vRes.data?.data || []);
      const dList = Array.isArray(dRes.data) ? dRes.data : (dRes.data?.data || []);

      setVehicles(vList);
      setDrivers(dList);
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

  // Open Passenger Roster
  const handleOpenRoster = async (v) => {
    setRosterVehicle(v);
    setRosterModal(true);
    setRosterLoading(true);
    try {
      const res = await client.get(`/transport/vehicles/${v.id}/students`);
      if (res?.data) {
        setRosterData(res.data.data || res.data);
      }
    } catch {
      setRosterData(null);
    } finally {
      setRosterLoading(false);
    }
  };

  // Create Vehicle
  const handleCreateVehicle = async () => {
    if (!newVehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter a vehicle registration number.');
      return;
    }

    setSubmitting(true);
    try {
      await client.post('/transport/vehicles', {
        vehicle_number: newVehicleNumber.trim().toUpperCase(),
        vehicle_name: newVehicleName.trim(),
        vehicle_type: newVehicleType,
        capacity: parseInt(newCapacity, 10) || 0,
        driver_id: newDriverId ? parseInt(newDriverId, 10) : null,
        insurance_expiry: newInsuranceExpiry.trim() || null,
      });

      Alert.alert('Success', 'Vehicle added to fleet successfully!');
      setAddModal(false);
      setNewVehicleNumber('');
      setNewVehicleName('');
      setNewCapacity('40');
      setNewDriverId('');
      setNewInsuranceExpiry('');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create vehicle.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  // KPIs
  const totalCount = vehicles.length;
  const busCount = vehicles.filter(v => (v.vehicle_type || 'BUS') === 'BUS').length;
  const vanCount = vehicles.filter(v => ['VAN', 'MINIBUS'].includes(v.vehicle_type)).length;
  const activeCount = vehicles.filter(v => (v.status || 'ACTIVE') === 'ACTIVE').length;

  // Filtered
  const filteredVehicles = vehicles.filter(v => {
    const q = search.trim().toLowerCase();
    const num = (v.vehicle_number || v.registration_no || '').toLowerCase();
    const name = (v.vehicle_name || v.model || '').toLowerCase();
    const dName = (v.driver?.name || v.driver_name || '').toLowerCase();
    const matchesSearch = !q || num.includes(q) || name.includes(q) || dName.includes(q);

    if (!matchesSearch) return false;

    if (filterType === 'BUS') return (v.vehicle_type || 'BUS') === 'BUS';
    if (filterType === 'VAN') return ['VAN', 'MINIBUS'].includes(v.vehicle_type);
    if (filterType === 'ACTIVE') return (v.status || 'ACTIVE') === 'ACTIVE';
    if (filterType === 'MAINTENANCE') return v.status === 'MAINTENANCE';

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
            <Text style={styles.headerTitle}>Fleet Vehicles</Text>
            <Text style={styles.headerSub}>Buses, Vans & Capacity Management</Text>
          </View>
        </View>

        {canManage && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
            <Ionicons name="add" size={18} color="#c2410c" />
            <Text style={styles.addBtnText}>Add Vehicle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiValue}>{totalCount}</Text>
          <Text style={styles.kpiLabel}>TOTAL FLEET</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#c2410c' }]}>{busCount}</Text>
          <Text style={styles.kpiLabel}>BUSES</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{vanCount}</Text>
          <Text style={styles.kpiLabel}>VANS / MINI</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{activeCount}</Text>
          <Text style={styles.kpiLabel}>ACTIVE</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicle number or driver..."
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'ALL', label: `All (${totalCount})` },
            { key: 'BUS', label: `Buses (${busCount})` },
            { key: 'VAN', label: `Vans (${vanCount})` },
            { key: 'ACTIVE', label: `Active (${activeCount})` },
            { key: 'MAINTENANCE', label: 'Maintenance' },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filterType === f.key && styles.filterChipActive]}
              onPress={() => setFilterType(f.key)}
            >
              <Text style={[styles.filterChipText, filterType === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Loading fleet vehicles...</Text>
        </View>
      ) : filteredVehicles.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#ea580c']} />}
        >
          <Ionicons name="bus-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Vehicles Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No fleet vehicles match your search filter.' : 'No vehicles currently registered in system.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#ea580c']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredVehicles.map((v, i) => {
            const regNo = v.vehicle_number || v.registration_no || `Bus #${i + 1}`;
            const model = v.vehicle_name || v.model || 'School Bus';
            const cap = v.capacity || 40;
            const assignedCount = v.assigned_students_count || v.assigned_count || 0;
            const status = v.status || 'ACTIVE';
            const driverName = v.driver?.name || v.driver_name || 'Unassigned';

            const isMaintenance = status === 'MAINTENANCE';
            const isInactive = status === 'INACTIVE';

            return (
              <View key={v.id || i} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="bus" size={22} color="#ea580c" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.regNo}>{regNo}</Text>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{v.vehicle_type || 'BUS'}</Text>
                      </View>
                    </View>
                    <Text style={styles.modelText}>{model}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isMaintenance
                        ? { backgroundColor: '#fef3c7' }
                        : isInactive
                        ? { backgroundColor: '#fee2e2' }
                        : { backgroundColor: '#dcfce7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isMaintenance
                          ? { color: '#d97706' }
                          : isInactive
                          ? { color: '#dc2626' }
                          : { color: '#16a34a' },
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                {/* Capacity Progress Bar */}
                <View style={styles.capacitySection}>
                  <View style={styles.capacityHeader}>
                    <Text style={styles.capacityLabel}>SEATING CAPACITY</Text>
                    <Text style={styles.capacityNum}>
                      {assignedCount} / {cap} Seats Occupied
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, cap > 0 ? (assignedCount / cap) * 100 : 0)}%`,
                          backgroundColor: assignedCount >= cap ? '#dc2626' : '#ea580c',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Driver & Details */}
                <View style={styles.detailRow}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>DRIVER</Text>
                    <Text style={styles.detailVal}>{driverName}</Text>
                  </View>

                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>INSURANCE</Text>
                    <Text style={styles.detailVal}>
                      {v.insurance_expiry ? new Date(v.insurance_expiry).toLocaleDateString() : 'Valid'}
                    </Text>
                  </View>
                </View>

                {/* Action Footer */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.rosterBtn}
                    onPress={() => handleOpenRoster(v)}
                  >
                    <Ionicons name="people-outline" size={16} color="#0284c7" />
                    <Text style={styles.rosterBtnText}>View Passenger Roster</Text>
                  </TouchableOpacity>

                  {v.driver_phone && (
                    <TouchableOpacity
                      style={styles.callSmallBtn}
                      onPress={() => handleCall(v.driver_phone)}
                    >
                      <Ionicons name="call" size={14} color="#16a34a" />
                      <Text style={styles.callSmallBtnText}>Call Driver</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Passenger Roster Modal */}
      <Modal
        visible={rosterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setRosterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {rosterVehicle?.vehicle_number} Roster
                </Text>
                <Text style={styles.modalSub}>
                  Capacity: {rosterData?.capacity || rosterVehicle?.capacity || 40} seats • Assigned: {rosterData?.assigned_count || 0}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRosterModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {rosterLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ea580c" />
                <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading passenger manifest...</Text>
              </View>
            ) : !rosterData?.students || rosterData.students.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="people-outline" size={40} color="#cbd5e1" />
                <Text style={{ marginTop: 10, color: '#94a3b8', fontSize: 13 }}>
                  No students currently assigned to this vehicle.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {rosterData.students.map((st, idx) => (
                  <View key={st.student_id || idx} style={styles.studentItem}>
                    <View style={styles.studentAvatar}>
                      <Ionicons name="person" size={16} color="#0284c7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentItemName}>{st.student_name}</Text>
                      <Text style={styles.studentItemClass}>
                        {st.class_name} • Stop: {st.pickup_stop_name || 'Campus'}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View
                        style={[
                          styles.feeBadge,
                          st.fee_status === 'PAID'
                            ? { backgroundColor: '#dcfce7' }
                            : { backgroundColor: '#fee2e2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.feeBadgeText,
                            st.fee_status === 'PAID' ? { color: '#16a34a' } : { color: '#dc2626' },
                          ]}
                        >
                          {st.fee_status === 'PAID' ? 'FEE PAID' : 'FEE DUE'}
                        </Text>
                      </View>

                      {st.father_mobile && (
                        <TouchableOpacity
                          style={styles.parentCallBtn}
                          onPress={() => handleCall(st.father_mobile)}
                        >
                          <Ionicons name="call" size={12} color="#16a34a" />
                          <Text style={styles.parentCallText}>Parent</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Vehicle Modal */}
      <Modal
        visible={addModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Fleet Vehicle</Text>
                <Text style={styles.modalSub}>Register new school bus or van</Text>
              </View>
              <TouchableOpacity onPress={() => setAddModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>VEHICLE REGISTRATION NUMBER *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. BR06-PA-9988"
                placeholderTextColor="#94a3b8"
                value={newVehicleNumber}
                onChangeText={setNewVehicleNumber}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>VEHICLE MODEL / MAKE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Tata Starbus 40 Seater"
                placeholderTextColor="#94a3b8"
                value={newVehicleName}
                onChangeText={setNewVehicleName}
              />

              <Text style={styles.inputLabel}>VEHICLE TYPE</Text>
              <View style={styles.typeSelectorRow}>
                {VEHICLE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeSelectChip, newVehicleType === t && styles.typeSelectChipActive]}
                    onPress={() => setNewVehicleType(t)}
                  >
                    <Text style={[styles.typeSelectText, newVehicleType === t && styles.typeSelectTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>SEATING CAPACITY *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 40"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={newCapacity}
                onChangeText={setNewCapacity}
              />

              <Text style={styles.inputLabel}>ASSIGNED DRIVER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.driverSelectChip, !newDriverId && styles.driverSelectChipActive]}
                  onPress={() => setNewDriverId('')}
                >
                  <Text style={[styles.driverSelectText, !newDriverId && styles.driverSelectTextActive]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {drivers.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.driverSelectChip, String(newDriverId) === String(d.id) && styles.driverSelectChipActive]}
                    onPress={() => setNewDriverId(String(d.id))}
                  >
                    <Text style={[styles.driverSelectText, String(newDriverId) === String(d.id) && styles.driverSelectTextActive]}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>INSURANCE EXPIRY (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2027-12-31"
                placeholderTextColor="#94a3b8"
                value={newInsuranceExpiry}
                onChangeText={setNewInsuranceExpiry}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleCreateVehicle}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Register Vehicle</Text>
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
    backgroundColor: '#c2410c',
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
    color: '#fed7aa',
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c2410c',
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
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ffffff',
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
  filterScroll: {
    marginVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#c2410c',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
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
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regNo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  typeBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#c2410c',
  },
  modelText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  capacitySection: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  capacityNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  rosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  rosterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  callSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  callSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
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
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentItemClass: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  feeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  feeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  parentCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  parentCallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
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
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeSelectChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeSelectChipActive: {
    backgroundColor: '#c2410c',
    borderColor: '#c2410c',
  },
  typeSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  typeSelectTextActive: {
    color: '#ffffff',
  },
  driverSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  driverSelectChipActive: {
    backgroundColor: '#c2410c',
    borderColor: '#c2410c',
  },
  driverSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  driverSelectTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c2410c',
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
