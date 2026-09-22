// mob_app/src/screens/profile/ProfileScreen.js
// Exact match to Screen 6 of mockup: My Profile with live institutional details and navigation triggers
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';
import { colors } from '../../theme/colors';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/auth/me').catch(() => ({ data: user })),
      client.get('/principal/school/profile').catch(() => ({ data: null })),
    ]).then(([uRes, sRes]) => {
      setProfile(uRes.data?.user || uRes.data || user);
      setSchool(sRes.data?.school || sRes.data);
    }).finally(() => {
      setLoading(false);
    });
  }, [user]);

  const userName = profile?.name || user?.name || user?.email?.split('@')[0] || 'User Profile';
  const userRole = profile?.role || user?.role || 'Principal';
  const userEmail = profile?.email || user?.email || '—';
  const userPhone = profile?.phone || user?.phone || '—';
  const schoolName = school?.name || user?.school?.name || user?.school_name || 'EduERP Institution';
  const schoolCode = school?.code || school?.school_code || '—';
  const academicSession = school?.current_session || user?.school?.current_session || school?.academic_year || 'Current Session';

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
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation?.navigate?.('EditProfile')}
        >
          <Ionicons name="pencil" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {userName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity style={styles.editAvatarBadge} activeOpacity={0.8}>
                <Ionicons name="pencil" size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userNameText}>{userName}</Text>
            <Text style={styles.userRoleText}>{userRole}</Text>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userEmail}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{userPhone}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="business-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>School</Text>
                <Text style={styles.infoValue}>{schoolName}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="barcode-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>School Code</Text>
                <Text style={styles.infoValue}>{schoolCode}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Academic Session</Text>
                <Text style={styles.infoValue}>{academicSession}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions List */}
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('EditProfile')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="create-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionRowLabel}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('ChangePassword')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionRowLabel}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('NotificationSettings')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="notifications-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionRowLabel}>Notification Preferences</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('AppearanceSettings')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="color-palette-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionRowLabel}>App Appearance</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation?.navigate?.('HelpSupport')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="headset-outline" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionRowLabel}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  userRoleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1e293b',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#f8fafc',
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionRowLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
