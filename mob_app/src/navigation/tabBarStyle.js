// mob_app/src/navigation/tabBarStyle.js
import { Platform } from 'react-native';
import { colors } from '../theme/colors';

export const TAB_BAR_STYLE = {
  backgroundColor: '#ffffff',
  borderTopColor: colors.border,
  borderTopWidth: 1,
  paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  paddingTop: 8,
  height: Platform.OS === 'ios' ? 84 : 64,
  shadowColor: colors.shadowColor,
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 10,
};

export const TAB_BAR_OPTIONS = {
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  tabBarStyle: TAB_BAR_STYLE,
  headerShown: false,
};
