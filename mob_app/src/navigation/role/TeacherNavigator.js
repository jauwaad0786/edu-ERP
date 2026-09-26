// mob_app/src/navigation/role/TeacherNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TeacherDashboardScreen from '../../screens/dashboard/TeacherDashboardScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import ClassesScreen from '../../screens/classes/ClassesScreen';
import ClassDetailScreen from '../../screens/classes/ClassDetailScreen';
import MarksScreen from '../../screens/marks/MarksScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import AssignmentsScreen from '../../screens/assignments/AssignmentsScreen';
import LeavesScreen from '../../screens/leaves/LeavesScreen';
import StaffAttendanceScreen from '../../screens/staff/StaffAttendanceScreen';
import PayrollScreen from '../../screens/hr/PayrollScreen';
import SupportScreen from '../../screens/admin/SupportScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import NoticeBoardScreen from '../../screens/notices/NoticeBoardScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import AdmitCardScreen from '../../screens/examinations/AdmitCardScreen';
import StudentsScreen from '../../screens/students/StudentsScreen';
import StudentDetailScreen from '../../screens/students/StudentDetailScreen';
import IDCardScreen from '../../screens/students/IDCardScreen';
import AnnualRegisterScreen from '../../screens/students/AnnualRegisterScreen';
import StudentImportScreen from '../../screens/students/StudentImportScreen';
import StaffDetailScreen from '../../screens/staff/StaffDetailScreen';
import AIChatScreen from '../../screens/ai/AIChatScreen';
import TimetableScreen from '../../screens/timetable/TimetableScreen';
import CurriculumScreen from '../../screens/curriculum/CurriculumScreen';
import SubjectsScreen from '../../screens/classes/SubjectsScreen';
import DelegationsScreen from '../../screens/delegations/DelegationsScreen';
import MeetingsScreen from '../../screens/communication/MeetingsScreen';
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
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Curriculum" component={CurriculumScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="ExamSchedule" component={ExaminationsScreen} />
      <Stack.Screen name="AdmitCard" component={AdmitCardScreen} />
      <Stack.Screen name="AdmitCards" component={AdmitCardScreen} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Homework" component={AssignmentsScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="Marks" component={MarksScreen} />
      <Stack.Screen name="MarksEntry" component={MarksScreen} />
      <Stack.Screen name="Students" component={StudentsScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <Stack.Screen name="IDCard" component={IDCardScreen} />
      <Stack.Screen name="IDCards" component={IDCardScreen} />
      <Stack.Screen name="AnnualRegister" component={AnnualRegisterScreen} />
      <Stack.Screen name="StudentImport" component={StudentImportScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="Leaves" component={LeavesScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NoticeBoard" component={NoticeBoardScreen} />
      <Stack.Screen name="Notices" component={NoticeBoardScreen} />
      <Stack.Screen name="Delegations" component={DelegationsScreen} />
      <Stack.Screen name="TeacherDelegations" component={DelegationsScreen} />
      <Stack.Screen name="SubstituteDuties" component={DelegationsScreen} />
      <Stack.Screen name="Meetings" component={MeetingsScreen} />
      <Stack.Screen name="PTM" component={MeetingsScreen} />
      <Stack.Screen name="Conferences" component={MeetingsScreen} />
    </Stack.Navigator>
  );
}
