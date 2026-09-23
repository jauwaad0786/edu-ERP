// mob_app/src/screens/settings/SettingsScreen.js
// Exact match to Screen 13 of mockup: Settings management hub
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const SETTINGS_OPTIONS = [
  {
    id: 'school_profile',
    title: 'School Profile',
    desc: 'Update school information',
    icon: 'business',
    color: '#0284c7',
    bg: '#e0f2fe',
    screen: 'Profile',
  },
  {
    id: 'session',
    title: 'Academic Session',
    desc: 'Manage current session',
    icon: 'calendar',
    color: '#ea580c',
    bg: '#ffedd5',
    screen: 'AcademicSession',
  },
  {
    id: 'notifications',
    title: 'Notification Preferences',
    desc: 'Manage alerts',
    icon: 'notifications',
    color: '#eab308',
    bg: '#fef9c3',
    screen: 'NotificationSettings',
  },
  {
    id: 'change_password',
    title: 'Change Password',
    desc: null,
    icon: 'lock-closed',
    color: '#0284c7',
    bg: '#e0f2fe',
    screen: 'ChangePassword',
  },
  {
    id: 'appearance',
    title: 'App Appearance',
    desc: null,
    icon: 'color-palette',
    color: '#0284c7',
    bg: '#e0f2fe',
    screen: 'AppearanceSettings',
  },
  {
    id: 'language',
    title: 'Language',
    desc: 'English',
    icon: 'globe',
    color: '#7c3aed',
    bg: '#ede9fe',
    screen: 'LanguageSettings',
  },
  {
    id: 'help',
    title: 'Help & Support',
    desc: null,
    icon: 'information-circle',
    color: '#0284c7',
    bg: '#e0f2fe',
    screen: 'HelpSupport',
  },
];

export default function SettingsScreen({ navigation }) {
  const handleSettingPress = (item) => {
    // Screens that are fully implemented and registered in the navigator
    const implementedScreens = ['Profile', 'ChangePassword'];
    if (implementedScreens.includes(item.screen) && navigation?.navigate) {
      navigation.navigate(item.screen);
    } else {
      // Graceful fallback for screens not yet implemented in the mobile app
      Alert.alert(
        item.title,
        `${item.title} settings will be available in the next update.\n\nPlease use the web portal to manage these settings.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {SETTINGS_OPTIONS.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={styles.settingRow}
              activeOpacity={0.7}
              onPress={() => handleSettingPress(item)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                {item.desc && <Text style={styles.settingDesc}>{item.desc}</Text>}
              </View>

              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  cardList: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoCol: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  settingDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
});
