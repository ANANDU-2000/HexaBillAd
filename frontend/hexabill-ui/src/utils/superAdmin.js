/**
 * Super Admin utilities
 * Purpose: Check if user is SystemAdmin (tenantId = 0)
 */

/**
 * Decode JWT token to extract claims
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded token payload or null
 */
const decodeJWT = (token) => {
  if (!token) return null
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Failed to decode JWT:', error)
    return null
  }
}

/**
 * Get tenantId from JWT token
 * @param {string} token - JWT token from localStorage
 * @returns {number|null} - TenantId (0 for SystemAdmin, number for tenant, null if not found)
 */
export const getTenantIdFromToken = (token) => {
  const decoded = decodeJWT(token)
  if (!decoded) return null
  
  // Check tenant_id claim (primary)
  const tenantId = decoded.tenant_id || decoded.tenantId
  if (tenantId !== undefined) {
    const parsed = parseInt(tenantId, 10)
    return isNaN(parsed) ? null : parsed
  }
  
  // Fallback to owner_id claim (legacy)
  const ownerId = decoded.owner_id || decoded.ownerId
  if (ownerId !== undefined) {
    const parsed = parseInt(ownerId, 10)
    return isNaN(parsed) ? null : parsed
  }
  
  return null
}

/**
 * Check if user is SystemAdmin
 * SystemAdmin has tenantId = 0 or null in JWT token
 * @param {object} user - User object (may include tenantId)
 * @param {string} token - Optional JWT token (will be read from localStorage if not provided)
 * @returns {boolean} - True if user is SystemAdmin
 */
export const isSystemAdmin = (user, token = null) => {
  if (!user) return false
  
  // First check: If user object has tenantId property
  if (user.tenantId !== undefined) {
    return user.tenantId === 0 || user.tenantId === null
  }
  
  // Second check: Extract tenantId from JWT token
  const jwtToken = token || localStorage.getItem('token')
  if (jwtToken) {
    const tenantId = getTenantIdFromToken(jwtToken)
    return tenantId === 0 || tenantId === null
  }
  
  // Fallback: Check role (legacy - should not be primary method)
  return user.role?.toLowerCase() === 'systemadmin' || user.isSystemAdmin === true
}

/**
 * Check if user can access Super Admin features
 * @param {object} user - User object
 * @returns {boolean} - True if user can access Super Admin
 */
export const canAccessSuperAdmin = isSystemAdmin
