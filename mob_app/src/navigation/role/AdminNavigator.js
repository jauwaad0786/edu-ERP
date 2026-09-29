// mob_app/src/navigation/role/AdminNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboardScreen  from '../../screens/dashboard/AdminDashboardScreen';
import SchoolsScreen         from '../../screens/admin/SchoolsScreen';
import UsersScreen           from '../../screens/admin/UsersScreen';
import SupportScreen         from '../../screens/admin/SupportScreen';
import SettingsScreen        from '../../screens/settings/SettingsScreen';
import ProfileScreen         from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen  from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen   from '../../screens/notifications/NotificationsScreen';
import NoticeBoardScreen    from '../../screens/notices/NoticeBoardScreen';
import LeadsScreen          from '../../screens/admin/LeadsScreen';
import VisitorsScreen       from '../../screens/hostel/VisitorsScreen';
import RoomMapScreen        from '../../screens/hostel/RoomMapScreen';
import HostelAdmissionScreen from '../../screens/hostel/HostelAdmissionScreen';
import HostelTransfersScreen from '../../screens/hostel/HostelTransfersScreen';
import HostelFeesScreen      from '../../screens/hostel/HostelFeesScreen';
import HostelFinesScreen     from '../../screens/hostel/HostelFinesScreen';
import RollCallScreen        from '../../screens/hostel/RollCallScreen';
import OutPassScreen         from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen      from '../../screens/hostel/ComplaintsScreen';
import LiveTrackingScreen    from '../../screens/transport/LiveTrackingScreen';
import VehiclesScreen        from '../../screens/transport/VehiclesScreen';
import RoutesScreen          from '../../screens/transport/RoutesScreen';
import DriversScreen         from '../../screens/transport/DriversScreen';
import ConductorsScreen      from '../../screens/transport/ConductorsScreen';
import StudentTransportScreen from '../../screens/transport/StudentTransportScreen';
import VehicleMaintenanceScreen from '../../screens/transport/VehicleMaintenanceScreen';
import StudentTravelHistoryScreen from '../../screens/transport/StudentTravelHistoryScreen';
import DriverConsoleScreen   from '../../screens/transport/DriverConsoleScreen';
import DelegationsScreen    from '../../screens/delegations/DelegationsScreen';
import AuditLogsScreen      from '../../screens/audit/AuditLogsScreen';
import SchoolProfileScreen  from '../../screens/admin/SchoolProfileScreen';
import SessionManagerScreen from '../../screens/admin/SessionManagerScreen';
import WhatsAppScreen       from '../../screens/communication/WhatsAppScreen';
import RolesScreen          from '../../screens/rbac/RolesScreen';
import MeetingsScreen       from '../../screens/communication/MeetingsScreen';
import AIChatScreen          from '../../screens/ai/AIChatScreen';
import DeveloperCenterScreen from '../../screens/developer/DeveloperCenterScreen';
import FinanceHubScreen from '../../screens/finance/FinanceHubScreen';
import VendorsScreen from '../../screens/finance/VendorsScreen';
import InventoryScreen from '../../screens/finance/InventoryScreen';
import AssetsScreen from '../../screens/finance/AssetsScreen';
import StudentDocumentsScreen from '../../screens/documents/StudentDocumentsScreen';
import IssueCertificatesScreen from '../../screens/documents/IssueCertificatesScreen';
import StudentsScreen from '../../screens/students/StudentsScreen';
import AddStudentWizardScreen from '../../screens/students/AddStudentWizardScreen';
import StudentDetailScreen from '../../screens/students/StudentDetailScreen';
import ProvisionalScreen from '../../screens/students/ProvisionalScreen';
import SectionShuffleScreen from '../../screens/students/SectionShuffleScreen';
import PromotionScreen from '../../screens/students/PromotionScreen';
import BulkEditScreen from '../../screens/students/BulkEditScreen';
import AnnualRegisterScreen from '../../screens/students/AnnualRegisterScreen';
import IDCardScreen from '../../screens/students/IDCardScreen';
import StudentImportScreen from '../../screens/students/StudentImportScreen';
import AttendanceScreen from '../../screens/attendance/AttendanceScreen';
import StaffAttendanceScreen from '../../screens/staff/StaffAttendanceScreen';
import StaffAttendanceAnalyticsScreen from '../../screens/staff/StaffAttendanceAnalyticsScreen';
import StaffAttendanceSettingsScreen from '../../screens/staff/StaffAttendanceSettingsScreen';
import ClassesScreen from '../../screens/classes/ClassesScreen';
import ClassDetailScreen from '../../screens/classes/ClassDetailScreen';
import SubjectsScreen from '../../screens/classes/SubjectsScreen';
import TimetableScreen from '../../screens/timetable/TimetableScreen';
import CurriculumScreen from '../../screens/curriculum/CurriculumScreen';
import NotesScreen from '../../screens/notes/NotesScreen';
import AssignmentsScreen from '../../screens/assignments/AssignmentsScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import AdmitCardScreen from '../../screens/examinations/AdmitCardScreen';
import MarksScreen from '../../screens/marks/MarksScreen';
import ResultScreen from '../../screens/result/ResultScreen';
import StaffScreen from '../../screens/staff/StaffScreen';
import StaffDetailScreen from '../../screens/staff/StaffDetailScreen';
import LeavesScreen from '../../screens/leaves/LeavesScreen';
import PayrollScreen from '../../screens/hr/PayrollScreen';
import BooksScreen from '../../screens/library/BooksScreen';
import IssueReturnScreen from '../../screens/library/IssueReturnScreen';
import FinesScreen from '../../screens/library/FinesScreen';
import MembersScreen from '../../screens/library/MembersScreen';
import ReservationsScreen from '../../screens/library/ReservationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Schools: focused ? 'school' : 'school-outline',
          Users: focused ? 'people' : 'people-outline',
          Support: focused ? 'headset' : 'headset-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Schools"   component={SchoolsScreen} />
      <Tab.Screen name="Users"     component={UsersScreen} />
      <Tab.Screen name="Support"   component={SupportScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs"      component={AdminTabs} />
      <Stack.Screen name="AIChat"         component={AIChatScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
      <Stack.Screen name="NoticeBoard"    component={NoticeBoardScreen} />
      <Stack.Screen name="Notices"        component={NoticeBoardScreen} />
      <Stack.Screen name="Leads"          component={LeadsScreen} />
      <Stack.Screen name="Inquiries"      component={LeadsScreen} />
      <Stack.Screen name="Visitors"       component={VisitorsScreen} />
      <Stack.Screen name="VisitorLog"     component={VisitorsScreen} />
      <Stack.Screen name="GatePass"       component={VisitorsScreen} />
      <Stack.Screen name="Delegations"    component={DelegationsScreen} />
      <Stack.Screen name="TeacherDelegations" component={DelegationsScreen} />
      <Stack.Screen name="SubstituteDuties" component={DelegationsScreen} />
      <Stack.Screen name="AuditLogs"      component={AuditLogsScreen} />
      <Stack.Screen name="AuditTrail"     component={AuditLogsScreen} />
      <Stack.Screen name="SecurityLogs"   component={AuditLogsScreen} />
      <Stack.Screen name="SchoolProfile"  component={SchoolProfileScreen} />
      <Stack.Screen name="SchoolSettings" component={SchoolProfileScreen} />
      <Stack.Screen name="Branches"       component={SchoolProfileScreen} />
      <Stack.Screen name="SessionManager" component={SessionManagerScreen} />
      <Stack.Screen name="Sessions"       component={SessionManagerScreen} />
      <Stack.Screen name="Terms"          component={SessionManagerScreen} />
      <Stack.Screen name="SessionSwitcher" component={SessionManagerScreen} />
      <Stack.Screen name="WhatsApp"       component={WhatsAppScreen} />
      <Stack.Screen name="WhatsAppSettings" component={WhatsAppScreen} />
      <Stack.Screen name="Roles"          component={RolesScreen} />
      <Stack.Screen name="RoleManagement" component={RolesScreen} />
      <Stack.Screen name="PermissionMatrix" component={RolesScreen} />
      <Stack.Screen name="RBAC"           component={RolesScreen} />
      <Stack.Screen name="Meetings"         component={MeetingsScreen} />
      <Stack.Screen name="PTM"              component={MeetingsScreen} />
      <Stack.Screen name="Conferences"      component={MeetingsScreen} />
      <Stack.Screen name="DeveloperCenter"  component={DeveloperCenterScreen} />
      <Stack.Screen name="ErrorDashboard"   component={DeveloperCenterScreen} />
      <Stack.Screen name="SystemHealth"     component={DeveloperCenterScreen} />
      <Stack.Screen name="FinanceHub"     component={FinanceHubScreen} />
      <Stack.Screen name="Purchases"      component={FinanceHubScreen} />
      <Stack.Screen name="Vendors"        component={VendorsScreen} />
      <Stack.Screen name="VendorDirectory" component={VendorsScreen} />
      <Stack.Screen name="Inventory"      component={InventoryScreen} />
      <Stack.Screen name="Stock"          component={InventoryScreen} />
      <Stack.Screen name="Assets"         component={AssetsScreen} />
      <Stack.Screen name="FixedAssets"    component={AssetsScreen} />
      <Stack.Screen name="FinanceDash"    component={FinanceHubScreen} />

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
      <Stack.Screen name="StudentDocuments" component={StudentDocumentsScreen} />
      <Stack.Screen name="Documents" component={StudentDocumentsScreen} />
      <Stack.Screen name="IssueCertificates" component={IssueCertificatesScreen} />
      <Stack.Screen name="Certificates" component={IssueCertificatesScreen} />

      {/* Attendance & HRMS */}
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <Stack.Screen name="StaffAttendanceAnalytics" component={StaffAttendanceAnalyticsScreen} />
      <Stack.Screen name="AttendanceAnalytics" component={StaffAttendanceAnalyticsScreen} />
      <Stack.Screen name="StaffAttendanceSettings" component={StaffAttendanceSettingsScreen} />
      <Stack.Screen name="AttendanceSettings" component={StaffAttendanceSettingsScreen} />

      {/* Academics & Curriculum */}
      <Stack.Screen name="Classes" component={ClassesScreen} />
      <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
      <Stack.Screen name="Subjects" component={SubjectsScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="Curriculum" component={CurriculumScreen} />
      <Stack.Screen name="TeachingDiary" component={CurriculumScreen} />
      <Stack.Screen name="CurriculumCoverage" component={CurriculumScreen} />
      <Stack.Screen name="CurriculumSetup" component={CurriculumScreen} />

      {/* Academic Resources */}
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="StudyMaterial" component={NotesScreen} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Homework" component={AssignmentsScreen} />

      {/* Examinations & Evaluation */}
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="ExamSchedule" component={ExaminationsScreen} />
      <Stack.Screen name="AdmitCard" component={AdmitCardScreen} />
      <Stack.Screen name="AdmitCards" component={AdmitCardScreen} />
      <Stack.Screen name="Marks" component={MarksScreen} />
      <Stack.Screen name="MarksEntry" component={MarksScreen} />
      <Stack.Screen name="Result" component={ResultScreen} />
      <Stack.Screen name="Results" component={ResultScreen} />

      {/* Staff & HRMS */}
      <Stack.Screen name="Staff" component={StaffScreen} />
      <Stack.Screen name="Teachers" component={StaffScreen} />
      <Stack.Screen name="Employees" component={StaffScreen} />
      <Stack.Screen name="StaffDetail" component={StaffDetailScreen} />
      <Stack.Screen name="TeacherDetail" component={StaffDetailScreen} />
      <Stack.Screen name="Leaves" component={LeavesScreen} />
      <Stack.Screen name="Payroll" component={PayrollScreen} />

      {/* Library Management */}
      <Stack.Screen name="Books" component={BooksScreen} />
      <Stack.Screen name="Library" component={BooksScreen} />
      <Stack.Screen name="LibraryBooks" component={BooksScreen} />
      <Stack.Screen name="IssueReturn" component={IssueReturnScreen} />
      <Stack.Screen name="Fines" component={FinesScreen} />
      <Stack.Screen name="LibraryFines" component={FinesScreen} />
      <Stack.Screen name="Members" component={MembersScreen} />
      <Stack.Screen name="LibraryMembers" component={MembersScreen} />
      <Stack.Screen name="Reservations" component={ReservationsScreen} />
      <Stack.Screen name="LibraryReservations" component={ReservationsScreen} />

      {/* Hostel Management */}
      <Stack.Screen name="RoomMap" component={RoomMapScreen} />
      <Stack.Screen name="HostelRoomMap" component={RoomMapScreen} />
      <Stack.Screen name="HostelAdmission" component={HostelAdmissionScreen} />
      <Stack.Screen name="HostelTransfers" component={HostelTransfersScreen} />
      <Stack.Screen name="HostelFees" component={HostelFeesScreen} />
      <Stack.Screen name="HostelFines" component={HostelFinesScreen} />
      <Stack.Screen name="RollCall" component={RollCallScreen} />
      <Stack.Screen name="Hostel" component={RollCallScreen} />
      <Stack.Screen name="OutPass" component={OutPassScreen} />
      <Stack.Screen name="Visitors" component={VisitorsScreen} />
      <Stack.Screen name="VisitorLog" component={VisitorsScreen} />
      <Stack.Screen name="GatePass" component={VisitorsScreen} />
      <Stack.Screen name="Complaints" component={ComplaintsScreen} />

      {/* Transport Management */}
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      <Stack.Screen name="Transport" component={LiveTrackingScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Routes" component={RoutesScreen} />
      <Stack.Screen name="Drivers" component={DriversScreen} />
      <Stack.Screen name="Conductors" component={ConductorsScreen} />
      <Stack.Screen name="StudentTransport" component={StudentTransportScreen} />
      <Stack.Screen name="TransportStudents" component={StudentTransportScreen} />
      <Stack.Screen name="VehicleMaintenance" component={VehicleMaintenanceScreen} />
      <Stack.Screen name="Maintenance" component={VehicleMaintenanceScreen} />
      <Stack.Screen name="StudentTravelHistory" component={StudentTravelHistoryScreen} />
      <Stack.Screen name="TravelHistory" component={StudentTravelHistoryScreen} />
      <Stack.Screen name="DriverConsole" component={DriverConsoleScreen} />
      <Stack.Screen name="DriverApp" component={DriverConsoleScreen} />
    </Stack.Navigator>
  );
}
