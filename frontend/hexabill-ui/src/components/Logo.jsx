import React from 'react'
import { useBranding } from '../contexts/TenantBrandingContext'
import { getApiBaseUrlNoSuffix } from '../services/apiConfig'

const Logo = ({ className = '', showText = true, size = 'default' }) => {
  const { companyName, companyLogo } = useBranding()
  const [logoError, setLogoError] = React.useState(false)
  const [logoKey, setLogoKey] = React.useState(0)
  
  React.useEffect(() => { 
    setLogoError(false)
    setLogoKey(prev => prev + 1) // Force re-render when logo changes
  }, [companyLogo])

  // Listen for logo update events
  React.useEffect(() => {
    const handleLogoUpdate = () => {
      setLogoKey(prev => prev + 1)
    }
    window.addEventListener('logo-updated', handleLogoUpdate)
    return () => window.removeEventListener('logo-updated', handleLogoUpdate)
  }, [])

  const sizeClasses = {
    small: 'h-8 w-8',
    default: 'h-10 w-10',
    large: 'h-16 w-16',
    xl: 'h-24 w-24'
  }

  const textSizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-2xl',
    xl: 'text-3xl'
  }

  const apiBase = getApiBaseUrlNoSuffix()
  // Remove existing cache-busting params; ensure relative paths are under /uploads/ for static files
  const logoUrlClean = companyLogo ? companyLogo.split('?')[0] : null
  const pathForSrc = logoUrlClean?.startsWith('http') ? logoUrlClean : logoUrlClean ? (logoUrlClean.startsWith('/') ? logoUrlClean : `/uploads/${logoUrlClean}`) : null
  const logoSrc = pathForSrc ? (pathForSrc.startsWith('http') ? `${pathForSrc}?t=${Date.now()}` : `${apiBase}${pathForSrc.startsWith('/') ? '' : '/'}${pathForSrc}?t=${Date.now()}`) : null

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${sizeClasses[size]} ${!logoSrc && (companyName === 'HexaBill' || !companyName) ? '' : 'bg-primary-600 rounded-lg'} flex items-center justify-center overflow-hidden flex-shrink-0`}>
{logoSrc && !logoError ? (
          <img
            src={logoSrc}
            alt={companyName}
            className="w-full h-full object-contain"
            onError={() => setLogoError(true)}
          />
        ) : companyName === 'HexaBill' || !companyName ? (
          <img src="/hexabill-logo.svg" alt="HexaBill" className="w-full h-full object-contain" />
        ) : (
          <span className="text-white font-bold text-xl">{companyName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {showText && (
        <div className={`font-bold tracking-tight text-neutral-900 ${textSizeClasses[size]} hidden sm:block truncate`}>
          {companyName}
        </div>
      )}
    </div>
  )
}

export default Logo

