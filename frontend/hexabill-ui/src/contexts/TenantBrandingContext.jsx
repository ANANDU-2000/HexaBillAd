import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../services'

const BrandingContext = createContext()

export const useBranding = () => {
  const context = useContext(BrandingContext)
  if (!context) {
    return {
      companyName: 'HexaBill',
      companyLogo: null,
      primaryColor: '#2563EB',
      loading: false,
      refresh: () => {},
    }
  }
  return context
}

const getApiBaseUrl = () => {
  const env = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'
  return env.replace(/\/api\/?$/, '')
}

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    companyName: 'HexaBill',
    companyLogo: null,
    primaryColor: '#2563EB',
    accentColor: '#10B981',
    loading: true,
  })

  const updateFavicon = useCallback((logoUrl) => {
    if (!logoUrl) return
    try {
      const base = getApiBaseUrl()
      const href = logoUrl.startsWith('http') ? logoUrl : `${base}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
      link.rel = 'shortcut icon'
      link.href = href
      if (logoUrl.endsWith('.svg')) link.type = 'image/svg+xml'
      else link.type = 'image/x-icon'
      document.getElementsByTagName('head')[0].appendChild(link)
    } catch (e) {
      console.warn('Favicon update failed:', e)
    }
  }, [])

  const loadBranding = useCallback(async () => {
    // CRITICAL: Only call /api/settings when user is logged in (has token).
    // Prevents flood of 401s on login page and when token expired.
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) {
      setBranding(prev => ({ ...prev, companyName: 'HexaBill', loading: false }))
      return
    }
    setBranding(prev => ({ ...prev, loading: true }))
    try {
      const response = await adminAPI.getSettings()
      const data = response?.data ?? response
      if (data) {
        const name = data.COMPANY_NAME_EN || data.companyNameEn || data.companyName || 'HexaBill'
        const logoUrl = data.COMPANY_LOGO || data.logoUrl || null
        const primary = data.primaryColor || data.primary_color || '#2563EB'
        const accent = data.accentColor || data.accent_color || '#10B981'

        setBranding(prev => ({
          ...prev,
          companyName: name,
          companyLogo: logoUrl,
          primaryColor: primary,
          accentColor: accent,
          loading: false,
        }))

        document.title = name
        if (logoUrl) updateFavicon(logoUrl)
      } else {
        setBranding(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      setBranding(prev => ({ ...prev, companyName: 'HexaBill', loading: false }))
    }
  }, [updateFavicon])

  useEffect(() => {
    loadBranding()
  }, [loadBranding])

  return (
    <BrandingContext.Provider value={{ ...branding, refresh: loadBranding }}>
      {children}
    </BrandingContext.Provider>
  )
}
