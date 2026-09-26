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
import ClassDetailScreen from '../../screens/classes/ClassDetailScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import FeesScreen from '../../screens/fees/FeesScreen';
import CollectPaymentScreen from '../../screens/fees/CollectPaymentScreen';
import OutstandingScreen from '../../screens/fees/OutstandingScreen';
import FeeSetupScreen from '../../screens/fees/FeeSetupScreen';
import FeeServiceGenerationScreen from '../../screens/fees/FeeServiceGenerationScreen';
import ExpensesScreen from '../../screens/finance/ExpensesScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import AdmitCardScreen from '../../screens/examinations/AdmitCardScreen';
import MarksScreen from '../../screens/marks/MarksScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import AssignmentsScreen from '../../screens/assignments/AssignmentsScreen';
import LiveTrackingScreen from '../../screens/transport/LiveTrackingScreen';
import VehiclesScreen from '../../screens/transport/VehiclesScreen';
import RoutesScreen from '../../screens/transport/RoutesScreen';
import RollCallScreen from '../../screens/hostel/RollCallScreen';
import OutPassScreen from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen from '../../screens/hostel/ComplaintsScreen';
import VisitorsScreen from '../../screens/hostel/VisitorsScreen';
import BooksScreen from '../../screens/library/BooksScreen';
import FinesScreen from '../../screens/library/FinesScreen';
import IssueReturnScreen from '../../screens/library/IssueReturnScreen';
import EmployeesScreen from '../../screens/hr/EmployeesScreen';
import PayrollScreen from '../../screens/hr/PayrollScreen';
import LeavesScreen from '../../screens/leaves/LeavesScreen';
import StaffAttendanceScreen from '../../screens/staff/StaffAttendanceScreen';
import DelegationsScreen from '../../screens/delegations/DelegationsScreen';
import ReportsScreen from '../../screens/reports/ReportsScreen';
import AuditLogsScreen from '../../screens/audit/AuditLogsScreen';
import WhatsAppScreen from '../../screens/communication/WhatsAppScreen';
import RolesScreen from '../../screens/rbac/RolesScreen';
import MeetingsScreen from '../../screens/communication/MeetingsScreen';
import SupportScreen from '../../screens/admin/SupportScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import NoticeBoardScreen from '../../screens/notices/NoticeBoardScreen';
import LeadsScreen from '../../screens/admin/LeadsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import AIChatScreen from '../../screens/ai/AIChatScreen';
import TimetableScreen from '../../screens/timetable/TimetableScreen';
import CurriculumScreen from '../../screens/curriculum/CurriculumScreen';
import RoomMapScreen from '../../screens/hostel/RoomMapScreen';
import ProvisionalScreen from '../../screens/students/ProvisionalScreen';
import SectionShuffleScreen from '../../screens/students/SectionShuffleScreen';
import PromotionScreen from '../../screens/students/PromotionScreen';
import BulkEditScreen from '../../screens/students/BulkEditScreen';
import AnnualRegisterScreen from '../../screens/students/AnnualRegisterScreen';
import IDCardScreen from '../../screens/students/IDCardScreen';
import StudentImportScreen from '../../screens/students/StudentImportScreen';
import ReceiptsScreen from '../../screens/fees/ReceiptsScreen';
import SubjectsScreen from '../../screens/classes/SubjectsScreen';
import DriverConsoleScreen from '../../screens/transport/DriverConsoleScreen';
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
      <Stack.Screen name="Provisional" component={ProvisionalScreen} />
      <Stack.Screen name="SectionShuffle" component={SectionShuffleScreen} />
      <Stack.Screen name="Promotion" component={PromotionScreen} />
      <Stack.Screen name="BulkEdit" component={BulkEditScreen} />
      <Stack.Screen name="AnnualRegister" component={AnnualRegisterScreen} />
      <Stack.Screen name="IDCard" component={IDCardScreen} />
      <Stack.Screen name="IDCards" component={IDCardScreen} />
      <Stack.Screen name="StudentImport" component={StudentImportScreen} />
      <Stack.Screen name="ImportStudents" component={StudentImportScreen} />

      {/* Academics & Staff */}
      <Stack.Screen name="Teachers" component={StaffScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="TeacherDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Classes" component={ClassesScreen} />
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Curriculum" component={CurriculumScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="ExamSchedule" component={ExaminationsScreen} />
      <Stack.Screen name="AdmitCard" component={AdmitCardScreen} />
      <Stack.Screen name="AdmitCards" component={AdmitCardScreen} />
      <Stack.Screen name="Marks" component={MarksScreen} />
      <Stack.Screen name="MarksEntry" component={MarksScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Homework" component={AssignmentsScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />

      {/* Finance & Fees */}
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="FeeCollect" component={CollectPaymentScreen} />
      <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
      <Stack.Screen name="FeeSetup" component={FeeSetupScreen} />
      <Stack.Screen name="FeeGeneration" component={FeeServiceGenerationScreen} />
      <Stack.Screen name="FeeServiceGeneration" component={FeeServiceGenerationScreen} />
      <Stack.Screen name="Receipts" component={ReceiptsScreen} />
      <Stack.Screen name="ReceiptsAudit" component={ReceiptsScreen} />
      <Stack.Screen name="FeeRecords" component={OutstandingScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />

      {/* Campus & Logistics */}
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="Transport" component={LiveTrackingScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Routes" component={RoutesScreen} />
      <Stack.Screen name="DriverConsole" component={DriverConsoleScreen} />
      <Stack.Screen name="DriverApp" component={DriverConsoleScreen} />
      <Stack.Screen name="RollCall" component={RollCallScreen} />
      <Stack.Screen name="Hostel" component={RollCallScreen} />
      <Stack.Screen name="RoomMap" component={RoomMapScreen} />
      <Stack.Screen name="HostelRoomMap" component={RoomMapScreen} />
      <Stack.Screen name="OutPass" component={OutPassScreen} />
      <Stack.Screen name="Complaints" component={ComplaintsScreen} />
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="VisitorLog" component={VisitorsScreen} />
      <Stack.Screen name="GatePass" component={VisitorsScreen} />
      <Stack.Screen name="Books" component={BooksScreen} />
      <Stack.Screen name="Library" component={BooksScreen} />
      <Stack.Screen name="Fines" component={FinesScreen} />
      <Stack.Screen name="IssueReturn" component={IssueReturnScreen} />

      {/* HRMS & Staff Operations */}
      <Stack.Screen name="Employees" component={EmployeesScreen} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />
      <Stack.Screen name="Leaves" component={LeavesScreen} />
      <Stack.Screen name="Delegations" component={DelegationsScreen} />
      <Stack.Screen name="TeacherDelegations" component={DelegationsScreen} />
      <Stack.Screen name="SubstituteDuties" component={DelegationsScreen} />

      {/* Reporting, Support & Settings */}
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="AuditLogs" component={AuditLogsScreen} />
      <Stack.Screen name="AuditTrail" component={AuditLogsScreen} />
      <Stack.Screen name="SecurityLogs" component={AuditLogsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NoticeBoard" component={NoticeBoardScreen} />
      <Stack.Screen name="Notices" component={NoticeBoardScreen} />
      <Stack.Screen name="Leads" component={LeadsScreen} />
      <Stack.Screen name="Inquiries" component={LeadsScreen} />
      <Stack.Screen name="WhatsApp" component={WhatsAppScreen} />
      <Stack.Screen name="WhatsAppSettings" component={WhatsAppScreen} />
      <Stack.Screen name="Roles" component={RolesScreen} />
      <Stack.Screen name="RoleManagement" component={RolesScreen} />
      <Stack.Screen name="PermissionMatrix" component={RolesScreen} />
      <Stack.Screen name="RBAC" component={RolesScreen} />
      <Stack.Screen name="Meetings" component={MeetingsScreen} />
      <Stack.Screen name="PTM" component={MeetingsScreen} />
      <Stack.Screen name="Conferences" component={MeetingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="DeveloperCenter"  component={DeveloperCenterScreen} />
      <Stack.Screen name="ErrorDashboard"   component={DeveloperCenterScreen} />
      <Stack.Screen name="SystemHealth"     component={DeveloperCenterScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="FinanceHub"     component={FinanceHubScreen} />
      <Stack.Screen name="Purchases"      component={FinanceHubScreen} />
      <Stack.Screen name="Vendors"        component={FinanceHubScreen} />
      <Stack.Screen name="FinanceDash"    component={FinanceHubScreen} />
    </Stack.Navigator>
  );
}
