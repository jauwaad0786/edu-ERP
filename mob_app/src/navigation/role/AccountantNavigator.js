// mob_app/src/navigation/role/AccountantNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AccountantDashboardScreen from '../../screens/dashboard/AccountantDashboardScreen';
import CollectPaymentScreen      from '../../screens/fees/CollectPaymentScreen';
import OutstandingScreen         from '../../screens/fees/OutstandingScreen';
import ExpensesScreen            from '../../screens/finance/ExpensesScreen';
import SettingsScreen            from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function AccountantNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#16a34a', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Collect: 'card-outline', Outstanding: 'alert-circle-outline', Expenses: 'trending-down-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"   component={AccountantDashboardScreen} />
      <Tab.Screen name="Collect"     component={CollectPaymentScreen} />
      <Tab.Screen name="Outstanding" component={OutstandingScreen} />
      <Tab.Screen name="Expenses"    component={ExpensesScreen} />
      <Tab.Screen name="Settings"    component={SettingsScreen} />
    </Tab.Navigator>
  );
}
