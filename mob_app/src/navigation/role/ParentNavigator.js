// mob_app/src/navigation/role/ParentNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import StudentDashboardScreen from '../../screens/dashboard/StudentDashboardScreen';
import AttendanceScreen       from '../../screens/attendance/AttendanceScreen';
import FeesScreen             from '../../screens/fees/FeesScreen';
import TransportTrackScreen   from '../../screens/transport/TransportTrackScreen';
import SettingsScreen         from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function ParentNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#7c3aed', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { 'My Child': 'person-outline', Attendance: 'clipboard-outline', Fees: 'receipt-outline', Transport: 'bus-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="My Child"   component={StudentDashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Fees"       component={FeesScreen} />
      <Tab.Screen name="Transport"  component={TransportTrackScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}
