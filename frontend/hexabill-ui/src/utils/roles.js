/**
 * Role-based access control utilities
 * Purpose: Centralized role checking for multi-tenant system
 * Date: 2025-12-25
 */

/**
 * Check if user has admin-level privileges (Admin or Owner role)
 * In multi-tenant system, both Admin and Owner have full access to their company data
 * @param {object} user - User object with role property
 * @returns {boolean} - True if user is Admin or Owner
 */
export const isAdminOrOwner = (user) => {
  if (!user?.role) return false
  const role = user.role.toLowerCase()
  return role === 'admin' || role === 'owner' || role === 'systemadmin'
}

/**
 * Check if user is specifically Owner role or SystemAdmin
 * @param {object} user - User object with role property
 * @returns {boolean} - True if user is Owner or SystemAdmin
 */
export const isOwner = (user) => {
  if (!user?.role) return false
  const role = user.role.toLowerCase()
  return role === 'owner' || role === 'systemadmin'
}

/**
 * Check if user is specifically Admin role or SystemAdmin
 * @param {object} user - User object with role property
 * @returns {boolean} - True if user is Admin or SystemAdmin
 */
export const isAdmin = (user) => {
  if (!user?.role) return false
  const role = user.role.toLowerCase()
  return role === 'admin' || role === 'systemadmin'
}

/**
 * Check if user is Staff role (limited access)
 * @param {object} user - User object with role property
 * @returns {boolean} - True if user is Staff
 */
export const isStaff = (user) => {
  if (!user?.role) return false
  return user.role.toLowerCase() === 'staff'
}

/**
 * Get user role display name
 * @param {object} user - User object with role property
 * @returns {string} - Role display name
 */
export const getRoleDisplayName = (user) => {
  if (!user?.role) return 'Unknown'
  const role = user.role.toLowerCase()

  switch (role) {
    case 'owner':
      return 'Owner'
    case 'admin':
      return 'Admin'
    case 'staff':
      return 'Staff'
    default:
      return user.role
  }
}

/**
 * Check if user can access admin features
 * Alias for isAdminOrOwner for backward compatibility
 * @param {object} user - User object with role property
 * @returns {boolean} - True if user can access admin features
 */
export const canAccessAdminFeatures = isAdminOrOwner

// Admin-only page IDs – Staff can NEVER access these (no conflict with Owner/Admin)
const STAFF_NEVER_ACCESS = ['users', 'settings', 'backup', 'branches', 'routes', 'purchases']

/**
 * Check if user can access a given page (for Staff page-level restrictions).
 * Owner, Admin, SystemAdmin can access all pages. Staff can access only pages in user.pageAccess (comma-separated),
 * and NEVER users, settings, backup, branches, routes, purchases.
 * @param {object} user - User object with role and optional pageAccess
 * @param {string} pageId - Page id (e.g. 'pos', 'invoices', 'products', 'customers', 'expenses', 'reports')
 * @returns {boolean} - True if user can access the page
 */
export const canAccessPage = (user, pageId) => {
  if (!user) return false
  const role = user.role?.toLowerCase()
  if (role === 'owner' || role === 'admin' || role === 'systemadmin') return true
  if (role === 'staff') {
    if (STAFF_NEVER_ACCESS.includes(pageId)) return false
    if (!user.pageAccess) return true // No restriction = all allowed (except STAFF_NEVER_ACCESS)
    const allowed = (user.pageAccess || '').split(',').map(s => s.trim()).filter(Boolean)
    return allowed.includes(pageId)
  }
  return false
}
