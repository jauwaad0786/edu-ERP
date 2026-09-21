import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import ScreenContainer from '../components/layout/ScreenContainer';
import MobileHeader from '../components/layout/MobileHeader';
import BottomNav from '../components/layout/BottomNav';
import Drawer from '../components/layout/Drawer';
import LoadingState from '../components/common/LoadingState';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import StudentLoginScreen from '../screens/auth/StudentLoginScreen';

// Student Screens
import StudentHomeScreen from '../screens/student/StudentHomeScreen';
import StudentProfileScreen from '../screens/student/StudentProfileScreen';
import StudentAttendanceScreen from '../screens/student/StudentAttendanceScreen';
import StudentMarksScreen from '../screens/student/StudentMarksScreen';
import StudentFeesScreen from '../screens/student/StudentFeesScreen';
import StudentNotesScreen from '../screens/student/StudentNotesScreen';

// Teacher Screens
import TeacherHomeScreen from '../screens/teacher/TeacherHomeScreen';
import TeacherAttendanceScreen from '../screens/teacher/TeacherAttendanceScreen';
import TeacherMarksScreen from '../screens/teacher/TeacherMarksScreen';
import TeacherNotesScreen from '../screens/teacher/TeacherNotesScreen';

// Principal Screens
import PrincipalHomeScreen from '../screens/principal/PrincipalHomeScreen';
import PrincipalStudentsScreen from '../screens/principal/PrincipalStudentsScreen';
import PrincipalTeachersScreen from '../screens/principal/PrincipalTeachersScreen';
import PrincipalFeesScreen from '../screens/principal/PrincipalFeesScreen';
import PrincipalAttendanceScreen from '../screens/principal/PrincipalAttendanceScreen';

// SuperAdmin Screens
import SuperAdminHomeScreen from '../screens/superadmin/SuperAdminHomeScreen';
import SchoolsDirectoryScreen from '../screens/superadmin/SchoolsDirectoryScreen';
import OnboardSchoolScreen from '../screens/superadmin/OnboardSchoolScreen';

// Parent Screen
import ParentHomeScreen from '../screens/parent/ParentHomeScreen';

// Auxiliary Roles
import AccountantHomeScreen from '../screens/accountant/AccountantHomeScreen';
import LibrarianHomeScreen from '../screens/librarian/LibrarianHomeScreen';
import WardenHomeScreen from '../screens/warden/WardenHomeScreen';
import TransportHomeScreen from '../screens/transport/TransportHomeScreen';
import StaffHomeScreen from '../screens/hrms/StaffHomeScreen';

// Settings Screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';

