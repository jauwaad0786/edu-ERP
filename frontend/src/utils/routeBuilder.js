/**
 * 1P360 Canonical Multi-Tenant Route Builder & Utilities
 * Schema: /:schoolSlug/:role/:service
 */

export const ROLE_SLUG_MAP = {
  PRINCIPAL: 'principal',
  DIRECTOR: 'principal',
  VICE_PRINCIPAL: 'principal',
  ADMIN: 'principal',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
  ACCOUNTANT: 'accountant',
  LIBRARIAN: 'librarian',
  HOSTEL: 'hostel',
  TRANSPORT: 'transport',
  DRIVER: 'driver',
  HR: 'principal',
  ACADEMIC_COORDINATOR: 'principal',
  EXAM_CONTROLLER: 'principal',
  RECEPTIONIST: 'principal',
  SUPER_ADMIN: 'admin',
};

export const ROLE_DISPLAY_NAMES = {
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  accountant: 'Accountant',
  librarian: 'Librarian',
  hostel: 'Hostel Warden',
  transport: 'Transport Incharge',
  driver: 'Transport Driver',
  admin: 'Platform Administrator',
};

/**
 * Returns a stable, URL-safe lowercase school slug.
 * Prioritizes school.code / user.school_code. Fallback: sch{school_id}.
 */
export function getCanonicalSchoolSlug(user) {
  if (!user) return 'school';
  if (user.school_code) return String(user.school_code).trim().toLowerCase();
  if (user.school?.code) return String(user.school.code).trim().toLowerCase();
  if (user.school_id) return `sch${user.school_id}`;
  if (user.school?.id) return `sch${user.school.id}`;
  return 'app';
}

/**
 * Returns canonical role slug from user object.
 */
export function getCanonicalRoleSlug(user) {
  if (!user) return 'principal';
  const role = String(user.role || '').toUpperCase();
  return ROLE_SLUG_MAP[role] || role.toLowerCase() || 'principal';
}

/**
 * Builds a canonical multi-tenant route.
 * Example: buildTenantRoute({ schoolSlug: 'sch001', role: 'principal', service: 'fees' })
 * => '/sch001/principal/fees'
 */
export function buildTenantRoute({ schoolSlug, role, service = '', id = null, search = '' }) {
  const cleanSchool = (schoolSlug || 'app').toLowerCase();
  const cleanRole = (role || 'principal').toLowerCase();
  let path = `/${cleanSchool}/${cleanRole}`;

  if (service) {
    const cleanService = service.startsWith('/') ? service.slice(1) : service;
    path += `/${cleanService}`;
  }

  if (id !== null && id !== undefined && id !== '') {
    path += `/${id}`;
  }

  if (search) {
    path += search.startsWith('?') ? search : `?${search}`;
  }

  return path;
}

/**
 * Translates a legacy un-prefixed route into a canonical tenant route based on user context.
 * Example: resolveTenantPath('/fees', user) => '/sch001/principal/fees'
 */
export function resolveTenantPath(rawPath, user) {
  if (!rawPath) return '/';
  
  // External or absolute HTTP URLs
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }

  // Company actors with no school_id
  const isCompanyActor = user && user.school_id == null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.active_role?.key === 'SUPER_ADMIN' || !!user?.is_super;

  if (isCompanyActor && isSuperAdmin) {
    if (rawPath.startsWith('/developer/') || rawPath.startsWith('/schools') || rawPath.startsWith('/users') || rawPath.startsWith('/admin')) {
      return rawPath;
    }
    if (rawPath === '/dashboard') return '/admin/dashboard';
  }

  const schoolSlug = getCanonicalSchoolSlug(user);
  const roleSlug = getCanonicalRoleSlug(user);

  // Split pathname and search query
  const [pathname, query] = rawPath.split('?');
  const searchStr = query ? `?${query}` : '';

  const parts = pathname.split('/').filter(p => p && p !== 'index.html');

  // If already prefixed with any school slug and role slug, normalize cleanly without duplicating
  if (parts.length >= 2 && Object.values(ROLE_SLUG_MAP).includes(parts[1].toLowerCase())) {
    // Strip any repetitive loops if present
    while (parts.length >= 4 && parts[0].toLowerCase() === parts[2].toLowerCase() && parts[1].toLowerCase() === parts[3].toLowerCase()) {
      parts.splice(0, 2);
    }
    const cleanService = parts.slice(2).join('/');
    return buildTenantRoute({
      schoolSlug,
      role: roleSlug,
      service: cleanService,
      search: searchStr
    });
  }

  // Canonical service normalization mapping
  let service = parts.join('/');

  // Specific alias mappings
  if (service === 'audit/school/logs') service = 'audit-logs';
  if (service === 'principal/deleted-items') service = 'deleted-items';
  if (service === 'settings/whatsapp') service = 'settings/whatsapp';
  if (service === 'my-hr') service = 'my-hr';
  if (service === 'my-services') service = 'my-services';

  return buildTenantRoute({
    schoolSlug,
    role: roleSlug,
    service,
    search: searchStr
  });
}
