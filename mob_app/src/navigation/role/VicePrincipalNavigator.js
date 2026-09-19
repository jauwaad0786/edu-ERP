// mob_app/src/navigation/role/VicePrincipalNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import VicePrincipalDashboardScreen from '../../screens/dashboard/VicePrincipalDashboardScreen';
import AttendanceScreen             from '../../screens/attendance/AttendanceScreen';
import ClassesScreen                from '../../screens/classes/ClassesScreen';
import LeavesScreen                 from '../../screens/leaves/LeavesScreen';
import SettingsScreen               from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function VicePrincipalNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#7c3aed', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Attendance: 'clipboard-outline', Classes: 'library-outline', Leaves: 'calendar-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
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
