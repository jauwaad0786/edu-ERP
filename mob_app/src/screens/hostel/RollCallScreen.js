// mob_app/src/screens/hostel/RollCallScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const STATUS_CONFIG = {
  PRESENT: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0', icon: 'checkmark-circle' },
  ABSENT:  { bg: '#fee2e2', text: '#dc2626', border: '#fecaca', icon: 'close-circle' },
  LEAVE:   { bg: '#fef3c7', text: '#d97706', border: '#fde68a', icon: 'airplane-outline' },
};

export default function RollCallScreen({ navigation }) {
  const { user } = useAuth();
  const canMark = ['HOSTEL', 'PRINCIPAL', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // 1. Load Hostels
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

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  // 2. Load Attendance for Selected Hostel & Date
  const loadAttendance = useCallback(async (isRefresh = false) => {
    if (!selectedHostelId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await client.get('/hostel/attendance', {
        params: { hostel_id: selectedHostelId, date: selectedDate },
      }).catch(() => ({ data: [] }));

      const list = Array.isArray(res.data) ? res.data : [];
      setResidents(list);
    } catch {
      setResidents([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  }, [selectedHostelId, selectedDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Date Navigation
  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Toggle resident status
  const setResidentStatus = (studentId, newStatus) => {
    setResidents(prev =>
      prev.map(r => (r.student_id === studentId ? { ...r, status: newStatus } : r))
    );
  };

  // Set remarks
  const setResidentRemarks = (studentId, remarks) => {
    setResidents(prev =>
      prev.map(r => (r.student_id === studentId ? { ...r, remarks } : r))
    );
  };

  // Bulk mark all present
  const handleMarkAllPresent = () => {
    setResidents(prev => prev.map(r => ({ ...r, status: 'PRESENT' })));
  };

  // Submit Roll Call
  const handleSubmitRollCall = async () => {
    if (residents.length === 0) return;

    setSubmitting(true);
    try {
      const entries = residents.map(r => ({
        student_id: r.student_id,
        allocation_id: r.allocation_id,
        status: r.status || 'PRESENT',
        remarks: r.remarks || '',
      }));

      await client.post('/hostel/attendance', {
        hostel_id: selectedHostelId,
        date: selectedDate,
        entries,
      });

      Alert.alert('Roll Call Submitted', `Night attendance recorded for ${entries.length} residents on ${selectedDate}.`);
      loadAttendance(true);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit roll call.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered residents
  const filteredResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter(r => {
      const name = (r.student_name || '').toLowerCase();
      const adm = (r.admission_no || '').toLowerCase();
      const room = (r.room_number || '').toLowerCase();
      return name.includes(q) || adm.includes(q) || room.includes(q);
    });
  }, [residents, search]);

  // KPIs
  const totalCount = residents.length;
  const presentCount = residents.filter(r => (r.status || 'PRESENT') === 'PRESENT').length;
  const absentCount = residents.filter(r => r.status === 'ABSENT').length;
  const leaveCount = residents.filter(r => r.status === 'LEAVE').length;

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
            <Text style={styles.headerTitle}>Night Roll Call</Text>
            <Text style={styles.headerSub}>Hostel Census & Night Attendance</Text>
          </View>
        </View>

        {canMark && residents.length > 0 && (
          <TouchableOpacity
            style={[styles.submitHeaderBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmitRollCall}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#4338ca" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={15} color="#4338ca" />
                <Text style={styles.submitHeaderBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Date Navigation Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeDate(-1)}>
          <Ionicons name="chevron-back" size={18} color="#4338ca" />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Ionicons name="calendar-outline" size={16} color="#4338ca" />
          <Text style={styles.dateText}>
            {selectedDate === new Date().toISOString().split('T')[0]
              ? `Today (${selectedDate})`
              : selectedDate}
          </Text>
        </View>

        <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeDate(1)}>
          <Ionicons name="chevron-forward" size={18} color="#4338ca" />
        </TouchableOpacity>
      </View>

      {/* Hostels Carousel */}
      {hostels.length > 1 && (
        <View style={styles.hostelRibbon}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {hostels.map(h => {
              const isSel = selectedHostelId === h.id;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.hostelChip, isSel && styles.hostelChipActive]}
                  onPress={() => setSelectedHostelId(h.id)}
                >
                  <Ionicons
                    name="bed"
                    size={13}
                    color={isSel ? '#ffffff' : '#64748b'}
                  />
                  <Text style={[styles.hostelChipText, isSel && styles.hostelChipTextActive]}>
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* KPI Stats Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiValue}>{totalCount}</Text>
          <Text style={styles.kpiLabel}>RESIDENTS</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{presentCount}</Text>
          <Text style={styles.kpiLabel}>PRESENT</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#dc2626' }]}>{absentCount}</Text>
          <Text style={styles.kpiLabel}>ABSENT</Text>
        </View>
        <View style={styles.kpiTile}>
          <Text style={[styles.kpiValue, { color: '#d97706' }]}>{leaveCount}</Text>
          <Text style={styles.kpiLabel}>LEAVE / OUT</Text>
        </View>
      </View>

      {/* Search & Bulk Action Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search resident by name, room, roll no..."
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

        {canMark && residents.length > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllPresent}>
            <Ionicons name="checkmark-done" size={15} color="#16a34a" />
            <Text style={styles.markAllBtnText}>All Present</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Residents Attendance List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4338ca" />
          <Text style={styles.loadingText}>Loading hostel roll call...</Text>
        </View>
      ) : filteredResidents.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAttendance(true)} colors={['#4338ca']} />}
        >
          <Ionicons name="clipboard-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No Residents Found</Text>
          <Text style={styles.emptySub}>
            {search ? 'No residents match your search filter.' : 'No active resident allocations for this hostel.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAttendance(true)} colors={['#4338ca']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredResidents.map((r, idx) => {
            const currentStatus = r.status || 'PRESENT';

            return (
              <View key={r.student_id || idx} style={styles.residentCard}>
                <View style={styles.residentTop}>
                  <View style={styles.avatarBox}>
                    <Ionicons name="person" size={18} color="#4338ca" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.residentName}>{r.student_name}</Text>
                    <Text style={styles.residentMeta}>
                      Room #{r.room_number || '—'} • Bed #{r.bed_number || '1'}
                      {r.admission_no ? ` • Adm: ${r.admission_no}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Status Toggle Chips */}
                {canMark ? (
                  <View style={styles.statusChipsRow}>
                    {['PRESENT', 'ABSENT', 'LEAVE'].map(st => {
                      const isSelected = currentStatus === st;
                      const conf = STATUS_CONFIG[st];
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.statusChip,
                            isSelected && {
                              backgroundColor: conf.bg,
                              borderColor: conf.border,
                            },
                          ]}
                          onPress={() => setResidentStatus(r.student_id, st)}
                        >
                          <Ionicons
                            name={conf.icon}
                            size={14}
                            color={isSelected ? conf.text : '#94a3b8'}
                          />
                          <Text
                            style={[
                              styles.statusChipText,
                              isSelected && { color: conf.text, fontWeight: '800' },
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View
                    style={[
                      styles.readOnlyBadge,
                      { backgroundColor: STATUS_CONFIG[currentStatus]?.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readOnlyBadgeText,
                        { color: STATUS_CONFIG[currentStatus]?.text },
                      ]}
                    >
                      {currentStatus}
                    </Text>
                  </View>
                )}

                {/* Optional remarks input if Absent or Leave */}
                {canMark && currentStatus !== 'PRESENT' && (
                  <TextInput
                    style={styles.remarksInput}
                    placeholder="Add remark: e.g. Out on pass #42 or home visit"
                    placeholderTextColor="#94a3b8"
                    value={r.remarks || ''}
                    onChangeText={txt => setResidentRemarks(r.student_id, txt)}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
    backgroundColor: '#3730a3',
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
    color: '#c7d2fe',
    marginTop: 1,
  },
  submitHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  submitHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4338ca',
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e1b4b',
  },
  hostelRibbon: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  hostelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  hostelChipActive: {
    backgroundColor: '#4338ca',
  },
  hostelChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  hostelChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flex: 1,
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
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
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
  residentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  residentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  residentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  residentMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  readOnlyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  readOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  remarksInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    color: '#0f172a',
    marginTop: 10,
  },
});
