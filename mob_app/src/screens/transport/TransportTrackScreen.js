// mob_app/src/screens/transport/TransportTrackScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Linking, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const POLL_INTERVAL_MS = 10000; // 10s auto-refresh when trip is active

const STATUS_CONFIG = {
  RUNNING: {
    label: 'Bus is in Transit',
    sub: 'Live GPS transmitting in real time',
    bg: '#dcfce7',
    color: '#16a34a',
    icon: 'navigate-circle',
    isLive: true,
  },
  PAUSED: {
    label: 'Bus Stopped / Halted',
    sub: 'Bus is temporarily waiting at stop',
    bg: '#fef3c7',
    color: '#d97706',
    icon: 'pause-circle',
    isLive: true,
  },
  SOS: {
    label: 'Emergency SOS Alert',
    sub: 'Distress signal active — school notified',
    bg: '#fee2e2',
    color: '#dc2626',
    icon: 'warning',
    isLive: true,
  },
  BREAKDOWN: {
    label: 'Vehicle Breakdown',
    sub: 'School is dispatching backup transport',
    bg: '#fee2e2',
    color: '#dc2626',
    icon: 'construct',
    isLive: true,
  },
  COMPLETED: {
    label: "Today's Trip Concluded",
    sub: 'Bus has arrived at school or final depot',
    bg: '#f1f5f9',
    color: '#64748b',
    icon: 'checkmark-circle',
    isLive: false,
  },
  NOT_STARTED: {
    label: 'Trip Not Yet Started',
    sub: 'Scheduled departure pending',
    bg: '#f8fafc',
    color: '#64748b',
    icon: 'time-outline',
    isLive: false,
  },
};

