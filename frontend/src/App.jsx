import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }          from './context/AuthContext';
import { NotificationProvider }  from './context/NotificationContext';
import ProtectedRoute            from './components/ProtectedRoute';
import DocumentsPage             from './pages/DocumentsPage';
import SchoolSettings            from './pages/SchoolSettings';

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
import SubjectsPage     from './pages/SubjectsPage';
import TimetablePage    from './pages/TimetablePage';
import IDCardPage       from './pages/IDCardPage';
import MarksPage        from './pages/MarksPage';
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
import LibraryReports    from './pages/library/LibraryReports';

// ── Hostel Management ─────────────────────────────────────────────────────
import HostelDashboard   from './pages/hostel/HostelDashboard';
import HostelSetup       from './pages/hostel/HostelSetup';
import HostelRoomMap     from './pages/hostel/HostelRoomMap';
import HostelAdmission   from './pages/hostel/HostelAdmission';
import HostelRoomDetail  from './pages/hostel/HostelRoomDetail';
import HostelTransfers   from './pages/hostel/HostelTransfers';
import HostelFeeStructures from './pages/hostel/HostelFeeStructures';
import HostelReports       from './pages/hostel/HostelReports';

// ── Communication Hub Pages ───────────────────────────────────────────────────
import SupportInbox     from './pages/communication/SupportInbox';
import TicketDetail     from './pages/communication/TicketDetail';
import NewTicket        from './pages/communication/NewTicket';
import MeetingRequest   from './pages/communication/MeetingRequest';
import Announcements    from './pages/communication/Announcements';
import ChatWindow       from './pages/communication/ChatWindow';
import KnowledgeBase    from './pages/communication/KnowledgeBase';
import SupportDashboard from './pages/developer/SupportDashboard';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
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
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <StudentsPage />
              </ProtectedRoute>
            } />
            <Route path="/students/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
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
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <StaffPage />
              </ProtectedRoute>
            } />
            <Route path="/staff/:id" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <StaffProfile />
              </ProtectedRoute>
            } />
            <Route path="/fees" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'STUDENT', 'PARENT']}>
                <FeesPage />
              </ProtectedRoute>
            } />
            <Route path="/fees/structures" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <FeeStructures />
              </ProtectedRoute>
            } />
            <Route path="/finance/expenses" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <ExpensesPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/inventory" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <InventoryPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/payroll" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <PayrollPage />
              </ProtectedRoute>
            } />
            <Route path="/finance/vendors" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <VendorsPage />
              </ProtectedRoute>
            } />
            <Route path="/admission" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <NewAdmissionPage />
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <AttendancePage />
              </ProtectedRoute>
            } />
            <Route path="/marks" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL']}>
                <MarksPage />
              </ProtectedRoute>
            } />
            <Route path="/holidays" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <HolidaysPage />
              </ProtectedRoute>
            } />
            <Route path="/notes" element={
              <ProtectedRoute roles={['TEACHER', 'PRINCIPAL', 'STUDENT']}>
                <NotesPage />
              </ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'TEACHER']}>
                <DocumentsPage />
              </ProtectedRoute>
            } />
            <Route path="/exams" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <ExamsPage />
              </ProtectedRoute>
            } />
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
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN']}>
                <SchoolSettings />
              </ProtectedRoute>
            } />
            <Route path="/settings/whatsapp" element={
              <ProtectedRoute roles={['PRINCIPAL']}>
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
            <Route path="/library/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN']}>
                <LibraryReports />
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
            <Route path="/hostel/reports" element={
              <ProtectedRoute roles={['PRINCIPAL', 'SUPER_ADMIN', 'HOSTEL']}>
                <HostelReports />
              </ProtectedRoute>
            } />

            {/* ── Communication Hub — all logged-in roles ── */}
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
              <ProtectedRoute>
                <Announcements />
              </ProtectedRoute>
            } />
            <Route path="/support/chat" element={
              <ProtectedRoute>
                <ChatWindow />
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

            {/* ── Catch-all ── */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
