import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }          from './context/AuthContext';
import { NotificationProvider }  from './context/NotificationContext';
import ProtectedRoute            from './components/ProtectedRoute';
import TenantProtectedRoute      from './components/TenantProtectedRoute';
import LegacyRedirect            from './components/LegacyRedirect';
import { NotFoundPage, AccessDeniedPage } from './pages/ErrorPages';
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
import SectionShufflePage from './pages/students/SectionShufflePage';
import BulkEditPage       from './pages/students/BulkEditPage';
import PromotionPage      from './pages/students/PromotionPage';
import AnnualRegisterPage from './pages/students/AnnualRegisterPage';
import StudentImportPage  from './pages/students/StudentImportPage';
import TeachersPage     from './pages/TeachersPage';
import ClassesPage      from './pages/ClassesPage';
import FeesPage         from './pages/FeesPage';
import ExamsPage        from './pages/ExamsPage';
import SchoolsPage      from './pages/SchoolsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import AttendancePage   from './pages/AttendancePage';
import NewAdmissionPage from './pages/NewAdmissionPage';
import ProvisionalAdmissionsPage from './pages/ProvisionalAdmissionsPage';
import StudentProfile   from './pages/StudentProfile';
import ClassDetailPage  from './pages/ClassDetailPage';
import TeacherProfile   from './pages/TeacherProfile';
import HolidaysPage     from './pages/HolidaysPage';
import NotesPage        from './pages/NotesPage';
import AssignmentsPage  from './pages/AssignmentsPage';
import InternalMarksPage from './pages/InternalMarksPage';
import SubjectsPage     from './pages/SubjectsPage';
import TimetablePage    from './pages/TimetablePage';
import CurriculumSetupPage from './pages/academics/CurriculumSetupPage';
import TeacherDailyDiaryPage from './pages/academics/TeacherDailyDiaryPage';
import TeacherSyllabusCoveragePage from './pages/academics/TeacherSyllabusCoveragePage';
import PrincipalAcademicDashboard from './pages/academics/PrincipalAcademicDashboard';
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
import PurchasesPage    from './pages/finance/PurchasesPage';
import AssetsPage       from './pages/finance/AssetsPage';
import DeletedItemsPage from './pages/principal/DeletedItemsPage';

import WhatsAppSettings  from './pages/settings/WhatsAppSettings';

