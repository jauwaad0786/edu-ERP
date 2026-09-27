// mob_app/src/screens/menu/DrawerMenuModal.js
// Dynamic Role-Based Drawer Navigation matching Web Sidebar ROLE_MENUS
// 100% connected to existing backend routes and registered mobile screens

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function DrawerMenuModal({
  visible,
  onClose,
  navigation,
  user,
  onLogoutPress,
}) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const role = user?.role ? String(user.role).toUpperCase() : 'PRINCIPAL';
  const userName = user?.name || user?.email?.split('@')[0] || 'Institutional User';
  const schoolName = user?.school?.name || user?.school_name || 'EduERP Institution';
  const academicSession = user?.school?.current_session || '2024-25';

  // Role-Specific Navigation Groups strictly matching Web ERP modules
  const menuGroups = useMemo(() => {
    switch (role) {
      case 'PRINCIPAL':
      case 'DIRECTOR':
      case 'VICE_PRINCIPAL':
      case 'ADMIN':
        return [
          {
            title: 'Overview & Intelligence',
            items: [
              { label: 'Dashboard', icon: 'grid-outline', screen: 'Home', color: '#0b57d0' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'Student Lifecycle',
            items: [
              { label: 'Students Directory', icon: 'people-outline', screen: 'Students', color: '#2563eb' },
              { label: 'New Admission', icon: 'person-add-outline', screen: 'AddStudentWizard', color: '#0284c7' },
              { label: 'Provisional Admissions', icon: 'time-outline', screen: 'Provisional', color: '#d97706' },
              { label: 'Students Bulk Edit', icon: 'create-outline', screen: 'BulkEdit', color: '#0d9488' },
              { label: 'Section Shuffle', icon: 'shuffle-outline', screen: 'SectionShuffle', color: '#7c3aed' },
              { label: 'Promote & Rollover', icon: 'rocket-outline', screen: 'Promotion', color: '#16a34a' },
              { label: 'Annual Re-Registration', icon: 'repeat-outline', screen: 'AnnualRegister', color: '#059669' },
              { label: 'Bulk Student Import CSV', icon: 'cloud-upload-outline', screen: 'StudentImport', color: '#0891b2' },
              { label: 'Student ID Cards', icon: 'card-outline', screen: 'IDCard', color: '#7c3aed' },
              { label: 'Student Documents & KYC', icon: 'document-text-outline', screen: 'StudentDocuments', color: '#0284c7' },
              { label: 'Issue Certificates (TC/Bonafide)', icon: 'ribbon-outline', screen: 'IssueCertificates', color: '#dc2626' },
              { label: 'Inquiries & Leads', icon: 'megaphone-outline', screen: 'Leads', color: '#ea580c' },
            ],
          },
          {
            title: 'Academics & Evaluation',
            items: [
              { label: 'Classes & Sections', icon: 'school-outline', screen: 'Classes', color: '#0d9488' },
              { label: 'Curriculum Subjects', icon: 'book-outline', screen: 'Subjects', color: '#0284c7' },
              { label: 'Weekly Timetable', icon: 'calendar-outline', screen: 'Timetable', color: '#7c3aed' },
              { label: 'Curriculum Coverage', icon: 'analytics-outline', screen: 'Curriculum', color: '#059669' },
              { label: 'Teachers Directory', icon: 'person-outline', screen: 'Teachers', color: '#4f46e5' },
              { label: 'Attendance Registry', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
              { label: 'Examinations & Datesheets', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Admit Cards (Hall Tickets)', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Marks & Evaluations', icon: 'pencil-outline', screen: 'Marks', color: '#4338ca' },
              { label: 'Results & RMS Cards', icon: 'ribbon-outline', screen: 'Result', color: '#be185d' },
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Notes & Study Material', icon: 'document-text-outline', screen: 'Notes', color: '#0891b2' },
            ],
          },
          {
            title: 'Finance & Accounts',
            items: [
              { label: 'Fees Command Center', icon: 'trending-up-outline', screen: 'Fees', color: '#16a34a' },
              { label: 'Fee Bills & Demands', icon: 'document-text-outline', screen: 'FeeBills', color: '#0b57d0' },
              { label: 'Collect Payment (POS)', icon: 'card-outline', screen: 'FeeCollect', color: '#0284c7' },
              { label: 'Payment Receipts Log', icon: 'receipt-outline', screen: 'Receipts', color: '#059669' },
              { label: 'Generate Monthly Fees', icon: 'calculator-outline', screen: 'FeeGeneration', color: '#d97706' },
              { label: 'Fee Setup & Plans', icon: 'settings-outline', screen: 'FeeSetup', color: '#7c3aed' },
              { label: 'Outstanding Student Dues', icon: 'alert-circle-outline', screen: 'FeeRecords', color: '#ea580c' },
              { label: 'Operating Expenses', icon: 'wallet-outline', screen: 'Expenses', color: '#dc2626' },
              { label: 'Purchase Orders & GRN', icon: 'cart-outline', screen: 'Purchases', color: '#7c3aed' },
              { label: 'Vendor Directory', icon: 'business-outline', screen: 'Vendors', color: '#ea580c' },
            ],
          },
          {
            title: 'Transport & Fleet Management',
            items: [
              { label: 'Live GPS Tracking', icon: 'navigate-outline', screen: 'LiveTracking', color: '#ea580c' },
              { label: 'Student Travel History', icon: 'trail-sign-outline', screen: 'StudentTravelHistory', color: '#0b57d0' },
              { label: 'Vehicles & Fleet', icon: 'bus-outline', screen: 'Vehicles', color: '#2563eb' },
              { label: 'Drivers Directory', icon: 'steering-wheel', screen: 'Drivers', color: '#059669' },
              { label: 'Conductors List', icon: 'people-outline', screen: 'Conductors', color: '#0d9488' },
              { label: 'Routes & Stops', icon: 'map-outline', screen: 'Routes', color: '#7c3aed' },
              { label: 'Student Bus Roster', icon: 'person-add-outline', screen: 'StudentTransport', color: '#0284c7' },
              { label: 'Vehicle Maintenance', icon: 'construct-outline', screen: 'VehicleMaintenance', color: '#dc2626' },
              { label: 'Driver Console App', icon: 'speedometer-outline', screen: 'DriverConsole', color: '#f59e0b' },
            ],
          },
          {
            title: 'Hostel Management',
            items: [
              { label: 'Hostel Admissions & Allotment', icon: 'person-add-outline', screen: 'HostelAdmission', color: '#4338ca' },
              { label: 'Transfers & Vacate Clearance', icon: 'swap-horizontal-outline', screen: 'HostelTransfers', color: '#6366f1' },
              { label: 'Room & Bed Map', icon: 'business-outline', screen: 'RoomMap', color: '#3b82f6' },
              { label: 'Monthly Hostel Fees', icon: 'receipt-outline', screen: 'HostelFees', color: '#15803d' },
              { label: 'Hostel Fines & Penalties', icon: 'alert-circle-outline', screen: 'HostelFines', color: '#dc2626' },
              { label: 'Night Roll Call', icon: 'bed-outline', screen: 'RollCall', color: '#0284c7' },
              { label: 'Gate Out-Passes', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Visitor Gate Pass', icon: 'shield-checkmark-outline', screen: 'Visitors', color: '#059669' },
              { label: 'Room Maintenance & Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
            ],
          },
          {
            title: 'Library Automation',
            items: [
              { label: 'Book Master Catalog', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Issue & Return Desk', icon: 'swap-horizontal-outline', screen: 'IssueReturn', color: '#0284c7' },
              { label: 'Library Members & Cards', icon: 'card-outline', screen: 'Members', color: '#0d9488' },
              { label: 'Book Hold & Reservations', icon: 'bookmark-outline', screen: 'Reservations', color: '#7c3aed' },
              { label: 'Overdue Fines & Dues', icon: 'cash-outline', screen: 'Fines', color: '#d97706' },
            ],
          },
          {
            title: 'Staff & HRMS',
            items: [
              { label: 'Employee Directory', icon: 'people-outline', screen: 'Employees', color: '#be123c' },
              { label: 'GPS Punch Attendance', icon: 'finger-print-outline', screen: 'StaffAttendance', color: '#0284c7' },
              { label: 'Attendance Analytics', icon: 'bar-chart-outline', screen: 'AttendanceAnalytics', color: '#16a34a' },
              { label: 'Attendance & GPS Settings', icon: 'settings-outline', screen: 'AttendanceSettings', color: '#64748b' },
              { label: 'Leaves & Official Duty', icon: 'calendar-outline', screen: 'Leaves', color: '#ea580c' },
              { label: 'Payroll & Salary Slips', icon: 'cash-outline', screen: 'Payroll', color: '#15803d' },
              { label: 'Staff Delegation & Proxy', icon: 'swap-horizontal-outline', screen: 'Delegations', color: '#4338ca' },
            ],
          },
          {
            title: 'Campus & Operations',
            items: [
              { label: 'Finance Command Center', icon: 'trending-up-outline', screen: 'FinanceHub', color: '#0369a1' },
              { label: 'Purchase Orders & GRN', icon: 'cart-outline', screen: 'Purchases', color: '#7c3aed' },
              { label: 'Vendor Management', icon: 'business-outline', screen: 'Vendors', color: '#ea580c' },
              { label: 'Comprehensive Reports', icon: 'bar-chart-outline', screen: 'Reports', color: '#c026d3' },
              { label: 'Audit Trail & Logs', icon: 'shield-checkmark-outline', screen: 'AuditLogs', color: '#dc2626' },
              { label: 'WhatsApp Gateway', icon: 'logo-whatsapp', screen: 'WhatsApp', color: '#16a34a' },
              { label: 'Roles & Permissions', icon: 'key-outline', screen: 'Roles', color: '#4338ca' },
              { label: 'Virtual Meetings & PTM', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
              { label: 'Support & Help Desk', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'Settings & Profile', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'TEACHER':
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Teacher Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0176d3' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'My Daily Work',
            items: [
              { label: 'Student Attendance', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
              { label: 'Assigned Classes', icon: 'school-outline', screen: 'Classes', color: '#0d9488' },
              { label: 'Exam Marks Entry', icon: 'pencil-outline', screen: 'Marks', color: '#4338ca' },
              { label: 'Admit Cards (Hall Tickets)', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'My Punch Attendance', icon: 'finger-print-outline', screen: 'StaffAttendance', color: '#0284c7' },
              { label: 'Leave Applications', icon: 'calendar-outline', screen: 'Leaves', color: '#ea580c' },
              { label: 'My Salary Payslips', icon: 'cash-outline', screen: 'Payroll', color: '#16a34a' },
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Study Notes Upload', icon: 'book-outline', screen: 'Notes', color: '#0284c7' },
              { label: 'Substitute Duties', icon: 'swap-horizontal-outline', screen: 'Delegations', color: '#0369a1' },
              { label: 'PTM & Conferences', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
            ],
          },
          {
            title: 'Help & Settings',
            items: [
              { label: 'Support & Tickets', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'STUDENT':
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Student Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#7c3aed' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#0b57d0', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'My Academics',
            items: [
              { label: 'My Attendance', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
              { label: 'Exam Schedule & Datesheet', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Exam Admit Card', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Exam Report Card', icon: 'ribbon-outline', screen: 'Result', color: '#7c3aed' },
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Study Notes & PDFs', icon: 'book-outline', screen: 'Notes', color: '#0284c7' },
              { label: 'Fee Dues & Receipts', icon: 'receipt-outline', screen: 'Fees', color: '#d97706' },
              { label: 'Library Books', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Transport Live Bus', icon: 'bus-outline', screen: 'Transport', color: '#ea580c' },
              { label: 'Hostel Out-Pass', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Room Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
            ],
          },
          {
            title: 'Support & Profile',
            items: [
              { label: 'Support & Grievances', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'My Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'PARENT':
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Child Dashboard', icon: 'grid-outline', screen: 'My Child', color: '#7c3aed' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#0b57d0', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: "Child's Monitoring",
            items: [
              { label: 'Attendance Records', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
              { label: 'Fee Dues & Receipts', icon: 'receipt-outline', screen: 'Fees', color: '#d97706' },
              { label: 'Exam Datesheets', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Child Admit Card', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Report Card & Marks', icon: 'ribbon-outline', screen: 'Result', color: '#7c3aed' },
              { label: 'Homework & Tasks', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Live Bus Tracking', icon: 'bus-outline', screen: 'Transport', color: '#ea580c' },
              { label: 'Library Books & Dues', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Study Materials', icon: 'book-outline', screen: 'Notes', color: '#0284c7' },
              { label: 'Hostel Out-Pass', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Hostel Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
              { label: 'PTM & Virtual Meetings', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
            ],
          },
          {
            title: 'Support & Profile',
            items: [
              { label: 'Support & Inquiries', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'Account Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'HOSTEL':
      case 'WARDEN':
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Hostel Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#4338ca' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Hostel Management',
            items: [
              { label: 'Hostel Admissions & Allotment', icon: 'person-add-outline', screen: 'HostelAdmission', color: '#4338ca' },
              { label: 'Transfers & Vacate Clearance', icon: 'swap-horizontal-outline', screen: 'HostelTransfers', color: '#6366f1' },
              { label: 'Room & Bed Map', icon: 'bed-outline', screen: 'RoomMap', color: '#3b82f6' },
              { label: 'Monthly Hostel Fees', icon: 'receipt-outline', screen: 'HostelFees', color: '#15803d' },
              { label: 'Hostel Fines & Penalties', icon: 'alert-circle-outline', screen: 'HostelFines', color: '#dc2626' },
              { label: 'Night Roll Call', icon: 'clipboard-outline', screen: 'RollCall', color: '#0284c7' },
              { label: 'Gate Out-Passes', icon: 'exit-outline', screen: 'OutPass', color: '#16a34a' },
              { label: 'Visitor Gate Pass', icon: 'shield-checkmark-outline', screen: 'Visitors', color: '#059669' },
              { label: 'Maintenance & Grievances', icon: 'construct-outline', screen: 'Complaints', color: '#ea580c' },
            ],
          },
          {
            title: 'Account & Settings',
            items: [
              { label: 'My Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'LIBRARIAN':
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Library Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0891b2' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Library Operations',
            items: [
              { label: 'Book Master Catalog', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Issue & Return Desk', icon: 'swap-horizontal-outline', screen: 'IssueReturn', color: '#0284c7' },
              { label: 'Library Members & Cards', icon: 'card-outline', screen: 'Members', color: '#0d9488' },
              { label: 'Hold & Reservations Queue', icon: 'bookmark-outline', screen: 'Reservations', color: '#7c3aed' },
              { label: 'Overdue Fines & Penalties', icon: 'cash-outline', screen: 'Fines', color: '#d97706' },
            ],
          },
          {
            title: 'Account & Settings',
            items: [
              { label: 'My Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'SUPER_ADMIN':
      default:
        return [
          {
            title: 'Overview',
            items: [
              { label: 'Platform Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0176d3' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Platform Administration',
            items: [
              { label: 'Tenant Schools', icon: 'school-outline', screen: 'Schools', color: '#0284c7' },
              { label: 'Platform Users', icon: 'people-outline', screen: 'Users', color: '#7c3aed' },
              { label: 'Demo Leads & Inquiries', icon: 'person-add-outline', screen: 'Leads', color: '#ea580c' },
              { label: 'Security & Audit Logs', icon: 'shield-checkmark-outline', screen: 'AuditLogs', color: '#dc2626' },
              { label: 'WhatsApp Gateway', icon: 'logo-whatsapp', screen: 'WhatsApp', color: '#16a34a' },
              { label: 'Roles & Permissions', icon: 'key-outline', screen: 'Roles', color: '#4338ca' },
              { label: 'Support Tickets', icon: 'headset-outline', screen: 'Support', color: '#16a34a' },
              { label: 'Developer Center', icon: 'bug-outline', screen: 'DeveloperCenter', color: '#7c3aed' },
              { label: 'System Health', icon: 'pulse-outline', screen: 'SystemHealth', color: '#0284c7' },
              { label: 'Finance Command Center', icon: 'trending-up-outline', screen: 'FinanceHub', color: '#0369a1' },
              { label: 'Purchase Orders & GRN', icon: 'cart-outline', screen: 'Purchases', color: '#7c3aed' },
              { label: 'Vendor Management', icon: 'business-outline', screen: 'Vendors', color: '#ea580c' },
              { label: 'Security & Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];
    }
  }, [role]);

  const handleNavigate = (screen) => {
    onClose();
    if (screen && navigation?.navigate) {
      navigation.navigate(screen);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Profile Card Header */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => handleNavigate('Profile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{userName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.nameText} numberOfLines={1}>{userName}</Text>
            </View>
            <View style={styles.roleSessionRow}>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{role}</Text>
              </View>
              <Text style={styles.sessionDot}>•</Text>
              <Text style={styles.sessionText}>{academicSession}</Text>
            </View>
            <Text style={styles.schoolSub} numberOfLines={1}>{schoolName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Role-Specific Navigation Groups List */}
        <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
          {menuGroups.map((group, gIdx) => (
            <View key={gIdx} style={styles.groupContainer}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.menuRow}
                  onPress={() => handleNavigate(item.screen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{item.badge}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>

        {/* Bottom Theme Toggle & Logout */}
        <View style={styles.footer}>
          <View style={styles.themeRow}>
            <Ionicons name="sunny-outline" size={16} color={colors.muted} style={{ marginRight: 4 }} />
            <Text style={styles.themeLabel}>Light</Text>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
              trackColor={{ false: '#e2e8f0', true: colors.primaryLight }}
            />
            <Text style={styles.themeLabel}>Dark</Text>
            <Ionicons name="moon-outline" size={16} color={colors.muted} style={{ marginLeft: 4 }} />
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              onClose();
              if (onLogoutPress) onLogoutPress();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  roleSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  rolePill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  sessionDot: {
    color: '#94a3b8',
    marginHorizontal: 5,
  },
  sessionText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  schoolSub: {
    fontSize: 12,
    color: colors.muted,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  groupContainer: {
    marginTop: 14,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#ffffff',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badgePill: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: '#f8fafc',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 12,
    color: colors.text,
    marginHorizontal: 4,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
