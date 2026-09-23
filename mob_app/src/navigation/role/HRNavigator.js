// mob_app/src/navigation/role/HRNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HRDashboardScreen  from '../../screens/dashboard/HRDashboardScreen';
import EmployeesScreen    from '../../screens/hr/EmployeesScreen';
import LeavesScreen       from '../../screens/leaves/LeavesScreen';
import PayrollScreen      from '../../screens/hr/PayrollScreen';
import SettingsScreen     from '../../screens/settings/SettingsScreen';
import ProfileScreen      from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen  from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HRTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#be123c', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Employees: focused ? 'people' : 'people-outline',
          Leaves: focused ? 'calendar' : 'calendar-outline',
          Payroll: focused ? 'cash' : 'cash-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={HRDashboardScreen} />
      <Tab.Screen name="Employees" component={EmployeesScreen} />
      <Tab.Screen name="Leaves"    component={LeavesScreen} />
      <Tab.Screen name="Payroll"   component={PayrollScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function HRNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HRTabs"         component={HRTabs} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
