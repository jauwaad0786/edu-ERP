// mob_app/src/navigation/role/PrincipalNavigator.js
// Complete navigator for Principal role matching all screens in the mockup
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import PrincipalDashboardScreen from '../../screens/dashboard/PrincipalDashboardScreen';
import StudentsScreen from '../../screens/students/StudentsScreen';
import AddStudentWizardScreen from '../../screens/students/AddStudentWizardScreen';
import StaffScreen from '../../screens/staff/StaffScreen';
import FeesScreen from '../../screens/fees/FeesScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import ExaminationsScreen from '../../screens/examinations/ExaminationsScreen';
import ReportsScreen from '../../screens/reports/ReportsScreen';
import NotificationsScreen from '../../screens/notifications/NotificationsScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
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
      <Stack.Screen name="AddStudent" component={AddStudentWizardScreen} />
      <Stack.Screen name="AddStudentWizard" component={AddStudentWizardScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}
