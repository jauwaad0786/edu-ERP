import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }          from './context/AuthContext';
import { NotificationProvider }  from './context/NotificationContext';
import ProtectedRoute            from './components/ProtectedRoute';
import { ROUTE_PERMISSIONS }     from './utils/permissionMenuMap';
import DocumentsPage             from './pages/DocumentsPage';
import SchoolSettings            from './pages/SchoolSettings';
import InstallPrompt             from './components/pwa/InstallPrompt';
import OfflineBanner             from './components/pwa/OfflineBanner';

// ── Core Pages ────────────────────────────────────────────────────────────────
import Landing          from './pages/Landing';
import Login            from './pages/Login';
import DashboardRouter  from './pages/DashboardRouter';
import StudentsPage     from './pages/StudentsPage';
import TeachersPage     from './pages/TeachersPage';
import ClassesPage      from './pages/ClassesPage';
import FeesPage         from './pages/FeesPage';
import FeeStructures    from './pages/FeeStructures';
import ExamsPage        from './pages/ExamsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import AttendancePage   from './pages/AttendancePage';
import NewAdmissionPage from './pages/NewAdmissionPage';
import StudentProfile   from './pages/StudentProfile';
import ClassDetailPage  from './pages/ClassDetailPage';
import TeacherProfile   from './pages/TeacherProfile';
import HolidaysPage     from './pages/HolidaysPage';
import NotesPage        from './pages/NotesPage';
import AssignmentsPage  from './pages/AssignmentsPage';
import InternalMarksPage from './pages/InternalMarksPage';
import SubjectsPage     from './pages/SubjectsPage';
import TimetablePage    from './pages/TimetablePage';
import IDCardPage       from './pages/IDCardPage';
import AdmitCardPage    from './pages/AdmitCardPage';
import ResultCardPage   from './pages/ResultCardPage';
import MarksPage        from './pages/MarksPage';
import ResultManagement from './pages/ResultManagement';
import MyServices       from './pages/MyServices';
import UsersPage        from './pages/UsersPage';
import StaffPage        from './pages/StaffPage';
import StaffProfile     from './pages/StaffProfile';
import ExpensesPage     from './pages/finance/ExpensesPage';
import InventoryPage    from './pages/finance/InventoryPage';
import VendorsPage      from './pages/finance/VendorsPage';

import PayrollPage       from './pages/PayrollPage';
import WhatsAppSettings  from './pages/settings/WhatsAppSettings';

// ── Library Management ────────────────────────────────────────────────────
import LibraryDashboard  from './pages/library/LibraryDashboard';
import LibraryBooks      from './pages/library/LibraryBooks';
import LibraryIssueReturn from './pages/library/LibraryIssueReturn';
import LibraryReservations from './pages/library/LibraryReservations';
import LibraryMembers    from './pages/library/LibraryMembers';
import LibraryFines      from './pages/library/LibraryFines';
import LibraryReports    from './pages/library/LibraryReports';

// ── Hostel Management ─────────────────────────────────────────────────────
import HostelDashboard   from './pages/hostel/HostelDashboard';
import HostelSetup       from './pages/hostel/HostelSetup';
import HostelRoomMap     from './pages/hostel/HostelRoomMap';
import HostelAdmission   from './pages/hostel/HostelAdmission';
import HostelRoomDetail  from './pages/hostel/HostelRoomDetail';
import HostelTransfers   from './pages/hostel/HostelTransfers';
import HostelFeeStructures from './pages/hostel/HostelFeeStructures';
import HostelFees        from './pages/hostel/HostelFees';
import HostelFines       from './pages/hostel/HostelFines';
import HostelAttendance  from './pages/hostel/HostelAttendance';
import HostelOutPass     from './pages/hostel/HostelOutPass';
import HostelComplaints  from './pages/hostel/HostelComplaints';
import HostelVisitors    from './pages/hostel/HostelVisitors';
import HostelInventory   from './pages/hostel/HostelInventory';
import HostelReports     from './pages/hostel/HostelReports';

