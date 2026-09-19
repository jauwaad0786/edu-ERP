// mob_app/src/screens/settings/SettingsScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const C = { primary: '#0176d3', text: '#1e293b', muted: '#64748b', bg: '#f0f4f8', surface: '#fff', border: '#e2e8f0', error: '#dc2626' };

function SettingRow({ icon, label, value, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? '#fef2f2' : '#f0f4f8' }]}>
        <Ionicons name={icon} size={18} color={danger ? C.error : C.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.rowLabel, danger && { color: C.error }]}>{label}</Text>
        {value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin', PRINCIPAL: 'Principal', DIRECTOR: 'Director',
  VICE_PRINCIPAL: 'Vice Principal', TEACHER: 'Teacher', ACCOUNTANT: 'Accountant',
  LIBRARIAN: 'Librarian', HOSTEL: 'Warden', TRANSPORT: 'Transport Head',
  DRIVER: 'Driver', STUDENT: 'Student', PARENT: 'Parent', HR: 'HR Manager',
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const confirmLogout = () => Alert.alert(
    'Logout',
    'Are you sure you want to sign out?',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: logout }]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileRole}>{ROLE_LABELS[user?.role] || user?.role}</Text>
            <Text style={styles.profileSchool}>{user?.school?.name || user?.school_name || 'EduERP'}</Text>
          </View>
        </View>

        {/* Account Info */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.section}>
          <SettingRow icon="person-circle-outline" label="Full Name" value={user?.name} />
          <SettingRow icon="mail-outline" label="Email" value={user?.email} />
          <SettingRow icon="phone-portrait-outline" label="Phone" value={user?.phone} />
          <SettingRow icon="school-outline" label="Institution" value={user?.school?.name || user?.school_name} />
          <SettingRow icon="calendar-outline" label="Academic Session" value={user?.school?.current_session || user?.current_session || '2026-27'} />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.section}>
          <SettingRow icon="notifications-outline" label="Push Notifications" />
          <SettingRow icon="language-outline" label="Language" value="English" />
        </View>

        {/* App Info */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.section}>
          <SettingRow icon="information-circle-outline" label="App Version" value="1.0.0" />
          <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" />
          <SettingRow icon="document-text-outline" label="Terms of Use" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={C.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>EduERP · Powered by 1P360{'\n'}© 2024 All rights reserved</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileCard: { backgroundColor: C.primary, borderRadius: 18, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  profileRole: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 1 },
  profileSchool: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 4, paddingLeft: 4 },
  section: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  rowValue: { fontSize: 11, color: C.muted, marginTop: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2', marginBottom: 20 },
  logoutText: { color: C.error, fontWeight: '700', fontSize: 14 },
  footer: { textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 18 },
});
