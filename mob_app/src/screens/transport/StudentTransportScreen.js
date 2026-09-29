// mob_app/src/screens/transport/StudentTransportScreen.js
// Student Transport Allocation Roster — 100% mirrors Web ERP StudentTransport.jsx
// Handles class-wise student transport allocation, route/stop assignments, bus transfer, and fee status.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const FEE_COLORS = {
  PAID:    { bg: '#dcfce7', text: '#16a34a' },
  PENDING: { bg: '#fef3c7', text: '#d97706' },
  OVERDUE: { bg: '#fee2e2', text: '#dc2626' },
  WAIVED:  { bg: '#f1f5f9', text: '#64748b' },
};

export default function StudentTransportScreen({ navigation }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED'

  // Allocation Modal
  const [allocStudent, setAllocStudent] = useState(null);
  const [allocVehicle, setAllocVehicle] = useState('');
  const [allocRoute, setAllocRoute] = useState('');
  const [allocStop, setAllocStop] = useState('');
  const [allocFare, setAllocFare] = useState('');
  const [allocating, setAllocating] = useState(false);

  // Transfer Modal
  const [transferStudent, setTransferStudent] = useState(null);
  const [transVehicle, setTransVehicle] = useState('');
  const [transRoute, setTransRoute] = useState('');
  const [transStop, setTransStop] = useState('');
  const [transReason, setTransReason] = useState('');
  const [transferring, setTransferring] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedClass) params.class_id = selectedClass;
      if (statusFilter !== 'ALL') params.transport_status = statusFilter;

      const [studentsRes, classesRes, vehiclesRes, routesRes] = await Promise.all([
        client.get('/transport/students', { params }).catch(() => ({ data: { data: [] } })),
        client.get('/principal/classes').catch(() => ({ data: { data: [] } })),
        client.get('/transport/vehicles?per_page=100').catch(() => ({ data: { data: [] } })),
        client.get('/transport/routes').catch(() => ({ data: { data: [] } })),
      ]);

      setStudents(studentsRes.data?.data || []);
      setClasses(classesRes.data?.data || classesRes.data?.classes || []);
      setVehicles(vehiclesRes.data?.data || []);
      setRoutes(routesRes.data?.data || []);
    } catch (err) {
      console.error('[StudentTransportScreen] Load failed:', err);
      Alert.alert('Error', 'Failed to load transport student roster.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedClass, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open Assign Modal
  const openAssign = (st) => {
    setAllocStudent(st);
    setAllocVehicle(st.vehicle_id ? String(st.vehicle_id) : (vehicles[0]?.id ? String(vehicles[0].id) : ''));
    setAllocRoute(st.route_id ? String(st.route_id) : (routes[0]?.id ? String(routes[0].id) : ''));
    setAllocStop(st.stop_name || '');
    setAllocFare(st.monthly_fare ? String(st.monthly_fare) : '1200');
  };

  // Save Allocation
  const handleSaveAllocation = async () => {
    if (!allocVehicle || !allocRoute) {
      Alert.alert('Selection Required', 'Please select a vehicle and route for this student.');
      return;
    }

    setAllocating(true);
    try {
      await client.post('/transport/students/assign', {
        student_id: allocStudent.id,
        vehicle_id: Number(allocVehicle),
        route_id: Number(allocRoute),
        stop_name: allocStop.trim() || undefined,
        monthly_fare: allocFare ? Number(allocFare) : 1200,
      });

      Alert.alert('Allocated', `${allocStudent.name} assigned to transport successfully.`);
      setAllocStudent(null);
      loadData();
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Failed to allocate transport.');
    } finally {
      setAllocating(false);
    }
  };

  // Open Transfer Modal
  const openTransfer = (st) => {
    setTransferStudent(st);
    setTransVehicle('');
    setTransRoute('');
    setTransStop('');
    setTransReason('');
  };

  // Save Transfer
  const handleSaveTransfer = async () => {
    if (!transVehicle || !transRoute) {
      Alert.alert('Selection Required', 'Please select the destination vehicle and route.');
      return;
    }

    setTransferring(true);
    try {
      await client.post('/transport/students/transfer', {
        student_id: transferStudent.id,
        new_vehicle_id: Number(transVehicle),
        new_route_id: Number(transRoute),
        new_stop_name: transStop.trim() || undefined,
        transfer_reason: transReason.trim() || undefined,
      });

      Alert.alert('Transferred', `${transferStudent.name} moved to the new transport route.`);
      setTransferStudent(null);
      loadData();
    } catch (err) {
      Alert.alert('Transfer Failed', err.response?.data?.error || 'Failed to transfer student.');
    } finally {
      setTransferring(false);
    }
  };

  const callParent = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const renderStudentCard = ({ item }) => {
    const isEnrolled = !!item.route_name || !!item.vehicle_number;
    const feeStatus = item.fee_status || (isEnrolled ? 'PENDING' : 'WAIVED');
    const feeColor = FEE_COLORS[feeStatus] || FEE_COLORS.PENDING;

    return (
      <View style={styles.card}>
        {/* Top Info */}
        <View style={styles.cardTop}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.feeBadge, { backgroundColor: feeColor.bg }]}>
                <Text style={[styles.feeBadgeText, { color: feeColor.text }]}>{feeStatus}</Text>
              </View>
            </View>
            <Text style={styles.studentMeta}>
              Class {item.class_name || item.class || 'N/A'} • Roll: {item.roll_number || item.roll_no || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Transport Details Banner */}
        {isEnrolled ? (
          <View style={styles.routeBanner}>
            <View style={styles.bannerRow}>
              <Ionicons name="bus" size={16} color="#0b57d0" />
              <Text style={styles.bannerBus}>{item.vehicle_number || 'Assigned Bus'}</Text>
              <Text style={styles.bannerDot}>•</Text>
              <Text style={styles.bannerRoute} numberOfLines={1}>{item.route_name || 'Main Route'}</Text>
            </View>
            <View style={styles.bannerSubRow}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.bannerStop} numberOfLines={1}>Stop: {item.stop_name || 'Standard Stop'}</Text>
              {item.monthly_fare ? (
                <Text style={styles.fareText}>₹{item.monthly_fare}/mo</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.unassignedBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.unassignedText}>Not enrolled in school bus service</Text>
          </View>
        )}

        {/* Parent & Actions */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.parentBtn}
            onPress={() => callParent(item.parent_phone || item.mobile)}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={14} color="#0f172a" />
            <Text style={styles.parentPhone}>{item.parent_phone || item.mobile || 'No Phone'}</Text>
          </TouchableOpacity>

          <View style={styles.actionBtnsRow}>
            {isEnrolled ? (
              <TouchableOpacity
                style={styles.transferBtn}
                onPress={() => openTransfer(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={14} color="#7c3aed" />
                <Text style={styles.transferBtnText}>Transfer</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.assignBtn, isEnrolled && { backgroundColor: '#f1f5f9' }]}
              onPress={() => openAssign(item)}
              activeOpacity={0.7}
            >
              <Ionicons name={isEnrolled ? 'create-outline' : 'add'} size={14} color={isEnrolled ? '#0b57d0' : '#ffffff'} />
              <Text style={[styles.assignBtnText, isEnrolled && { color: '#0b57d0' }]}>
                {isEnrolled ? 'Edit' : 'Enroll Bus'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Student Transport Roster</Text>
          <Text style={styles.headerSubtitle}>{students.length} Students in registry</Text>
        </View>
      </View>

      {/* Transport Quick Service Navigation Ribbon */}
      <View style={styles.serviceNavStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('LiveTracking')}>
            <Ionicons name="navigate" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Live GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Vehicles')}>
            <Ionicons name="bus" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Routes')}>
            <Ionicons name="map" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Routes & Stops</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Drivers')}>
            <Ionicons name="person" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('Conductors')}>
            <Ionicons name="people" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Conductors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.serviceNavTab, styles.serviceNavTabActive]} onPress={() => {}}>
            <Ionicons name="person-add" size={14} color="#0b57d0" />
            <Text style={[styles.serviceNavText, styles.serviceNavTextActive]}>Student Roster</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.serviceNavTab} onPress={() => navigation.navigate('VehicleMaintenance')}>
            <Ionicons name="construct" size={14} color="#64748b" />
            <Text style={styles.serviceNavText}>Maintenance</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student by name, roll, admission no..."
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
      </View>

      {/* Class & Status Filter Horizontal Carousel */}
      <View style={styles.filtersScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {/* Status Tabs */}
          {['ALL', 'ASSIGNED', 'UNASSIGNED'].map(st => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                {st === 'ALL' ? 'All Students' : st === 'ASSIGNED' ? '🚌 On Bus' : '🚶 Self Commute'}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Class Filters */}
          <View style={styles.filterDivider} />
          <TouchableOpacity
            style={[styles.filterChip, !selectedClass && styles.filterChipActive]}
            onPress={() => setSelectedClass('')}
          >
            <Text style={[styles.filterChipText, !selectedClass && styles.filterChipTextActive]}>All Classes</Text>
          </TouchableOpacity>
          {classes.map(c => {
            const isSel = String(c.id) === String(selectedClass);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.filterChip, isSel && styles.filterChipActive]}
                onPress={() => setSelectedClass(String(c.id))}
              >
                <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                  {c.name || `Class ${c.grade_level || c.id}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Students List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0b57d0" />
          <Text style={styles.loadingText}>Loading transport roster...</Text>
        </View>
      ) : students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bus-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Students Found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your class or enrollment filter.</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStudentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Allocation / Enrollment Modal */}
      <Modal visible={!!allocStudent} animationType="slide" transparent onRequestClose={() => setAllocStudent(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Transport: {allocStudent?.name}</Text>
              <TouchableOpacity onPress={() => setAllocStudent(null)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Vehicle Selection */}
              <Text style={styles.fieldLabel}>Select Bus / Vehicle *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {vehicles.map(v => {
                  const isSel = String(v.id) === String(allocVehicle);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.selectPill, isSel && styles.selectPillActive]}
                      onPress={() => setAllocVehicle(String(v.id))}
                    >
                      <Ionicons name="bus" size={14} color={isSel ? '#ffffff' : '#2563eb'} />
                      <Text style={[styles.selectPillText, isSel && styles.selectPillTextActive]}>
                        {v.vehicle_number || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Route Selection */}
              <Text style={styles.fieldLabel}>Select Route *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {routes.map(r => {
                  const isSel = String(r.id) === String(allocRoute);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.selectPill, isSel && styles.selectPillActive]}
                      onPress={() => setAllocRoute(String(r.id))}
                    >
                      <Ionicons name="navigate-circle" size={14} color={isSel ? '#ffffff' : '#7c3aed'} />
                      <Text style={[styles.selectPillText, isSel && styles.selectPillTextActive]}>
                        {r.route_name || r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Stop Name */}
              <Text style={styles.fieldLabel}>Boarding / Drop Stop Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. City Plaza, Main Gate"
                placeholderTextColor="#94a3b8"
                value={allocStop}
                onChangeText={setAllocStop}
              />

              {/* Monthly Transport Fee */}
              <Text style={styles.fieldLabel}>Monthly Transport Fee (₹)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="1200"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={allocFare}
                onChangeText={setAllocFare}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveAllocation}
                disabled={allocating}
                activeOpacity={0.85}
              >
                {allocating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Allocation</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transfer Bus Modal */}
      <Modal visible={!!transferStudent} animationType="slide" transparent onRequestClose={() => setTransferStudent(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Bus: {transferStudent?.name}</Text>
              <TouchableOpacity onPress={() => setTransferStudent(null)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>New Bus / Vehicle *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {vehicles.map(v => {
                  const isSel = String(v.id) === String(transVehicle);
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.selectPill, isSel && styles.selectPillActive]}
                      onPress={() => setTransVehicle(String(v.id))}
                    >
                      <Ionicons name="bus" size={14} color={isSel ? '#ffffff' : '#2563eb'} />
                      <Text style={[styles.selectPillText, isSel && styles.selectPillTextActive]}>
                        {v.vehicle_number || v.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>New Route *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {routes.map(r => {
                  const isSel = String(r.id) === String(transRoute);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.selectPill, isSel && styles.selectPillActive]}
                      onPress={() => setTransRoute(String(r.id))}
                    >
                      <Ionicons name="navigate-circle" size={14} color={isSel ? '#ffffff' : '#7c3aed'} />
                      <Text style={[styles.selectPillText, isSel && styles.selectPillTextActive]}>
                        {r.route_name || r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>New Stop Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="New pickup location"
                placeholderTextColor="#94a3b8"
                value={transStop}
                onChangeText={setTransStop}
              />

              <Text style={styles.fieldLabel}>Transfer Reason / Remarks</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="e.g. Address changed to Sector 62"
                placeholderTextColor="#94a3b8"
                multiline
                value={transReason}
                onChangeText={setTransReason}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#7c3aed' }]}
                onPress={handleSaveTransfer}
                disabled={transferring}
                activeOpacity={0.85}
              >
                {transferring ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Execute Transfer</Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#ffffff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  filtersScroll: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  studentMeta: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  feeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  feeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  routeBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerBus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b57d0',
  },
  bannerDot: {
    color: '#94a3b8',
  },
  bannerRoute: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  bannerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bannerStop: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  fareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  unassignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
  },
  unassignedText: {
    fontSize: 12,
    color: '#64748b',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  parentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  parentPhone: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  transferBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c3aed',
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b57d0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  assignBtnText: {
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalBody: {
    paddingTop: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  selectPillActive: {
    backgroundColor: '#0b57d0',
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  selectPillTextActive: {
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  submitBtn: {
    backgroundColor: '#0b57d0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  serviceNavStrip: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8,
  },
  serviceNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceNavTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  serviceNavText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  serviceNavTextActive: {
    color: '#0b57d0',
    fontWeight: '700',
  },
});
