// mob_app/src/navigation/role/WardenNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import WardenDashboardScreen from '../../screens/dashboard/WardenDashboardScreen';
import RollCallScreen        from '../../screens/hostel/RollCallScreen';
import OutPassScreen         from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen      from '../../screens/hostel/ComplaintsScreen';
import RoomMapScreen        from '../../screens/hostel/RoomMapScreen';
import VisitorsScreen       from '../../screens/hostel/VisitorsScreen';
import SettingsScreen        from '../../screens/settings/SettingsScreen';
import ProfileScreen         from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen  from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen   from '../../screens/notifications/NotificationsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function WardenTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#4338ca', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          'Room Map': focused ? 'bed' : 'bed-outline',
          'Roll Call': focused ? 'clipboard' : 'clipboard-outline',
          'Out Pass': focused ? 'exit' : 'exit-outline',
          Complaints: focused ? 'warning' : 'warning-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"  component={WardenDashboardScreen} />
      <Tab.Screen name="Room Map"   component={RoomMapScreen} />
      <Tab.Screen name="Roll Call"  component={RollCallScreen} />
      <Tab.Screen name="Out Pass"   component={OutPassScreen} />
      <Tab.Screen name="Complaints" component={ComplaintsScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function WardenNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WardenTabs"     component={WardenTabs} />
      <Stack.Screen name="RoomMap"        component={RoomMapScreen} />
      <Stack.Screen name="HostelRoomMap"  component={RoomMapScreen} />
      <Stack.Screen name="Visitors"       component={VisitorsScreen} />
      <Stack.Screen name="VisitorLog"     component={VisitorsScreen} />
      <Stack.Screen name="GatePass"       component={VisitorsScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
