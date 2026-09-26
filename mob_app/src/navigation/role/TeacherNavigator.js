// mob_app/src/navigation/role/TeacherNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TeacherDashboardScreen from '../../screens/dashboard/TeacherDashboardScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import ClassesScreen from '../../screens/classes/ClassesScreen';
import MarksScreen from '../../screens/marks/MarksScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import LeavesScreen from '../../screens/leaves/LeavesScreen';
import SupportScreen from '../../screens/admin/SupportScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import StudentsScreen from '../../screens/students/StudentsScreen';
import StudentDetailScreen from '../../screens/students/StudentDetailScreen';
import StaffDetailScreen from '../../screens/staff/StaffDetailScreen';
import AIChatScreen from '../../screens/ai/AIChatScreen';
import TimetableScreen from '../../screens/timetable/TimetableScreen';
import CurriculumScreen from '../../screens/curriculum/CurriculumScreen';
import SubjectsScreen from '../../screens/classes/SubjectsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TeacherTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: '#0176d3',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Dashboard:  focused ? 'grid' : 'grid-outline',
            Attendance: focused ? 'clipboard' : 'clipboard-outline',
            Marks:      focused ? 'pencil' : 'pencil-outline',
            Notes:      focused ? 'book' : 'book-outline',
            Settings:   focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"  component={TeacherDashboardScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Marks"      component={MarksScreen} />
      <Tab.Screen name="Notes"      component={NotesScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function TeacherNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabs} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="Classes" component={ClassesScreen} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Curriculum" component={CurriculumScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="ExamSchedule" component={ExaminationsScreen} />
      <Stack.Screen name="MarksEntry" component={MarksScreen} />
      <Stack.Screen name="Students" component={StudentsScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />
      <Stack.Screen name="Leaves" component={LeavesScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
