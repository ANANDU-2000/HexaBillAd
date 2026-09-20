import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services'

const AuthContext = createContext()

const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`).join('')))
  } catch {
    return null
  }
}

const userFromToken = (token) => {
  const decoded = decodeJwtPayload(token)
  if (!decoded) return null
  return {
    id: Number(decoded.sub || decoded.UserId || 0),
    role: decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Owner',
    name: decoded.name || 'Support session',
    tenantId: decoded.tid ? Number(decoded.tid) : null,
    supportSession: decoded.support_session ? Number(decoded.support_session) : null,
    supportReadOnly: decoded.support_readonly === 'true'
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [impersonatedTenantId, setImpersonatedTenantId] = useState(null)

  // Declare logout before any useEffect that references it to avoid TDZ when minified
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setImpersonatedTenantId(null)
  }

  useEffect(() => {
    let token = localStorage.getItem('token')
    let userData = localStorage.getItem('user')
    const supportToken = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('support')
      : null
    if (supportToken) {
      token = supportToken
      userData = JSON.stringify(userFromToken(supportToken))
      localStorage.setItem('token', supportToken)
      localStorage.setItem('user', userData)
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
    }
    const path = typeof window !== 'undefined' ? window.location.pathname : ''

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

        // Skip validate on login page to avoid ERR_CONNECTION_REFUSED when backend is down
        if (path === '/login' || path === '/Admin26') {
          setLoading(false)
          return
        }

        // Validate token silently - don't show errors on initial load
        authAPI.validateToken()
          .then(response => {
            if (response?.success && response?.data) {
              // Update user data if response contains user info
              const updatedUser = {
                id: response.data.UserId || parsedUser.id,
                role: response.data.Role || parsedUser.role,
                name: response.data.Name || parsedUser.name,
                dashboardPermissions: response.data.dashboardPermissions || response.data.DashboardPermissions || parsedUser.dashboardPermissions,
                pageAccess: response.data.pageAccess ?? response.data.PageAccess ?? parsedUser.pageAccess,
                companyName: parsedUser.companyName,
                assignedBranchIds: response.data.assignedBranchIds || response.data.AssignedBranchIds || parsedUser.assignedBranchIds || [],
                assignedRouteIds: response.data.assignedRouteIds || response.data.AssignedRouteIds || parsedUser.assignedRouteIds || [],
                mustChangePassword: response.data.mustChangePassword ?? parsedUser.mustChangePassword ?? false,
                supportSession: parsedUser.supportSession ?? null,
                supportReadOnly: parsedUser.supportReadOnly ?? false
              }
              setUser(updatedUser)
              localStorage.setItem('user', JSON.stringify(updatedUser))
            } else {
              // Token invalid - logout silently
              logout()
            }
          })
          .catch((error) => {
            // Only logout if it's an authentication error, not network errors
            if (error.response?.status === 401) {
              logout()
            }
            // For network errors, keep the user logged in with cached data
          })
          .finally(() => {
            setLoading(false)
          })
      } catch (error) {
        // Invalid user data in localStorage - clear it
        logout()
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      if (response.success) {
        const token = response.data.token
        let tenantId = response.data.tenantId ?? null
        if (tenantId === undefined && token) {
          try {
            const base64Url = token.split('.')[1]
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            }).join(''))
            const decoded = JSON.parse(jsonPayload)
            const tenantIdStr = decoded.tid || decoded.tenant_id
            tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : null
          } catch (e) {
            console.warn('Failed to decode tenantId from token:', e)
          }
        }

        const userData = {
          id: response.data.userId,
          role: response.data.role || 'Staff',
          name: response.data.name || response.data.Name || 'User',
          companyName: response.data.companyName,
          dashboardPermissions: response.data.dashboardPermissions,
          pageAccess: response.data.pageAccess ?? response.data.PageAccess ?? null,
          tenantId: tenantId,
          assignedBranchIds: response.data.assignedBranchIds || [],
          assignedRouteIds: response.data.assignedRouteIds || [],
          mustChangePassword: response.data.mustChangePassword ?? false
        }

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)

        // Tenant context is established by the verified host and JWT. Never mirror it into browser storage.
        setImpersonatedTenantId(null)

        return { success: true, data: response.data }
      } else {
        return { success: false, message: response.message }
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      }
    }
  }

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData }
    setUser(newUserData)
    localStorage.setItem('user', JSON.stringify(newUserData))
  }

  const impersonateTenant = (tenantId) => {
    // Deliberately disabled: a client-side tenant ID must never select tenant data.
    return false
  }

  const stopImpersonation = () => {
    setImpersonatedTenantId(null)
  }

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading,
    impersonatedTenantId,
    impersonateTenant,
    stopImpersonation
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
