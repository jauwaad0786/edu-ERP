import React from 'react';
import { useAuth } from '../context/AuthContext';
import AdminDashboard     from './dashboard/AdminDashboard';
import PrincipalDashboard from './dashboard/PrincipalDashboard';
import TeacherDashboard   from './dashboard/TeacherDashboard';
import StudentDashboard   from './dashboard/StudentDashboard';
import { Navigate }       from 'react-router-dom';

export default function DashboardRouter() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'SUPER_ADMIN': return <AdminDashboard />;
    case 'PRINCIPAL':   return <PrincipalDashboard />;
    case 'TEACHER':     return <TeacherDashboard />;
    case 'STUDENT':     return <StudentDashboard />;
    case 'PARENT':      return <StudentDashboard />;  // parent sees child view
    case 'LIBRARIAN':   return <Navigate to="/library" replace />;
    default:            return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <p>Unknown role. Please contact admin.</p>
      </div>
    );
  }
}
