import React from 'react'
import { useBranding } from '../contexts/TenantBrandingContext'

const Logo = ({ className = '', showText = true, size = 'default' }) => {
  const { companyName, companyLogo } = useBranding()

  const sizeClasses = {
    small: 'h-8 w-8',
    default: 'h-10 w-10',
    large: 'h-16 w-16',
    xl: 'h-24 w-24'
  }

  const textSizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-xl',
    xl: 'text-2xl'
  }

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '')
  const logoSrc = companyLogo?.startsWith('http') ? companyLogo : companyLogo ? `${apiBase}${companyLogo.startsWith('/') ? '' : '/'}${companyLogo}` : null

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses[size]} bg-primary-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0`}>
        {logoSrc ? (
          <img src={logoSrc} alt={companyName} className="w-full h-full object-contain" />
        ) : companyName === 'HexaBill' ? (
          <span className="w-full h-full flex items-center justify-center text-white font-bold" style={{ fontSize: '1.1em' }}>H</span>
        ) : (
          <span className="text-white font-bold text-xl">{companyName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {showText && (
        <div className={`font-semibold text-neutral-900 ${textSizeClasses[size]} hidden sm:block truncate`}>
          {companyName}
        </div>
      )}
    </div>
  )
}

export default Logo

