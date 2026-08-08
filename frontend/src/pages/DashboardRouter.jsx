import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard     from './dashboard/AdminDashboard';
import EmployeeDashboard  from './dashboard/EmployeeDashboard';
import PrincipalDashboard from './dashboard/PrincipalDashboard';
import TeacherDashboard   from './dashboard/TeacherDashboard';
import StudentDashboard   from './dashboard/StudentDashboard';
import { Navigate }       from 'react-router-dom';

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
    case 'SUPER_ADMIN': return (isCompanyActor && !isTrueAdmin) ? <EmployeeDashboard /> : <AdminDashboard />;
    case 'PRINCIPAL':   return <PrincipalDashboard />;
    case 'TEACHER':     return <TeacherDashboard />;
    case 'STUDENT':     return <StudentDashboard />;
    case 'PARENT':      return <StudentDashboard />;  // parent sees child view
    case 'LIBRARIAN':   return <Navigate to="/library" replace />;
    case 'HOSTEL':      return <Navigate to="/hostel" replace />;
    case 'ACCOUNTANT':  return <Navigate to="/finance/expenses" replace />;
    case 'TRANSPORT':   return <Navigate to="/transport" replace />;
    case 'DRIVER':      return <Navigate to="/driver/app" replace />;
    default:            return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <p>Unknown role. Please contact admin.</p>
      </div>
    );
  }
}