// ── Transport Management ──────────────────────────────────────────────────
import TransportDashboard    from './pages/transport/TransportDashboard';
import TransportVehicles     from './pages/transport/Vehicles';
import TransportDrivers      from './pages/transport/Drivers';
import TransportConductors   from './pages/transport/Conductors';
import TransportRouteBuilder from './pages/transport/RouteBuilder';
import TransportStops        from './pages/transport/Stops';
import StudentTransport      from './pages/transport/StudentTransport';
import TransportFees         from './pages/transport/TransportFees';
import VehicleMaintenance    from './pages/transport/VehicleMaintenance';
import LiveTracking          from './pages/transport/LiveTracking';
import ParentTransportView   from './pages/transport/ParentTransportView';
import TransportReports      from './pages/transport/TransportReports';
import StudentTravelHistory  from './pages/transport/StudentTravelHistory';
import DriverMobileApp       from './pages/transport/DriverMobileApp';

import StaffAttendanceDashboard from './pages/staff-attendance/StaffAttendanceDashboard';
import AttendanceSettings   from './pages/staff-attendance/AttendanceSettings';
import EmployeeProfile      from './pages/staff-attendance/EmployeeProfile';
import AttendanceAnalytics  from './pages/staff-attendance/AttendanceAnalytics';

// ── HRMS & Staff Management Suite ─────────────────────────────────────────────
import HRMSDashboard        from './pages/hrms/HRMSDashboard';
import EmployeeDirectory    from './pages/hrms/EmployeeDirectory';
import EmployeeDetailPage   from './pages/hrms/EmployeeDetailPage';
import LeaveManagementPage  from './pages/hrms/LeaveManagementPage';
import PayrollManagerPage   from './pages/hrms/PayrollManagerPage';
import StaffSelfService     from './pages/hrms/StaffSelfService';

// ── Unified Finance & Fee Management Suite ─────────────────────────────────────
import FinanceDashboard          from './pages/finance/FinanceDashboard';
import FeeBillsPage              from './pages/finance/FeeBillsPage';
import CollectPaymentPage        from './pages/finance/CollectPaymentPage';
import ReceiptsPage              from './pages/finance/ReceiptsPage';
import StudentFinancialLedgerPage from './pages/finance/StudentFinancialLedgerPage';
import FeeSetupPage              from './pages/finance/FeeSetupPage';
import OutstandingPage           from './pages/finance/OutstandingPage';
import FinanceReportsPage        from './pages/finance/FinanceReportsPage';
import PaymentLogsPage          from './pages/finance/PaymentLogsPage';

// ── Communication Hub Pages ───────────────────────────────────────────────────
import SupportInbox     from './pages/communication/SupportInbox';
import TicketDetail     from './pages/communication/TicketDetail';
import NewTicket        from './pages/communication/NewTicket';
import MeetingRequest   from './pages/communication/MeetingRequest';
import Announcements    from './pages/communication/Announcements';
import ChatWindow       from './pages/communication/ChatWindow';
import KnowledgeBase    from './pages/communication/KnowledgeBase';
import SupportDashboard from './pages/developer/SupportDashboard';
import ErrorDashboard   from './pages/developer/ErrorDashboard';
import IssueBoard       from './pages/developer/IssueBoard';
import SystemHealthDashboard from './pages/developer/SystemHealthDashboard';
import LeadsPage        from './pages/developer/LeadsPage';
// ── RBAC Pages ──────────────────────────────────────────────────────────────
import RoleManagement     from './pages/rbac/RoleManagement';
import PermissionMatrix   from './pages/rbac/PermissionMatrix';
import DelegationPage     from './pages/rbac/DelegationPage';
import StaffAccessPage    from './pages/rbac/StaffAccessPage';

