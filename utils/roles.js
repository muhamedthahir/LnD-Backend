/**
 * Platform admins have the same access as primary_admin.
 * To restrict campuszen_admin later, use authorizeExact('primary_admin')
 * on that route instead of authorize('primary_admin').
 */
const PLATFORM_ADMIN_ROLES = ['primary_admin', 'campuszen_admin'];
const ADMIN_ROLES = ['primary_admin', 'campuszen_admin', 'college_admin'];
const CORE_ROLES = ['primary_admin', 'campuszen_admin', 'college_admin', 'student'];

function isPlatformAdmin(role) {
  return PLATFORM_ADMIN_ROLES.includes(role);
}

function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

function expandAllowedRoles(roles) {
  if (roles.includes('primary_admin') && !roles.includes('campuszen_admin')) {
    return [...roles, 'campuszen_admin'];
  }
  return roles;
}

module.exports = {
  PLATFORM_ADMIN_ROLES,
  ADMIN_ROLES,
  CORE_ROLES,
  isPlatformAdmin,
  isAdmin,
  expandAllowedRoles
};
