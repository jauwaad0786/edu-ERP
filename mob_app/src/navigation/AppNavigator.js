// mob_app/src/navigation/AppNavigator.js
// Role-based navigation root — mirrors DashboardRouter.jsx on the web.
// Determines which bottom-tab navigator to mount based on user.role.

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// ── Auth Screens ──────────────────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';
import LoggedOutSuccessScreen from '../screens/auth/LoggedOutSuccessScreen';

// ── Role Navigators ────────────────────────────────────────────────────────
import AdminNavigator       from './role/AdminNavigator';
import PrincipalNavigator   from './role/PrincipalNavigator';
import VicePrincipalNavigator from './role/VicePrincipalNavigator';
import TeacherNavigator     from './role/TeacherNavigator';
import StudentNavigator     from './role/StudentNavigator';
import ParentNavigator      from './role/ParentNavigator';
import AccountantNavigator  from './role/AccountantNavigator';
import LibrarianNavigator   from './role/LibrarianNavigator';
import WardenNavigator      from './role/WardenNavigator';
import TransportNavigator   from './role/TransportNavigator';
import HRNavigator          from './role/HRNavigator';

const Stack = createNativeStackNavigator();

/**
 * Returns the correct authenticated navigator for the given user role.
 * Add new roles here — never in individual screen files.
 */
function AuthenticatedNavigator({ user }) {
  const isCompanyActor = user.school_id == null;
  const isTrueAdmin = !!(user.is_super || ['CEO', 'SUPER_ADMIN'].includes(user.active_role?.key));

  switch (user.role) {
    case 'SUPER_ADMIN':
      return (isCompanyActor && !isTrueAdmin) ? <PrincipalNavigator /> : <AdminNavigator />;
    case 'PRINCIPAL':
    case 'DIRECTOR':
      return <PrincipalNavigator />;
    case 'VICE_PRINCIPAL':
    case 'ACADEMIC_COORDINATOR':
    case 'EXAM_CONTROLLER':
      return <VicePrincipalNavigator />;
    case 'TEACHER':
      return <TeacherNavigator />;
    case 'STUDENT':
      return <StudentNavigator />;
    case 'PARENT':
      return <ParentNavigator />;
    case 'ACCOUNTANT':
      return <AccountantNavigator />;
    case 'LIBRARIAN':
      return <LibrarianNavigator />;
    case 'HOSTEL':
      return <WardenNavigator />;
    case 'TRANSPORT':
      return <TransportNavigator />;
    case 'HR':
      return <HRNavigator />;
    default:
      return (
        <View style={styles.centerScreen}>
          <Text style={styles.unknownText}>
            Unknown role: <Text style={styles.code}>{user.role}</Text>
          </Text>
          <Text style={styles.subText}>Contact your administrator.</Text>
        </View>
      );
  }
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#0176d3" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="App">
            {() => <AuthenticatedNavigator user={user} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Auth" component={LoginScreen} />
            <Stack.Screen name="LoggedOutSuccess" component={LoggedOutSuccessScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f8',
  },
  unknownText: {
    fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 6,
  },
  code: {
    fontFamily: 'monospace', color: '#dc2626',
  },
  subText: {
    fontSize: 13, color: '#64748b',
  },
});
