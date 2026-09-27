// mob_app/src/screens/staff/StaffAttendanceSettingsScreen.js
// Staff GPS Geo-fence & Shift Settings — 100% mirrors Web ERP AttendanceSettings.jsx
// Handles institutional GPS geo-fencing, punch grace minutes, and shift timings.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client from '../../api/client';

const RADIUS_OPTIONS = [50, 100, 150, 200, 300, 500];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StaffAttendanceSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    geofence_radius: 100,
    punch_grace_minutes: 15,
    work_start_time: '08:30',
    work_end_time: '15:30',
    half_day_threshold_hours: 4.0,
    working_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  useEffect(() => {
    client.get('/staff-attendance/settings')
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field, val) => {
    setSettings(prev => ({ ...prev, [field]: val }));
  };

  const toggleWorkingDay = (day) => {
    const currentDays = (settings.working_days || '').split(',').map(d => d.trim()).filter(Boolean);
    const exists = currentDays.includes(day);
    const updated = exists ? currentDays.filter(d => d !== day) : [...currentDays, day];
    updateField('working_days', updated.join(','));
  };

  const handleCaptureLocation = async () => {
    try {
      setFetchingGps(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture institutional GPS coordinates.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      updateField('latitude', loc.coords.latitude);
      updateField('longitude', loc.coords.longitude);
      Alert.alert(
        'GPS Captured',
        `Campus coordinates set to:\nLat: ${loc.coords.latitude.toFixed(6)}\nLng: ${loc.coords.longitude.toFixed(6)}`
      );
    } catch (err) {
      Alert.alert('GPS Error', 'Failed to retrieve high-accuracy GPS fix from device.');
    } finally {
      setFetchingGps(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await client.put('/staff-attendance/settings', {
        ...settings,
        latitude: parseFloat(settings.latitude),
        longitude: parseFloat(settings.longitude),
        geofence_radius: parseInt(settings.geofence_radius, 10),
        punch_grace_minutes: parseInt(settings.punch_grace_minutes, 10),
        half_day_threshold_hours: parseFloat(settings.half_day_threshold_hours),
      });
      if (res.data) setSettings(res.data);
      Alert.alert('Settings Saved', 'Staff GPS geo-fencing and shift rules updated successfully.');
    } catch (err) {
      Alert.alert('Save Failed', err.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0b57d0" />
      </SafeAreaView>
    );
  }

  const selectedDays = (settings.working_days || '').split(',').map(d => d.trim());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Attendance & GPS Settings</Text>
          <Text style={styles.headerSubtitle}>Geo-fence boundary & shift rules</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Geo-fence Coordinates Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="location" size={20} color="#0b57d0" />
            <Text style={styles.cardTitle}>Campus Geo-Fence Coordinates</Text>
          </View>
          <Text style={styles.cardDesc}>
            Staff can only punch IN / OUT when within the verified campus perimeter.
          </Text>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(settings.latitude || '')}
                onChangeText={(v) => updateField('latitude', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(settings.longitude || '')}
                onChangeText={(v) => updateField('longitude', v)}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.gpsCaptureBtn}
            disabled={fetchingGps}
            onPress={handleCaptureLocation}
          >
            {fetchingGps ? (
              <ActivityIndicator size="small" color="#0b57d0" />
            ) : (
              <>
                <Ionicons name="navigate-circle-outline" size={18} color="#0b57d0" />
                <Text style={styles.gpsCaptureBtnText}>Use Device's Current GPS Position</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Radius Selector Card */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Allowed Punch Radius (Meters):</Text>
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map(r => {
              const active = Number(settings.geofence_radius) === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusChip, active && styles.radiusChipActive]}
                  onPress={() => updateField('geofence_radius', r)}
                >
                  <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                    {r}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Shift Timings & Grace Time */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time" size={20} color="#16a34a" />
            <Text style={styles.cardTitle}>Shift Timings & Grace</Text>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Shift Start (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="08:30"
                placeholderTextColor="#94a3b8"
                value={settings.work_start_time || ''}
                onChangeText={(v) => updateField('work_start_time', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Shift End (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="15:30"
                placeholderTextColor="#94a3b8"
                value={settings.work_end_time || ''}
                onChangeText={(v) => updateField('work_end_time', v)}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Punch Grace (Minutes)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="15"
                placeholderTextColor="#94a3b8"
                value={String(settings.punch_grace_minutes || '')}
                onChangeText={(v) => updateField('punch_grace_minutes', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Half-Day Min (Hours)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="4.0"
                placeholderTextColor="#94a3b8"
                value={String(settings.half_day_threshold_hours || '')}
                onChangeText={(v) => updateField('half_day_threshold_hours', v)}
              />
            </View>
          </View>
        </View>

        {/* Working Days */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Designated Working Days:</Text>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map(day => {
              const active = selectedDays.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => toggleWorkingDay(day)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
          onPress={handleSaveSettings}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Attendance Rules</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 11, color: '#64748b' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardDesc: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 12 },

  formRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },

  gpsCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  gpsCaptureBtnText: { fontSize: 12, fontWeight: '700', color: '#0b57d0' },

  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radiusChipActive: { backgroundColor: '#0b57d0', borderColor: '#0b57d0' },
  radiusChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  radiusChipTextActive: { color: '#fff' },

  weekRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayChipActive: { backgroundColor: '#15803d', borderColor: '#15803d' },
  dayChipText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  dayChipTextActive: { color: '#fff' },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b57d0',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  saveBtnDisabled: { backgroundColor: '#94a3b8' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
