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

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

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
          tenantId: tenantId,
          assignedBranchIds: response.data.assignedBranchIds || [],
          assignedRouteIds: response.data.assignedRouteIds || []
        }

        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)

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

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData }
    setUser(newUserData)
    localStorage.setItem('user', JSON.stringify(newUserData))
  }

  const value = {
    user,
    login,
    logout,
    updateUser,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
