import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services'

const AuthContext = createContext()

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
    localStorage.removeItem('selected_tenant_id') // Clear impersonation on logout
    setUser(null)
    setImpersonatedTenantId(null)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    const savedTenantId = localStorage.getItem('selected_tenant_id')
    const path = typeof window !== 'undefined' ? window.location.pathname : ''

    if (savedTenantId) {
      setImpersonatedTenantId(parseInt(savedTenantId, 10))
    }

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
                assignedRouteIds: response.data.assignedRouteIds || response.data.AssignedRouteIds || parsedUser.assignedRouteIds || []
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
            const tenantIdStr = decoded.tenant_id || decoded.owner_id
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
          assignedRouteIds: response.data.assignedRouteIds || []
        }

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)

        // Phase 4: Set tenant context for API/branding (normal users only; System Admin has tenantId 0 and should not set)
        if (tenantId != null && tenantId !== undefined && tenantId !== 0) {
          localStorage.setItem('selected_tenant_id', String(tenantId))
          setImpersonatedTenantId(parseInt(tenantId, 10))
        } else {
          localStorage.removeItem('selected_tenant_id')
          setImpersonatedTenantId(null)
        }

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
    if (!tenantId) return
    localStorage.setItem('selected_tenant_id', tenantId.toString())
    setImpersonatedTenantId(parseInt(tenantId, 10))
  }

  const stopImpersonation = () => {
    localStorage.removeItem('selected_tenant_id')
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
