import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolveMenuRole } from '../utils/roleEquivalence';
import { PERMISSION_MENU_ITEMS } from '../utils/permissionMenuMap';

const ROLE_MENUS = {
  SUPER_ADMIN: [
    {
      group: 'Overview',
      items: [
        { icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' },
      ],
    },
    {
      group: 'Management',
      items: [
        { icon: 'ti-building-school', label: 'Schools', path: '/schools' },
        { icon: 'ti-users', label: 'Users', path: '/users' },
      ],
    },
    {
      group: 'Access Control',
      items: [
        {
          icon: 'ti-users', label: 'Role Management', path: '/rbac/roles',
          children: [
            { icon: 'ti-users', label: 'Roles & Hierarchy', path: '/rbac/roles' },
            { icon: 'ti-grid',  label: 'Permission Matrix', path: '/rbac/permissions' },
            
            { icon: 'ti-switch-horizontal', label: 'Delegations', path: '/rbac/delegations' },
          ],
        },
        { icon: 'ti-history', label: 'Audit Logs', path: '/audit/company/logs' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        {
          icon: 'ti-headset', label: 'Support Dashboard', path: '/developer/support',
          children: [
            { icon: 'ti-layout-dashboard', label: 'All Tickets',    path: '/developer/support' },
            { icon: 'ti-ticket',           label: 'Support Inbox',  path: '/support/tickets' },
            { icon: 'ti-video',            label: 'Meetings',       path: '/support/meetings' },
            { icon: 'ti-speakerphone',     label: 'Announcements',  path: '/support/announcements' },
            { icon: 'ti-books',            label: 'Knowledge Base', path: '/support/kb' },
          ],
        },
        { icon: 'ti-user-plus', label: 'Demo Requests & Messages', path: '/developer/leads' },
      ],
    },
     
    {
      group: 'Developer Tools',
      items: [
        { icon: 'ti-bug',              label: 'Error Center',   path: '/developer/errors' },
        { icon: 'ti-list-check',       label: 'Issue Board',    path: '/developer/issues' },
        { icon: 'ti-activity-heartbeat', label: 'System Health', path: '/developer/system-health' },
      ],
    },
  ],

  PRINCIPAL: [
    {
      group: '',
      items: [
        { icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' },

        {
          icon: 'ti-address-book', label: 'Student Management', path: '/students',
          children: [
            { icon: 'ti-user-plus',      label: 'Admissions',            path: '/admission' },
            { icon: 'ti-address-book',   label: 'Students',              path: '/students' },
            { icon: 'ti-edit',           label: 'Students Bulk Edit',    path: '/students/bulk-edit' },
            { icon: 'ti-arrows-shuffle', label: 'Section Shuffle',       path: '/students/section-shuffle' },
            { icon: 'ti-id-badge',       label: 'ID Cards',              path: '/id-cards' },
            { icon: 'ti-certificate',    label: 'Transfer Certificates', path: '/students/transfer-cert' },
          ],
        },

        { icon: 'ti-clipboard-check', label: 'Attendance', path: '/attendance' },

        {
          icon: 'ti-books', label: 'Academics', path: '/classes',
          children: [
            { icon: 'ti-list',          label: 'Classes & Sections', path: '/classes' },
            { icon: 'ti-bookmark',      label: 'Subject Management', path: '/subjects' },
            { icon: 'ti-calendar-time', label: 'Timetable',          path: '/timetable' },
          ],
        },

        {
          icon: 'ti-pencil', label: 'Examinations', path: '/exams',
          children: [
            { icon: 'ti-pencil',           label: 'Exam Schedule',      path: '/exams' },
            { icon: 'ti-chart-bar',        label: 'Marks',              path: '/marks' },
            { icon: 'ti-checklist',        label: 'Mark Entry',         path: '/mark-entry' },
            { icon: 'ti-clipboard-check',  label: 'Result Management',  path: '/result-management' },
            { icon: 'ti-ticket',           label: 'Admit Cards',        path: '/admit-card' },
            { icon: 'ti-file-certificate', label: 'Result Cards',       path: '/result-card' },
          ],
        },

        {
          icon: 'ti-receipt', label: 'Fees Management', path: '/fees',
          children: [
            { icon: 'ti-receipt',        label: 'Fees',           path: '/fees' },
            { icon: 'ti-currency-rupee', label: 'Fee Structures', path: '/fees/structures' },
            { icon: 'ti-receipt-2',      label: 'Expenses',       path: '/finance/expenses' },
            { icon: 'ti-boxes',          label: 'Inventory',      path: '/finance/inventory' },
            { icon: 'ti-cash',           label: 'Payroll',        path: '/finance/payroll' },
            { icon: 'ti-building-store', label: 'Vendors',        path: '/finance/vendors' },
          ],
        },

        {
          icon: 'ti-briefcase', label: 'Staff Management', path: '/staff',
          children: [
            { icon: 'ti-chalkboard',      label: 'Teachers',              path: '/teachers' },
            { icon: 'ti-briefcase',       label: 'Staff List',            path: '/staff' },
            { icon: 'ti-clipboard-check', label: 'Staff Attendance',      path: '/staff/attendance' },
            { icon: 'ti-chart-bar',       label: 'Attendance Analytics',  path: '/staff/attendance/analytics' },
            { icon: 'ti-settings',        label: 'Attendance Settings',   path: '/staff/attendance/settings' },
          ],
        },

        {
          icon: 'ti-books', label: 'Library', path: '/library',
          children: [
            { icon: 'ti-layout-dashboard', label: 'Dashboard',      path: '/library' },
            { icon: 'ti-books',            label: 'Book Master',    path: '/library/books' },
            { icon: 'ti-arrows-exchange',  label: 'Issue / Return', path: '/library/issue-return' },
            { icon: 'ti-clock',            label: 'Reservations',   path: '/library/reservations' },
            { icon: 'ti-users',            label: 'Members',        path: '/library/members' },
            { icon: 'ti-currency-rupee',   label: 'Fines & Dues',   path: '/library/fines' },
            { icon: 'ti-report',           label: 'Reports',        path: '/library/reports' },
          ],
        },

        {
          icon: 'ti-bed', label: 'Hostel', path: '/hostel',
          children: [
            { icon: 'ti-layout-dashboard', label: 'Dashboard',          path: '/hostel' },
            { icon: 'ti-layout-grid',      label: 'Room Map & Beds',    path: '/hostel/room-map' },
            { icon: 'ti-user-plus',        label: 'Admissions',         path: '/hostel/admission' },
            { icon: 'ti-arrows-exchange',  label: 'Transfers & Vacate', path: '/hostel/transfers' },
            { icon: 'ti-receipt-2',        label: 'Monthly Fees',       path: '/hostel/fees' },
            { icon: 'ti-currency-rupee',   label: 'Fee Structures',     path: '/hostel/fee-structures' },
            { icon: 'ti-alert-triangle',   label: 'Fines & Waivers',    path: '/hostel/fines' },
            { icon: 'ti-clipboard-check',  label: 'Night Roll Call',    path: '/hostel/attendance' },
            { icon: 'ti-ticket',           label: 'Gate Pass / Out',    path: '/hostel/out-pass' },
            { icon: 'ti-tool',             label: 'Room Complaints',    path: '/hostel/complaints' },
            { icon: 'ti-users',            label: 'Visitor Log',        path: '/hostel/visitors' },
            { icon: 'ti-box',              label: 'Room Assets',        path: '/hostel/inventory' },
            { icon: 'ti-settings',         label: 'Hostel Setup',       path: '/hostel/setup' },
            { icon: 'ti-report',           label: 'Reports',            path: '/hostel/reports' },
          ],
        },

        {
          icon: 'ti-bus', label: 'Transport', path: '/transport',
          children: [
            { icon: 'ti-layout-dashboard', label: 'Dashboard',              path: '/transport' },
            { icon: 'ti-history',          label: 'Student Travel History', path: '/transport/travel-history' },
            { icon: 'ti-bus',              label: 'Vehicles & Fleet',       path: '/transport/vehicles' },
            { icon: 'ti-steering-wheel',   label: 'Drivers',                path: '/transport/drivers' },
            { icon: 'ti-user-check',       label: 'Conductors',             path: '/transport/conductors' },
            { icon: 'ti-route',            label: 'Routes',                 path: '/transport/routes' },
            { icon: 'ti-map-pin',          label: 'Stops',                  path: '/transport/stops' },
            { icon: 'ti-users',            label: 'Student Roster',         path: '/transport/students' },
            { icon: 'ti-currency-rupee',   label: 'Fees & Fines',           path: '/transport/fees' },
            { icon: 'ti-tool',             label: 'Maintenance',            path: '/transport/maintenance' },
            { icon: 'ti-map-pin-filled',   label: 'Live Tracking',          path: '/transport/live' },
            { icon: 'ti-report',           label: 'Reports',                path: '/transport/reports' },
          ],
        },

        {
          icon: 'ti-speakerphone', label: 'Communication', path: '/announcements',
          children: [
            { icon: 'ti-speakerphone', label: 'Announcements & Circulars', path: '/announcements' },
            { icon: 'ti-message-2',    label: 'Messages',                   path: '/messages' },
          ],
        },

        {
          icon: 'ti-headset', label: 'ERP Support', path: '/support/tickets',
          children: [
            { icon: 'ti-ticket',       label: 'Support Tickets',      path: '/support/tickets' },
            { icon: 'ti-plus',         label: 'New Support Ticket',   path: '/support/tickets/new' },
            { icon: 'ti-video',        label: 'Book Support Meeting', path: '/support/meetings' },
            { icon: 'ti-help-circle',  label: 'Help Center',          path: '/help-center' },
          ],
        },

        {
          icon: 'ti-books', label: 'Academic Resources', path: '/notes',
          children: [
            { icon: 'ti-books',          label: 'Notes & Study Material', path: '/notes' },
            { icon: 'ti-clipboard-list', label: 'Assignments',            path: '/assignments' },
            { icon: 'ti-chart-dots',     label: 'Internal Marks',         path: '/internal-marks' },
          ],
        },

        {
          icon: 'ti-file-certificate', label: 'Student Documents', path: '/documents',
          children: [
            { icon: 'ti-award',        label: 'Issue Certificates', path: '/issue-documents' },
            { icon: 'ti-file-text',    label: 'Student Documents & KYC', path: '/documents' },
          ],
        },

        {
          icon: 'ti-chart-bar', label: 'Reports & Analytics', path: '/library/reports',
          children: [
            { icon: 'ti-report', label: 'Library Reports', path: '/library/reports' },
            { icon: 'ti-report', label: 'Hostel Reports',  path: '/hostel/reports' },
          ],
        },

        {
          icon: 'ti-settings', label: 'Settings', path: '/school-settings',
          children: [
            { icon: 'ti-bolt',              label: 'My Plan & Services',   path: '/my-services' },
            { icon: 'ti-settings',          label: 'School Settings',      path: '/school-settings' },
            { icon: 'ti-brand-whatsapp',    label: 'WhatsApp Integration', path: '/settings/whatsapp' },
            { icon: 'ti-users',             label: 'Roles & Hierarchy',    path: '/rbac/roles' },
            { icon: 'ti-grid',              label: 'Permission Matrix',    path: '/rbac/permissions' },
            { icon: 'ti-switch-horizontal', label: 'Delegations',          path: '/rbac/delegations' },
            { icon: 'ti-user-check',        label: 'Staff Permissions',    path: '/rbac/staff-access' },
            { icon: 'ti-history',           label: 'Audit Logs',           path: '/audit/school/logs' },
          ],
        },
      ],
    },
  ],

  TEACHER: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
    {
      group: 'Academics',
      items: [
        { icon: 'ti-books',          label: 'Notes & Materials', path: '/notes' },
        { icon: 'ti-clipboard-list', label: 'Assignments',       path: '/assignments' },
        { icon: 'ti-chart-dots',     label: 'Internal Marks',    path: '/internal-marks' },
        { icon: 'ti-calendar-time',  label: 'Timetable',         path: '/timetable' },
      ],
    },
    {
      group: 'My Work',
      items: [
        { icon: 'ti-clipboard-check', label: 'Attendance',         path: '/attendance' },
        { icon: 'ti-pencil',          label: 'Exam Marks Entry',   path: '/marks' },
        { icon: 'ti-checklist',       label: 'Result Submission',  path: '/mark-entry' },
        { icon: 'ti-award',           label: 'Issue Certificates', path: '/issue-documents' },
        { icon: 'ti-file-text',        label: 'Student KYC Docs',   path: '/documents' },
        { icon: 'ti-user-graduate',   label: 'My Students',        path: '/students' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-speakerphone', label: 'Announcements', path: '/support/announcements' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],

  LIBRARIAN: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/library' }],
    },
    {
      group: 'Library Management',
      items: [
        { icon: 'ti-books',           label: 'Book Master',    path: '/library/books' },
        { icon: 'ti-arrows-exchange', label: 'Issue / Return',  path: '/library/issue-return' },
        { icon: 'ti-clock',           label: 'Reservations',    path: '/library/reservations' },
        { icon: 'ti-users',           label: 'Members',         path: '/library/members' },
        { icon: 'ti-currency-rupee',  label: 'Fines & Dues',    path: '/library/fines' },
        { icon: 'ti-report',          label: 'Reports',         path: '/library/reports' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],

  ACCOUNTANT: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/finance/expenses' }],
    },
    {
      group: 'Finance',
      items: [
        { icon: 'ti-receipt',        label: 'Fees',       path: '/fees' },
        { icon: 'ti-receipt-2',      label: 'Expenses',   path: '/finance/expenses' },
        { icon: 'ti-boxes',          label: 'Inventory',  path: '/finance/inventory' },
        { icon: 'ti-cash',           label: 'Payroll',    path: '/finance/payroll' },
        { icon: 'ti-building-store', label: 'Vendors',    path: '/finance/vendors' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',      label: 'My Tickets', path: '/support/tickets' },
        { icon: 'ti-message-2',   label: 'Messages',   path: '/support/chat' },
        { icon: 'ti-help-circle', label: 'Help Center',path: '/support/help' },
      ],
    },
  ],

  HOSTEL: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/hostel' }],
    },
    {
      group: 'Hostel Management',
      items: [
        { icon: 'ti-layout-grid',      label: 'Room Map',         path: '/hostel/room-map' },
        { icon: 'ti-currency-rupee',   label: 'Fee Structures',   path: '/hostel/fee-structures' },
        { icon: 'ti-user-plus',        label: 'Admission',        path: '/hostel/admission' },
        { icon: 'ti-arrows-exchange',  label: 'Transfer / Vacate',path: '/hostel/transfers' },
        { icon: 'ti-report',           label: 'Reports',          path: '/hostel/reports' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],

  TRANSPORT: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/transport' }],
    },
    {
      group: 'Transport Management',
      items: [
        { icon: 'ti-history',          label: 'Student Travel History', path: '/transport/travel-history' },
        { icon: 'ti-bus',              label: 'Vehicles & Fleet', path: '/transport/vehicles' },
        { icon: 'ti-steering-wheel',   label: 'Drivers',          path: '/transport/drivers' },
        { icon: 'ti-user-check',       label: 'Conductors',       path: '/transport/conductors' },
        { icon: 'ti-route',            label: 'Routes',           path: '/transport/routes' },
        { icon: 'ti-map-pin',          label: 'Stops',            path: '/transport/stops' },
        { icon: 'ti-users',            label: 'Student Roster',   path: '/transport/students' },
        { icon: 'ti-currency-rupee',   label: 'Fees & Fines',     path: '/transport/fees' },
        { icon: 'ti-tool',             label: 'Maintenance',      path: '/transport/maintenance' },
        { icon: 'ti-map-pin-filled',   label: 'Live Tracking',    path: '/transport/live' },
        { icon: 'ti-report',           label: 'Reports',          path: '/transport/reports' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],

  DRIVER: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-truck', label: 'My Cockpit & Trip', path: '/driver/app' }],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],

  STUDENT: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
    {
      group: 'My School',
      items: [
        { icon: 'ti-books',           label: 'Notes & Materials', path: '/notes' },
        { icon: 'ti-clipboard-list',  label: 'Assignments',       path: '/assignments' },
        { icon: 'ti-chart-dots',      label: 'Internal Marks',    path: '/internal-marks' },
        { icon: 'ti-calendar-time',   label: 'Timetable',         path: '/timetable' },
        { icon: 'ti-clipboard-check', label: 'Attendance',        path: '/attendance' },
        { icon: 'ti-file-certificate',label: 'Result Card',       path: '/result-card' },
        { icon: 'ti-receipt',         label: 'Fees',              path: '/fees' },
        { icon: 'ti-bus',             label: 'My Transport',      path: '/transport/parent' },
        { icon: 'ti-file-text',       label: 'Documents',         path: '/documents' },
        { icon: 'ti-book',            label: 'Library',           path: '/library/books' },
        { icon: 'ti-ticket',          label: 'Admit Card',        path: '/admit-card' },
      ],
    },

    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',      label: 'Support',     path: '/support/tickets' },
        { icon: 'ti-message-2',   label: 'Messages',    path: '/support/chat' },
        { icon: 'ti-help-circle', label: 'Help Center', path: '/support/help' },
      ],
    },
  ],

  PARENT: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
    {
      group: 'My Child',
      items: [
        { icon: 'ti-clipboard-check', label: 'Attendance',   path: '/attendance' },
        { icon: 'ti-file-certificate',label: 'Report Card',  path: '/result-card' },
        { icon: 'ti-receipt',         label: 'Fees',         path: '/fees' },
        { icon: 'ti-bus',             label: 'Bus Tracking', path: '/transport/parent' },
        { icon: 'ti-file-text',       label: 'Documents',    path: '/documents' },
      ],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',      label: 'Support',     path: '/support/tickets' },
        { icon: 'ti-message-2',   label: 'Messages',    path: '/support/chat' },
        { icon: 'ti-help-circle', label: 'Help Center', path: '/support/help' },
      ],
    },
  ],

  // Base menu for a real (non-admin) COMPANY-side employee -- Manager,
  // Software Engineer, QA, Sales, HR, Intern, etc. Previously these users
  // had NO entry here at all, so Sidebar fell back to ROLE_MENUS.SUPER_ADMIN
  // for every one of them (see the legacy-role bug this fixes below) --
  // every employee got the CEO's full Schools/Users/RBAC/Audit sidebar.
  // "My Assigned Issues" is always here (any company employee can have an
  // error assigned to them); "Developer Tools" only appears once
  // 'developer.manage' is actually granted (buildDynamicGroups below).
  EMPLOYEE: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
    {
      group: 'My Work',
      items: [{ icon: 'ti-bug', label: 'My Assigned Issues', path: '/developer/errors' }],
    },
    {
      group: 'Customer Service',
      items: [
        { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
        { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
        { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
      ],
    },
  ],
};

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin', PRINCIPAL: 'Principal', DIRECTOR: 'Director', VICE_PRINCIPAL: 'Vice Principal',
  TEACHER: 'Teacher', ACCOUNTANT: 'Accountant', RECEPTIONIST: 'Receptionist',
  LIBRARIAN: 'Librarian', HOSTEL: 'Warden', STUDENT: 'Student', PARENT: 'Parent',
  TRANSPORT: 'Transport Head', DRIVER: 'Driver',
};

// ═══════════════════════════════════════════════════════════════════════════
//  DYNAMIC PERMISSION-DRIVEN MENU ITEMS  (the actual bug fix)
// ═══════════════════════════════════════════════════════════════════════════
// Purani problem: ROLE_MENUS[user.role] hamesha ek FIXED, hardcoded list
// tha. Principal ne Staff Access page se kisi Teacher/Warden ko baad me
// extra permission (UserPermissionOverride, e.g. 'fees.collect') diya bhi
// to sidebar kabhi nahi badalta tha, kyunki neeche wala `groups` sirf
// `user.role` string dekh raha tha -- `user.permissions` (jo /auth/me se
// fresh aata hai, see auth.py _serialize_user) ko kabhi use hi nahi kiya
// ja raha tha.
//
// PERMISSION_MENU_ITEMS ab yaha define nahi hota -- utils/permissionMenuMap.js
// se import hota hai. Wahi file ROUTE_PERMISSIONS bhi export karti hai jo
// ProtectedRoute (App.jsx) use karta hai, taaki "sidebar me item dikhna"
// aur "us route par actually jaane dena" hamesha ek hi mapping se decide
// ho -- dono kabhi ek-dusre se out-of-sync na ho paayein (yahi wo bug tha
// jahan permission grant karne par item dikhta tha par click karne par
// /dashboard par wapas redirect ho jaata tha).

/**
 * Role ke static base menu ko user ke ACTUAL resolved permissions
 * (role-default + per-user override, dono already merged in user.permissions
 * by resolve_platform_permissions()) ke saath merge karta hai. Path-level
 * dedupe hai isliye already-visible item dobara nahi judta, aur naya group
 * chahiye ho to end me apne aap ban jaata hai.
 */
function buildDynamicGroups(baseGroups, permissions) {
  if (!permissions || !permissions.length) return baseGroups;

  const existingPaths = new Set();
  baseGroups.forEach(g => g.items.forEach(it => {
    existingPaths.add(it.path);
    (it.children || []).forEach(c => existingPaths.add(c.path));
  }));

  const extraByGroup = {};
  const addEntry = (entry) => {
    if (!entry || existingPaths.has(entry.item.path)) return;
    existingPaths.add(entry.item.path);
    (extraByGroup[entry.group] ||= []).push(entry.item);
  };

  permissions.forEach(key => {
    const mapped = PERMISSION_MENU_ITEMS[key];
    if (!mapped) return;
    (Array.isArray(mapped) ? mapped : [mapped]).forEach(addEntry);
  });

  if (Object.keys(extraByGroup).length === 0) return baseGroups;

  const merged = baseGroups.map(g => (
    extraByGroup[g.group] ? { ...g, items: [...g.items, ...extraByGroup[g.group]] } : g
  ));
  Object.keys(extraByGroup).forEach(groupName => {
    if (!merged.some(g => g.group === groupName)) {
      merged.push({ group: groupName, items: extraByGroup[groupName] });
    }
  });
  return merged;
}

function getSchoolColor(name = '') {
  const colors = ['#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const NAV = {
  bg:           '#0f2744',
  bgDeep:       '#0a1e36',
  bgHover:      '#162f52',
  bgActive:     'rgba(99,149,255,0.18)',
  accent:       '#4a9eff',
  accentBar:    '#3b82f6',
  border:       '#1c3452',
  groupLabel:   '#5a85aa',
  textBase:     '#a8c4e0',
  textActive:   '#ffffff',
  textMuted:    '#4a6a88',
  searchBg:     '#0d2240',
  searchBorder: '#1c3452',
  subBg:        '#0a1e36',
  footerBg:     '#0a1e36',
};

export default function Sidebar({ darkMode }) {
  const { user }   = useAuth();
  const location   = useLocation();

  // COMPANY-side account = school_id null (see backend's own
  // _require_company_actor() split -- same discriminator, reused here).
  // Legacy user.role is USELESS for telling these apart: every company
  // employee (CEO, Manager, Intern, Sales, Developer, ...) shares the
  // exact same legacy value 'SUPER_ADMIN' (see admin.py's
  // _resolve_creation_role). Real identity is user.active_role (from
  // platform_roles via UserRoleAssignment, see auth.py _serialize_user).
  const isCompanyActor = user && user.school_id == null;
  const isTrueAdmin = !!(user?.is_super || ['CEO', 'SUPER_ADMIN'].includes(user?.active_role?.key));

  const baseGroups = (isCompanyActor && !isTrueAdmin)
    ? ROLE_MENUS.EMPLOYEE
    : (ROLE_MENUS[resolveMenuRole(user?.role, ROLE_MENUS)] || []);

  // Static role bucket + jo bhi extra permission is user ko diya gaya hai
  // (Staff Access page / Permission Matrix se) — ab dono merge hote hain,
  // sirf role se nahi.
  //
  // EXCEPTION: a true admin (CEO, or the real platform SUPER_ADMIN role)
  // is kept OUT of this merge. backend resolve_platform_permissions()
  // (rbac.py) super role ke liye poora permission catalog return karta hai
  // — 'fees.collect', 'students.profile.view', sab kuch — ye ek CEO-style
  // full bypass hai, na ki genuine per-item grant. Agar dynamic merge yaha
  // bhi chalta to har school-level item (Fees, Students, Marks, ...)
  // admin ke sidebar me bhi dikhne lagta. A real (non-admin) company
  // employee, on the other hand, SHOULD go through the dynamic merge —
  // that's the whole point of the EMPLOYEE base menu above: it starts
  // lean and grows only with whatever's actually been granted to them.
  const groups     = useMemo(
    () => (isCompanyActor && isTrueAdmin
      ? baseGroups
      : buildDynamicGroups(baseGroups, user?.permissions)),
    [baseGroups, user?.permissions, isCompanyActor, isTrueAdmin]
  );
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('ederp_sidebar_expanded');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const navRef = React.useRef(null);

  // Preserve scroll position in sidebar nav
  React.useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;
    const savedScroll = sessionStorage.getItem('ederp_sidebar_scroll');
    if (savedScroll) {
      navEl.scrollTop = Number(savedScroll);
    }
    const handleScroll = () => {
      sessionStorage.setItem('ederp_sidebar_scroll', String(navEl.scrollTop));
    };
    navEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => navEl.removeEventListener('scroll', handleScroll);
  }, []);

  const schoolName   = user?.school?.name || user?.school_name || 'EduERP';
  const schoolCode   = user?.school?.code || user?.school_code || '';
  const schoolCity   = user?.school?.city || user?.school_city || '';
  const schoolColor  = getSchoolColor(schoolName);
  const initial      = schoolName.charAt(0).toUpperCase();
  const userInitials = (user?.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  React.useEffect(() => {
    const next = {};
    groups.forEach(g => {
      g.items.forEach(item => {
        if (item.children) {
          const anyActive = item.children.some(
            c => location.pathname === c.path || location.pathname.startsWith(c.path + '/')
          );
          if (anyActive) next[item.path] = true;
        }
      });
    });
    setExpanded(prev => {
      const updated = { ...prev, ...next };
      try {
        localStorage.setItem('ederp_sidebar_expanded', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [location.pathname, groups]);

  function toggleExpand(path) {
    setExpanded(prev => {
      const updated = { ...prev, [path]: !prev[path] };
      try {
        localStorage.setItem('ederp_sidebar_expanded', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function isItemActive(item) {
    if (item.children) {
      return item.children.some(
        c => location.pathname === c.path || location.pathname.startsWith(c.path + '/')
      );
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  }

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        items: g.items
          .map(item => {
            if (item.label.toLowerCase().includes(q)) return item;
            if (item.children) {
              const fc = item.children.filter(c => c.label.toLowerCase().includes(q));
              if (fc.length) return { ...item, children: fc };
            }
            return null;
          })
          .filter(Boolean),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, search]);

  return (
    <>
      <aside style={{
        width: 232, minWidth: 232,
        position: 'fixed', top: 0, left: 0,
        height: '100vh',
        background: NAV.bg,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
        borderRight: `1px solid ${NAV.border}`,
        boxShadow: '2px 0 16px rgba(0,0,0,0.4)',
      }}>

        {/* Brand */}
        <div style={{
          background: NAV.bgDeep, borderBottom: `1px solid ${NAV.border}`,
          padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: schoolColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: `0 2px 10px ${schoolColor}66`,
          }}>
            <span style={{ color: '#fff', fontSize: 17, fontWeight: 800 }}>{initial}</span>
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{
              color: '#ffffff', fontWeight: 800, fontSize: 14, lineHeight: 1.2,
              letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{schoolName}</div>
            <div style={{
              color: NAV.groupLabel, fontSize: 10, fontWeight: 500, marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {[schoolCode, schoolCity].filter(Boolean).join(' | ') || (isCompanyActor && user?.active_role?.name) || ROLE_LABELS[user?.role] || ''}
            </div>
            <div style={{
              color: NAV.accent, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2, opacity: 0.8,
            }}>POWERED BY EDUERP</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px 4px', flexShrink: 0, background: NAV.bg }}>
          <div style={{ position: 'relative' }}>
            <i className="ti ti-search" style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: NAV.textMuted, pointerEvents: 'none',
            }} aria-hidden="true" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search modules..."
              style={{
                width: '100%', padding: '7px 10px 7px 30px', fontSize: 12,
                background: NAV.searchBg, border: `1px solid ${NAV.searchBorder}`,
                borderRadius: 8, color: '#c8dff5', outline: 'none',
                boxSizing: 'border-box', caretColor: NAV.accent,
              }}
              onFocus={e => { e.target.style.borderColor = NAV.accentBar; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)'; }}
              onBlur={e => { e.target.style.borderColor = NAV.searchBorder; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav ref={navRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 8px' }}>
          <style>{`
            aside nav::-webkit-scrollbar { width: 3px; }
            aside nav::-webkit-scrollbar-track { background: transparent; }
            aside nav::-webkit-scrollbar-thumb { background: #1c3452; border-radius: 99px; }
          `}</style>

          {filteredGroups.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 12, color: NAV.textMuted }}>
              Koi module nahi mila
            </div>
          )}

          {filteredGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 2 }}>
              {group.group && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color: NAV.groupLabel,
                  padding: gi === 0 ? '6px 8px 3px' : '12px 8px 3px',
                  textTransform: 'uppercase', userSelect: 'none',
                }}>{group.group}</div>
              )}

              {group.items.map(item => {
                const active  = isItemActive(item);
                const hasKids = !!(item.children && item.children.length);
                const isOpen  = expanded[item.path];
                return (
                  <div key={item.path}>
                    {hasKids ? (
                      <div onClick={() => toggleExpand(item.path)} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 7,
                        color:      active ? NAV.textActive : NAV.textBase,
                        background: active ? NAV.bgActive   : 'transparent',
                        borderLeft: active ? `3px solid ${NAV.accentBar}` : '3px solid transparent',
                        fontWeight: active ? 600 : 400, fontSize: 13, marginBottom: 1,
                        cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                        whiteSpace: 'nowrap', userSelect: 'none',
                      }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = NAV.bgHover; e.currentTarget.style.color = '#d8ecff'; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NAV.textBase; } }}
                      >
                        <i className={`ti ${item.icon}`} style={{ fontSize: 16, flexShrink: 0, width: 18, textAlign: 'center' }} aria-hidden="true" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                        <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                          style={{ fontSize: 12, color: NAV.groupLabel, flexShrink: 0 }} aria-hidden="true" />
                      </div>
                    ) : (
                      <NavLink to={item.path}
                        style={({ isActive }) => ({
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 8px', borderRadius: 7,
                          color:      isActive ? NAV.textActive : NAV.textBase,
                          background: isActive ? NAV.bgActive   : 'transparent',
                          borderLeft: isActive ? `3px solid ${NAV.accentBar}` : '3px solid transparent',
                          fontWeight: isActive ? 600 : 400, fontSize: 13, marginBottom: 1,
                          textDecoration: 'none', whiteSpace: 'nowrap',
                          transition: 'background 0.12s, color 0.12s',
                        })}
                        onMouseEnter={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background = NAV.bgHover; e.currentTarget.style.color = '#d8ecff'; } }}
                        onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NAV.textBase; } }}
                      >
                        <i className={`ti ${item.icon}`} style={{ fontSize: 16, flexShrink: 0, width: 18, textAlign: 'center' }} aria-hidden="true" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                      </NavLink>
                    )}

                    {hasKids && isOpen && (
                      <div style={{
                        background: NAV.subBg, borderRadius: 6,
                        margin: '0 0 2px 8px', padding: '2px 0',
                        borderLeft: `2px solid ${NAV.border}`, overflow: 'hidden',
                      }}>
                        {item.children.map(child => (
                          <NavLink key={child.path} to={child.path}
                            style={({ isActive }) => ({
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px 6px 12px',
                              color:      isActive ? NAV.accent   : NAV.textBase,
                              background: isActive ? NAV.bgActive : 'transparent',
                              fontWeight: isActive ? 600 : 400, fontSize: 12,
                              textDecoration: 'none', whiteSpace: 'nowrap',
                              transition: 'background 0.1s, color 0.1s',
                            })}
                            onMouseEnter={e => { e.currentTarget.style.background = NAV.bgHover; e.currentTarget.style.color = '#d8ecff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <i className={`ti ${child.icon}`} style={{ fontSize: 13, flexShrink: 0, width: 14, textAlign: 'center', opacity: 0.8 }} aria-hidden="true" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '10px 12px', borderTop: `1px solid ${NAV.border}`,
          background: NAV.footerBg, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, boxShadow: '0 2px 6px rgba(59,130,246,0.4)',
          }}>{userInitials}</div>
          <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#e8f4ff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: NAV.groupLabel, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {(isCompanyActor && user?.active_role?.name) || ROLE_LABELS[user?.role] || user?.role}
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700,
            background: 'rgba(34,197,94,0.2)', color: '#4ade80',
            padding: '2px 7px', borderRadius: 99,
            letterSpacing: '0.04em', flexShrink: 0,
          }}>GROWTH</span>
        </div>
      </aside>

      <style>{`:root { --sidebar-w: 232px; }`}</style>
    </>
  );
}
