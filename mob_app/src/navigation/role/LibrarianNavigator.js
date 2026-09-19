// mob_app/src/navigation/role/LibrarianNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LibrarianDashboardScreen from '../../screens/dashboard/LibrarianDashboardScreen';
import IssueReturnScreen        from '../../screens/library/IssueReturnScreen';
import BooksScreen              from '../../screens/library/BooksScreen';
import FinesScreen              from '../../screens/library/FinesScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function LibrarianNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0891b2', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', 'Issue/Return': 'swap-horizontal-outline', Books: 'book-outline', Fines: 'cash-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
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
