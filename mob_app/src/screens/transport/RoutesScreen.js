// mob_app/src/screens/transport/RoutesScreen.js
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

export default function RoutesScreen({ navigation }) {
  const { user } = useAuth();
  const canManage = ['PRINCIPAL', 'ADMIN', 'TRANSPORT', 'SUPER_ADMIN'].includes(user?.role);

  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  // Create Route Modal
  const [addRouteModal, setAddRouteModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteCode, setNewRouteCode] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [submittingRoute, setSubmittingRoute] = useState(false);

  // Create Stop Modal
  const [addStopModal, setAddStopModal] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [newStopDesc, setNewStopDesc] = useState('');
  const [submittingStop, setSubmittingStop] = useState(false);

  // Load Routes & Stops
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [rRes, sRes, vRes] = await Promise.all([
        client.get('/transport/routes').catch(() => ({ data: [] })),
        client.get('/transport/stops').catch(() => ({ data: [] })),
        client.get('/transport/vehicles').catch(() => ({ data: [] })),
      ]);

      const rList = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.data || []);
      const sList = Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data || []);
      const vList = Array.isArray(vRes.data) ? vRes.data : (vRes.data?.data || []);

      setRoutes(rList);
      setStops(sList);
      setVehicles(vList);
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

  // Toggle Route Expansion
  const toggleExpand = (id) => {
    setExpandedRouteId(prev => (prev === id ? null : id));
  };

  // Submit Create Route
  const handleCreateRoute = async () => {
    if (!newRouteName.trim()) {
      Alert.alert('Required', 'Please enter a route name.');
      return;
    }

    setSubmittingRoute(true);
    try {
      await client.post('/transport/routes', {
        name: newRouteName.trim(),
        code: newRouteCode.trim() || undefined,
        vehicle_id: newVehicleId ? parseInt(newVehicleId, 10) : null,
      });

      Alert.alert('Success', 'Route created successfully!');
      setAddRouteModal(false);
      setNewRouteName('');
      setNewRouteCode('');
      setNewVehicleId('');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create route.');
    } finally {
      setSubmittingRoute(false);
    }
  };

  // Submit Create Stop
  const handleCreateStop = async () => {
    if (!newStopName.trim()) {
      Alert.alert('Required', 'Please enter a stop name.');
      return;
    }

    setSubmittingStop(true);
    try {
      await client.post('/transport/stops', {
        name: newStopName.trim(),
        description: newStopDesc.trim(),
      });

      Alert.alert('Success', 'Bus stop created successfully!');
      setAddStopModal(false);
      setNewStopName('');
      setNewStopDesc('');
      loadData(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create stop.');
    } finally {
      setSubmittingStop(false);
    }
  };

  // KPIs
  const totalRoutes = routes.length;
  const totalStops = stops.length;
  const totalAssignedStudents = routes.reduce((sum, r) => sum + (r.students_count || r.assigned_students_count || 0), 0);

  // Filtered
  const filteredRoutes = routes.filter(r => {
    const q = search.trim().toLowerCase();
    const name = (r.name || r.route_name || '').toLowerCase();
    const code = (r.code || '').toLowerCase();
    const vNo = (r.vehicle?.vehicle_number || r.vehicle_no || '').toLowerCase();
    return !q || name.includes(q) || code.includes(q) || vNo.includes(q);
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
            <Text style={styles.headerTitle}>Transport Routes</Text>
            <Text style={styles.headerSub}>Bus Lines, Pickup Points & Schedules</Text>
          </View>
        </View>

        {canManage && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setAddStopModal(true)}>
              <Ionicons name="pin" size={14} color="#c2410c" />
              <Text style={styles.topBtnText}>+ Stop</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBtn} onPress={() => setAddRouteModal(true)}>
              <Ionicons name="add" size={16} color="#c2410c" />
              <Text style={styles.topBtnText}>+ Route</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* KPI Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiValue}>{totalRoutes}</Text>
          <Text style={styles.kpiLabel}>TOTAL ROUTES</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#0284c7' }]}>{totalStops}</Text>
          <Text style={styles.kpiLabel}>BUS STOPS</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{totalAssignedStudents}</Text>
          <Text style={styles.kpiLabel}>COMMUTERS</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search route by name or vehicle..."
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
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Loading routes and stops...</Text>
        </View>
      ) : filteredRoutes.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#ea580c']} />}
        >
          <Ionicons name="map-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Routes Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No routes match your search query.' : 'No transport routes configured yet.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#ea580c']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredRoutes.map((r, idx) => {
            const isExpanded = expandedRouteId === r.id;
            const rStops = r.stops || [];
            const vNo = r.vehicle?.vehicle_number || r.vehicle_number || 'Unassigned';
            const dName = r.vehicle?.driver?.name || r.driver_name || 'Unassigned';

            return (
              <View key={r.id || idx} style={styles.card}>
                {/* Route Header */}
                <TouchableOpacity
                  style={styles.routeHeader}
                  onPress={() => toggleExpand(r.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.mapIconCircle}>
                    <Ionicons name="map" size={20} color="#ea580c" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeName}>{r.name || `Route #${r.id}`}</Text>
                    <Text style={styles.routeVehicle}>
                      Bus: {vNo} • Driver: {dName}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={styles.stopsBadge}>
                      <Text style={styles.stopsBadgeText}>{rStops.length || r.stops_count || 0} Stops</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#94a3b8"
                    />
                  </View>
                </TouchableOpacity>

                {/* Start to End ribbon */}
                {(r.start_point || r.end_point) && (
                  <View style={styles.pointsBar}>
                    <Ionicons name="trail-sign-outline" size={14} color="#64748b" />
                    <Text style={styles.pointsText}>
                      {r.start_point || 'Campus'} → {r.end_point || 'Destination'}
                    </Text>
                  </View>
                )}

                {/* Expandable Stops Timeline */}
                {isExpanded && (
                  <View style={styles.timelineSection}>
                    <Text style={styles.timelineTitle}>ROUTE STOPS SEQUENCE</Text>

                    {rStops.length === 0 ? (
                      <Text style={styles.noStopsText}>No stops registered for this route line.</Text>
                    ) : (
                      rStops.map((st, sIdx) => (
                        <View key={st.id || sIdx} style={styles.timelineRow}>
                          <View style={styles.timelineNodeCol}>
                            <View style={styles.timelineDot}>
                              <Text style={styles.timelineNum}>{sIdx + 1}</Text>
                            </View>
                            {sIdx < rStops.length - 1 && <View style={styles.timelineLine} />}
                          </View>

                          <View style={styles.timelineInfo}>
                            <Text style={styles.stopNameText}>{st.stop?.name || st.name || `Stop ${sIdx + 1}`}</Text>
                            <Text style={styles.stopMetaText}>
                              {st.estimated_time ? `Arrival: ${st.estimated_time}` : 'Scheduled Stop'}
                              {st.monthly_fare ? ` • Fare: ₹${st.monthly_fare}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Create Route Modal */}
      <Modal
        visible={addRouteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddRouteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create Bus Route</Text>
                <Text style={styles.modalSub}>Define new school transport route</Text>
              </View>
              <TouchableOpacity onPress={() => setAddRouteModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>ROUTE NAME *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Route 4 - Station to Campus"
                placeholderTextColor="#94a3b8"
                value={newRouteName}
                onChangeText={setNewRouteName}
              />

              <Text style={styles.inputLabel}>ROUTE CODE (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. R-04"
                placeholderTextColor="#94a3b8"
                value={newRouteCode}
                onChangeText={setNewRouteCode}
              />

              <Text style={styles.inputLabel}>ASSIGN VEHICLE / BUS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.driverSelectChip, !newVehicleId && styles.driverSelectChipActive]}
                  onPress={() => setNewVehicleId('')}
                >
                  <Text style={[styles.driverSelectText, !newVehicleId && styles.driverSelectTextActive]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {vehicles.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.driverSelectChip, String(newVehicleId) === String(v.id) && styles.driverSelectChipActive]}
                    onPress={() => setNewVehicleId(String(v.id))}
                  >
                    <Text style={[styles.driverSelectText, String(newVehicleId) === String(v.id) && styles.driverSelectTextActive]}>
                      {v.vehicle_number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, submittingRoute && { opacity: 0.7 }]}
                onPress={handleCreateRoute}
                disabled={submittingRoute}
              >
                {submittingRoute ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Create Route</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Stop Modal */}
      <Modal
        visible={addStopModal}
        animationType="slide"
        transparent
        onRequestClose={() => setAddStopModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Bus Stop</Text>
                <Text style={styles.modalSub}>Register new passenger pickup location</Text>
              </View>
              <TouchableOpacity onPress={() => setAddStopModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>STOP NAME *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Zero Mile Chowk"
                placeholderTextColor="#94a3b8"
                value={newStopName}
                onChangeText={setNewStopName}
              />

              <Text style={styles.inputLabel}>DESCRIPTION / LANDMARK</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Near Reliance Petrol Pump"
                placeholderTextColor="#94a3b8"
                value={newStopDesc}
                onChangeText={setNewStopDesc}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submittingStop && { opacity: 0.7 }]}
                onPress={handleCreateStop}
                disabled={submittingStop}
              >
                {submittingStop ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="pin" size={18} color="#ffffff" />
                    <Text style={styles.submitBtnText}>Register Bus Stop</Text>
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
  topBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topBtnText: {
    fontSize: 11,
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
    paddingVertical: 12,
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
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  routeVehicle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  stopsBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  pointsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  pointsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  timelineSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  timelineTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  noStopsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 40,
  },
  timelineNodeCol: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNum: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#fed7aa',
    marginVertical: 2,
  },
  timelineInfo: {
    flex: 1,
    paddingBottom: 10,
  },
  stopNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  stopMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
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
