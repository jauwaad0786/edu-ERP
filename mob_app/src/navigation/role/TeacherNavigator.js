// mob_app/src/navigation/role/TeacherNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TeacherDashboardScreen   from '../../screens/dashboard/TeacherDashboardScreen';
import AttendanceScreen         from '../../screens/attendance/AttendanceScreen';
import MarksScreen              from '../../screens/marks/MarksScreen';
import NotesScreen              from '../../screens/notes/NotesScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();

export default function TeacherNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'grid-outline', Attendance: 'clipboard-outline',
          Marks: 'pencil-outline', Notes: 'book-outline', Settings: 'settings-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"  component={TeacherDashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Marks"      component={MarksScreen} />
      <Tab.Screen name="Notes"      component={NotesScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}