// ── Library Management ────────────────────────────────────────────────────
import LibraryDashboard  from './pages/library/LibraryDashboard';
import LibraryBooks      from './pages/library/LibraryBooks';
import LibraryIssueReturn from './pages/library/LibraryIssueReturn';
import LibraryReservations from './pages/library/LibraryReservations';
import LibraryMembers    from './pages/library/LibraryMembers';
import LibraryFines      from './pages/library/LibraryFines';
import LibraryReports    from './pages/library/LibraryReports';
import LibraryAttendance from './pages/library/LibraryAttendance';

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
import DelegationDashboardPage from './pages/delegations/DelegationDashboardPage';

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
import FinancePayrollPage       from './pages/finance/FinancePayrollPage';
import FeeServiceGenerationPage from './pages/finance/FeeServiceGenerationPage';
import FeeCollectionAnalyticsPage from './pages/finance/FeeCollectionAnalyticsPage';

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

            {/* ═══════════════════════════════════════════════════════════════
                PUBLIC ROUTES
               ═══════════════════════════════════════════════════════════════ */}
            <Route path="/"      element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* ═══════════════════════════════════════════════════════════════
                PLATFORM / SUPER ADMIN (Company Accounts)
               ═══════════════════════════════════════════════════════════════ */}
            <Route path="/admin/dashboard" element={<ProtectedRoute roles={['SUPER_ADMIN']}><DashboardRouter /></ProtectedRoute>} />
            <Route path="/admin/schools" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SchoolsPage /></ProtectedRoute>} />
            <Route path="/admin/schools/:id" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SchoolDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UsersPage /></ProtectedRoute>} />
            <Route path="/developer/support" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SupportDashboard /></ProtectedRoute>} />
            <Route path="/developer/errors" element={<ProtectedRoute roles={['SUPER_ADMIN']}><ErrorDashboard /></ProtectedRoute>} />
            <Route path="/developer/issues" element={<ProtectedRoute roles={['SUPER_ADMIN']}><IssueBoard /></ProtectedRoute>} />
            <Route path="/developer/system-health" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SystemHealthDashboard /></ProtectedRoute>} />
            <Route path="/developer/leads" element={<ProtectedRoute roles={['SUPER_ADMIN']}><LeadsPage /></ProtectedRoute>} />
            <Route path="/developer/ai" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AIManagement /></ProtectedRoute>} />
            <Route path="/audit/company/logs" element={<ProtectedRoute roles={['SUPER_ADMIN']}><CompanyAuditLogs /></ProtectedRoute>} />

            {/* ═══════════════════════════════════════════════════════════════
                CANONICAL MULTI-TENANT ROUTES: /:schoolSlug/:role/:service
               ═══════════════════════════════════════════════════════════════ */}
            
            {/* Dashboard & Base Tenant Route */}
            <Route path="/:schoolSlug/:role" element={<LegacyRedirect toService="dashboard" />} />
            <Route path="/:schoolSlug/:role/index.html" element={<LegacyRedirect />} />
            <Route path="/:schoolSlug/:role/dashboard" element={
              <TenantProtectedRoute>
                <DashboardRouter />
              </TenantProtectedRoute>
            } />

            {/* Students Lifecycle */}
            <Route path="/:schoolSlug/:role/students" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']} permissions={ROUTE_PERMISSIONS['/students']}>
                <StudentsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/bulk-edit" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']} permissions={ROUTE_PERMISSIONS['/students/bulk-edit']}>
                <BulkEditPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/section-shuffle" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/students/section-shuffle']}>
                <SectionShufflePage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/promotion" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/students/promotion']}>
                <PromotionPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/annual-register" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/students/annual-register']}>
                <AnnualRegisterPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/import" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/students/import']}>
                <StudentImportPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/:id" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']} permissions={ROUTE_PERMISSIONS['/students']}>
                <StudentProfile />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/admission" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/admission']}>
                <NewAdmissionPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/admissions/provisional" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/admissions/provisional']}>
                <ProvisionalAdmissionsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/provisional" element={<LegacyRedirect toService="admissions/provisional" />} />
            <Route path="/:schoolSlug/:role/admissions/new" element={<LegacyRedirect toService="admission" />} />
            <Route path="/:schoolSlug/:role/admissions" element={<LegacyRedirect toService="admission" />} />
            <Route path="/:schoolSlug/:role/school-profile" element={<LegacyRedirect toService="school-settings" />} />
            <Route path="/:schoolSlug/:role/support/announcements" element={<LegacyRedirect toService="announcements" />} />
            <Route path="/:schoolSlug/:role/hrms/attendance" element={<LegacyRedirect toService="staff/attendance" />} />

            {/* Teachers & Classes */}
            <Route path="/:schoolSlug/:role/teachers" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <TeachersPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/teachers/:id" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <TeacherProfile />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/classes" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <ClassesPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/classes/:id" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <ClassDetailPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/subjects" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN']}>
                <SubjectsPage />
              </TenantProtectedRoute>
            } />

            {/* Staff & HRMS */}
            <Route path="/:schoolSlug/:role/staff" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/staff']}>
                <StaffPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/staff/:id" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/staff']}>
                <StaffProfile />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/staff/attendance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <StaffAttendanceDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/staff/attendance/settings" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'DIRECTOR']}>
                <AttendanceSettings />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/staff/attendance/analytics" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <AttendanceAnalytics />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/staff/attendance/employee/:userId" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <EmployeeProfile />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hrms" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <HRMSDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hrms/employees" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <EmployeeDirectory />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hrms/employees/:userId" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <EmployeeDetailPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hrms/leaves" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <LeaveManagementPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hrms/payroll" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT']}>
                <PayrollManagerPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/my-hr" element={
              <TenantProtectedRoute roles={['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'RECEPTIONIST', 'HOSTEL', 'TRANSPORT', 'HR', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'EXAM_CONTROLLER', 'DRIVER', 'PRINCIPAL']}>
                <StaffSelfService />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/delegations" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <DelegationDashboardPage />
              </TenantProtectedRoute>
            } />

            {/* Attendance & Academics */}
            <Route path="/:schoolSlug/:role/attendance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
                <AttendancePage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/marks" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT']} permissions={ROUTE_PERMISSIONS['/marks']}>
                <MarksPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/mark-entry" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/mark-entry']}>
                <ResultManagement />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/result-management" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/result-management']}>
                <ResultManagement />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/holidays" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']}>
                <HolidaysPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/notes" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <NotesPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/assignments" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <AssignmentsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/internal-marks" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT', 'PARENT', 'SUPER_ADMIN', 'ADMIN']}>
                <InternalMarksPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/timetable" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT']}>
                <TimetablePage />
              </TenantProtectedRoute>
            } />

            {/* Curriculum & Teacher Teaching Diary */}
            <Route path="/:schoolSlug/:role/curriculum" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR']}>
                <CurriculumSetupPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/curriculum/setup" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR']}>
                <CurriculumSetupPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/curriculum/diary" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR']}>
                <TeacherDailyDiaryPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/curriculum/coverage" element={
              <TenantProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR']}>
                <TeacherSyllabusCoveragePage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/curriculum/dashboard" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'ACADEMIC_COORDINATOR']}>
                <PrincipalAcademicDashboard />
              </TenantProtectedRoute>
            } />

            {/* Exams & Results */}
            <Route path="/:schoolSlug/:role/exams" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/exams']}>
                <ExamsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/admit-card" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR']} permissions={ROUTE_PERMISSIONS['/admit-card']}>
                <AdmitCardPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/result-card" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR']} permissions={ROUTE_PERMISSIONS['/result-card']}>
                <ResultCardPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/id-cards/:type" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <IDCardPage />
              </TenantProtectedRoute>
            } />

            {/* Finance & Fees */}
            <Route path="/:schoolSlug/:role/finance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/dashboard" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/service-generation" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeServiceGenerationPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/collection-analytics" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeCollectionAnalyticsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/fees/service-generation" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeServiceGenerationPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/fees/collection-analytics" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeCollectionAnalyticsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/bills" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeBillsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/generate-fees" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FeeBillsPage defaultOpenGenerate={true} />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/payments/collect" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <CollectPaymentPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/receipts" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <ReceiptsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/students/:studentId/ledger" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL', 'TEACHER', 'PARENT', 'STUDENT']}>
                <StudentFinancialLedgerPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/setup" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR']}>
                <FeeSetupPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/outstanding" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <OutstandingPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/reports" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <FinanceReportsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/payment-logs" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL', 'HOSTEL', 'LIBRARIAN']}>
                <PaymentLogsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/fees" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'ACCOUNTANT']}>
                <FeeBillsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/fees/structures" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT']}>
                <FeeSetupPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/expenses" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']} permissions={ROUTE_PERMISSIONS['/finance/expenses']}>
                <ExpensesPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/inventory" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']} permissions={ROUTE_PERMISSIONS['/finance/inventory']}>
                <InventoryPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/payroll" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'VICE_PRINCIPAL', 'HR']}>
                <FinancePayrollPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/vendors" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']}>
                <VendorsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/purchases" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT']}>
                <PurchasesPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/finance/assets" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'ACCOUNTANT']}>
                <AssetsPage />
              </TenantProtectedRoute>
            } />

            {/* Documents */}
            <Route path="/:schoolSlug/:role/documents" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']} permissions={ROUTE_PERMISSIONS['/documents']}>
                <DocumentsPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/issue-documents" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <DocumentsPage initialTab="issue_workspace" />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/students/transfer-cert" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <DocumentsPage initialTab="issue_workspace" initialDocType="TRANSFER_CERTIFICATE" />
              </TenantProtectedRoute>
            } />

            {/* Library */}
            <Route path="/:schoolSlug/:role/library" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/books" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT']}>
                <LibraryBooks />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/issue-return" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryIssueReturn />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/reservations" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'STUDENT']}>
                <LibraryReservations />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/members" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryMembers />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/fines" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <LibraryFines />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/reports" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryReports />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/library/attendance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN', 'DIRECTOR', 'VICE_PRINCIPAL', 'TEACHER']}>
                <LibraryAttendance />
              </TenantProtectedRoute>
            } />

            {/* Hostel */}
            <Route path="/:schoolSlug/:role/hostel" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/setup" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelSetup />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/room-map" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelRoomMap />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/admission" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelAdmission />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/rooms/:roomId" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelRoomDetail />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/transfers" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelTransfers />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/fee-structures" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelFeeStructures />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/fees" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL', 'ACCOUNTANT']}>
                <HostelFees />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/fines" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL', 'ACCOUNTANT']}>
                <HostelFines />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/attendance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelAttendance />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/out-pass" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelOutPass />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/complaints" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelComplaints />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/visitors" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelVisitors />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/inventory" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelInventory />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/hostel/reports" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelReports />
              </TenantProtectedRoute>
            } />

            {/* Transport */}
            <Route path="/:schoolSlug/:role/transport" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportDashboard />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/vehicles" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportVehicles />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/drivers" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportDrivers />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/conductors" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportConductors />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/routes" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportRouteBuilder />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/stops" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportStops />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/students" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <StudentTransport />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/live" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <LiveTracking />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/fees" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportFees />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/maintenance" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <VehicleMaintenance />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/reports" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT']}>
                <TransportReports />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/travel-history" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TRANSPORT', 'STAFF', 'TEACHER']}>
                <StudentTravelHistory />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/transport/parent" element={
              <TenantProtectedRoute roles={['PARENT', 'STUDENT', 'PRINCIPAL']}>
                <ParentTransportView />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/driver/app" element={
              <TenantProtectedRoute roles={['DRIVER']}>
                <DriverMobileApp />
              </TenantProtectedRoute>
            } />

            {/* Support & Communication */}
            <Route path="/:schoolSlug/:role/support/tickets" element={<TenantProtectedRoute><SupportInbox /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/support/tickets/new" element={<TenantProtectedRoute><NewTicket /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/support/tickets/:id" element={<TenantProtectedRoute><TicketDetail /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/support/meetings" element={<TenantProtectedRoute><MeetingRequest /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/support/meetings/new" element={<TenantProtectedRoute><MeetingRequest /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/announcements" element={<TenantProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}><Announcements /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/announcements/create" element={<TenantProtectedRoute permissions={ROUTE_PERMISSIONS['/support/announcements']}><Announcements initialShowForm={true} /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/messages" element={<TenantProtectedRoute><ChatWindow /></TenantProtectedRoute>} />
            <Route path="/:schoolSlug/:role/help-center" element={<TenantProtectedRoute><KnowledgeBase /></TenantProtectedRoute>} />

            {/* School Settings & WhatsApp */}
            <Route path="/:schoolSlug/:role/school-settings" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/school-settings']}>
                <SchoolSettings />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/settings/whatsapp" element={
              <TenantProtectedRoute roles={['PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/settings/whatsapp']}>
                <WhatsAppSettings />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/settings" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']} permissions={ROUTE_PERMISSIONS['/school-settings']}>
                <SchoolSettings />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/my-services" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'TEACHER']}>
                <MyServices />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/deleted-items" element={
              <TenantProtectedRoute roles={['PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL']}>
                <DeletedItemsPage />
              </TenantProtectedRoute>
            } />

            {/* RBAC */}
            <Route path="/:schoolSlug/:role/rbac/roles" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/roles']}>
                <RoleManagement />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/rbac/permissions" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/permissions']}>
                <PermissionMatrix />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/rbac/delegations" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/delegations']}>
                <DelegationPage />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/rbac/staff-access" element={
              <TenantProtectedRoute roles={['PRINCIPAL']} permissions={ROUTE_PERMISSIONS['/rbac/staff-access']}>
                <StaffAccessPage />
              </TenantProtectedRoute>
            } />

            {/* Audit Logs */}
            <Route path="/:schoolSlug/:role/audit-logs" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN']} permissions={ROUTE_PERMISSIONS['/audit/school/logs']}>
                <SchoolAuditLogs />
              </TenantProtectedRoute>
            } />
            <Route path="/:schoolSlug/:role/audit/school/logs" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN']} permissions={ROUTE_PERMISSIONS['/audit/school/logs']}>
                <SchoolAuditLogs />
              </TenantProtectedRoute>
            } />

            {/* 1P360 BOT — AI Chat */}
            <Route path="/:schoolSlug/:role/ai/chat" element={
              <TenantProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'HOSTEL', 'TRANSPORT']}>
                <AIChat />
              </TenantProtectedRoute>
            } />

            {/* ═══════════════════════════════════════════════════════════════
                BACKWARD-COMPATIBILITY: LEGACY UNPREFIXED REDIRECTS
               ═══════════════════════════════════════════════════════════════ */}
            <Route path="/dashboard" element={<LegacyRedirect toService="dashboard" />} />
            <Route path="/students" element={<LegacyRedirect toService="students" />} />
            <Route path="/students/:id" element={<LegacyRedirect />} />
            <Route path="/students/bulk-edit" element={<LegacyRedirect toService="students/bulk-edit" />} />
            <Route path="/students/section-shuffle" element={<LegacyRedirect toService="students/section-shuffle" />} />
            <Route path="/students/promotion" element={<LegacyRedirect toService="students/promotion" />} />
            <Route path="/students/annual-register" element={<LegacyRedirect toService="students/annual-register" />} />
            <Route path="/students/import" element={<LegacyRedirect toService="students/import" />} />
            <Route path="/teachers" element={<LegacyRedirect toService="teachers" />} />
            <Route path="/classes" element={<LegacyRedirect toService="classes" />} />
            <Route path="/subjects" element={<LegacyRedirect toService="subjects" />} />
            <Route path="/admission" element={<LegacyRedirect toService="admission" />} />
            <Route path="/attendance" element={<LegacyRedirect toService="attendance" />} />
            <Route path="/marks" element={<LegacyRedirect toService="marks" />} />
            <Route path="/mark-entry" element={<LegacyRedirect toService="mark-entry" />} />
            <Route path="/result-management" element={<LegacyRedirect toService="result-management" />} />
            <Route path="/exams" element={<LegacyRedirect toService="exams" />} />
            <Route path="/fees" element={<LegacyRedirect toService="fees" />} />
            <Route path="/fees/structures" element={<LegacyRedirect toService="fees/structures" />} />
            <Route path="/fees/service-generation" element={<LegacyRedirect toService="finance/service-generation" />} />
            <Route path="/fees/collection-analytics" element={<LegacyRedirect toService="finance/collection-analytics" />} />
            <Route path="/finance" element={<LegacyRedirect toService="finance/dashboard" />} />
            <Route path="/finance/dashboard" element={<LegacyRedirect toService="finance/dashboard" />} />
            <Route path="/finance/service-generation" element={<LegacyRedirect toService="finance/service-generation" />} />
            <Route path="/finance/collection-analytics" element={<LegacyRedirect toService="finance/collection-analytics" />} />
            <Route path="/finance/bills" element={<LegacyRedirect toService="finance/bills" />} />
            <Route path="/finance/payments/collect" element={<LegacyRedirect toService="finance/payments/collect" />} />
            <Route path="/finance/receipts" element={<LegacyRedirect toService="finance/receipts" />} />
            <Route path="/finance/setup" element={<LegacyRedirect toService="finance/setup" />} />
            <Route path="/finance/outstanding" element={<LegacyRedirect toService="finance/outstanding" />} />
            <Route path="/finance/reports" element={<LegacyRedirect toService="finance/reports" />} />
            <Route path="/finance/payment-logs" element={<LegacyRedirect toService="finance/payment-logs" />} />
            <Route path="/finance/expenses" element={<LegacyRedirect toService="finance/expenses" />} />
            <Route path="/finance/inventory" element={<LegacyRedirect toService="finance/inventory" />} />
            <Route path="/finance/payroll" element={<LegacyRedirect toService="finance/payroll" />} />
            <Route path="/finance/vendors" element={<LegacyRedirect toService="finance/vendors" />} />
            <Route path="/finance/purchases" element={<LegacyRedirect toService="finance/purchases" />} />
            <Route path="/finance/assets" element={<LegacyRedirect toService="finance/assets" />} />
            <Route path="/documents" element={<LegacyRedirect toService="documents" />} />
            <Route path="/issue-documents" element={<LegacyRedirect toService="issue-documents" />} />
            <Route path="/notes" element={<LegacyRedirect toService="notes" />} />
            <Route path="/assignments" element={<LegacyRedirect toService="assignments" />} />
            <Route path="/internal-marks" element={<LegacyRedirect toService="internal-marks" />} />
            <Route path="/holidays" element={<LegacyRedirect toService="holidays" />} />
            <Route path="/timetable" element={<LegacyRedirect toService="timetable" />} />
            <Route path="/curriculum" element={<LegacyRedirect toService="curriculum/setup" />} />
            <Route path="/curriculum/setup" element={<LegacyRedirect toService="curriculum/setup" />} />
            <Route path="/curriculum/diary" element={<LegacyRedirect toService="curriculum/diary" />} />
            <Route path="/curriculum/coverage" element={<LegacyRedirect toService="curriculum/coverage" />} />
            <Route path="/curriculum/dashboard" element={<LegacyRedirect toService="curriculum/dashboard" />} />
            <Route path="/admit-card" element={<LegacyRedirect toService="admit-card" />} />
            <Route path="/admit-cards" element={<LegacyRedirect toService="admit-card" />} />
            <Route path="/result-card" element={<LegacyRedirect toService="result-card" />} />
            <Route path="/result-cards" element={<LegacyRedirect toService="result-card" />} />
            <Route path="/results" element={<LegacyRedirect toService="result-card" />} />
            <Route path="/id-cards" element={<LegacyRedirect toService="id-cards/students" />} />
            <Route path="/id-cards/:type" element={<LegacyRedirect toService="id-cards/students" />} />
            <Route path="/school-settings" element={<LegacyRedirect toService="school-settings" />} />
            <Route path="/settings/whatsapp" element={<LegacyRedirect toService="settings/whatsapp" />} />
            <Route path="/settings" element={<LegacyRedirect toService="school-settings" />} />
            <Route path="/my-services" element={<LegacyRedirect toService="my-services" />} />
            <Route path="/my-hr" element={<LegacyRedirect toService="my-hr" />} />
            <Route path="/delegations" element={<LegacyRedirect toService="delegations" />} />
            <Route path="/library" element={<LegacyRedirect toService="library" />} />
            <Route path="/hostel" element={<LegacyRedirect toService="hostel" />} />
            <Route path="/transport" element={<LegacyRedirect toService="transport" />} />
            <Route path="/announcements" element={<LegacyRedirect toService="announcements" />} />
            <Route path="/messages" element={<LegacyRedirect toService="messages" />} />
            <Route path="/support/tickets" element={<LegacyRedirect toService="support/tickets" />} />
            <Route path="/support/tickets/new" element={<LegacyRedirect toService="support/tickets/new" />} />
            <Route path="/support/meetings" element={<LegacyRedirect toService="support/meetings" />} />
            <Route path="/help-center" element={<LegacyRedirect toService="help-center" />} />
            <Route path="/rbac/roles" element={<LegacyRedirect toService="rbac/roles" />} />
            <Route path="/rbac/permissions" element={<LegacyRedirect toService="rbac/permissions" />} />
            <Route path="/rbac/delegations" element={<LegacyRedirect toService="delegations" />} />
            <Route path="/rbac/staff-access" element={<LegacyRedirect toService="delegations" />} />
            <Route path="/audit/school/logs" element={<LegacyRedirect toService="audit-logs" />} />
            <Route path="/ai/chat" element={<LegacyRedirect toService="ai/chat" />} />
            <Route path="/principal/deleted-items" element={<LegacyRedirect toService="deleted-items" />} />
            <Route path="/admissions" element={<LegacyRedirect toService="admission" />} />
            <Route path="/admissions/new" element={<LegacyRedirect toService="admission" />} />
            <Route path="/school-profile" element={<LegacyRedirect toService="school-settings" />} />
            <Route path="/support/announcements" element={<LegacyRedirect toService="announcements" />} />
            <Route path="/announcements/create" element={<LegacyRedirect toService="announcements/create" />} />
            <Route path="/hrms" element={<LegacyRedirect toService="hrms" />} />
            <Route path="/hrms/employees" element={<LegacyRedirect toService="hrms/employees" />} />
            <Route path="/hrms/employees/:userId" element={<LegacyRedirect />} />
            <Route path="/hrms/payroll" element={<LegacyRedirect toService="hrms/payroll" />} />
            <Route path="/hrms/attendance" element={<LegacyRedirect toService="staff/attendance" />} />
            <Route path="/hrms/leaves" element={<LegacyRedirect toService="hrms/leaves" />} />
            <Route path="/staff" element={<LegacyRedirect toService="staff" />} />
            <Route path="/staff/attendance" element={<LegacyRedirect toService="staff/attendance" />} />
            <Route path="/staff/attendance/analytics" element={<LegacyRedirect toService="staff/attendance/analytics" />} />
            <Route path="/staff/attendance/settings" element={<LegacyRedirect toService="staff/attendance/settings" />} />
            <Route path="/staff/attendance/employee/:userId" element={<LegacyRedirect />} />
            <Route path="/transport/reports" element={<LegacyRedirect toService="transport/reports" />} />

            {/* ═══════════════════════════════════════════════════════════════
                ERROR & CATCH-ALL
               ═══════════════════════════════════════════════════════════════ */}
            <Route path="/index.html" element={<LegacyRedirect />} />
            <Route path="/403" element={<AccessDeniedPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />

          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
