// mob_app/src/navigation/role/AccountantNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AccountantDashboardScreen from '../../screens/dashboard/AccountantDashboardScreen';
import CollectPaymentScreen      from '../../screens/fees/CollectPaymentScreen';
import OutstandingScreen         from '../../screens/fees/OutstandingScreen';
import ReceiptsScreen            from '../../screens/fees/ReceiptsScreen';
import FeesScreen                from '../../screens/fees/FeesScreen';
import FeeSetupScreen            from '../../screens/fees/FeeSetupScreen';
import FeeServiceGenerationScreen from '../../screens/fees/FeeServiceGenerationScreen';
import ExpensesScreen            from '../../screens/finance/ExpensesScreen';
import FinanceHubScreen          from '../../screens/finance/FinanceHubScreen';
import PayrollScreen             from '../../screens/hr/PayrollScreen';
import SettingsScreen            from '../../screens/settings/SettingsScreen';
import ProfileScreen             from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen      from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen       from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AccountantTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#16a34a', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Collect: focused ? 'card' : 'card-outline',
          Receipts: focused ? 'receipt' : 'receipt-outline',
          Outstanding: focused ? 'alert-circle' : 'alert-circle-outline',
          Expenses: focused ? 'trending-down' : 'trending-down-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"   component={AccountantDashboardScreen} />
      <Tab.Screen name="Collect"     component={CollectPaymentScreen} />
      <Tab.Screen name="Receipts"    component={ReceiptsScreen} />
      <Tab.Screen name="Outstanding" component={OutstandingScreen} />
      <Tab.Screen name="Expenses"    component={ExpensesScreen} />
      <Tab.Screen name="Settings"    component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AccountantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountantTabs" component={AccountantTabs} />
      <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
      <Stack.Screen name="FeeCollect"     component={CollectPaymentScreen} />
      <Stack.Screen name="Receipts"       component={ReceiptsScreen} />
      <Stack.Screen name="Fees"           component={FeesScreen} />
      <Stack.Screen name="FeeSetup"       component={FeeSetupScreen} />
      <Stack.Screen name="FeeGeneration"  component={FeeServiceGenerationScreen} />
      <Stack.Screen name="Payroll"        component={PayrollScreen} />
      <Stack.Screen name="FinanceHub"     component={FinanceHubScreen} />
      <Stack.Screen name="Purchases"      component={FinanceHubScreen} />
      <Stack.Screen name="Vendors"        component={FinanceHubScreen} />
      <Stack.Screen name="FinanceDash"    component={FinanceHubScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
