// frontend/src/utils/permissionMenuMap.js
//
// SINGLE SOURCE OF TRUTH for "this permission_catalog.py key unlocks this
// page". Sidebar.jsx uses PERMISSION_MENU_ITEMS to decide which sidebar
// item to show; ProtectedRoute (via ROUTE_PERMISSIONS below) uses the
// exact same data to decide whether to actually let the user land on that
// page. Keeping both derived from one object means a sidebar item can
// never again point at a route that rejects the user -- if a path is
// added/changed here, both the menu and the guard update together.
//
// Previously PERMISSION_MENU_ITEMS lived only inside Sidebar.jsx. That is
// why granting e.g. 'fees.structure.manage' to a Teacher made the "Fee
// Structures" item appear in the sidebar (Sidebar.jsx knew about the
// permission) but clicking it bounced back to /dashboard (App.jsx's
// <ProtectedRoute roles={['PRINCIPAL','SUPER_ADMIN']}> only knew about
// hardcoded roles, never about permissions).
export const PERMISSION_MENU_ITEMS = {
  'students.admission.manage': { group: 'Academics', item: { icon: 'ti-user-plus',    label: 'Admissions', path: '/admission' } },
  'students.profile.view':     { group: 'Academics', item: { icon: 'ti-address-book', label: 'Students',   path: '/students' } },
  'students.profile.edit':     { group: 'Academics', item: { icon: 'ti-address-book', label: 'Students',   path: '/students' } },
  'students.delete':           { group: 'Academics', item: { icon: 'ti-address-book', label: 'Students',   path: '/students' } },

  'staff.profile.manage':      { group: 'Staff Management', item: { icon: 'ti-briefcase', label: 'Staff List', path: '/staff' } },

  'fees.structure.manage':     { group: 'Operations', item: { icon: 'ti-currency-rupee', label: 'Fee Structures', path: '/fees/structures' } },
  'fees.collect':              { group: 'Operations', item: { icon: 'ti-receipt',        label: 'Fees',           path: '/fees' } },
  'fees.discount.apply':       { group: 'Operations', item: { icon: 'ti-receipt',        label: 'Fees',           path: '/fees' } },
  'fees.receipt.view':         { group: 'Operations', item: { icon: 'ti-receipt',        label: 'Fees',           path: '/fees' } },
  'fees.reports.view':         { group: 'Operations', item: { icon: 'ti-receipt',        label: 'Fees',           path: '/fees' } },

  'exams.schedule.manage':     { group: 'Examinations', item: { icon: 'ti-pencil',    label: 'Exam Schedule', path: '/exams' } },
  'exams.timetable.manage':    { group: 'Examinations', item: { icon: 'ti-pencil',    label: 'Exam Schedule', path: '/exams' } },
  'exams.results.publish':     { group: 'Examinations', item: { icon: 'ti-pencil',    label: 'Exam Schedule', path: '/exams' } },
  'exams.admitcard.generate':  { group: 'Examinations', item: { icon: 'ti-ticket',    label: 'Admit Cards',   path: '/admit-card' } },
  'marks.entry':                { group: 'Examinations', item: { icon: 'ti-chart-bar', label: 'Marks', path: '/marks' } },
  'marks.bulk_save':            { group: 'Examinations', item: { icon: 'ti-chart-bar', label: 'Marks', path: '/marks' } },
  'marks.analytics.view':       { group: 'Examinations', item: { icon: 'ti-chart-bar', label: 'Marks', path: '/marks' } },

  'finance.expense.manage':    { group: 'Finance', item: { icon: 'ti-receipt-2', label: 'Expenses',  path: '/finance/expenses' } },
  'finance.inventory.manage':  { group: 'Finance', item: { icon: 'ti-boxes',     label: 'Inventory',  path: '/finance/inventory' } },
  'staff.payroll.view':        { group: 'Finance', item: { icon: 'ti-cash',      label: 'Payroll',    path: '/finance/payroll' } },
  'staff.payroll.manage':      { group: 'Finance', item: { icon: 'ti-cash',      label: 'Payroll',    path: '/finance/payroll' } },

  'documents.issue':           { group: 'Resources', item: { icon: 'ti-file-text', label: 'Documents', path: '/documents' } },
  'documents.view':            { group: 'Resources', item: { icon: 'ti-file-text', label: 'Documents', path: '/documents' } },

  'communication.announcement.post': { group: 'Customer Service', item: { icon: 'ti-speakerphone', label: 'Announcements', path: '/support/announcements' } },

  'audit.logs.view':           { group: 'Access Control', item: { icon: 'ti-history', label: 'Audit Logs', path: '/audit/school/logs' } },

  // ek permission -> kai items (Access Control ka poora RBAC sub-menu)
  'admin.user.manage': [
    { group: 'Access Control', item: { icon: 'ti-users',             label: 'Roles & Hierarchy', path: '/rbac/roles' } },
    { group: 'Access Control', item: { icon: 'ti-grid',              label: 'Permission Matrix',  path: '/rbac/permissions' } },
    { group: 'Access Control', item: { icon: 'ti-switch-horizontal', label: 'Delegations',        path: '/rbac/delegations' } },
    { group: 'Access Control', item: { icon: 'ti-user-check',        label: 'Staff Permissions',  path: '/rbac/staff-access' } },
  ],
  'admin.school.settings':   { group: 'Settings', item: { icon: 'ti-settings',       label: 'School Settings',      path: '/school-settings' } },
  'admin.whatsapp.settings': { group: 'Settings', item: { icon: 'ti-brand-whatsapp', label: 'WhatsApp Integration', path: '/settings/whatsapp' } },
};

/**
 * Derived automatically from PERMISSION_MENU_ITEMS above: path -> the list
 * of permission keys that should unlock it. Built once at module load so
 * it can never fall out of sync with the sidebar map by hand-editing.
 *
 * Usage in App.jsx:
 *   <ProtectedRoute roles={[...]} permissions={ROUTE_PERMISSIONS['/fees/structures']}>
 */
export const ROUTE_PERMISSIONS = {};
Object.entries(PERMISSION_MENU_ITEMS).forEach(([permissionKey, mapped]) => {
  const entries = Array.isArray(mapped) ? mapped : [mapped];
  entries.forEach(({ item }) => {
    (ROUTE_PERMISSIONS[item.path] ||= []).push(permissionKey);
  });
});
