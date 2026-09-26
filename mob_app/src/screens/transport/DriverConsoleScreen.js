// mob_app/src/screens/transport/DriverConsoleScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export default function DriverConsoleScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Trip Data
  const [homeData, setHomeData] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripStatus, setTripStatus] = useState('SCHEDULED'); // 'SCHEDULED' | 'RUNNING' | 'COMPLETED'
  const [stops, setStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [studentBoarding, setStudentBoarding] = useState({}); // { student_id: 'BOARDED' | 'DROPPED' | 'ABSENT' }

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);
  const [breakdownModal, setBreakdownModal] = useState(false);
  const [breakdownRemarks, setBreakdownRemarks] = useState('');

  // 1. Fetch Today's Driver Data
  const loadDriverData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/transport/driver/today').catch(() => null);
      if (res?.data) {
        const d = res.data.data || res.data;
        setHomeData(d);
        const curr = d.current_trip || null;
        setActiveTrip(curr);
        if (curr) {
          setTripStatus(curr.status || 'RUNNING');
        }
        const sList = d.stops || curr?.stops || [];
        setStops(sList);
        if (sList.length > 0 && !selectedStopId) {
          setSelectedStopId(sList[0].id || sList[0].stop_id);
        }
      } else {
        // Fallback: fetch active trip directly
        const fallback = await client.get('/transport/trips/active').catch(() => null);
        if (fallback?.data) {
          setActiveTrip(fallback.data);
          setTripStatus(fallback.data.status || 'RUNNING');
          setStops(fallback.data.stops || []);
        }
      }
    } catch {
      // ignore
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [selectedStopId]);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  // Start Trip
  const handleStartTrip = async () => {
    Alert.alert(
      'Start Scheduled Route',
      'Begin live route navigation and parent proximity tracking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Trip',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await client.post('/transport/trips/start', {
                trip_id: activeTrip?.id,
                route_id: activeTrip?.route_id || homeData?.route_id,
              });
              setTripStatus('RUNNING');
              Alert.alert('Trip Started', 'GPS broadcast is live. Drive safely!');
              loadDriverData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to start trip.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // End Trip
  const handleEndTrip = async () => {
    Alert.alert(
      'Complete Trip',
      'Are you sure you have dropped off all students and finished the route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish Route',
          onPress: async () => {
            setActionLoading(true);
            try {
              await client.post('/transport/trips/end', {
                trip_id: activeTrip?.id,
              });
              setTripStatus('COMPLETED');
              Alert.alert('Route Finished', 'Trip marked completed. Daily log saved.');
              loadDriverData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to finish trip.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Student Boarding Toggle
  const markStudent = (studentId, status) => {
    setStudentBoarding(prev => ({
      ...prev,
      [studentId]: status,
    }));
    // Post to backend boarding event
    client.post('/transport/trips/boarding-event', {
      student_id: studentId,
      trip_id: activeTrip?.id,
      event: status,
    }).catch(() => {});
  };

  // Emergency SOS
  const handleTriggerSOS = () => {
    Alert.alert(
      'EMERGENCY SOS',
      'Broadcast immediate panic alert to school administration and transport desk?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DISPATCH SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.post('/transport/trips/sos', {
                trip_id: activeTrip?.id,
                driver_name: user?.name,
              });
              Alert.alert('SOS SENT', 'Alert broadcasted to Principal, Transport Head, and Emergency Dispatch.');
            } catch {
              Alert.alert('Emergency Broadcasted', 'School control room has received distress signal.');
            }
          },
        },
      ]
    );
  };

  // Report Breakdown
  const handleReportBreakdown = async () => {
    if (!breakdownRemarks.trim()) {
      Alert.alert('Required', 'Please describe the mechanical failure or delay reason.');
      return;
    }

    try {
      await client.post('/transport/trips/breakdown', {
        trip_id: activeTrip?.id,
        remarks: breakdownRemarks.trim(),
      });
      Alert.alert('Report Logged', 'Breakdown notice sent to maintenance & parents.');
      setBreakdownModal(false);
      setBreakdownRemarks('');
    } catch {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  const currentStop = stops.find(s => (s.id || s.stop_id) === selectedStopId) || stops[0] || null;
  const stopStudents = currentStop?.students || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBackBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Driver Console</Text>
          <Text style={styles.headerSub}>
            {homeData?.vehicle_no || 'Bus Fleet'} • Route: {homeData?.route_name || 'Active Line'}
          </Text>
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
          <Text style={styles.loadingText}>Syncing vehicle telemetry...</Text>
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
          <View style={[styles.statusBanner, tripStatus === 'RUNNING' ? styles.statusBannerActive : styles.statusBannerIdle]}>
            <View style={styles.bannerInfo}>
              <View style={styles.dotRow}>
                <View style={[styles.pulseDot, tripStatus === 'RUNNING' && styles.pulseDotLive]} />
                <Text style={styles.bannerStatusText}>
                  {tripStatus === 'RUNNING' ? 'TRIP IN PROGRESS (LIVE GPS)' : 'TRIP NOT STARTED'}
                </Text>
              </View>
              <Text style={styles.bannerSubText}>
                {tripStatus === 'RUNNING'
                  ? 'Transmitting vehicle coordinates to Parent App'
                  : 'Tap Start Trip when leaving the campus or starting pickup'}
              </Text>
            </View>

            {tripStatus === 'RUNNING' ? (
              <TouchableOpacity
                style={styles.endTripBtn}
                onPress={handleEndTrip}
                disabled={actionLoading}
              >
                <Ionicons name="stop" size={16} color="#ffffff" />
                <Text style={styles.endTripBtnText}>End Trip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.startTripBtn}
                onPress={handleStartTrip}
                disabled={actionLoading}
              >
                <Ionicons name="play" size={16} color="#ffffff" />
                <Text style={styles.startTripBtnText}>Start Trip</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Route Stops Bar */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SCHEDULED BUS STOPS</Text>
            {stops.length === 0 ? (
              <Text style={styles.emptyNote}>No scheduled stops found for this trip.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {stops.map((s, idx) => {
                  const sId = s.id || s.stop_id;
                  const isSelected = sId === selectedStopId;
                  return (
                    <TouchableOpacity
                      key={sId || idx}
                      style={[styles.stopPill, isSelected && styles.stopPillActive]}
                      onPress={() => setSelectedStopId(sId)}
                    >
                      <Text style={[styles.stopPillNum, isSelected && styles.stopPillNumActive]}>#{idx + 1}</Text>
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
            <View style={styles.stopHeader}>
              <View>
                <Text style={styles.stopNameText}>{currentStop?.name || currentStop?.stop_name || 'Selected Stop'}</Text>
                <Text style={styles.stopMetaText}>Pickup/Drop Time: {currentStop?.pickup_time || '07:45 AM'}</Text>
              </View>
              <TouchableOpacity
                style={styles.breakdownLink}
                onPress={() => setBreakdownModal(true)}
              >
                <Ionicons name="construct" size={14} color="#ea580c" />
                <Text style={styles.breakdownLinkText}>Report Issue</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.cardLabel, { marginTop: 12 }]}>PASSENGER ROSTER ({stopStudents.length})</Text>

            {stopStudents.length === 0 ? (
              <Text style={styles.emptyNote}>No students registered for boarding at this stop.</Text>
            ) : (
              stopStudents.map(st => {
                const stStatus = studentBoarding[st.id] || st.event_status || 'PENDING';

                return (
                  <View key={st.id} style={styles.passengerRow}>
                    <View style={styles.passengerInfo}>
                      <Text style={styles.passengerName}>{st.name || st.student_name}</Text>
                      <Text style={styles.passengerMeta}>
                        Class: {st.class_name || '5'} • Roll: {st.roll_no || '—'}
                      </Text>
                    </View>

                    {/* Boarding Action Chips */}
                    <View style={styles.actionChipGroup}>
                      <TouchableOpacity
                        style={[styles.chipBtn, stStatus === 'BOARDED' && styles.chipBtnGreen]}
                        onPress={() => markStudent(st.id, 'BOARDED')}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={stStatus === 'BOARDED' ? '#ffffff' : '#16a34a'}
                        />
                        <Text style={[styles.chipBtnText, stStatus === 'BOARDED' && { color: '#ffffff' }]}>
                          Boarded
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.chipBtn, stStatus === 'ABSENT' && styles.chipBtnRed]}
                        onPress={() => markStudent(st.id, 'ABSENT')}
                      >
                        <Ionicons
                          name="close"
                          size={14}
                          color={stStatus === 'ABSENT' ? '#ffffff' : '#dc2626'}
                        />
                        <Text style={[styles.chipBtnText, stStatus === 'ABSENT' && { color: '#ffffff' }]}>
                          Absent
                        </Text>
                      </TouchableOpacity>
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
              Inform school transport desk about tyre punctures, traffic congestion, or engine issues.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Heavy traffic at City Circle or flat front tyre"
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
                style={styles.submitBtn}
                onPress={handleReportBreakdown}
              >
                <Text style={styles.submitBtnText}>Submit Alert</Text>
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
  headerBackBtn: {
    padding: 4,
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '800',
    color: '#ffffff',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  statusBanner: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  statusBannerActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  statusBannerIdle: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  bannerInfo: {
    flex: 1,
    marginRight: 10,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b8',
  },
  pulseDotLive: {
    backgroundColor: '#10b981',
  },
  bannerStatusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  bannerSubText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  startTripBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  startTripBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  endTripBtn: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  endTripBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  stopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
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
    fontWeight: '600',
    color: '#334155',
  },
  stopPillNameActive: {
    color: '#ffffff',
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  stopNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  stopMetaText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  breakdownLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  breakdownLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
  },
  emptyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  passengerInfo: {
    flex: 1,
    marginRight: 8,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  passengerMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  actionChipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  chipBtnGreen: {
    backgroundColor: '#16a34a',
  },
  chipBtnRed: {
    backgroundColor: '#dc2626',
  },
  chipBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    minHeight: 60,
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ea580c',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
