// mob_app/src/navigation/role/TransportNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import TransportDashboardScreen from '../../screens/dashboard/TransportDashboardScreen';
import VehiclesScreen           from '../../screens/transport/VehiclesScreen';
import RoutesScreen             from '../../screens/transport/RoutesScreen';
import LiveTrackingScreen       from '../../screens/transport/LiveTrackingScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import ProfileScreen            from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen     from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen      from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TransportTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#ea580c', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Vehicles: focused ? 'bus' : 'bus-outline',
          Routes: focused ? 'map' : 'map-outline',
          Live: focused ? 'navigate' : 'navigate-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard" component={TransportDashboardScreen} />
      <Tab.Screen name="Vehicles"  component={VehiclesScreen} />
      <Tab.Screen name="Routes"    component={RoutesScreen} />
      <Tab.Screen name="Live"      component={LiveTrackingScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function TransportNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TransportTabs"  component={TransportTabs} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
