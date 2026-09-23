// mob_app/src/navigation/role/LibrarianNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import LibrarianDashboardScreen from '../../screens/dashboard/LibrarianDashboardScreen';
import IssueReturnScreen        from '../../screens/library/IssueReturnScreen';
import BooksScreen              from '../../screens/library/BooksScreen';
import FinesScreen              from '../../screens/library/FinesScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import ProfileScreen            from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen     from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen      from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function LibrarianTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0891b2', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          'Issue/Return': focused ? 'swap-horizontal' : 'swap-horizontal-outline',
          Books: focused ? 'book' : 'book-outline',
          Fines: focused ? 'cash' : 'cash-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"    component={LibrarianDashboardScreen} />
      <Tab.Screen name="Issue/Return" component={IssueReturnScreen} />
      <Tab.Screen name="Books"        component={BooksScreen} />
      <Tab.Screen name="Fines"        component={FinesScreen} />
      <Tab.Screen name="Settings"     component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function LibrarianNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibrarianTabs"  component={LibrarianTabs} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
