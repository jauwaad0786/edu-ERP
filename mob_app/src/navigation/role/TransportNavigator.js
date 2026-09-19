// mob_app/src/navigation/role/TransportNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TransportDashboardScreen from '../../screens/dashboard/TransportDashboardScreen';
import VehiclesScreen           from '../../screens/transport/VehiclesScreen';
import RoutesScreen             from '../../screens/transport/RoutesScreen';
import LiveTrackingScreen       from '../../screens/transport/LiveTrackingScreen';
import SettingsScreen           from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function TransportNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#ea580c', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', Vehicles: 'bus-outline', Routes: 'map-outline', Live: 'navigate-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
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
