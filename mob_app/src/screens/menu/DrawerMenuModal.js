// mob_app/src/screens/menu/DrawerMenuModal.js
import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function DrawerMenuModal({
  visible,
  onClose,
  navigation,
  user,
  onLogoutPress,
}) {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  const menuItems = [
    { label: 'Dashboard', icon: 'home-outline', screen: 'Home', color: colors.primary },
    { label: 'Students', icon: 'people-outline', screen: 'Students', color: '#2563eb' },
    { label: 'Teachers', icon: 'person-outline', screen: 'Teachers', color: colors.purple },
    { label: 'Classes', icon: 'school-outline', screen: 'Classes', color: colors.teal },
    { label: 'Subjects', icon: 'book-outline', screen: 'Subjects', color: '#0284c7' },
    { label: 'Attendance', icon: 'clipboard-outline', screen: 'Attendance', color: colors.success },
    { label: 'Examinations', icon: 'document-text-outline', screen: 'Examinations', color: colors.warning },
    { label: 'Results', icon: 'ribbon-outline', screen: 'Result', color: '#7c3aed' },
    { label: 'Fees Management', icon: 'card-outline', screen: 'Fees', color: colors.success },
    { label: 'Transport & Hostel', icon: 'bus-outline', screen: 'Transport', color: '#ea580c' },
    { label: 'Communication', icon: 'chatbubbles-outline', screen: 'Communication', color: '#0284c7' },
    { label: 'Reports', icon: 'stats-chart-outline', screen: 'Reports', color: colors.pink },
    { label: 'Settings', icon: 'settings-outline', screen: 'Settings', color: colors.muted },
  ];

  const handleNavigate = (screen) => {
    onClose();
    if (screen && navigation?.navigate) {
      navigation.navigate(screen);
    }
  };

  const userName = user?.name || 'Dr. Rajesh Sharma';
  const userRole = user?.role || 'Principal';
  const schoolName = user?.school?.name || user?.school_name || 'Greenwood International School';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Profile Header */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => handleNavigate('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{userName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.nameText}>{userName}</Text>
            <Text style={styles.roleSub}>{userRole}</Text>
            <Text style={styles.schoolSub} numberOfLines={1}>{schoolName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Navigation List */}
        <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuRow}
              onPress={() => handleNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bottom Theme Toggle & Logout */}
        <View style={styles.footer}>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>Light</Text>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
              trackColor={{ false: '#e2e8f0', true: colors.primaryLight }}
            />
            <Text style={styles.themeLabel}>Dark</Text>
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              onClose();
              if (onLogoutPress) onLogoutPress();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  nameText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  roleSub: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  schoolSub: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: '#ffffff',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
