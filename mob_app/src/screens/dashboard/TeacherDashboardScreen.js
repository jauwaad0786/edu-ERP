// mob_app/src/screens/dashboard/TeacherDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import GradientHero from '../../components/common/GradientHero';
import KPICard from '../../components/common/KPICard';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export default function TeacherDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [myStatus, setMyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [cRes, aRes, hRes, sRes] = await Promise.all([\
        // /api/principal/classes returns all classes for this school (teacher-scoped via JWT)
        client.get('/principal/classes').catch(() => ({ data: [] })),
        // /api/teacher/notes returns uploaded study materials/notes as content assignments
        client.get('/teacher/notes').catch(() => ({ data: [] })),
        // /api/support/announcements for school-wide holiday & event notices
        client.get('/support/announcements').catch(() => ({ data: [] })),
        // /api/staff-attendance/my-status returns today's check-in/out status for this staff
        client.get('/staff-attendance/my-status').catch(() => ({ data: null })),
      ]);

      const clsList = Array.isArray(cRes.data) ? cRes.data : cRes.data?.classes || [];
      setClasses(clsList);

      const notesList = Array.isArray(aRes.data) ? aRes.data : aRes.data?.notes || [];
      setAssignments(notesList);

      // Filter announcements that look like holidays
      const allAnnouncements = Array.isArray(hRes.data)
        ? hRes.data
        : hRes.data?.announcements || hRes.data?.data || [];
      const holsList = allAnnouncements.filter(a =>
        (a.title || a.name || '').toLowerCase().includes('holiday') ||
        (a.category || a.type || '').toLowerCase().includes('holiday') ||
        a.is_holiday
      );
      setHolidays(holsList);

      setMyStatus(sRes.data);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      let lat = null, lng = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      // Correct endpoint: /api/staff-attendance/check-in
      await client.post('/staff-attendance/check-in', { latitude: lat, longitude: lng });
      Alert.alert('Success', 'Check-in recorded successfully!');
      load(true);
    } catch (err) {
      Alert.alert('Check-in Failed', err.response?.data?.error || err.message || 'Could not record check-in.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      let lat = null, lng = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      // Correct endpoint: /api/staff-attendance/check-out
      await client.post('/staff-attendance/check-out', { latitude: lat, longitude: lng });
      Alert.alert('Success', 'Check-out recorded successfully!');
      load(true);
    } catch (err) {
      Alert.alert('Check-out Failed', err.response?.data?.error || err.message || 'Could not record check-out.');
    } finally {
      setCheckingIn(false);
    }
  };

  const isCheckedIn = !!myStatus?.check_in;
  const isCheckedOut = !!myStatus?.check_out;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const todayStr = now.toISOString().slice(0, 10);
  const todayHols = holidays.filter(h => h.date === todayStr);
  const upcomingHols = holidays.filter(h => new Date(h.date) >= now).slice(0, 3);
  const distinctSubjects = [...new Set(assignments.map(a => a.subject_id || a.subject_name))].length;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Teacher Portal...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Gradient Hero */}
        <GradientHero
          tagline="FACULTY PORTAL"
          title={`${greeting}, ${user?.name || 'Teacher'}`}
          subtitle={`${classes.length} assigned classes · ${assignments.length} assignments scheduled`}
          avatarText={user?.name || 'T'}
          gradientColors={colors.teacherGradient}
        >
          {todayHols.length > 0 && (
            <View style={styles.holidayBadge}>
              <Ionicons name="sparkles" size={13} color="#f59e0b" style={{ marginRight: 6 }} />
              <Text style={styles.holidayBadgeText}>
                {todayHols[0].name} — Holiday Today!
              </Text>
            </View>
          )}
        </GradientHero>

        {/* GPS Attendance Check-In Widget */}
        <Card padding={16} leftAccentColor={isCheckedOut ? colors.success : isCheckedIn ? colors.warning : colors.error}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="finger-print" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Daily Attendance Check-In</Text>
              <Text style={styles.cardSubtitle}>Geo-fenced mobile verification</Text>
            </View>
            <Badge
              label={isCheckedOut ? 'Checked Out' : isCheckedIn ? 'Checked In' : 'Pending'}
              variant={isCheckedOut ? 'success' : isCheckedIn ? 'warning' : 'error'}
              showDot
            />
          </View>

          <View style={styles.timeRow}>
            {myStatus?.check_in && (
              <View style={styles.timeCol}>
                <Text style={styles.timeLabel}>In Time</Text>
                <Text style={styles.timeVal}>
                  {new Date(myStatus.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {myStatus?.check_out && (
              <View style={styles.timeCol}>
                <Text style={styles.timeLabel}>Out Time</Text>
                <Text style={styles.timeVal}>
                  {new Date(myStatus.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>

          {!isCheckedOut && (
            <Button
              title={isCheckedIn ? 'Complete Check-Out' : 'Record GPS Check-In'}
              icon={isCheckedIn ? 'log-out-outline' : 'location-outline'}
              variant={isCheckedIn ? 'danger' : 'success'}
              onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
              loading={checkingIn}
              fullWidth
              style={{ marginTop: 12 }}
            />
          )}
        </Card>

        {/* Overview KPIs */}
        <View style={styles.kpiRow}>
          <KPICard
            label="My Classes"
            value={classes.length}
            sublabel="Active batches"
            icon="people-outline"
            accentColor={colors.primary}
            onPress={() => navigation?.navigate('Classes')}
          />
          <KPICard
            label="Subjects"
            value={distinctSubjects || classes.length}
            sublabel="Assigned courses"
            icon="book-outline"
            accentColor="#7c3aed"
          />
          <KPICard
            label="Upcoming Hols"
            value={upcomingHols.length}
            sublabel="Next 30 days"
            icon="calendar-outline"
            accentColor={colors.warning}
          />
        </View>

        {/* Assigned Classes */}
        <Card padding={16}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="school-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Assigned Classes ({classes.length})</Text>
          </View>

          {classes.length === 0 ? (
            <Text style={styles.emptyText}>No classes currently assigned</Text>
          ) : (
            classes.map((cls, idx) => (
              <TouchableOpacity
                key={cls.id || idx}
                style={[
                  styles.classRow,
                  idx === classes.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => navigation?.navigate('Attendance', { classId: cls.id })}
                activeOpacity={0.7}
              >
                <View style={styles.classAvatar}>
                  <Ionicons name="people" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.className}>{cls.name || `Class ${cls.grade || ''}`}</Text>
                  <Text style={styles.classSub}>
                    Section {cls.section || 'A'} • {cls.students_count ? `${cls.students_count} students` : 'Active'}
                  </Text>
                </View>
                <Badge label="Mark Attendance" variant="primary" size="sm" />
                <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Upcoming Holidays */}
        {upcomingHols.length > 0 && (
          <Card padding={16}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBox, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="calendar" size={18} color={colors.warning} />
              </View>
              <Text style={styles.cardTitle}>Upcoming Holidays</Text>
            </View>

            {upcomingHols.map((h, i) => (
              <View
                key={h.id || i}
                style={[
                  styles.holidayRow,
                  i === upcomingHols.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.holidayName}>{h.name}</Text>
                  <Text style={styles.holidayDate}>
                    {new Date(h.date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </Text>
                </View>
                <Badge label="Official Off" variant="warning" size="sm" />
              </View>
            ))}
          </Card>
        )}

        {/* Sign Out Button */}
        <Button
          title="Sign Out from Faculty Portal"
          variant="secondary"
          icon="log-out-outline"
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ])
          }
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  holidayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  holidayBadgeText: {
    fontSize: 11.5,
    color: '#ffffff',
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 20,
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  timeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  timeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  classAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  classSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 20,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  holidayName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },
  holidayDate: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
  },
});
