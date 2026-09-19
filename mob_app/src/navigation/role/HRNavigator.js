// mob_app/src/navigation/role/HRNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HRDashboardScreen  from '../../screens/dashboard/HRDashboardScreen';
import EmployeesScreen    from '../../screens/hr/EmployeesScreen';
import LeavesScreen       from '../../screens/leaves/LeavesScreen';
import PayrollScreen      from '../../screens/hr/PayrollScreen';
import SettingsScreen     from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function HRNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#be123c', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Employees: 'people-outline', Leaves: 'calendar-outline', Payroll: 'cash-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
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
