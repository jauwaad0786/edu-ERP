// mob_app/src/navigation/role/AdminNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboardScreen    from '../../screens/dashboard/AdminDashboardScreen';
import SchoolsScreen           from '../../screens/admin/SchoolsScreen';
import UsersScreen             from '../../screens/admin/UsersScreen';
import SupportScreen           from '../../screens/admin/SupportScreen';
import SettingsScreen          from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function AdminNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Schools: 'school-outline', Users: 'people-outline', Support: 'headset-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Schools"   component={SchoolsScreen} />
      <Tab.Screen name="Users"     component={UsersScreen} />
      <Tab.Screen name="Support"   component={SupportScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}
