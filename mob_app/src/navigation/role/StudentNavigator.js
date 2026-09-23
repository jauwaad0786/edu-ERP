// mob_app/src/navigation/role/StudentNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import StudentDashboardScreen  from '../../screens/dashboard/StudentDashboardScreen';
import AttendanceScreen        from '../../screens/attendance/AttendanceScreen';
import FeesScreen              from '../../screens/fees/FeesScreen';
import ResultScreen            from '../../screens/result/ResultScreen';
import SettingsScreen          from '../../screens/settings/SettingsScreen';
import ProfileScreen           from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen    from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen     from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#7c3aed',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard:  focused ? 'grid'      : 'grid-outline',
          Attendance: focused ? 'clipboard' : 'clipboard-outline',
          Fees:       focused ? 'receipt'   : 'receipt-outline',
          Results:    focused ? 'school'    : 'school-outline',
          Settings:   focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"  component={StudentDashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Fees"       component={FeesScreen} />
      <Tab.Screen name="Results"    component={ResultScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function StudentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentTabs"    component={StudentTabs} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
