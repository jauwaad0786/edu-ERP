// mob_app/src/screens/menu/DrawerMenuModal.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, Switch, Alert, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DrawerMenuModal({ visible, onClose, navigation }) {
  const { user, logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    'Student Management': true,
    'Academics': true,
    'Finance & Fees': true,
  });

  const role = user?.role ? String(user.role).toUpperCase() : 'PRINCIPAL';
  const userName = user?.name || user?.email?.split('@')[0] || 'Institutional User';
  const schoolName = user?.school?.name || user?.school_name || 'EduERP Institution';
  const academicSession = user?.school?.current_session || '2026-27';

  const toggleSection = (title) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Role-Specific Navigation Groups strictly matching Web ERP services
  const menuGroups = useMemo(() => {
    switch (role) {
      case 'PRINCIPAL':
      case 'DIRECTOR':
      case 'VICE_PRINCIPAL':
      case 'ADMIN':
      case 'ACCOUNTANT':
        return [
          {
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#0b57d0',
            items: [
              { label: 'Executive Dashboard', icon: 'grid-outline', screen: 'Home', color: '#0b57d0' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'Student Management',
            icon: 'people-outline',
            color: '#2563eb',
            items: [
              { label: 'Students Directory', icon: 'people-outline', screen: 'Students', color: '#2563eb' },
              { label: 'New Admission (Wizard)', icon: 'person-add-outline', screen: 'AddStudentWizard', color: '#0284c7' },
              { label: 'Provisional Admissions', icon: 'time-outline', screen: 'Provisional', color: '#d97706' },
              { label: 'Students Bulk Edit', icon: 'create-outline', screen: 'BulkEdit', color: '#0d9488' },
              { label: 'Section Shuffle', icon: 'shuffle-outline', screen: 'SectionShuffle', color: '#7c3aed' },
              { label: 'Promote & Rollover', icon: 'rocket-outline', screen: 'Promotion', color: '#16a34a' },
              { label: 'Annual Re-Registration', icon: 'repeat-outline', screen: 'AnnualRegister', color: '#059669' },
              { label: 'Bulk Student Import CSV', icon: 'cloud-upload-outline', screen: 'StudentImport', color: '#0891b2' },
              { label: 'Student ID Cards', icon: 'card-outline', screen: 'IDCard', color: '#7c3aed' },
              { label: 'Issue Certificates (TC, Bonafide)', icon: 'ribbon-outline', screen: 'IssueCertificates', color: '#7c3aed' },
              { label: 'Student KYC & Documents', icon: 'shield-checkmark-outline', screen: 'StudentDocuments', color: '#0284c7' },
              { label: 'Inquiries & Leads', icon: 'megaphone-outline', screen: 'Leads', color: '#ea580c' },
            ],
          },
          {
            title: 'Daily Attendance',
            icon: 'checkbox-outline',
            color: '#16a34a',
            items: [
              { label: 'Attendance Dashboard', icon: 'stats-chart-outline', screen: 'Attendance', params: { tab: 'overview' }, color: '#16a34a' },
              { label: 'Mark Class Attendance', icon: 'create-outline', screen: 'Attendance', params: { tab: 'mark' }, color: '#0b57d0' },
              { label: 'QR & Fast Scan Check-In', icon: 'qr-code-outline', screen: 'Attendance', params: { tab: 'qr_scan' }, color: '#7c3aed' },
              { label: 'Staff / Teacher Register', icon: 'people-outline', screen: 'StaffAttendance', color: '#ea580c' },
              { label: 'Staff Attendance Analytics', icon: 'bar-chart-outline', screen: 'StaffAttendanceAnalytics', color: '#0891b2' },
              { label: 'Attendance Rules & Geo-fence', icon: 'settings-outline', screen: 'StaffAttendanceSettings', color: '#64748b' },
            ],
          },
          {
            title: 'Academics & Curriculum',
            icon: 'school-outline',
            color: '#0d9488',
            items: [
              { label: 'Classes & Section Setup', icon: 'school-outline', screen: 'Classes', color: '#0d9488' },
              { label: 'Subject Management', icon: 'book-outline', screen: 'Subjects', color: '#0284c7' },
              { label: 'Weekly Timetable Grid', icon: 'calendar-outline', screen: 'Timetable', color: '#7c3aed' },
              { label: 'Teacher Teaching Diary', icon: 'journal-outline', screen: 'TeachingDiary', params: { initialTab: 'diary' }, color: '#059669' },
              { label: 'Syllabus Coverage Tracker', icon: 'pie-chart-outline', screen: 'CurriculumCoverage', params: { initialTab: 'coverage' }, color: '#16a34a' },
              { label: 'Curriculum & Books Setup', icon: 'library-outline', screen: 'Curriculum', params: { initialTab: 'setup' }, color: '#0284c7' },
              { label: 'Faculty & Teachers Directory', icon: 'people-outline', screen: 'Teachers', color: '#4f46e5' },
            ],
          },
          {
            title: 'Academic Resources',
            icon: 'document-text-outline',
            color: '#0891b2',
            items: [
              { label: 'Notes & Study Materials', icon: 'document-text-outline', screen: 'Notes', color: '#0891b2' },
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
            ],
          },
          {
            title: 'Examinations & Evaluation',
            icon: 'calendar-outline',
            color: '#ea580c',
            items: [
              { label: 'Exam Schedules & Datesheets', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Admit Cards (Hall Tickets)', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Marks & Grading Entry', icon: 'pencil-outline', screen: 'Marks', color: '#4338ca' },
              { label: 'Results & RMS Cards', icon: 'ribbon-outline', screen: 'Result', color: '#be185d' },
            ],
          },
          {
            title: 'Student Documents & KYC',
            icon: 'ribbon-outline',
            color: '#dc2626',
            items: [
              { label: 'Issue Certificates (TC/Bonafide)', icon: 'ribbon-outline', screen: 'IssueCertificates', color: '#dc2626' },
              { label: 'Student Documents & KYC', icon: 'document-text-outline', screen: 'StudentDocuments', color: '#0284c7' },
            ],
          },
          {
            title: 'Staff & HRMS',
            icon: 'people-outline',
            color: '#be123c',
            items: [
              { label: 'Employee Directory', icon: 'people-outline', screen: 'Employees', color: '#be123c' },
              { label: 'GPS Staff Attendance', icon: 'finger-print-outline', screen: 'StaffAttendance', color: '#0284c7' },
              { label: 'Attendance Analytics', icon: 'bar-chart-outline', screen: 'AttendanceAnalytics', color: '#16a34a' },
              { label: 'Attendance Settings & Geo-Fence', icon: 'settings-outline', screen: 'AttendanceSettings', color: '#64748b' },
              { label: 'Leaves & Official Duty', icon: 'calendar-outline', screen: 'Leaves', color: '#ea580c' },
              { label: 'Payroll & Salary Slips', icon: 'cash-outline', screen: 'Payroll', color: '#15803d' },
            ],
          },
          {
            title: 'Staff Delegation',
            icon: 'swap-horizontal-outline',
            color: '#4338ca',
            items: [
              { label: 'Assign Substitute & Delegations', icon: 'swap-horizontal-outline', screen: 'Delegations', color: '#4338ca' },
            ],
          },
          {
            title: 'Finance & Central Accounts',
            icon: 'trending-up-outline',
            color: '#16a34a',
            items: [
              { label: 'Finance Command Center', icon: 'trending-up-outline', screen: 'FinanceHub', color: '#0369a1' },
              { label: 'Fees Dashboard', icon: 'trending-up-outline', screen: 'Fees', color: '#16a34a' },
              { label: 'Fee Bills & Demands', icon: 'document-text-outline', screen: 'FeeBills', color: '#0b57d0' },
              { label: 'Collect Payment (POS)', icon: 'card-outline', screen: 'FeeCollect', color: '#0284c7' },
              { label: 'Payment Receipts Log', icon: 'receipt-outline', screen: 'Receipts', color: '#059669' },
              { label: 'Generate Monthly Fees', icon: 'calculator-outline', screen: 'FeeGeneration', color: '#d97706' },
              { label: 'Fee Setup & Plans', icon: 'settings-outline', screen: 'FeeSetup', color: '#7c3aed' },
              { label: 'Outstanding Student Dues', icon: 'alert-circle-outline', screen: 'FeeRecords', color: '#ea580c' },
              { label: 'Operating Expenses', icon: 'wallet-outline', screen: 'Expenses', color: '#dc2626' },
              { label: 'Purchase Orders & GRN', icon: 'cart-outline', screen: 'Purchases', color: '#7c3aed' },
              { label: 'Vendor Directory', icon: 'business-outline', screen: 'Vendors', color: '#ea580c' },
              { label: 'Inventory & Stock', icon: 'cube-outline', screen: 'Inventory', color: '#4338ca' },
              { label: 'Fixed Assets Register', icon: 'hardware-chip-outline', screen: 'Assets', color: '#7c3aed' },
            ],
          },
          {
            title: 'Transport Management',
            icon: 'bus-outline',
            color: '#2563eb',
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
            icon: 'bed-outline',
            color: '#4338ca',
            items: [
              { label: 'Room & Bed Map', icon: 'business-outline', screen: 'RoomMap', color: '#3b82f6' },
              { label: 'Hostel Admissions & Allotment', icon: 'person-add-outline', screen: 'HostelAdmission', color: '#4338ca' },
              { label: 'Transfers & Vacate Clearance', icon: 'swap-horizontal-outline', screen: 'HostelTransfers', color: '#6366f1' },
              { label: 'Monthly Hostel Fees', icon: 'receipt-outline', screen: 'HostelFees', color: '#15803d' },
              { label: 'Hostel Fines & Penalties', icon: 'alert-circle-outline', screen: 'HostelFines', color: '#dc2626' },
              { label: 'Night Roll Call Attendance', icon: 'bed-outline', screen: 'RollCall', color: '#0284c7' },
              { label: 'Gate Out-Passes', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Visitor Gate Pass', icon: 'shield-checkmark-outline', screen: 'Visitors', color: '#059669' },
              { label: 'Room Maintenance & Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
            ],
          },
          {
            title: 'Library Automation',
            icon: 'library-outline',
            color: '#0891b2',
            items: [
              { label: 'Book Master Catalog', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Issue & Return Desk', icon: 'swap-horizontal-outline', screen: 'IssueReturn', color: '#0284c7' },
              { label: 'Library Members & Cards', icon: 'card-outline', screen: 'Members', color: '#0d9488' },
              { label: 'Book Hold & Reservations', icon: 'bookmark-outline', screen: 'Reservations', color: '#7c3aed' },
              { label: 'Overdue Fines & Dues', icon: 'cash-outline', screen: 'Fines', color: '#d97706' },
            ],
          },
          {
            title: 'Communication & Notices',
            icon: 'chatbubbles-outline',
            color: '#ea580c',
            items: [
              { label: 'Announcements & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
              { label: 'Messages & Direct Chat', icon: 'chatbubbles-outline', screen: 'Messages', color: '#0284c7' },
            ],
          },
          {
            title: 'Audit Logs & Security',
            icon: 'shield-checkmark-outline',
            color: '#dc2626',
            items: [
              { label: 'Audit Command Center & Logs', icon: 'shield-checkmark-outline', screen: 'AuditLogs', color: '#dc2626' },
              { label: 'Roles & Permissions', icon: 'key-outline', screen: 'Roles', color: '#4338ca' },
            ],
          },
          {
            title: 'ERP Support & Settings',
            icon: 'settings-outline',
            color: '#64748b',
            items: [
              { label: 'WhatsApp Gateway', icon: 'logo-whatsapp', screen: 'WhatsApp', color: '#16a34a' },
              { label: 'Virtual Meetings & PTM', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
              { label: 'Support & Help Desk', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'School Settings & Profile', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'TEACHER':
        return [
          {
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#0176d3',
            items: [
              { label: 'Teacher Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0176d3' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'Daily Attendance Service',
            icon: 'checkbox-outline',
            color: '#16a34a',
            items: [
              { label: 'Class Attendance Dashboard', icon: 'stats-chart-outline', screen: 'Attendance', params: { tab: 'overview' }, color: '#16a34a' },
              { label: 'Mark Daily Attendance', icon: 'create-outline', screen: 'Attendance', params: { tab: 'mark' }, color: '#0b57d0' },
              { label: 'QR & Fast Scan Check-In', icon: 'qr-code-outline', screen: 'Attendance', params: { tab: 'qr_scan' }, color: '#7c3aed' },
              { label: 'My Punch & Staff Attendance', icon: 'person-circle-outline', screen: 'StaffAttendance', color: '#ea580c' },
            ],
          },
          {
            title: 'Academics & Teaching Service',
            icon: 'school-outline',
            color: '#0d9488',
            items: [
              { label: "Today's Teaching Diary", icon: 'journal-outline', screen: 'TeachingDiary', params: { initialTab: 'diary' }, color: '#059669' },
              { label: 'Syllabus Coverage Tracker', icon: 'pie-chart-outline', screen: 'CurriculumCoverage', params: { initialTab: 'coverage' }, color: '#16a34a' },
              { label: 'Curriculum & Books Setup', icon: 'library-outline', screen: 'Curriculum', params: { initialTab: 'setup' }, color: '#0284c7' },
              { label: 'Weekly Timetable Grid', icon: 'calendar-outline', screen: 'Timetable', color: '#7c3aed' },
              { label: 'Assigned Classes', icon: 'school-outline', screen: 'Classes', color: '#0d9488' },
              { label: 'Curriculum Subjects', icon: 'book-outline', screen: 'Subjects', color: '#0284c7' },
            ],
          },
          {
            title: 'Academic Resources Service',
            icon: 'document-text-outline',
            color: '#6366f1',
            items: [
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Study Notes Upload', icon: 'document-text-outline', screen: 'Notes', color: '#0284c7' },
            ],
          },
          {
            title: 'Examinations & Evaluation',
            icon: 'calendar-outline',
            color: '#4338ca',
            items: [
              { label: 'Exam Schedules & Datesheets', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Exam Marks Entry', icon: 'pencil-outline', screen: 'Marks', color: '#4338ca' },
              { label: 'Admit Cards (Hall Tickets)', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Results & RMS Cards', icon: 'ribbon-outline', screen: 'Result', color: '#be185d' },
            ],
          },
          {
            title: 'Student Lifecycle & Documents',
            icon: 'people-outline',
            color: '#2563eb',
            items: [
              { label: 'My Students Directory', icon: 'people-outline', screen: 'Students', color: '#2563eb' },
              { label: 'Student Documents & KYC', icon: 'document-text-outline', screen: 'StudentDocuments', color: '#0284c7' },
              { label: 'Issue Certificates', icon: 'ribbon-outline', screen: 'IssueCertificates', color: '#dc2626' },
            ],
          },
          {
            title: 'Staff HRMS & Self-Service',
            icon: 'finger-print-outline',
            color: '#0284c7',
            items: [
              { label: 'My GPS Punch Attendance', icon: 'finger-print-outline', screen: 'StaffAttendance', color: '#0284c7' },
              { label: 'Leave Applications', icon: 'calendar-outline', screen: 'Leaves', color: '#ea580c' },
              { label: 'My Salary Payslips', icon: 'cash-outline', screen: 'Payroll', color: '#16a34a' },
              { label: 'Substitute Duties', icon: 'swap-horizontal-outline', screen: 'Delegations', color: '#0369a1' },
            ],
          },
          {
            title: 'Library Automation',
            icon: 'library-outline',
            color: '#0891b2',
            items: [
              { label: 'Book Master Catalog', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Issue & Return Desk', icon: 'swap-horizontal-outline', screen: 'IssueReturn', color: '#0284c7' },
              { label: 'Book Hold & Reservations', icon: 'bookmark-outline', screen: 'Reservations', color: '#7c3aed' },
            ],
          },
          {
            title: 'Communication & Support',
            icon: 'headset-outline',
            color: '#059669',
            items: [
              { label: 'PTM & Conferences', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
              { label: 'Support & Tickets', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'STUDENT':
        return [
          {
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#7c3aed',
            items: [
              { label: 'Student Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#7c3aed' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#0b57d0', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: 'My Academics & Timetable',
            icon: 'school-outline',
            color: '#0b57d0',
            items: [
              { label: 'Weekly Timetable', icon: 'calendar-outline', screen: 'Timetable', color: '#7c3aed' },
              { label: 'Teaching Diary & Topics', icon: 'journal-outline', screen: 'Curriculum', color: '#059669' },
              { label: 'Homework & Assignments', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Study Notes & PDFs', icon: 'document-text-outline', screen: 'Notes', color: '#0284c7' },
              { label: 'My Attendance Registry', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
            ],
          },
          {
            title: 'Examinations & Results',
            icon: 'card-outline',
            color: '#ea580c',
            items: [
              { label: 'Exam Schedule & Datesheet', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Exam Admit Card', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Exam Report Card & RMS', icon: 'ribbon-outline', screen: 'Result', color: '#7c3aed' },
            ],
          },
          {
            title: 'Finance & Fees',
            icon: 'receipt-outline',
            color: '#d97706',
            items: [
              { label: 'Fee Dues & Receipts', icon: 'receipt-outline', screen: 'Fees', color: '#d97706' },
            ],
          },
          {
            title: 'Campus Services',
            icon: 'bus-outline',
            color: '#0891b2',
            items: [
              { label: 'Library Books & Catalog', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Transport Live Bus Tracking', icon: 'bus-outline', screen: 'Transport', color: '#ea580c' },
              { label: 'Hostel Out-Pass', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Room & Campus Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
            ],
          },
          {
            title: 'Support & Profile',
            icon: 'person-outline',
            color: '#2563eb',
            items: [
              { label: 'My Documents & Certificates', icon: 'document-attach-outline', screen: 'StudentDocuments', color: '#7c3aed' },
              { label: 'Support & Grievances', icon: 'headset-outline', screen: 'Support', color: '#059669' },
              { label: 'My Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'PARENT':
        return [
          {
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#7c3aed',
            items: [
              { label: 'Child Dashboard', icon: 'grid-outline', screen: 'My Child', color: '#7c3aed' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#0b57d0', badge: 'AI' },
              { label: 'Notice Board & Circulars', icon: 'megaphone-outline', screen: 'NoticeBoard', color: '#ea580c' },
            ],
          },
          {
            title: "Child's Academics",
            icon: 'school-outline',
            color: '#0284c7',
            items: [
              { label: 'Weekly Timetable', icon: 'calendar-outline', screen: 'Timetable', color: '#7c3aed' },
              { label: 'Homework & Tasks', icon: 'clipboard-outline', screen: 'Assignments', color: '#6366f1' },
              { label: 'Study Materials & Notes', icon: 'document-text-outline', screen: 'Notes', color: '#0284c7' },
              { label: 'Attendance Records', icon: 'clipboard-outline', screen: 'Attendance', color: '#16a34a' },
              { label: 'Child Documents & Certificates', icon: 'document-attach-outline', screen: 'StudentDocuments', color: '#7c3aed' },
            ],
          },
          {
            title: 'Examinations & Performance',
            icon: 'card-outline',
            color: '#ea580c',
            items: [
              { label: 'Exam Datesheets', icon: 'calendar-outline', screen: 'Examinations', color: '#ea580c' },
              { label: 'Child Admit Card', icon: 'card-outline', screen: 'AdmitCard', color: '#059669' },
              { label: 'Report Card & Marks', icon: 'ribbon-outline', screen: 'Result', color: '#7c3aed' },
            ],
          },
          {
            title: 'Fee Management',
            icon: 'receipt-outline',
            color: '#d97706',
            items: [
              { label: 'Fee Dues & Payment Receipts', icon: 'receipt-outline', screen: 'Fees', color: '#d97706' },
            ],
          },
          {
            title: 'Campus & Transport',
            icon: 'bus-outline',
            color: '#0891b2',
            items: [
              { label: 'Live Bus Tracking', icon: 'bus-outline', screen: 'Transport', color: '#ea580c' },
              { label: 'Library Books & Dues', icon: 'library-outline', screen: 'Books', color: '#0891b2' },
              { label: 'Hostel Out-Pass', icon: 'exit-outline', screen: 'OutPass', color: '#10b981' },
              { label: 'Hostel Complaints', icon: 'construct-outline', screen: 'Complaints', color: '#f59e0b' },
            ],
          },
          {
            title: 'Communication & Support',
            icon: 'headset-outline',
            color: '#059669',
            items: [
              { label: 'PTM & Virtual Meetings', icon: 'videocam-outline', screen: 'Meetings', color: '#0284c7' },
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
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#4338ca',
            items: [
              { label: 'Hostel Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#4338ca' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Hostel Management Service',
            icon: 'bed-outline',
            color: '#4338ca',
            items: [
              { label: 'Hostel Admissions & Allotment', icon: 'person-add-outline', screen: 'HostelAdmission', color: '#4338ca' },
              { label: 'Transfers & Vacate Clearance', icon: 'swap-horizontal-outline', screen: 'HostelTransfers', color: '#6366f1' },
              { label: 'Room & Bed Map', icon: 'bed-outline', screen: 'RoomMap', color: '#3b82f6' },
              { label: 'Monthly Hostel Fees', icon: 'receipt-outline', screen: 'HostelFees', color: '#15803d' },
              { label: 'Hostel Fines & Penalties', icon: 'alert-circle-outline', screen: 'HostelFines', color: '#dc2626' },
              { label: 'Night Roll Call Attendance', icon: 'clipboard-outline', screen: 'RollCall', color: '#0284c7' },
              { label: 'Gate Out-Passes', icon: 'exit-outline', screen: 'OutPass', color: '#16a34a' },
              { label: 'Visitor Gate Pass', icon: 'shield-checkmark-outline', screen: 'Visitors', color: '#059669' },
              { label: 'Maintenance & Grievances', icon: 'construct-outline', screen: 'Complaints', color: '#ea580c' },
            ],
          },
          {
            title: 'Account & Settings',
            icon: 'person-outline',
            color: '#2563eb',
            items: [
              { label: 'My Profile', icon: 'person-outline', screen: 'Profile', color: '#2563eb' },
              { label: 'Account Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];

      case 'LIBRARIAN':
        return [
          {
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#0891b2',
            items: [
              { label: 'Library Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0891b2' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Library Operations Service',
            icon: 'library-outline',
            color: '#0891b2',
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
            icon: 'person-outline',
            color: '#2563eb',
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
            title: 'Overview & AI',
            icon: 'grid-outline',
            color: '#0176d3',
            items: [
              { label: 'Platform Dashboard', icon: 'grid-outline', screen: 'Dashboard', color: '#0176d3' },
              { label: 'ERP Copilot (AI)', icon: 'sparkles', screen: 'AIChat', color: '#7c3aed', badge: 'AI' },
            ],
          },
          {
            title: 'Platform Administration Service',
            icon: 'school-outline',
            color: '#0284c7',
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
              { label: 'Inventory & Stock', icon: 'cube-outline', screen: 'Inventory', color: '#4338ca' },
              { label: 'Fixed Assets Register', icon: 'hardware-chip-outline', screen: 'Assets', color: '#7c3aed' },
              { label: 'Security & Settings', icon: 'settings-outline', screen: 'Settings', color: '#64748b' },
            ],
          },
        ];
    }
  }, [role]);

  // Filtered menu groups based on search
  const filteredMenuGroups = useMemo(() => {
    if (!searchQuery.trim()) return menuGroups;
    const q = searchQuery.toLowerCase();
    return menuGroups
      .map(group => {
        const matchesGroup = group.title.toLowerCase().includes(q);
        const filteredItems = group.items.filter(item =>
          item.label.toLowerCase().includes(q) || (item.screen && item.screen.toLowerCase().includes(q))
        );
        if (matchesGroup) return group;
        if (filteredItems.length > 0) {
          return { ...group, items: filteredItems };
        }
        return null;
      })
      .filter(Boolean);
  }, [menuGroups, searchQuery]);

  const handleNavigate = (screen, params) => {
    onClose();
    if (screen && navigation?.navigate) {
      if (params) {
        navigation.navigate(screen, params);
      } else {
        navigation.navigate(screen);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your institutional session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            if (logout) await logout();
          },
        },
      ]
    );
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
            <Text style={styles.avatarInitial}>{userName.charAt(0).toUpperCase()}</Text>
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

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search ERP services & submodules..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Servicewise Accordion Menu */}
        <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
          {filteredMenuGroups.map((group, gIdx) => {
            const isExpanded = searchQuery.trim().length > 0 || expandedSections[group.title] !== false;
            return (
              <View key={gIdx} style={styles.groupContainer}>
                {/* Servicewise Section Header (Accordion) */}
                <TouchableOpacity
                  style={styles.groupHeaderRow}
                  onPress={() => toggleSection(group.title)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name={group.icon || 'folder-outline'} size={16} color={group.color || '#64748b'} />
                    <Text style={styles.groupTitle}>{group.title}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{group.items.length}</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color="#94a3b8"
                    />
                  </View>
                </TouchableOpacity>

                {/* Submodule Items */}
                {isExpanded && (
                  <View style={styles.itemsWrapper}>
                    {group.items.map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        style={styles.menuRow}
                        onPress={() => handleNavigate(item.screen, item.params)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                          <Ionicons name={item.icon} size={18} color={item.color} />
                        </View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        {item.badge && (
                          <View style={styles.badgePill}>
                            <Text style={styles.badgePillText}>{item.badge}</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Bottom Theme Toggle & Logout */}
        <View style={styles.footer}>
          <View style={styles.themeRow}>
            <Ionicons name="sunny-outline" size={16} color={colors.muted} style={{ marginRight: 4 }} />
            <Text style={styles.themeLabel}>Light</Text>
            <Switch
              value={isDarkMode}
              onValueChange={setIsDarkMode}
              trackColor={{ false: '#cbd5e1', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0b57d0',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
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
    color: '#64748b',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  groupContainer: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  itemsWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  badgePill: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  badgePillText: {
    fontSize: 9,
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
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
