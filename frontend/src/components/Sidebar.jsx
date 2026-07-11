import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      ],
    },
  ],

  PRINCIPAL: [
    {
      group: 'Overview',
      items: [
        { icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' },
      ],
    },
    {
      group: '',
      items: [
        {
          icon: 'ti-school', label: 'Academics', path: '/classes',
          children: [
            { icon: 'ti-list',           label: 'Classes & Sections',    path: '/classes' },
            { icon: 'ti-user-plus',      label: 'Admissions',            path: '/admission' },
            { icon: 'ti-address-book',   label: 'Students',              path: '/students' },
            { icon: 'ti-edit',           label: 'Students Bulk Edit',    path: '/students/bulk-edit' },
            { icon: 'ti-arrows-shuffle', label: 'Section Shuffle',       path: '/students/section-shuffle' },
            { icon: 'ti-id-badge',       label: 'ID Cards',              path: '/id-cards' },
            { icon: 'ti-certificate',    label: 'Transfer Certificates', path: '/students/transfer-cert' },
          ],
        },
      ],
    },
    // ── NEW ──
    {
      group: '',
      items: [
        {
          icon: 'ti-users', label: 'Staff Management', path: '/teachers',
          children: [
            { icon: 'ti-chalkboard', label: 'Teachers',  path: '/teachers' },
            { icon: 'ti-briefcase',  label: 'Staff List', path: '/staff' },
          ],
        },
      ],
    },
    // ── NEW ──
    // ── NEW ──
    {
      group: '',
      items: [
        {
          icon: 'ti-clipboard-check', label: 'Operations', path: '/attendance',
          children: [
            { icon: 'ti-clipboard-check', label: 'Attendance', path: '/attendance' },
            { icon: 'ti-calendar-time',   label: 'Timetable',  path: '/timetable' },
            { icon: 'ti-receipt',         label: 'Fees',       path: '/fees' },
            { icon: 'ti-currency-rupee',  label: 'Fee Structures',  path: '/fees/structures' },
          ],
        },
      ],
    },
    
    // ── NEW ──
    {
      group: '',
      items: [
        {
          icon: 'ti-currency-rupee', label: 'Finance', path: '/finance/expenses',
          children: [
            { icon: 'ti-receipt-2', label: 'Expenses',  path: '/finance/expenses' },
            { icon: 'ti-boxes',     label: 'Inventory', path: '/finance/inventory' },
            { icon: 'ti-cash',      label: 'Payroll',   path: '/finance/payroll' },
            { icon: 'ti-building-store', label: 'Vendors', path: '/finance/vendors' },
          ],
        },
      ],
    },
    // ── OLD ──
    // ── OLD ──
    {
      group: 'Examinations',
      items: [
        {
          icon: 'ti-pencil', label: 'Examinations', path: '/exams',
          children: [
            { icon: 'ti-pencil',    label: 'Exam Schedule',      path: '/exams' },
            { icon: 'ti-chart-bar', label: 'Marks',              path: '/marks' },
            { icon: 'ti-ticket',    label: 'Admit Cards',        path: '/admit-card' },
            { icon: 'ti-books',     label: 'Subject Management', path: '/subjects' },
          ],
        },
      ],
    },
    // ── NEW: Library ──
    {
      group: 'Library',
      items: [
        {
          icon: 'ti-book-2', label: 'Library', path: '/library',
          children: [
            { icon: 'ti-layout-dashboard', label: 'Dashboard',     path: '/library' },
            { icon: 'ti-books',            label: 'Book Master',   path: '/library/books' },
            { icon: 'ti-arrows-exchange',  label: 'Issue / Return',path: '/library/issue-return' },
            { icon: 'ti-clock',            label: 'Reservations',  path: '/library/reservations' },
            { icon: 'ti-users',            label: 'Members',       path: '/library/members' },
            { icon: 'ti-report',           label: 'Reports',       path: '/library/reports' },
          ],
        },
      ],
    },
    // ── NEW: Hostel ──
    // NEW
    {
      group: 'Hostel',
      items: [
        {
          icon: 'ti-building-community', label: 'Hostel', path: '/hostel',
          children: [
            { icon: 'ti-layout-dashboard', label: 'Dashboard',       path: '/hostel' },
            { icon: 'ti-settings',         label: 'Hostel Setup',    path: '/hostel/setup' },
            { icon: 'ti-layout-grid',      label: 'Room Map',        path: '/hostel/room-map' },
            { icon: 'ti-currency-rupee',   label: 'Fee Structures',  path: '/hostel/fee-structures' },
            { icon: 'ti-user-plus',        label: 'Admission',       path: '/hostel/admission' },
            { icon: 'ti-arrows-exchange',  label: 'Transfer / Vacate', path: '/hostel/transfers' },
            { icon: 'ti-report',           label: 'Reports',         path: '/hostel/reports' },
          ],
        },
      ],
    },
    // ── NEW ──
    {
      group: '',
      items: [
        { icon: 'ti-file-text', label: 'Documents', path: '/documents' },
        { icon: 'ti-notes',     label: 'Notes',     path: '/notes' },
      ],
    },
    // ── NEW ──
    {
      group: '',
      items: [
        {
          icon: 'ti-headset', label: 'Customer Service', path: '/support/tickets',
          children: [
            { icon: 'ti-ticket',       label: 'My Tickets',    path: '/support/tickets' },
            { icon: 'ti-plus',         label: 'New Ticket',    path: '/support/tickets/new' },
            { icon: 'ti-video',        label: 'Book Meeting',  path: '/support/meetings' },
            { icon: 'ti-speakerphone', label: 'Announcements', path: '/support/announcements' },
            { icon: 'ti-message-2',    label: 'Messages',      path: '/support/chat' },
            { icon: 'ti-help-circle',  label: 'Help Center',   path: '/support/help' },
          ],
        },
      ],
    },
    {
      group: 'Settings',
      items: [
        { icon: 'ti-bolt',     label: 'My Plan & Services', path: '/my-services' },
        { icon: 'ti-settings', label: 'School Settings',    path: '/school-settings' },
        { icon: 'ti-brand-whatsapp', label: 'WhatsApp Integration', path: '/settings/whatsapp' },
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
      items: [{ icon: 'ti-calendar-time', label: 'Timetable', path: '/timetable' }],
    },
    {
      group: 'My Work',
      items: [
        { icon: 'ti-clipboard-check', label: 'Attendance',   path: '/attendance' },
        { icon: 'ti-pencil',          label: 'Marks Entry',  path: '/marks' },
        { icon: 'ti-upload',          label: 'Upload Notes', path: '/notes' },
        { icon: 'ti-user-graduate',   label: 'My Students',  path: '/students' },
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
      group: 'Library',
      items: [
        { icon: 'ti-books',           label: 'Book Master',    path: '/library/books' },
        { icon: 'ti-arrows-exchange', label: 'Issue / Return',  path: '/library/issue-return' },
        { icon: 'ti-clock',           label: 'Reservations',    path: '/library/reservations' },
        { icon: 'ti-users',           label: 'Members',         path: '/library/members' },
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
  // NEW — ACCOUNTANT role menu
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

  // NEW
  HOSTEL: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/hostel' }],
    },
    {
      group: 'Hostel',
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

  STUDENT: [
    {
      group: 'Overview',
      items: [{ icon: 'ti-layout-dashboard', label: 'Dashboard', path: '/dashboard' }],
    },
    {
      group: 'My School',
      items: [
        { icon: 'ti-calendar-time',   label: 'Timetable',  path: '/timetable' },
        { icon: 'ti-clipboard-check', label: 'Attendance', path: '/attendance' },
        { icon: 'ti-chart-bar',       label: 'Results',    path: '/results' },
        { icon: 'ti-receipt',         label: 'Fees',       path: '/fees' },
        { icon: 'ti-notes',           label: 'Notes',      path: '/notes' },
        { icon: 'ti-book',            label: 'Library',    path: '/library/books' },
        { icon: 'ti-ticket',          label: 'Admit Card', path: '/admit-card' },
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
        { icon: 'ti-clipboard-check', label: 'Attendance', path: '/attendance' },
        { icon: 'ti-chart-bar',       label: 'Progress',   path: '/results' },
        { icon: 'ti-receipt',         label: 'Fees',       path: '/fees' },
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
};

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin', PRINCIPAL: 'Principal', VICE_PRINCIPAL: 'Vice Principal',
  TEACHER: 'Teacher', ACCOUNTANT: 'Accountant', RECEPTIONIST: 'Receptionist',
  LIBRARIAN: 'Librarian', HOSTEL: 'Warden', STUDENT: 'Student', PARENT: 'Parent',
};

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
  const groups     = ROLE_MENUS[user?.role] || [];
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState({});

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
    setExpanded(prev => ({ ...prev, ...next }));
  }, [location.pathname]); // eslint-disable-line

  function toggleExpand(path) {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
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
              {[schoolCode, schoolCity].filter(Boolean).join(' | ') || ROLE_LABELS[user?.role] || ''}
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
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 8px' }}>
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
              {ROLE_LABELS[user?.role] || user?.role}
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