// ── Audit Logs ──────────────────────────────────────────────────────────────
import SchoolAuditLogs    from './pages/audit/SchoolAuditLogs';
import CompanyAuditLogs   from './pages/audit/CompanyAuditLogs';
import AIChat             from './AI/pages/AIChat';
import AIManagement       from './pages/developer/AIManagement';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <OfflineBanner />
        <InstallPrompt />
        <Router>
          <Routes>

            {/* ── Public ── */}
            <Route path="/"      element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* ── Dashboard (role-based router) ── */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } />

            {/* ── Principal / Teacher / Admin ── */}
            <Route path="/students" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']} permissions={ROUTE_PERMISSIONS['/students']}>
                <StudentsPage />
              </ProtectedRoute>
            } />
            <Route path="/students/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']} permissions={ROUTE_PERMISSIONS['/students']}>
                <StudentProfile />
              </ProtectedRoute>
            } />
            <Route path="/teachers" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <TeachersPage />
              </ProtectedRoute>
            } />
            <Route path="/classes" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <ClassesPage />
              </ProtectedRoute>
            } />
            <Route path="/classes/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <ClassDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/teachers/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <TeacherProfile />
              </ProtectedRoute>
            } />
            <Route path="/staff" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/staff']}>
                <StaffPage />
              </ProtectedRoute>
            } />
            <Route path="/staff/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/staff']}>
                <StaffProfile />
              </ProtectedRoute>
            } />
            {/* ── Unified Finance & Fee Management Suite ── */}
            <Route path="/finance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceDashboard />
              </ProtectedRoute>
            } />
            <Route path="/finance/dashboard" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceDashboard />
              </ProtectedRoute>
            } />
            <Route path="/finance/bills" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeBillsPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/payments/collect" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <CollectPaymentPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/receipts" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <ReceiptsPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/students/:studentId/ledger" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT']}>
                <StudentFinancialLedgerPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/setup" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR']}>
                <FeeSetupPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/outstanding" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <OutstandingPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/payment-logs" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL', 'HOSTEL', 'LIBRARIAN']}>
                <PaymentLogsPage />
              </ProtectedRoute>
            } />
            <Route path="/fees" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'ACCOUNTANT']}>
                <FeeBillsPage />
              </ProtectedRoute>
            } />
            <Route path="/fees/structures" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT']}>
                <FeeSetupPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/expenses" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']} permissions={ROUTE_PERMISSIONS['/finance/expenses']}>
                <ExpensesPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/inventory" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']} permissions={ROUTE_PERMISSIONS['/finance/inventory']}>
                <InventoryPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/payroll" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT']} permissions={ROUTE_PERMISSIONS['/finance/payroll']}>
                <PayrollPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/vendors" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']}>
                <VendorsPage />
              </ProtectedRoute>
            } />
            <Route path="/admission" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/admission']}>
                <NewAdmissionPage />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <AttendancePage />
              </ProtectedRoute>
            } />
            <Route path="/marks" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/marks']}>
                <MarksPage />
              </ProtectedRoute>
            } />
            {/* NEW — Result Management System (Draft → Submit → Review → Approve → Publish) */}
            <Route path="/mark-entry" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/mark-entry']}>
                <ResultManagement />
              </ProtectedRoute>
            } />
            <Route path="/result-management" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/result-management']}>
                <ResultManagement />
              </ProtectedRoute>
            } />
            <Route path="/holidays" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <HolidaysPage />
              </ProtectedRoute>
            } />
            <Route path="/notes" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <NotesPage />
              </ProtectedRoute>
            } />
            <Route path="/assignments" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <AssignmentsPage />
              </ProtectedRoute>
            } />
            <Route path="/internal-marks" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <InternalMarksPage />
              </ProtectedRoute>
            } />

            <Route path="/documents" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']} permissions={ROUTE_PERMISSIONS['/documents']}>
                <DocumentsPage />
              </ProtectedRoute>
            } />
            <Route path="/issue-documents" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <DocumentsPage initialTab="issue_workspace" />
              </ProtectedRoute>
            } />
            <Route path="/students/transfer-cert" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <DocumentsPage initialTab="issue_workspace" initialDocType="TRANSFER_CERTIFICATE" />
              </ProtectedRoute>
            } />

            <Route path="/exams" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/exams']}>
                <ExamsPage />
              </ProtectedRoute>
            } />
            <Route path="/admit-card" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR']} permissions={ROUTE_PERMISSIONS['/admit-card']}>
                <AdmitCardPage />
              </ProtectedRoute>
            } />
            <Route path="/admit-cards" element={<Navigate to="/admit-card" replace />} />
            <Route path="/result-card" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR']} permissions={ROUTE_PERMISSIONS['/result-card']}>
                <ResultCardPage />
              </ProtectedRoute>
            } />
            <Route path="/result-cards" element={<Navigate to="/result-card" replace />} />
            <Route path="/results" element={<Navigate to="/result-card" replace />} />
            <Route path="/timetable" element={
              <ProtectedRoute roles={['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT']}>
                <TimetablePage />
              </ProtectedRoute>
            } />
            <Route path="/id-cards/:type" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <IDCardPage />
              </ProtectedRoute>
            } />
            <Route path="/id-cards" element={<Navigate to="/id-cards/students" replace />} />
            <Route path="/school-settings" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/school-settings']}>
                <SchoolSettings />
              </ProtectedRoute>
            } />
            <Route path="/settings/whatsapp" element={
              <ProtectedRoute roles={['PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/settings/whatsapp']}>
                <WhatsAppSettings />
              </ProtectedRoute>
            } />
            <Route path="/my-services" element={
              <ProtectedRoute roles={['PRINCIPAL', 'TEACHER']}>
                <MyServices />
              </ProtectedRoute>
            } />
            <Route path="/subjects" element={
              <ProtectedRoute roles={['PRINCIPAL', 'TEACHER']}>
                <SubjectsPage />
              </ProtectedRoute>
            } />

            {/* ── Library Management ── */}
            <Route path="/library" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryDashboard />
              </ProtectedRoute>
            } />
            <Route path="/library/books" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT']}>
                <LibraryBooks />
              </ProtectedRoute>
            } />
            <Route path="/library/issue-return" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryIssueReturn />
              </ProtectedRoute>
            } />
            <Route path="/library/reservations" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'STUDENT']}>
                <LibraryReservations />
              </ProtectedRoute>
            } />
            <Route path="/library/members" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryMembers />
              </ProtectedRoute>
            } />
            <Route path="/library/fines" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <LibraryFines />
              </ProtectedRoute>
            } />
            <Route path="/library/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryReports />
              </ProtectedRoute>
            } />
            {/* ── Staff Attendance Management ── */}
            <Route path="/staff/attendance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <StaffAttendanceDashboard />
              </ProtectedRoute>
            } />
            <Route path="/staff/attendance/settings" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'DIRECTOR']}>
                <AttendanceSettings />
              </ProtectedRoute>
            } />
            <Route path="/staff/attendance/analytics" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <AttendanceAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/staff/attendance/employee/:userId" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <EmployeeProfile />
              </ProtectedRoute>
            } />

            {/* ── HRMS & Employee Management Suite ── */}
            <Route path="/hrms" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <HRMSDashboard />
              </ProtectedRoute>
            } />
            <Route path="/hrms/employees" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <EmployeeDirectory />
              </ProtectedRoute>
            } />
            <Route path="/hrms/employees/:userId" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/hrms/leaves" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <LeaveManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/hrms/payroll" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <PayrollManagerPage />
              </ProtectedRoute>
            } />
            <Route path="/my-hr" element={
              <ProtectedRoute roles={['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'RECEPTIONIST', 'HOSTEL', 'TRANSPORT', 'HR', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'EXAM_CONTROLLER', 'DRIVER', 'PRINCIPAL']}>
                <StaffSelfService />
              </ProtectedRoute>
            } />

            {/* ── Hostel Management ── */}
            <Route path="/hostel" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelDashboard />
              </ProtectedRoute>
            } />
            <Route path="/hostel/setup" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelSetup />
              </ProtectedRoute>
            } />
            <Route path="/hostel/room-map" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelRoomMap />
              </ProtectedRoute>
            } />
            <Route path="/hostel/admission" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelAdmission />
              </ProtectedRoute>
            } />
            <Route path="/hostel/rooms/:roomId" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelRoomDetail />
              </ProtectedRoute>
            } />
            <Route path="/hostel/transfers" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelTransfers />
              </ProtectedRoute>
            } />
            <Route path="/hostel/fee-structures" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelFeeStructures />
              </ProtectedRoute>
            } />
            <Route path="/hostel/fees" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL', 'ACCOUNTANT']}>
                <HostelFees />
              </ProtectedRoute>
            } />
            <Route path="/hostel/fines" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL', 'ACCOUNTANT']}>
                <HostelFines />
              </ProtectedRoute>
            } />
            <Route path="/hostel/attendance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelAttendance />
              </ProtectedRoute>
            } />
            <Route path="/hostel/out-pass" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelOutPass />
              </ProtectedRoute>
            } />
            <Route path="/hostel/complaints" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelComplaints />
              </ProtectedRoute>
            } />
            <Route path="/hostel/visitors" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelVisitors />
              </ProtectedRoute>
            } />
            <Route path="/hostel/inventory" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelInventory />
              </ProtectedRoute>
            } />
            <Route path="/hostel/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelReports />
              </ProtectedRoute>
            } />

            {/* ── Transport Management ── */}
            <Route path="/transport" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportDashboard />
              </ProtectedRoute>
            } />
            <Route path="/transport/vehicles" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportVehicles />
              </ProtectedRoute>
            } />
            <Route path="/transport/drivers" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportDrivers />
              </ProtectedRoute>
            } />
            <Route path="/transport/conductors" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportConductors />
              </ProtectedRoute>
            } />
            <Route path="/transport/routes" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportRouteBuilder />
              </ProtectedRoute>
            } />
            <Route path="/transport/stops" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportStops />
              </ProtectedRoute>
            } />
            <Route path="/transport/students" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <StudentTransport />
              </ProtectedRoute>
            } />
            <Route path="/transport/live" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <LiveTracking />
              </ProtectedRoute>
            } />
            <Route path="/transport/fees" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportFees />
              </ProtectedRoute>
            } />
            <Route path="/transport/maintenance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <VehicleMaintenance />
              </ProtectedRoute>
            } />
            <Route path="/transport/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportReports />
              </ProtectedRoute>
            } />
            <Route path="/transport/travel-history" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT', 'STAFF', 'TEACHER']}>
                <StudentTravelHistory />
              </ProtectedRoute>
            } />
            <Route path="/transport/student-travel-history" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT', 'STAFF', 'TEACHER']}>
                <StudentTravelHistory />
              </ProtectedRoute>
            } />
            <Route path="/transport/parent" element={
              <ProtectedRoute roles={['PARENT', 'STUDENT', 'PRINCIPAL']}>
                <ParentTransportView />
              </ProtectedRoute>
            } />
            <Route path="/driver/app" element={
              <ProtectedRoute roles={['DRIVER']}>
                <DriverMobileApp />
              </ProtectedRoute>
            } />
            
            <Route path="/support/tickets" element={
              <ProtectedRoute>
                <SupportInbox />
              </ProtectedRoute>
            } />
            <Route path="/support/tickets/new" element={
              <ProtectedRoute>
                <NewTicket />
              </ProtectedRoute>
            } />
            <Route path="/support/tickets/:id" element={
              <ProtectedRoute>
                <TicketDetail />
              </ProtectedRoute>
            } />
            <Route path="/support/meetings" element={
              <ProtectedRoute>
                <MeetingRequest />
              </ProtectedRoute>
            } />
            <Route path="/support/meetings/new" element={
              <ProtectedRoute>
                <MeetingRequest />
              </ProtectedRoute>
            } />
            <Route path="/support/announcements" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/support/announcements/create" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements initialShowForm={true} />
              </ProtectedRoute>
            } />
            <Route path="/announcements" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/announcements/create" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements initialShowForm={true} />
              </ProtectedRoute>
            } />
            <Route path="/principal/announcements" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/principal/announcements/create" element={
              <ProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}>
                <Announcements initialShowForm={true} />
              </ProtectedRoute>
            } />
            <Route path="/support" element={<Navigate to="/support/tickets" replace />} />
            <Route path="/messages" element={
              <ProtectedRoute>
                <ChatWindow />
              </ProtectedRoute>
            } />
            <Route path="/support/chat" element={
              <ProtectedRoute>
                <ChatWindow />
              </ProtectedRoute>
            } />
            <Route path="/help-center" element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            } />
            <Route path="/support/help" element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            } />
            <Route path="/support/kb" element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            } />

            {/* ── Super Admin only ── */}
            <Route path="/schools" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            } />
            <Route path="/schools/:id" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <SchoolDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            } />
            <Route path="/developer/support" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <SupportDashboard />
              </ProtectedRoute>
            } />
            {/* ErrorDashboard/IssueBoard/SystemHealthDashboard were built but
                never routed anywhere -- not reachable even by typing the URL.
                They read darkMode as a prop (unlike SupportDashboard, which
                keeps its own local state), so it's passed here from the same
                'ederp_theme' key every other page reads, to match the
                site-wide dark/light toggle instead of always rendering light. */}
            <Route path="/developer/errors" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <ErrorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/developer/issues" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <IssueBoard />
              </ProtectedRoute>
            } />
            <Route path="/developer/system-health" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <SystemHealthDashboard />
              </ProtectedRoute>
            } />
            <Route path="/developer/leads" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <LeadsPage />
              </ProtectedRoute>
            } />

            {/* ── RBAC (Role-Based Access Control) ── */}
            <Route path="/rbac/roles" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/roles']}>
                <RoleManagement />
              </ProtectedRoute>
            } />
            <Route path="/rbac/permissions" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/permissions']}>
                <PermissionMatrix />
              </ProtectedRoute>
            } />
            <Route path="/rbac/delegations" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/delegations']}>
                <DelegationPage />
              </ProtectedRoute>
            } />
            <Route path="/rbac/staff-access" element={
               <ProtectedRoute roles={['PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/staff-access']}>
                 <StaffAccessPage />
               </ProtectedRoute>
           } />

            {/* ── Audit Logs ── */}
            {/* VICE_PRINCIPAL included here on purpose: it's the one role that
                permission_catalog.py's DEFAULT_SCHOOL_ROLE_PERMISSIONS actually
                grants 'audit.logs.view' to by default (see permission_catalog.py
                fix) -- without it in this roles list, that grant would be
                unreachable since ProtectedRoute gates by role before the page's
                own permission check ever runs. */}
            <Route path="/audit/school/logs" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/audit/school/logs']}>
                <SchoolAuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/audit/company/logs" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <CompanyAuditLogs />
              </ProtectedRoute>
            } />

            {/* ── 1P360 BOT — AI Chat (Super Admin, Principal, Teacher, Staff) ── */}
            <Route path="/ai/chat" element={
              <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER',
                                      'ACCOUNTANT', 'LIBRARIAN', 'HOSTEL', 'TRANSPORT']}>
                <AIChat />
              </ProtectedRoute>
            } />


            {/* ── Super Admin: AI Management ── */}
            <Route path="/developer/ai" element={
              <ProtectedRoute roles={['SUPER_ADMIN']}>
                <AIManagement />
              </ProtectedRoute>
            } />

            {/* ── Catch-all ── */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
