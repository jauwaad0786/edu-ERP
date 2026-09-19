// mob_app/src/navigation/role/PrincipalNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import PrincipalDashboardScreen from '../../screens/dashboard/PrincipalDashboardScreen';
import StudentsScreen           from '../../screens/students/StudentsScreen';
import StaffScreen              from '../../screens/staff/StaffScreen';
import FeesScreen               from '../../screens/fees/FeesScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function PrincipalNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Students: 'people-outline', Staff: 'person-circle-outline', Fees: 'receipt-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={PrincipalDashboardScreen} />
      <Tab.Screen name="Students"  component={StudentsScreen} />
      <Tab.Screen name="Staff"     component={StaffScreen} />
      <Tab.Screen name="Fees"      component={FeesScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}
