// mob_app/src/navigation/role/AdminNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboardScreen  from '../../screens/dashboard/AdminDashboardScreen';
import SchoolsScreen         from '../../screens/admin/SchoolsScreen';
import UsersScreen           from '../../screens/admin/UsersScreen';
import SupportScreen         from '../../screens/admin/SupportScreen';
import SettingsScreen        from '../../screens/settings/SettingsScreen';
import ProfileScreen         from '../../screens/profile/ProfileScreen';
import ChangePasswordScreen  from '../../screens/profile/ChangePasswordScreen';
import NotificationsScreen   from '../../screens/notifications/NotificationsScreen';
import NoticeBoardScreen    from '../../screens/notices/NoticeBoardScreen';
import LeadsScreen          from '../../screens/admin/LeadsScreen';
import VisitorsScreen       from '../../screens/hostel/VisitorsScreen';
import DelegationsScreen    from '../../screens/delegations/DelegationsScreen';
import AuditLogsScreen      from '../../screens/audit/AuditLogsScreen';
import WhatsAppScreen       from '../../screens/communication/WhatsAppScreen';
import RolesScreen          from '../../screens/rbac/RolesScreen';
import MeetingsScreen       from '../../screens/communication/MeetingsScreen';
import AIChatScreen          from '../../screens/ai/AIChatScreen';
import DeveloperCenterScreen from '../../screens/developer/DeveloperCenterScreen';
import { TAB_BAR_STYLE } from '../tabBarStyle';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false, tabBarStyle: TAB_BAR_STYLE,
      tabBarActiveTintColor: '#0176d3', tabBarInactiveTintColor: '#94a3b8',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size, focused }) => {
        const icons = {
          Dashboard: focused ? 'grid' : 'grid-outline',
          Schools: focused ? 'school' : 'school-outline',
          Users: focused ? 'people' : 'people-outline',
          Support: focused ? 'headset' : 'headset-outline',
          Settings: focused ? 'settings' : 'settings-outline',
        };
        return <Ionicons name={icons[route.name] || 'grid-outline'} size={size} color={color} />;
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

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs"      component={AdminTabs} />
      <Stack.Screen name="AIChat"         component={AIChatScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen} />
      <Stack.Screen name="NoticeBoard"    component={NoticeBoardScreen} />
      <Stack.Screen name="Notices"        component={NoticeBoardScreen} />
      <Stack.Screen name="Leads"          component={LeadsScreen} />
      <Stack.Screen name="Inquiries"      component={LeadsScreen} />
      <Stack.Screen name="Visitors"       component={VisitorsScreen} />
      <Stack.Screen name="VisitorLog"     component={VisitorsScreen} />
      <Stack.Screen name="GatePass"       component={VisitorsScreen} />
      <Stack.Screen name="Delegations"    component={DelegationsScreen} />
      <Stack.Screen name="TeacherDelegations" component={DelegationsScreen} />
      <Stack.Screen name="SubstituteDuties" component={DelegationsScreen} />
      <Stack.Screen name="AuditLogs"      component={AuditLogsScreen} />
      <Stack.Screen name="AuditTrail"     component={AuditLogsScreen} />
      <Stack.Screen name="SecurityLogs"   component={AuditLogsScreen} />
      <Stack.Screen name="WhatsApp"       component={WhatsAppScreen} />
      <Stack.Screen name="WhatsAppSettings" component={WhatsAppScreen} />
      <Stack.Screen name="Roles"          component={RolesScreen} />
      <Stack.Screen name="RoleManagement" component={RolesScreen} />
      <Stack.Screen name="PermissionMatrix" component={RolesScreen} />
      <Stack.Screen name="RBAC"           component={RolesScreen} />
      <Stack.Screen name="Meetings"         component={MeetingsScreen} />
      <Stack.Screen name="PTM"              component={MeetingsScreen} />
      <Stack.Screen name="Conferences"      component={MeetingsScreen} />
      <Stack.Screen name="DeveloperCenter"  component={DeveloperCenterScreen} />
      <Stack.Screen name="ErrorDashboard"   component={DeveloperCenterScreen} />
      <Stack.Screen name="SystemHealth"     component={DeveloperCenterScreen} />
      <Stack.Screen name="FinanceHub"     component={FinanceHubScreen} />
      <Stack.Screen name="Purchases"      component={FinanceHubScreen} />
      <Stack.Screen name="Vendors"        component={FinanceHubScreen} />
      <Stack.Screen name="FinanceDash"    component={FinanceHubScreen} />
    </Stack.Navigator>
  );
}