export default function AppNavigator() {
  const { isAuthenticated, user, userRole, loading, logout } = useAuth();
  const [authMode, setAuthMode] = useState('STAFF'); // 'STAFF' | 'STUDENT'
  const [currentScreen, setCurrentScreen] = useState('HOME');
  const [activeTab, setActiveTab] = useState('home');
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <LoadingState message="Initializing Edu ERP Mobile..." />
      </div>
    );
  }

  // Not Authenticated: Render Login
  if (!isAuthenticated) {
    return authMode === 'STUDENT' ? (
      <StudentLoginScreen onSwitchToStaff={() => setAuthMode('STAFF')} />
    ) : (
      <LoginScreen onSwitchToStudent={() => setAuthMode('STUDENT')} />
    );
  }

  // Handle Tab Switching
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') setCurrentScreen('HOME');
    else if (tabId === 'profile') setCurrentScreen('PROFILE');
    else if (tabId === 'settings') setCurrentScreen('SETTINGS');
    else setCurrentScreen(tabId.toUpperCase());
  };

  // Generic navigation handler for screens & drawer
  const handleNavigate = (screenName) => {
    setCurrentScreen(screenName);
    setDrawerOpen(false);
    if (screenName === 'HOME') setActiveTab('home');
    else if (screenName === 'PROFILE') setActiveTab('profile');
    else if (screenName === 'SETTINGS') setActiveTab('settings');
  };

  // Define Bottom Nav Tabs based on Role
  const getTabsForRole = () => {
    const role = (userRole || '').toUpperCase();
    if (role === 'STUDENT') {
      return [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
        { id: 'marks', label: 'Marks', icon: 'award' },
        { id: 'fees', label: 'Fees', icon: 'credit-card' },
        { id: 'profile', label: 'Profile', icon: 'user' },
      ];
    }
    if (role === 'TEACHER') {
      return [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'attendance', label: 'Attendance', icon: 'user-check' },
        { id: 'marks', label: 'Grades', icon: 'clipboard-list' },
        { id: 'notes', label: 'Notes', icon: 'file-text' },
        { id: 'settings', label: 'More', icon: 'settings' },
      ];
    }
    if (role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL') {
      return [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'students', label: 'Students', icon: 'school' },
        { id: 'teachers', label: 'Teachers', icon: 'users' },
        { id: 'fees', label: 'Finance', icon: 'cash' },
        { id: 'settings', label: 'More', icon: 'settings' },
      ];
    }
    if (role === 'SUPER_ADMIN') {
      return [
        { id: 'home', label: 'Dashboard', icon: 'dashboard' },
        { id: 'schools', label: 'Schools', icon: 'building' },
        { id: 'onboard', label: 'Add School', icon: 'plus-circle' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
      ];
    }
    // Default tabs for Accountant, Librarian, Warden, Transport, Staff, Parent
    return [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ];
  };

  // Render the active screen content
  const renderScreenContent = () => {
    const role = (userRole || '').toUpperCase();

    // Global screens accessible to all roles
    if (currentScreen === 'SETTINGS') return <SettingsScreen onNavigate={handleNavigate} />;
    if (currentScreen === 'ABOUT') return <AboutScreen onNavigate={handleNavigate} />;
    if (currentScreen === 'CHANGE_PASSWORD') return <ChangePasswordScreen onNavigate={handleNavigate} />;

    // STUDENT Role screens
    if (role === 'STUDENT') {
      switch (currentScreen) {
        case 'PROFILE':
          return <StudentProfileScreen onNavigate={handleNavigate} />;
        case 'ATTENDANCE':
          return <StudentAttendanceScreen onNavigate={handleNavigate} />;
        case 'MARKS':
          return <StudentMarksScreen onNavigate={handleNavigate} />;
        case 'FEES':
          return <StudentFeesScreen onNavigate={handleNavigate} />;
        case 'NOTES':
          return <StudentNotesScreen onNavigate={handleNavigate} />;
        case 'HOME':
        default:
          return <StudentHomeScreen onNavigate={handleNavigate} />;
      }
    }

    // TEACHER Role screens
    if (role === 'TEACHER') {
      switch (currentScreen) {
        case 'ATTENDANCE':
          return <TeacherAttendanceScreen onNavigate={handleNavigate} />;
        case 'MARKS':
          return <TeacherMarksScreen onNavigate={handleNavigate} />;
        case 'NOTES':
          return <TeacherNotesScreen onNavigate={handleNavigate} />;
        case 'HOME':
        default:
          return <TeacherHomeScreen onNavigate={handleNavigate} />;
      }
    }

    // PRINCIPAL & VICE_PRINCIPAL screens
    if (role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL') {
      switch (currentScreen) {
        case 'STUDENTS':
          return <PrincipalStudentsScreen onNavigate={handleNavigate} />;
        case 'TEACHERS':
          return <PrincipalTeachersScreen onNavigate={handleNavigate} />;
        case 'FEES':
          return <PrincipalFeesScreen onNavigate={handleNavigate} />;
        case 'ATTENDANCE':
          return <PrincipalAttendanceScreen onNavigate={handleNavigate} />;
        case 'HOME':
        default:
          return <PrincipalHomeScreen onNavigate={handleNavigate} />;
      }
    }

    // SUPER_ADMIN screens
    if (role === 'SUPER_ADMIN') {
      switch (currentScreen) {
        case 'SCHOOLS':
          return <SchoolsDirectoryScreen onNavigate={handleNavigate} />;
        case 'ONBOARD':
          return <OnboardSchoolScreen onNavigate={handleNavigate} />;
        case 'HOME':
        default:
          return <SuperAdminHomeScreen onNavigate={handleNavigate} />;
      }
    }

    // PARENT Role
    if (role === 'PARENT') {
      return <ParentHomeScreen onNavigate={handleNavigate} />;
    }

    // ACCOUNTANT Role
    if (role === 'ACCOUNTANT') {
      return <AccountantHomeScreen onNavigate={handleNavigate} />;
    }

    // LIBRARIAN Role
    if (role === 'LIBRARIAN') {
      return <LibrarianHomeScreen onNavigate={handleNavigate} />;
    }

    // HOSTEL / WARDEN Role
    if (role === 'HOSTEL' || role === 'WARDEN') {
      return <WardenHomeScreen onNavigate={handleNavigate} />;
    }

    // TRANSPORT / DRIVER Role
    if (role === 'TRANSPORT' || role === 'DRIVER') {
      return <TransportHomeScreen onNavigate={handleNavigate} />;
    }

    // HR / STAFF / RECEPTIONIST / ACADEMIC_COORDINATOR
    return <StaffHomeScreen onNavigate={handleNavigate} />;
  };

  const getScreenTitle = () => {
    if (currentScreen === 'HOME') return 'Edu ERP';
    if (currentScreen === 'SETTINGS') return 'Settings';
    if (currentScreen === 'ABOUT') return 'About';
    if (currentScreen === 'CHANGE_PASSWORD') return 'Change Password';
    if (currentScreen === 'PROFILE') return 'My Profile';
    if (currentScreen === 'ATTENDANCE') return 'Attendance';
    if (currentScreen === 'MARKS') return 'Examination & Marks';
    if (currentScreen === 'FEES') return 'Fees & Finance';
    if (currentScreen === 'NOTES') return 'Study Material & Notes';
    if (currentScreen === 'STUDENTS') return 'Students Directory';
    if (currentScreen === 'TEACHERS') return 'Faculty Directory';
    if (currentScreen === 'SCHOOLS') return 'Managed Institutions';
    if (currentScreen === 'ONBOARD') return 'Onboard Institution';
    return currentScreen;
  };

  return (
    <ScreenContainer
      header={
        <MobileHeader
          title={getScreenTitle()}
          onOpenDrawer={() => setDrawerOpen(true)}
          showBack={currentScreen !== 'HOME'}
          onBack={() => handleNavigate('HOME')}
          rightAction={
            <div
              onClick={() => handleNavigate('SETTINGS')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {user?.name?.[0] || 'U'}
            </div>
          }
        />
      }
      bottomNav={
        <BottomNav
          tabs={getTabsForRole()}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
        />
      }
    >
      {/* Drawer navigation menu */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        userRole={userRole}
        onNavigate={handleNavigate}
        onLogout={logout}
      />

      {/* Main Active Screen */}
      <div style={{ paddingBottom: '20px' }}>
        {renderScreenContent()}
      </div>
    </ScreenContainer>
  );
}
