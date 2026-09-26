// mob_app/src/screens/staff/StaffDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { colors } from '../../theme/colors';

const AVATAR_BG_COLORS = ['#ede9fe', '#dbeafe', '#fef3c7', '#dcfce7'];
const AVATAR_TEXT_COLORS = ['#7c3aed', '#1d4ed8', '#b45309', '#15803d'];

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
        <Ionicons name="person-outline" size={48} color="#94a3b8" style={{ opacity: 0.4, marginBottom: 12 }} />
        <Text style={styles.loadingText}>Faculty record not found.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const name = teacher.name || teacher.user_name || 'Faculty Member';
  const designation = teacher.designation || teacher.subject || 'Faculty / Teacher';
  const employeeId = teacher.employee_id || teacher.emp_id || `EMP00${teacher.id || 1}`;
  const phone = teacher.phone || teacher.mobile || teacher.contact_number;
  const email = teacher.email;
  const qualification = teacher.qualification || 'Post-Graduate (B.Ed / M.Sc)';
  const department = teacher.department || teacher.dept_name || 'Academic Faculty';
  const subjects = Array.isArray(teacher.subjects)
    ? teacher.subjects.join(', ')
    : teacher.subjects || teacher.subject || 'Assigned Core Curriculum';
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
    if (phone) Linking.openURL(`tel:${phone.replace(/\D/g, '')}`).catch(() => {});
  };

  const handleEmail = () => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => {});
  };

  const handleDownloadIdCard = () => {
    const url = `${client.defaults.baseURL}/principal/teachers/${teacher.id}/id-card`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Download Error', 'Could not open ID Card link.');
    });
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={16} color="#0284c7" />
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
        <TouchableOpacity onPress={handleDownloadIdCard} style={styles.idCardNavBtn}>
          <Ionicons name="card-outline" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar + Name Section */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: AVATAR_BG_COLORS[0] }]}>
            <Text style={[styles.avatarText, { color: AVATAR_TEXT_COLORS[0] }]}>{initials}</Text>
          </View>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.designationText}>{designation} • {department}</Text>
          <View style={styles.empBadge}>
            <Text style={styles.empBadgeText}>ID: {employeeId}</Text>
          </View>

          {/* Quick Contact Actions */}
          <View style={styles.actionRow}>
            {phone && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
                <Ionicons name="call" size={15} color="#ffffff" />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
            {email && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0284c7' }]} onPress={handleEmail}>
                <Ionicons name="mail" size={15} color="#ffffff" />
                <Text style={styles.actionBtnText}>Email</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#059669' }]} onPress={handleDownloadIdCard}>
              <Ionicons name="download-outline" size={15} color="#ffffff" />
              <Text style={styles.actionBtnText}>ID Card</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Academic Responsibilities Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Academic Responsibilities</Text>
          <InfoRow icon="book-outline" label="Assigned Subjects" value={subjects} />
          <View style={styles.divider} />
          <InfoRow icon="school-outline" label="Teaching Classes" value={assignedClasses} />
          <View style={styles.divider} />
          <InfoRow icon="ribbon-outline" label="Qualifications" value={qualification} />
        </View>

        {/* Employment & Contact Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Employment & Contact Details</Text>
          <InfoRow icon="business-outline" label="Department" value={department} />
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Phone Number" value={phone} />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline" label="Official Email" value={email} />
          <View style={styles.divider} />
          <InfoRow icon="shield-checkmark-outline" label="Employment Status" value="ACTIVE FULL-TIME" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  backBtn: { marginTop: 16, padding: 8 },
  header: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { padding: 4 },
  idCardNavBtn: { padding: 6, backgroundColor: '#1e293b', borderRadius: 8 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 14, paddingBottom: 40 },
  avatarSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 24, fontWeight: '800' },
  nameText: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  designationText: { fontSize: 13, color: '#64748b', marginTop: 2 },
  empBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  empBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, color: '#64748b' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
});