export default function TransportTrackScreen({ navigation }) {
  const { user } = useAuth();
  const isParent = (user?.role === 'PARENT');

  // State
  const [children, setChildren] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // History Modal
  const [historyModal, setHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const pollTimerRef = useRef(null);

  // 1. Initial resolution: get student ID based on Parent or Student role
  const initUser = useCallback(async () => {
    try {
      if (isParent) {
        const cRes = await client.get('/student/children').catch(() => ({ data: [] }));
        const list = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
        setChildren(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
          setStudentName(list[0].name || list[0].full_name || 'Child');
        }
      } else {
        // Student role
        const pRes = await client.get('/student/profile').catch(() => null);
        if (pRes?.data) {
          const s = pRes.data.data || pRes.data;
          setSelectedStudentId(s.id);
          setStudentName(s.name || s.full_name || user?.name || 'Student');
        }
      }
    } catch {
      // ignore
    }
  }, [isParent, user?.name]);

  useEffect(() => {
    initUser();
  }, [initUser]);

  // 2. Fetch live trip details for selected student
  const loadTripData = useCallback(async (isPull = false) => {
    if (!selectedStudentId) return;
    if (isPull) setRefreshing(true);

    try {
      const res = await client.get(`/transport/parent/child/${selectedStudentId}/trip`);
      if (res?.data) {
        setTrip(res.data.data || res.data);
      }
    } catch {
      setTrip(null);
    } finally {
      if (isPull) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId) {
      setLoading(true);
      loadTripData();
    }
  }, [selectedStudentId, loadTripData]);

  // 3. Auto-poll when trip is actively on road (RUNNING, PAUSED, SOS, BREAKDOWN)
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    const isTripActive = trip && ['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'].includes(trip.trip_status);
    if (autoRefreshEnabled && isTripActive) {
      pollTimerRef.current = setInterval(() => {
        loadTripData(false);
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [trip, autoRefreshEnabled, loadTripData]);

  // 4. Load Travel History Logs
  const openHistory = async () => {
    if (!selectedStudentId) return;
    setHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await client.get(`/transport/parent/child/${selectedStudentId}/history`);
      const logs = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setHistoryLogs(logs);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Call Driver
  const handleCallDriver = (phone) => {
    if (!phone) {
      Alert.alert('Unavailable', 'Driver phone number not registered.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  // WhatsApp Driver
  const handleWhatsAppDriver = (phone) => {
    if (!phone) {
      Alert.alert('Unavailable', 'Driver phone number not registered.');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '');
    const formatted = clean.startsWith('91') ? clean : `91${clean}`;
    Linking.openURL(`https://wa.me/${formatted}?text=Hello%20Driver,%20regarding%20school%20bus%20tracking`).catch(() => {
      Alert.alert('Error', 'WhatsApp application not found.');
    });
  };

  const statusMeta = STATUS_CONFIG[trip?.trip_status] || STATUS_CONFIG.NOT_STARTED;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Live Bus Tracking</Text>
            <Text style={styles.headerSub}>GPS Telemetry & Transit Status</Text>
          </View>
        </View>

        {/* Action icons */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, autoRefreshEnabled && styles.headerIconBtnActive]}
            onPress={() => setAutoRefreshEnabled(v => !v)}
          >
            <Ionicons
              name={autoRefreshEnabled ? 'radio' : 'radio-outline'}
              size={18}
              color={autoRefreshEnabled ? '#ea580c' : '#ffffff'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={openHistory}>
            <Ionicons name="time-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Parent Child Switcher Tabs */}
      {isParent && children.length > 1 && (
        <View style={styles.childrenRibbon}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {children.map(c => {
              const active = c.id === selectedStudentId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.childChip, active && styles.childChipActive]}
                  onPress={() => {
                    setSelectedStudentId(c.id);
                    setStudentName(c.name || c.full_name || 'Child');
                  }}
                >
                  <Ionicons
                    name={active ? 'person' : 'person-outline'}
                    size={14}
                    color={active ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.childChipText, active && styles.childChipTextActive]}>
                    {c.name || 'Child'} {c.class_name ? `(${c.class_name})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Connecting to satellite GPS...</Text>
        </View>
      ) : !trip || trip.has_transport === false ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTripData(true)} colors={['#ea580c']} />}
        >
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bus-outline" size={48} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No Transport Enrolled</Text>
          <Text style={styles.emptySub}>
            {studentName ? `${studentName} ` : 'This student '}
            is not currently assigned to any school bus route or vehicle.
          </Text>
          <Text style={styles.emptyHint}>
            Please contact the school transport manager to register for bus service.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTripData(true)}
              colors={['#ea580c']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Main Status Hero Banner */}
          <View style={[styles.statusHero, { borderColor: statusMeta.color, backgroundColor: statusMeta.bg }]}>
            <View style={styles.statusHeroTop}>
              <View style={styles.statusPulseRow}>
                {statusMeta.isLive && <View style={[styles.pulseDot, { backgroundColor: statusMeta.color }]} />}
                <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                  {statusMeta.label.toUpperCase()}
                </Text>
              </View>
              {autoRefreshEnabled && statusMeta.isLive && (
                <View style={styles.liveSyncBadge}>
                  <Ionicons name="sync" size={11} color="#16a34a" />
                  <Text style={styles.liveSyncText}>Auto-Sync 10s</Text>
                </View>
              )}
            </View>

            <Text style={styles.statusHeroTitle}>{trip.route_name || 'Assigned School Bus Route'}</Text>
            <Text style={styles.statusHeroSub}>{statusMeta.sub}</Text>

            {trip.last_updated && (
              <Text style={styles.lastUpdatedText}>
                Last GPS ping: {new Date(trip.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            )}
          </View>

          {/* Child Boarding Roll-Call Event Status */}
          <View style={styles.eventCard}>
            <View style={styles.eventIconBox}>
              <Ionicons
                name={
                  trip.event_status === 'PICKED_UP'
                    ? 'checkmark-done-circle'
                    : trip.event_status === 'DROPPED_OFF'
                    ? 'home'
                    : trip.event_status === 'ABSENT'
                    ? 'close-circle'
                    : 'time-outline'
                }
                size={24}
                color={
                  trip.event_status === 'PICKED_UP'
                    ? '#16a34a'
                    : trip.event_status === 'DROPPED_OFF'
                    ? '#0284c7'
                    : trip.event_status === 'ABSENT'
                    ? '#dc2626'
                    : '#ea580c'
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventCardLabel}>TODAY'S BOARDING STATUS</Text>
              <Text style={styles.eventCardValue}>
                {trip.event_status === 'PICKED_UP'
                  ? `Boarded Bus ${trip.event_time ? `at ${trip.event_time}` : ''}`
                  : trip.event_status === 'DROPPED_OFF'
                  ? `Safely Dropped ${trip.event_time ? `at ${trip.event_time}` : ''}`
                  : trip.event_status === 'ABSENT'
                  ? 'Marked Absent by Driver'
                  : 'Awaiting Pickup at Stop'}
              </Text>
            </View>
            <View
              style={[
                styles.eventStatusBadge,
                trip.event_status === 'PICKED_UP'
                  ? { backgroundColor: '#dcfce7' }
                  : trip.event_status === 'DROPPED_OFF'
                  ? { backgroundColor: '#e0f2fe' }
                  : trip.event_status === 'ABSENT'
                  ? { backgroundColor: '#fee2e2' }
                  : { backgroundColor: '#ffedd5' },
              ]}
            >
              <Text
                style={[
                  styles.eventStatusBadgeText,
                  trip.event_status === 'PICKED_UP'
                    ? { color: '#16a34a' }
                    : trip.event_status === 'DROPPED_OFF'
                    ? { color: '#0284c7' }
                    : trip.event_status === 'ABSENT'
                    ? { color: '#dc2626' }
                    : { color: '#ea580c' },
                ]}
              >
                {trip.event_status || 'PENDING'}
              </Text>
            </View>
          </View>

          {/* Telemetry Metrics Row */}
          <View style={styles.metricsRow}>
            {/* Speed */}
            <View style={styles.metricCard}>
              <View style={styles.metricTop}>
                <Ionicons name="speedometer-outline" size={16} color="#ea580c" />
                <Text style={styles.metricLabel}>LIVE SPEED</Text>
              </View>
              <View style={styles.metricValRow}>
                <Text style={styles.metricVal}>{Math.round(trip.speed || 0)}</Text>
                <Text style={styles.metricUnit}>km/h</Text>
              </View>
              <Text style={styles.metricSub}>
                {(trip.speed || 0) > 2 ? 'In Motion' : 'Halted / Idling'}
              </Text>
            </View>

            {/* Next Stop & ETA */}
            <View style={styles.metricCard}>
              <View style={styles.metricTop}>
                <Ionicons name="pin-outline" size={16} color="#0284c7" />
                <Text style={styles.metricLabel}>NEXT STOP / ETA</Text>
              </View>
              <Text style={styles.nextStopName} numberOfLines={1}>
                {trip.next_stop || trip.pickup_stop || 'School Campus'}
              </Text>
              <Text style={styles.metricEta}>
                {trip.eta ? `ETA ~ ${trip.eta}` : 'On Schedule'}
              </Text>
            </View>
          </View>

          {/* Vehicle Information */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>BUS & FLEET DETAILS</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="bus-outline" size={18} color="#ea580c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowLabel}>Vehicle Registration</Text>
                <Text style={styles.infoRowVal}>{trip.vehicle_number || 'BR06-PA-XXXX'}</Text>
              </View>
              <View style={styles.regBadge}>
                <Text style={styles.regBadgeText}>GPS ENABLED</Text>
              </View>
            </View>

            {trip.pickup_stop && (
              <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }]}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="location-outline" size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowLabel}>Assigned Boarding Stop</Text>
                  <Text style={styles.infoRowVal}>{trip.pickup_stop}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Driver Contact & SOS Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>ASSIGNED DRIVER</Text>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={24} color="#ea580c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{trip.driver_name || 'Driver Assigned'}</Text>
                <Text style={styles.driverPhone}>
                  {trip.driver_mobile || trip.driver_phone || 'Contact via school desk'}
                </Text>
              </View>
            </View>

            {(trip.driver_mobile || trip.driver_phone) && (
              <View style={styles.driverActionButtons}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCallDriver(trip.driver_mobile || trip.driver_phone)}
                >
                  <Ionicons name="call" size={16} color="#ffffff" />
                  <Text style={styles.callBtnText}>Call Driver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => handleWhatsAppDriver(trip.driver_mobile || trip.driver_phone)}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#ffffff" />
                  <Text style={styles.waBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Notice Card */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={20} color="#0284c7" />
            <Text style={styles.tipText}>
              Arrival times are calculated dynamically based on live traffic and road speeds. Parents are advised to reach the stop 5 minutes prior to ETA.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Travel History Modal */}
      <Modal
        visible={historyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Travel History</Text>
                <Text style={styles.modalSub}>Recent boarding & drop logs for {studentName}</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ea580c" />
                <Text style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Loading trip logs...</Text>
              </View>
            ) : historyLogs.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="file-tray-outline" size={40} color="#cbd5e1" />
                <Text style={{ marginTop: 10, color: '#94a3b8', fontSize: 14 }}>No recent travel history recorded.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {historyLogs.map((log, idx) => (
                  <View key={log.id || idx} style={styles.historyItem}>
                    <View
                      style={[
                        styles.historyIconBox,
                        log.event_type === 'PICKED_UP'
                          ? { backgroundColor: '#dcfce7' }
                          : log.event_type === 'DROPPED_OFF'
                          ? { backgroundColor: '#e0f2fe' }
                          : { backgroundColor: '#fee2e2' },
                      ]}
                    >
                      <Ionicons
                        name={
                          log.event_type === 'PICKED_UP'
                            ? 'checkmark'
                            : log.event_type === 'DROPPED_OFF'
                            ? 'home'
                            : 'close'
                        }
                        size={16}
                        color={
                          log.event_type === 'PICKED_UP'
                            ? '#16a34a'
                            : log.event_type === 'DROPPED_OFF'
                            ? '#0284c7'
                            : '#dc2626'
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyEventTitle}>
                        {log.event_type === 'PICKED_UP'
                          ? 'Boarded Bus'
                          : log.event_type === 'DROPPED_OFF'
                          ? 'Dropped Off'
                          : 'Marked Absent'}
                        {log.stop_name ? ` at ${log.stop_name}` : ''}
                      </Text>
                      <Text style={styles.historyEventDate}>
                        {log.recorded_at ? new Date(log.recorded_at).toLocaleString() : 'Recent Trip'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: '#ffffff',
  },
  childrenRibbon: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  childChipActive: {
    backgroundColor: '#c2410c',
    borderColor: '#c2410c',
  },
  childChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  childChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  emptyHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 12,
  },
  content: {
    flex: 1,
  },
  statusHero: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  statusHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveSyncText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  statusHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusHeroSub: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    gap: 12,
  },
  eventIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  eventCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  eventStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  metricSub: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 2,
  },
  nextStopName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  metricEta: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  infoRowVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  regBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  regBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  driverActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 10,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  waBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 10,
  },
  waBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#1e40af',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  historyEventDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
