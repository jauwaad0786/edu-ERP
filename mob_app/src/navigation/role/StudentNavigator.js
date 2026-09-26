// mob_app/src/navigation/role/StudentNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import StudentDashboardScreen from '../../screens/dashboard/StudentDashboardScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import FeesScreen from '../../screens/fees/FeesScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import AssignmentsScreen from '../../screens/assignments/AssignmentsScreen';
import BooksScreen from '../../screens/library/BooksScreen';
import TransportTrackScreen from '../../screens/transport/TransportTrackScreen';
import OutPassScreen from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen from '../../screens/hostel/ComplaintsScreen';
import SupportScreen from '../../screens/admin/SupportScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import NoticeBoardScreen from '../../screens/notices/NoticeBoardScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import AdmitCardScreen from '../../screens/examinations/AdmitCardScreen';
import TimetableScreen from '../../screens/timetable/TimetableScreen';
import CurriculumScreen from '../../screens/curriculum/CurriculumScreen';
import AIChatScreen from '../../screens/ai/AIChatScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Dashboard:  focused ? 'grid' : 'grid-outline',
            Attendance: focused ? 'clipboard' : 'clipboard-outline',
            Fees:       focused ? 'receipt' : 'receipt-outline',
            Results:    focused ? 'school' : 'school-outline',
            Settings:   focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
        },
      })}
    >
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
      <Stack.Screen name="StudentTabs" component={StudentTabs} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Curriculum" component={CurriculumScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="AdmitCard" component={AdmitCardScreen} />
      <Stack.Screen name="AdmitCards" component={AdmitCardScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Homework" component={AssignmentsScreen} />
      <Stack.Screen name="Books" component={BooksScreen} />
      <Stack.Screen name="Transport" component={TransportTrackScreen} />
      <Stack.Screen name="OutPass" component={OutPassScreen} />
      <Stack.Screen name="Complaints" component={ComplaintsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NoticeBoard" component={NoticeBoardScreen} />
      <Stack.Screen name="Notices" component={NoticeBoardScreen} />
    </Stack.Navigator>
  );
}
