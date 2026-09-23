// mob_app/src/navigation/role/TeacherNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import TeacherDashboardScreen  from '../../screens/dashboard/TeacherDashboardScreen';
import AttendanceScreen        from '../../screens/attendance/AttendanceScreen';
import MarksScreen             from '../../screens/marks/MarksScreen';
import NotesScreen             from '../../screens/notes/NotesScreen';
import SettingsScreen          from '../../screens/settings/SettingsScreen';
import ProfileScreen           from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen    from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen     from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard:  focused ? 'grid'       : 'grid-outline',
          Attendance: focused ? 'clipboard'  : 'clipboard-outline',
          Marks:      focused ? 'pencil'     : 'pencil-outline',
          Notes:      focused ? 'book'       : 'book-outline',
          Settings:   focused ? 'settings'   : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
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

// Wrap in Stack so Profile/ChangePassword/Notifications are reachable from Settings
export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherTabs"    component={TeacherTabs} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
