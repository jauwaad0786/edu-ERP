// mob_app/src/navigation/role/StudentNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import StudentDashboardScreen  from '../../screens/dashboard/StudentDashboardScreen';
import AttendanceScreen        from '../../screens/attendance/AttendanceScreen';
import FeesScreen              from '../../screens/fees/FeesScreen';
import ResultScreen            from '../../screens/result/ResultScreen';
import SettingsScreen          from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();

export default function StudentNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#7c3aed',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'grid-outline', Attendance: 'clipboard-outline',
          Fees: 'receipt-outline', Results: 'school-outline', Settings: 'settings-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
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
