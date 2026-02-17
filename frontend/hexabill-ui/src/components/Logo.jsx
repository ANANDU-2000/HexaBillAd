import React from 'react'
import { useBranding } from '../contexts/TenantBrandingContext'

const Logo = ({ className = '', showText = true, size = 'default' }) => {
  const { companyName, companyLogo } = useBranding()
  const [logoError, setLogoError] = React.useState(false)
  React.useEffect(() => { setLogoError(false) }, [companyLogo])

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

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '')
  const logoSrc = companyLogo?.startsWith('http') ? companyLogo : companyLogo ? `${apiBase}${companyLogo.startsWith('/') ? '' : '/'}${companyLogo}` : null

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

