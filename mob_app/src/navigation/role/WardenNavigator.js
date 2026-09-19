// mob_app/src/navigation/role/WardenNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import WardenDashboardScreen from '../../screens/dashboard/WardenDashboardScreen';
import RollCallScreen        from '../../screens/hostel/RollCallScreen';
import OutPassScreen         from '../../screens/hostel/OutPassScreen';
import ComplaintsScreen      from '../../screens/hostel/ComplaintsScreen';
import SettingsScreen        from '../../screens/settings/SettingsScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';
const Tab = createBottomTabNavigator();
export default function WardenNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#4338ca', tabBarInactiveTintColor: '#94a3b8',
      tabBarIcon: ({ color, size }) => {
        const icons = { Dashboard: 'grid-outline', 'Roll Call': 'clipboard-outline', 'Out Pass': 'exit-outline', Complaints: 'warning-outline', Settings: 'settings-outline' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Dashboard"  component={WardenDashboardScreen} />
      <Tab.Screen name="Roll Call"  component={RollCallScreen} />
      <Tab.Screen name="Out Pass"   component={OutPassScreen} />
      <Tab.Screen name="Complaints" component={ComplaintsScreen} />
      <Tab.Screen name="Settings"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}
