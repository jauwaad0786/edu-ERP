import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard            from './dashboard/AdminDashboard';
import EmployeeDashboard         from './dashboard/EmployeeDashboard';
import PrincipalDashboard        from './dashboard/PrincipalDashboard';
import TeacherDashboard          from './dashboard/TeacherDashboard';
import StudentDashboard          from './dashboard/StudentDashboard';
import VicePrincipalDashboard    from './dashboard/VicePrincipalDashboard';
import AccountantDashboard       from './dashboard/AccountantDashboard';
import LibrarianDashboard        from './dashboard/LibrarianDashboard';
import WardenDashboard           from './dashboard/WardenDashboard';
import TransportStaffDashboard   from './dashboard/TransportStaffDashboard';
import HRDashboard               from './dashboard/HRDashboard';
import { Navigate }              from 'react-router-dom';

export default function DashboardRouter() {
  const { user } = useAuth();

  // Legacy user.role is 'SUPER_ADMIN' for EVERY company employee (CEO,
  // Manager, Intern, Sales, Developer, ...) -- see admin.py's
  // _resolve_creation_role, which uses it as a generic "company account"
  // marker, not a real identity. Real identity is user.active_role (from
  // platform_roles via UserRoleAssignment). Without this split, every
  // company employee landed on the CEO's AdminDashboard.
  const isCompanyActor = user && user.school_id == null;
  const isTrueAdmin = !!(user?.is_super || ['CEO', 'SUPER_ADMIN'].includes(user?.active_role?.key));

  switch (user?.role) {
    // ── Company / Platform ────────────────────────────────────────────────
    case 'SUPER_ADMIN':
      return (isCompanyActor && !isTrueAdmin) ? <EmployeeDashboard /> : <AdminDashboard />;

    // ── School Leadership ─────────────────────────────────────────────────
    case 'PRINCIPAL':
    case 'DIRECTOR':
      return <PrincipalDashboard />;

    case 'VICE_PRINCIPAL':
    case 'ACADEMIC_COORDINATOR':
    case 'EXAM_CONTROLLER':
      return <VicePrincipalDashboard />;

    // ── Teaching Staff ────────────────────────────────────────────────────
    case 'TEACHER':
      return <TeacherDashboard />;

    // ── Students & Parents ────────────────────────────────────────────────
    case 'STUDENT':
    case 'PARENT':
      return <StudentDashboard />;

    // ── Finance ───────────────────────────────────────────────────────────
    case 'ACCOUNTANT':
      return <AccountantDashboard />;

    // ── Library ───────────────────────────────────────────────────────────
    case 'LIBRARIAN':
      return <LibrarianDashboard />;

    // ── Hostel ────────────────────────────────────────────────────────────
    case 'HOSTEL':
      return <WardenDashboard />;

    // ── Transport ─────────────────────────────────────────────────────────
    case 'TRANSPORT':
      return <TransportStaffDashboard />;

    // ── Driver (mobile-first cockpit, already exists) ─────────────────────
    case 'DRIVER':
      return <Navigate to="/driver/app" replace />;

    // ── Human Resources ───────────────────────────────────────────────────
    case 'HR':
      return <HRDashboard />;

    // ── Fallback ──────────────────────────────────────────────────────────
    default:
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 12, color: '#64748b',
        }}>
          <i className="ti ti-user-question" style={{ fontSize: 48, opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 600 }}>Unknown role: <code>{user?.role}</code></p>
          <p style={{ fontSize: 13 }}>Please contact your administrator.</p>
        </div>
      );
  }
}
