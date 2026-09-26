// mob_app/src/screens/students/StudentDetailScreen.js
// Full student profile screen — shows details fetched from /api/principal/students/:id
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const AVATAR_COLORS = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe'];

export default function StudentDetailScreen({ route, navigation }) {
  // student object can be passed via params OR we fetch by student_id
  const { student: passedStudent, student_id } = route?.params || {};

  const [student, setStudent] = useState(passedStudent || null);
  const [fees, setFees] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(!passedStudent);
  const [deleting, setDeleting] = useState(false);

  const sid = passedStudent?.id || student_id;

  useEffect(() => {
    if (!sid) return;
    // If student was passed via params we still fetch fresh data + fees + attendance
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [stuRes, feeRes, attRes] = await Promise.all([
          // Fetch full student profile
          client.get(`/principal/students/${sid}`).catch(() => ({ data: passedStudent })),
          // Fetch student fee records
          client.get(`/principal/fees/student-records/${sid}`).catch(() => ({ data: null })),
          // Fetch student attendance summary
          client.get(`/teacher/attendance/monthly/${sid}`).catch(() => ({ data: null })),
        ]);
        if (stuRes.data) setStudent(stuRes.data?.student || stuRes.data);
        setFees(feeRes.data);
        setAttendance(attRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [sid]);

  const handleDeleteStudent = () => {
    if (!student?.id) return;
    Alert.alert(
      'Archive Student Record?',
      `Are you sure you want to remove ${student.name || 'this student'} from active enrollment? This record will be moved to Deleted Items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive / Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await client.delete(`/principal/students/${student.id}`);
              Alert.alert('Student Archived', 'Student record has been archived successfully.', [
                { text: 'OK', onPress: () => (navigation?.goBack ? navigation.goBack() : null) }
              ]);
            } catch (err) {
              Alert.alert('Action Failed', err.response?.data?.error || 'Could not delete student record.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Student Profile...</Text>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="person-outline" size={48} color={colors.muted} style={{ opacity: 0.4, marginBottom: 12 }} />
        <Text style={styles.loadingText}>Student not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const name = student.name || student.student_name || 'Student';
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const avatarBg = AVATAR_COLORS[0];

  const attPct = attendance?.percentage != null
    ? Math.round(attendance.percentage)
    : attendance?.present && attendance?.total_days
    ? Math.round((attendance.present / attendance.total_days) * 100)
    : null;

  const feeRecords = Array.isArray(fees) ? fees : fees?.records || [];
  const unpaidFees = feeRecords.filter(f => f.status !== 'PAID');
  const totalDue = unpaidFees.reduce((sum, f) => {
    const due = (f.amount_due || f.amount || 0) - (f.amount_paid || 0);
    return sum + Math.max(0, due);
  }, 0);

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (navigation?.navigate) {
              navigation.navigate('IDCard', { student_id: sid, student });
            }
          }}
        >
          <Ionicons name="card-outline" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.admText}>
            Adm #{student.admission_no || student.admission_number || '—'}
          </Text>

          {/* Status & Attendance Badges */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <View style={[
              styles.statusPill,
              { backgroundColor: student.status === 'PROVISIONAL' ? '#fef3c7' : '#dcfce7' }
            ]}>
              <Text style={[
                styles.statusPillText,
                { color: student.status === 'PROVISIONAL' ? '#d97706' : '#16a34a' }
              ]}>
                {student.status || 'ACTIVE'}
              </Text>
            </View>

            {attPct != null && (
              <View style={[styles.attBadge, { backgroundColor: attPct >= 75 ? '#dcfce7' : '#fee2e2' }]}>
                <Ionicons
                  name={attPct >= 75 ? 'checkmark-circle' : 'warning'}
                  size={13}
                  color={attPct >= 75 ? '#16a34a' : '#dc2626'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.attBadgeText, { color: attPct >= 75 ? '#16a34a' : '#dc2626' }]}>
                  {attPct}% Attendance
                </Text>
              </View>
            )}
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.actionRow}>
            {Boolean(student.parent_phone || student.father_phone || student.phone) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#eff6ff' }]}
                onPress={() => Linking.openURL(`tel:${student.parent_phone || student.father_phone || student.phone}`)}
              >
                <Ionicons name="call" size={16} color="#0b57d0" />
                <Text style={[styles.actionBtnText, { color: '#0b57d0' }]}>Call</Text>
              </TouchableOpacity>
            )}

            {Boolean(student.parent_phone || student.father_phone || student.phone) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#dcfce7' }]}
                onPress={() => {
                  const num = String(student.parent_phone || student.father_phone || student.phone).replace(/\D/g, '');
                  const intlNum = num.length === 10 ? `91${num}` : num;
                  Linking.openURL(`https://wa.me/${intlNum}?text=Hello%20Parent%2C%20regarding%20${encodeURIComponent(name)}`).catch(() => {});
                }}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16a34a" />
                <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f3e8ff' }]}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate('IDCard', { student_id: sid, student });
                }
              }}
            >
              <Ionicons name="card" size={16} color="#7c3aed" />
              <Text style={[styles.actionBtnText, { color: '#7c3aed' }]}>ID Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#fef3c7' }]}
              onPress={() => {
                try {
                  navigation?.navigate('FeeCollect', { student });
                } catch {
                  try {
                    navigation?.navigate('Collect', { student });
                  } catch {
                    Alert.alert('Fee Collection', 'Please open Collect Fee from the finance menu.');
                  }
                }
              }}
            >
              <Ionicons name="cash" size={16} color="#d97706" />
              <Text style={[styles.actionBtnText, { color: '#d97706' }]}>Collect Fee</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Academic Lifecycle & Classification Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <Text style={styles.cardTitle}>Academic Lifecycle</Text>
            <TouchableOpacity
              style={styles.reRegisterBtn}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate('AnnualRegister');
                }
              }}
            >
              <Ionicons name="repeat" size={14} color="#0b57d0" />
              <Text style={styles.reRegisterBtnText}>Re-Register</Text>
            </TouchableOpacity>
          </View>

          <InfoRow icon="calendar-outline" label="Academic Session" value={student.session || '2024-25'} />
          <View style={styles.divider} />
          <InfoRow icon="school-outline" label="Current Class"
            value={`Class ${student.class_name || student.grade || student.class?.name || '—'} - Section ${student.section || '—'}`} />
          <View style={styles.divider} />
          <InfoRow icon="flag-outline" label="House" value={student.house} />
          <View style={styles.divider} />
          <InfoRow icon="git-branch-outline" label="Stream" value={student.stream || 'General'} />
          <View style={styles.divider} />
          <InfoRow icon="time-outline" label="Admission Date"
            value={student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-IN') : '—'} />
        </View>

        {/* Personal Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Dossier</Text>
          <InfoRow icon="person-outline" label="Full Name" value={name} />
          <View style={styles.divider} />
          <InfoRow icon="document-text-outline" label="Roll Number"
            value={student.roll_no || student.roll_number} />
          <View style={styles.divider} />
          <InfoRow icon="male-female-outline" label="Gender"
            value={student.gender ? String(student.gender).toUpperCase() : null} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Date of Birth"
            value={student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : null} />
          <View style={styles.divider} />
          <InfoRow icon="medkit-outline" label="Blood Group"
            value={student.blood_group} />
          <View style={styles.divider} />
          <InfoRow icon="pricetag-outline" label="Category"
            value={student.category} />
          <View style={styles.divider} />
          <InfoRow icon="card-outline" label="Aadhar Number"
            value={student.aadhar_no} />
          <View style={styles.divider} />
          <InfoRow icon="person-circle-outline" label="Father / Guardian"
            value={student.father_name || student.guardian_name} />
          <View style={styles.divider} />
          <InfoRow icon="person-circle-outline" label="Mother Name"
            value={student.mother_name} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Parent Phone"
            value={student.parent_phone || student.father_phone || student.mother_phone} />
          <View style={styles.divider} />
          <InfoRow icon="home-outline" label="Address"
            value={student.address || student.current_address} />
        </View>

        {/* Attendance Summary Card */}
        {attendance && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Summary</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: colors.primary }]}>
                  {attPct != null ? `${attPct}%` : '—'}
                </Text>
                <Text style={styles.statLbl}>Overall</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#16a34a' }]}>
                  {attendance.present ?? '—'}
                </Text>
                <Text style={styles.statLbl}>Present</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#dc2626' }]}>
                  {attendance.absent ?? (attendance.total_days != null && attendance.present != null
                    ? attendance.total_days - attendance.present : '—')}
                </Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#64748b' }]}>
                  {attendance.total_days ?? '—'}
                </Text>
                <Text style={styles.statLbl}>Total Days</Text>
              </View>
            </View>
          </View>
        )}

        {/* Fee Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fee Status</Text>
          {feeRecords.length === 0 ? (
            <View style={styles.emptyFee}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#16a34a" />
              <Text style={styles.emptyFeeText}>No outstanding dues found.</Text>
            </View>
          ) : (
            <>
              {unpaidFees.length > 0 && (
                <View style={styles.duePill}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={styles.duePillText}>
                    ₹{Number(totalDue).toLocaleString('en-IN')} outstanding dues
                  </Text>
                </View>
              )}
              {feeRecords.slice(0, 5).map((f, i) => (
                <View key={f.id || i} style={[styles.feeRow, i === 0 && { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeName}>{f.fee_type || f.name || `Payment ${i + 1}`}</Text>
                    <Text style={styles.feeMeta}>
                      ₹{Number(f.amount_due || f.amount || 0).toLocaleString('en-IN')}
                      {f.due_date ? ` · Due: ${new Date(f.due_date).toLocaleDateString('en-IN')}` : ''}
                    </Text>
                  </View>
                  <View style={[
                    styles.feeStatusBadge,
                    { backgroundColor: f.status === 'PAID' ? '#dcfce7' : '#fee2e2' }
                  ]}>
                    <Text style={[
                      styles.feeStatusText,
                      { color: f.status === 'PAID' ? '#16a34a' : '#dc2626' }
                    ]}>
                      {f.status || 'PENDING'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Archive / Delete Student Option */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteStudent}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text style={styles.deleteBtnText}>Archive / Delete Student Record</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b', fontWeight: '600' },
  backBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, marginBottom: 10,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
  nameText: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  admText: { fontSize: 13, color: '#64748b', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  attBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 99,
  },
  attBadgeText: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000',
    shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  reRegisterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reRegisterBtnText: { fontSize: 11, fontWeight: '700', color: '#0b57d0' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 1 },
  infoValue: { fontSize: 13.5, fontWeight: '600', color: '#1e293b' },
  divider: { height: 1, backgroundColor: '#f8fafc' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', paddingVertical: 8 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' },
  emptyFee: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  emptyFeeText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  duePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 4,
  },
  duePillText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  feeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#f8fafc',
  },
  feeName: { fontSize: 13.5, fontWeight: '600', color: '#1e293b' },
  feeMeta: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  feeStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  feeStatusText: { fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14, width: '100%', justifyContent: 'center', flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff',
    marginTop: 8,
    marginBottom: 20,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
});
