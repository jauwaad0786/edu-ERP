// mob_app/src/navigation/role/PrincipalNavigator.js
// Complete role navigator for Principal / Director with full Web ERP feature parity

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import PrincipalDashboardScreen from '../../screens/dashboard/PrincipalDashboardScreen';
import StudentsScreen from '../../screens/students/StudentsScreen';
import AddStudentWizardScreen from '../../screens/students/AddStudentWizardScreen';
import StudentDetailScreen from '../../screens/students/StudentDetailScreen';
import StaffScreen from '../../screens/staff/StaffScreen';
import StaffDetailScreen from '../../screens/staff/StaffDetailScreen';
import ClassesScreen from '../../screens/classes/ClassesScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import FeesScreen from '../../screens/fees/FeesScreen';
import CollectPaymentScreen from '../../screens/fees/CollectPaymentScreen';
import OutstandingScreen from '../../screens/fees/OutstandingScreen';
import ExpensesScreen from '../../screens/finance/ExpensesScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import MarksScreen from '../../screens/marks/MarksScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import LiveTrackingScreen from '../../screens/transport/LiveTrackingScreen';
import VehiclesScreen from '../../screens/transport/VehiclesScreen';
import RoutesScreen from '../../screens/transport/RoutesScreen';
import RollCallScreen from '../../screens/hostel/RollCallScreen';
import OutPassScreen from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen from '../../screens/hostel/ComplaintsScreen';
import BooksScreen from '../../screens/library/BooksScreen';
import FinesScreen from '../../screens/library/FinesScreen';
import IssueReturnScreen from '../../screens/library/IssueReturnScreen';
import EmployeesScreen from '../../screens/hr/EmployeesScreen';
import PayrollScreen from '../../screens/hr/PayrollScreen';
import LeavesScreen from '../../screens/leaves/LeavesScreen';
import ReportsScreen from '../../screens/reports/ReportsScreen';
import SupportScreen from '../../screens/admin/SupportScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import AIChatScreen from '../../screens/ai/AIChatScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PrincipalTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: '#0b57d0',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Students: focused ? 'people' : 'people-outline',
            Teachers: focused ? 'person' : 'person-outline',
            Fees: focused ? 'card' : 'card-outline',
            Settings: focused ? 'settings' : 'settings-outline',
          };
          return <Ionicons name={icons[route.name] || 'grid-outline'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={PrincipalDashboardScreen} />
      <Tab.Screen name="Students" component={StudentsScreen} />
      <Tab.Screen name="Teachers" component={StaffScreen} />
      <Tab.Screen name="Fees" component={FeesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function PrincipalNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PrincipalTabs" component={PrincipalTabs} />

      {/* AI Assistant (Copilot) */}
      <Stack.Screen name="AIChat" component={AIChatScreen} />

      {/* Student Lifecycle */}
      <Stack.Screen name="Students" component={StudentsScreen} />
      <Stack.Screen name="AddStudent" component={AddStudentWizardScreen} />
      <Stack.Screen name="AddStudentWizard" component={AddStudentWizardScreen} />
      <Stack.Screen name="StudentDetail" component={StudentDetailScreen} />

      {/* Academics & Staff */}
      <Stack.Screen name="Teachers" component={StaffScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="TeacherDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Classes" component={ClassesScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="ExamSchedule" component={ExaminationsScreen} />
      <Stack.Screen name="Marks" component={MarksScreen} />
      <Stack.Screen name="MarksEntry" component={MarksScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />

      {/* Finance & Fees */}
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="FeeCollect" component={CollectPaymentScreen} />
      <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
      <Stack.Screen name="FeeRecords" component={OutstandingScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />

      {/* Campus & Logistics */}
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="Transport" component={LiveTrackingScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Routes" component={RoutesScreen} />
      <Stack.Screen name="RollCall" component={RollCallScreen} />
      <Stack.Screen name="Hostel" component={RollCallScreen} />
      <Stack.Screen name="OutPass" component={OutPassScreen} />
      <Stack.Screen name="Complaints" component={ComplaintsScreen} />
      <Stack.Screen name="Books" component={BooksScreen} />
      <Stack.Screen name="Library" component={BooksScreen} />
      <Stack.Screen name="Fines" component={FinesScreen} />
      <Stack.Screen name="IssueReturn" component={IssueReturnScreen} />

      {/* HRMS & Staff Operations */}
      <Stack.Screen name="Employees" component={EmployeesScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="Leaves" component={LeavesScreen} />

      {/* Reporting, Support & Settings */}
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}
