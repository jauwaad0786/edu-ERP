// mob_app/src/navigation/role/VicePrincipalNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import VicePrincipalDashboardScreen from '../../screens/dashboard/VicePrincipalDashboardScreen';
import AttendanceScreen             from '../../screens/attendance/AttendanceScreen';
import ClassesScreen                from '../../screens/classes/ClassesScreen';
import LeavesScreen                 from '../../screens/leaves/LeavesScreen';
import SettingsScreen               from '../../screens/settings/SettingsScreen';
import ProfileScreen                from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen         from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen          from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function VicePrincipalTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#7c3aed', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Attendance: focused ? 'clipboard' : 'clipboard-outline',
          Classes: focused ? 'library' : 'library-outline',
          Leaves: focused ? 'calendar' : 'calendar-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"  component={VicePrincipalDashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Classes"    component={ClassesScreen} />
      <Tab.Screen name="Leaves"     component={LeavesScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function VicePrincipalNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VicePrincipalTabs" component={VicePrincipalTabs} />
      <Stack.Screen name="Profile"           component={ProfileScreen} />
      <Stack.Screen name="ChangePassword"    component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"     component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
