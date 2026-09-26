// mob_app/src/navigation/role/DriverNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DriverConsoleScreen   from '../../screens/transport/DriverConsoleScreen';
import RoutesScreen          from '../../screens/transport/RoutesScreen';
import SettingsScreen        from '../../screens/settings/SettingsScreen';
import ProfileScreen         from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen  from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen   from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DriverTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#c2410c',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Console: focused ? 'bus' : 'bus-outline',
          Route: focused ? 'map' : 'map-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Console"  component={DriverConsoleScreen} />
      <Tab.Screen name="Route"    component={RoutesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs"     component={DriverTabs} />
      <Stack.Screen name="DriverConsole"  component={DriverConsoleScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
