// mob_app/src/screens/staff/StaffDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const AVATAR_BG_COLORS = ['#dbeafe', '#fce7f3', '#fef3c7', '#dcfce7', '#ede9fe'];
const AVATAR_TEXT_COLORS = ['#1d4ed8', '#be185d', '#b45309', '#15803d', '#6d28d9'];

export default function StaffDetailScreen({ route, navigation }) {
  const { teacher: passedTeacher, teacher_id } = route?.params || {};
  const [teacher, setTeacher] = useState(passedTeacher || null);
  const [loading, setLoading] = useState(!passedTeacher);

  const tid = passedTeacher?.id || teacher_id;

  useEffect(() => {
    if (!tid) return;
    const fetchTeacher = async () => {
      setLoading(true);
      try {
        const res = await client.get(`/principal/teachers/${tid}/profile`).catch(() => null);
        if (res?.data) {
          setTeacher(res.data?.teacher || res.data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTeacher();
  }, [tid]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Faculty Profile...</Text>
      </SafeAreaView>
    );
  }

  if (!teacher) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="person-outline" size={48} color={colors.muted} style={{ opacity: 0.4, marginBottom: 12 }} />
        <Text style={styles.loadingText}>Faculty record not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const name = teacher.name || teacher.user_name || 'Faculty Member';
  const designation = teacher.designation || teacher.subject || 'Teacher / Faculty';
  const employeeId = teacher.employee_id || teacher.emp_id || `EMP00${teacher.id || 1}`;
  const phone = teacher.phone || teacher.mobile || teacher.contact_number;
  const email = teacher.email;
  const qualification = teacher.qualification || 'B.Ed, Post-Graduate';
  const subjects = Array.isArray(teacher.subjects)
    ? teacher.subjects.join(', ')
    : teacher.subjects || teacher.subject || 'All General Subjects';
  const assignedClasses = Array.isArray(teacher.classes)
    ? teacher.classes.map(c => c.name || c).join(', ')
    : teacher.assigned_class || 'Class 8, Class 9, Class 10';

  const initials = name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCall = () => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleEmail = () => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => {});
  };

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
          onPress={() => navigation?.goBack ? navigation.goBack() : null}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Faculty Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: AVATAR_BG_COLORS[0] }]}>
            <Text style={[styles.avatarText, { color: AVATAR_TEXT_COLORS[0] }]}>{initials}</Text>
          </View>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.designationText}>{designation}</Text>
          <View style={styles.empBadge}>
            <Text style={styles.empBadgeText}>ID: {employeeId}</Text>
          </View>

          {/* Quick Contact Actions */}
          <View style={styles.actionRow}>
            {phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                <Ionicons name="call" size={16} color="#ffffff" />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
            {email && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4338ca' }]} onPress={handleEmail}>
                <Ionicons name="mail" size={16} color="#ffffff" />
                <Text style={styles.actionBtnText}>Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Academic Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Academic Responsibilities</Text>
          <InfoRow icon="book-outline" label="Assigned Subjects" value={subjects} />
          <View style={styles.divider} />
          <InfoRow icon="school-outline" label="Teaching Classes" value={assignedClasses} />
          <View style={styles.divider} />
          <InfoRow icon="ribbon-outline" label="Qualifications" value={qualification} />
        </View>

        {/* Contact & Administrative Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact & Personnel Details</Text>
          <InfoRow icon="call-outline" label="Contact Number" value={phone} />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline" label="Institutional Email" value={email} />
          <View style={styles.divider} />
          <InfoRow icon="card-outline" label="Employee Identification" value={employeeId} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Status" value={teacher.status || 'Active Faculty'} />
        </View>
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
  scrollContent: { padding: 16, paddingBottom: 36 },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  avatarText: { fontSize: 28, fontWeight: '800' },
  nameText: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 10 },
  designationText: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
  empBadge: {
    marginTop: 8, backgroundColor: '#e2e8f0', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 12,
  },
  empBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 20,
  },
  actionBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoIconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#0f172a', fontWeight: '600', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
});
