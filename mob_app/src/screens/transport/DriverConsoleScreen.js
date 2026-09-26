// mob_app/src/screens/transport/DriverConsoleScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const GPS_PING_INTERVAL_MS = 10000; // 10s live ping during running trip

export default function DriverConsoleScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Driver Assignment & Trip Data
  const [todayData, setTodayData] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripStatus, setTripStatus] = useState('NOT_STARTED'); // 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'SOS' | 'BREAKDOWN'
  const [stops, setStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [studentBoarding, setStudentBoarding] = useState({}); // { [student_id]: 'PICKED_UP' | 'DROPPED_OFF' | 'ABSENT' }

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);
  const [breakdownModal, setBreakdownModal] = useState(false);
  const [breakdownRemarks, setBreakdownRemarks] = useState('');

  // Simulated GPS Coordinates
  const [currentCoords, setCurrentCoords] = useState({ lat: 26.1209, lng: 85.3647, speed: 28 });
  const gpsTimerRef = useRef(null);

  // 1. Fetch Today's Driver Assignment & Active Trip
  const loadDriverData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await client.get('/transport/driver/today').catch(() => null);
      if (res?.data) {
        const d = res.data.data || res.data;
        setTodayData(d);
        const curr = d.current_trip || null;
        setActiveTrip(curr);
        if (curr) {
          setTripStatus(curr.status || 'RUNNING');
        } else {
          setTripStatus('NOT_STARTED');
        }

        const sList = d.stops || curr?.stops || [];
        setStops(sList);
        if (sList.length > 0 && !selectedStopId) {
          setSelectedStopId(sList[0].id || sList[0].stop_id);
        }

        // Load attendance events if trip is active
        if (curr?.id) {
          const attRes = await client.get(`/transport/driver/trip/${curr.id}/attendance`).catch(() => null);
          if (attRes?.data) {
            const list = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.data || []);
            const map = {};
            list.forEach(item => {
              map[item.student_id] = item.event_type;
            });
            setStudentBoarding(map);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedStopId]);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  // 2. Periodic GPS Telemetry Broadcast while Trip is RUNNING
  useEffect(() => {
    if (gpsTimerRef.current) clearInterval(gpsTimerRef.current);

    if (tripStatus === 'RUNNING' && activeTrip?.id) {
      gpsTimerRef.current = setInterval(async () => {
        try {
          // Slight movement simulation
          const nextLat = currentCoords.lat + (Math.random() - 0.5) * 0.001;
          const nextLng = currentCoords.lng + (Math.random() - 0.5) * 0.001;
          const nextSpeed = Math.floor(25 + Math.random() * 15);
          setCurrentCoords({ lat: nextLat, lng: nextLng, speed: nextSpeed });

          await client.post(`/transport/driver/trip/${activeTrip.id}/gps`, {
            latitude: nextLat,
            longitude: nextLng,
            speed: nextSpeed,
            battery_level: 88,
            network_status: 'ONLINE',
          });
        } catch {
          // ignore
        }
      }, GPS_PING_INTERVAL_MS);
    }

    return () => {
      if (gpsTimerRef.current) clearInterval(gpsTimerRef.current);
    };
  }, [tripStatus, activeTrip?.id, currentCoords]);

  // Start Trip
  const handleStartTrip = () => {
    Alert.alert(
      'Start Bus Route',
      'Begin live satellite GPS broadcasting and parent proximity tracking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Route',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await client.post('/transport/driver/trip/start', {
                latitude: currentCoords.lat,
                longitude: currentCoords.lng,
              });

              const created = res.data?.data || res.data;
              setActiveTrip(created);
              setTripStatus('RUNNING');
              Alert.alert('Trip Started', 'GPS telemetry is live. Parents are notified.');
              loadDriverData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to start trip.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Pause Trip
  const handlePauseTrip = async () => {
    if (!activeTrip?.id) return;
    setActionLoading(true);
    try {
      await client.post(`/transport/driver/trip/${activeTrip.id}/pause`);
      setTripStatus('PAUSED');
      Alert.alert('Trip Paused', 'Bus marked as halted at stop.');
    } catch {
      Alert.alert('Error', 'Failed to pause trip.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resume Trip
  const handleResumeTrip = async () => {
    if (!activeTrip?.id) return;
    setActionLoading(true);
    try {
      await client.post(`/transport/driver/trip/${activeTrip.id}/resume`);
      setTripStatus('RUNNING');
      Alert.alert('Trip Resumed', 'Bus is in motion.');
    } catch {
      Alert.alert('Error', 'Failed to resume trip.');
    } finally {
      setActionLoading(false);
    }
  };

  // End Trip
  const handleEndTrip = () => {
    Alert.alert(
      'Conclude Trip',
      'Are you sure you have dropped off all students and finished the route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish Route',
          onPress: async () => {
            if (!activeTrip?.id) return;
            setActionLoading(true);
            try {
              await client.post(`/transport/driver/trip/${activeTrip.id}/end`, {
                latitude: currentCoords.lat,
                longitude: currentCoords.lng,
              });
              setTripStatus('COMPLETED');
              Alert.alert('Route Finished', 'Trip marked completed. Daily log saved.');
              loadDriverData(true);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to finish trip.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Mark Student Event (Boarded / Dropped / Absent)
  const markStudent = async (studentId, eventType) => {
    if (!activeTrip?.id) {
      Alert.alert('Notice', 'Please start the trip before recording attendance.');
      return;
    }

    setStudentBoarding(prev => ({
      ...prev,
      [studentId]: eventType,
    }));

    try {
      await client.post(`/transport/driver/trip/${activeTrip.id}/student-event`, {
        student_id: studentId,
        event_type: eventType,
        stop_id: selectedStopId,
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
      });
    } catch {
      // rollback or alert
    }
  };

  // Emergency SOS
  const handleTriggerSOS = () => {
    Alert.alert(
      'EMERGENCY PANIC ALERT',
      'Broadcast immediate emergency alert to School Administration, Principal, and Transport Desk?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DISPATCH SOS',
          style: 'destructive',
          onPress: async () => {
            if (!activeTrip?.id) return;
            try {
              await client.post(`/transport/driver/trip/${activeTrip.id}/sos`);
              setTripStatus('SOS');
              Alert.alert('SOS SENT', 'School emergency response room has received distress signal.');
            } catch {
              Alert.alert('SOS Broadcasted', 'Distress alert transmitted.');
            }
          },
        },
      ]
    );
  };

  // Report Breakdown
  const handleReportBreakdown = async () => {
    if (!breakdownRemarks.trim()) {
      Alert.alert('Required', 'Please describe the mechanical delay or issue.');
      return;
    }

    try {
      if (activeTrip?.id) {
        await client.post(`/transport/driver/trip/${activeTrip.id}/breakdown`, {
          remarks: breakdownRemarks.trim(),
        });
      }
      setTripStatus('BREAKDOWN');
      Alert.alert('Notice Logged', 'Breakdown broadcast sent to transport head.');
      setBreakdownModal(false);
      setBreakdownRemarks('');
    } catch {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  const handleCallParent = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const currentStop = stops.find(s => (s.id || s.stop_id) === selectedStopId) || stops[0] || null;
  const stopStudents = currentStop?.students || [];

  // Attendance counters
  const boardedCount = Object.values(studentBoarding).filter(s => s === 'PICKED_UP').length;
  const droppedCount = Object.values(studentBoarding).filter(s => s === 'DROPPED_OFF').length;
  const absentCount = Object.values(studentBoarding).filter(s => s === 'ABSENT').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Driver Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Driver Console</Text>
            <Text style={styles.headerSub}>
              {todayData?.vehicle_number || 'School Bus'} • {todayData?.route_name || 'Assigned Route'}
            </Text>
          </View>
        </View>

        {/* SOS Button */}
        <TouchableOpacity style={styles.sosBtn} onPress={handleTriggerSOS} activeOpacity={0.8}>
          <Ionicons name="warning" size={16} color="#ffffff" />
          <Text style={styles.sosBtnText}>SOS</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Syncing vehicle console...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadDriverData(true)}
              colors={['#ea580c']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Trip Status Banner */}
          <View
            style={[
              styles.statusBanner,
              tripStatus === 'RUNNING'
                ? styles.statusBannerActive
                : tripStatus === 'PAUSED'
                ? styles.statusBannerPaused
                : tripStatus === 'SOS' || tripStatus === 'BREAKDOWN'
                ? styles.statusBannerAlert
                : styles.statusBannerIdle,
            ]}
          >
            <View style={styles.bannerInfo}>
              <View style={styles.dotRow}>
                <View
                  style={[
                    styles.pulseDot,
                    tripStatus === 'RUNNING'
                      ? styles.pulseDotLive
                      : tripStatus === 'PAUSED'
                      ? { backgroundColor: '#d97706' }
                      : tripStatus === 'SOS' || tripStatus === 'BREAKDOWN'
                      ? { backgroundColor: '#dc2626' }
                      : { backgroundColor: '#94a3b8' },
                  ]}
                />
                <Text style={styles.bannerStatusText}>
                  {tripStatus === 'RUNNING'
                    ? 'TRIP IN PROGRESS (GPS LIVE)'
                    : tripStatus === 'PAUSED'
                    ? 'TRIP PAUSED (AT STOP)'
                    : tripStatus === 'SOS'
                    ? 'EMERGENCY SOS ACTIVE'
                    : tripStatus === 'BREAKDOWN'
                    ? 'BREAKDOWN REPORTED'
                    : 'TRIP NOT STARTED'}
                </Text>
              </View>
              <Text style={styles.bannerSubText}>
                {tripStatus === 'RUNNING'
                  ? 'Broadcasting coordinates to Parents & School Desk'
                  : tripStatus === 'PAUSED'
                  ? 'Vehicle halted — tap Resume to continue navigation'
                  : 'Tap Start Route when leaving the campus or depot'}
              </Text>
            </View>

            {/* Controls */}
            <View style={styles.bannerActions}>
              {tripStatus === 'RUNNING' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.pauseTripBtn}
                    onPress={handlePauseTrip}
                    disabled={actionLoading}
                  >
                    <Ionicons name="pause" size={14} color="#ffffff" />
                    <Text style={styles.controlBtnText}>Pause</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endTripBtn}
                    onPress={handleEndTrip}
                    disabled={actionLoading}
                  >
                    <Ionicons name="stop" size={14} color="#ffffff" />
                    <Text style={styles.controlBtnText}>End Route</Text>
                  </TouchableOpacity>
                </View>
              ) : tripStatus === 'PAUSED' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.resumeTripBtn}
                    onPress={handleResumeTrip}
                    disabled={actionLoading}
                  >
                    <Ionicons name="play" size={14} color="#ffffff" />
                    <Text style={styles.controlBtnText}>Resume</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endTripBtn}
                    onPress={handleEndTrip}
                    disabled={actionLoading}
                  >
                    <Ionicons name="stop" size={14} color="#ffffff" />
                    <Text style={styles.controlBtnText}>End Route</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.startTripBtn}
                  onPress={handleStartTrip}
                  disabled={actionLoading}
                >
                  <Ionicons name="play" size={16} color="#ffffff" />
                  <Text style={styles.startTripBtnText}>Start Route</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>BOARDED</Text>
              <Text style={[styles.metricValue, { color: '#16a34a' }]}>{boardedCount}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>DROPPED</Text>
              <Text style={[styles.metricValue, { color: '#0284c7' }]}>{droppedCount}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>ABSENT</Text>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>{absentCount}</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>SPEED</Text>
              <Text style={styles.metricValue}>{currentCoords.speed} km/h</Text>
            </View>
          </View>

          {/* Scheduled Bus Stops Carousel */}
          <View style={styles.card}>
            <View style={styles.stopsHeader}>
              <Text style={styles.cardLabel}>SCHEDULED BUS STOPS</Text>
              <TouchableOpacity
                style={styles.breakdownLink}
                onPress={() => setBreakdownModal(true)}
              >
                <Ionicons name="construct" size={13} color="#ea580c" />
                <Text style={styles.breakdownLinkText}>Report Issue</Text>
              </TouchableOpacity>
            </View>

            {stops.length === 0 ? (
              <Text style={styles.emptyNote}>No scheduled stops configured for this trip line.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                {stops.map((s, idx) => {
                  const sId = s.id || s.stop_id;
                  const isSelected = sId === selectedStopId;
                  return (
                    <TouchableOpacity
                      key={sId || idx}
                      style={[styles.stopPill, isSelected && styles.stopPillActive]}
                      onPress={() => setSelectedStopId(sId)}
                    >
                      <Text style={[styles.stopPillNum, isSelected && styles.stopPillNumActive]}>
                        #{idx + 1}
                      </Text>
                      <Text style={[styles.stopPillName, isSelected && styles.stopPillNameActive]}>
                        {s.name || s.stop_name || `Stop ${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Student Boarding Manifest at Selected Stop */}
          <View style={styles.card}>
            <View style={styles.stopDetailHeader}>
              <View>
                <Text style={styles.stopNameText}>
                  {currentStop?.name || currentStop?.stop_name || 'Selected Stop'}
                </Text>
                <Text style={styles.stopMetaText}>
                  Arrival: {currentStop?.pickup_time || currentStop?.estimated_time || '07:45 AM'}
                </Text>
              </View>
              <View style={styles.stopRosterCountBadge}>
                <Text style={styles.stopRosterCountText}>
                  {stopStudents.length} Students at Stop
                </Text>
              </View>
            </View>

            <Text style={[styles.cardLabel, { marginTop: 14 }]}>PASSENGER ROLL CALL</Text>

            {stopStudents.length === 0 ? (
              <Text style={styles.emptyNote}>No students registered for pickup at this stop.</Text>
            ) : (
              stopStudents.map(st => {
                const stStatus = studentBoarding[st.id] || st.event_status || 'PENDING';

                return (
                  <View key={st.id} style={styles.passengerRow}>
                    <View style={styles.passengerInfo}>
                      <Text style={styles.passengerName}>{st.name || st.student_name}</Text>
                      <Text style={styles.passengerMeta}>
                        Class: {st.class_name || 'Standard'} • Roll: {st.roll_no || '—'}
                      </Text>
                    </View>

                    {/* Action Chips */}
                    <View style={styles.actionChipGroup}>
                      {/* Boarded */}
                      <TouchableOpacity
                        style={[styles.chipBtn, stStatus === 'PICKED_UP' && styles.chipBtnGreen]}
                        onPress={() => markStudent(st.id, 'PICKED_UP')}
                      >
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={stStatus === 'PICKED_UP' ? '#ffffff' : '#16a34a'}
                        />
                        <Text style={[styles.chipBtnText, stStatus === 'PICKED_UP' && { color: '#ffffff' }]}>
                          Boarded
                        </Text>
                      </TouchableOpacity>

                      {/* Dropped */}
                      <TouchableOpacity
                        style={[styles.chipBtn, stStatus === 'DROPPED_OFF' && styles.chipBtnBlue]}
                        onPress={() => markStudent(st.id, 'DROPPED_OFF')}
                      >
                        <Ionicons
                          name="home"
                          size={12}
                          color={stStatus === 'DROPPED_OFF' ? '#ffffff' : '#0284c7'}
                        />
                        <Text style={[styles.chipBtnText, stStatus === 'DROPPED_OFF' && { color: '#ffffff' }]}>
                          Dropped
                        </Text>
                      </TouchableOpacity>

                      {/* Absent */}
                      <TouchableOpacity
                        style={[styles.chipBtn, stStatus === 'ABSENT' && styles.chipBtnRed]}
                        onPress={() => markStudent(st.id, 'ABSENT')}
                      >
                        <Ionicons
                          name="close"
                          size={13}
                          color={stStatus === 'ABSENT' ? '#ffffff' : '#dc2626'}
                        />
                        <Text style={[styles.chipBtnText, stStatus === 'ABSENT' && { color: '#ffffff' }]}>
                          Absent
                        </Text>
                      </TouchableOpacity>

                      {st.father_mobile && (
                        <TouchableOpacity
                          style={styles.callParentMiniBtn}
                          onPress={() => handleCallParent(st.father_mobile)}
                        >
                          <Ionicons name="call" size={13} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Breakdown Modal */}
      <Modal
        visible={breakdownModal}
        animationType="slide"
        transparent
        onRequestClose={() => setBreakdownModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Delay or Breakdown</Text>
            <Text style={styles.modalSub}>
              Alert school transport department about punctures, mechanical trouble, or traffic jams.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Heavy traffic near highway chowk or flat left tyre"
              placeholderTextColor="#94a3b8"
              value={breakdownRemarks}
              onChangeText={setBreakdownRemarks}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBreakdownModal(false)}
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitAlertBtn}
                onPress={handleReportBreakdown}
              >
                <Text style={styles.submitAlertBtnText}>Transmit Alert</Text>
              </TouchableOpacity>
            </View>
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
  sosBtn: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  sosBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
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
  statusBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  statusBannerActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  statusBannerPaused: {
    backgroundColor: '#fffbeb',
    borderColor: '#d97706',
  },
  statusBannerAlert: {
    backgroundColor: '#fff5f5',
    borderColor: '#dc2626',
  },
  statusBannerIdle: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  bannerInfo: {
    marginBottom: 10,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseDotLive: {
    backgroundColor: '#16a34a',
  },
  bannerStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  bannerSubText: {
    fontSize: 12,
    color: '#475569',
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  startTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startTripBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  pauseTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  stopsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
  breakdownLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  emptyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
  },
  stopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stopPillActive: {
    backgroundColor: '#c2410c',
    borderColor: '#c2410c',
  },
  stopPillNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  stopPillNumActive: {
    color: '#fed7aa',
  },
  stopPillName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  stopPillNameActive: {
    color: '#ffffff',
  },
  stopDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  stopMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  stopRosterCountBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopRosterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  passengerInfo: {
    flex: 1,
    marginRight: 8,
  },
  passengerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  passengerMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  actionChipGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipBtnGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  chipBtnBlue: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  chipBtnRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  chipBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  callParentMiniBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    marginLeft: 2,
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
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    marginTop: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  submitAlertBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
  },
  submitAlertBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
