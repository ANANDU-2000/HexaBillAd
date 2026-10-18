// Security: disable console in production first (before any other code)
import './security/disableConsoleInProduction.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { BrandingProvider } from './tenant/TenantBrandingContext'
import AppToaster from './components/ui/AppToaster'
import App from './app/App.jsx'
import './index.css'

// Apply saved language preference before first paint (RTL for Arabic).
try {
  const lang = localStorage.getItem('hexabill_lang') || 'en'
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'en'
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
} catch {
  /* ignore private-mode / SSR */
}

// Force favicon update on load (for cache-busting)
const updateFavicon = () => {
  const timestamp = Date.now()
  const favicon = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']")
  if (favicon) {
    const newHref = favicon.href.split('?')[0] + '?v=' + timestamp
    favicon.href = newHref
  }

  // Update apple touch icon
  const appleIcon = document.querySelector("link[rel='apple-touch-icon']")
  if (appleIcon) {
    const newHref = appleIcon.href.split('?')[0] + '?v=' + timestamp
    appleIcon.href = newHref
  }

  // Update manifest
  const manifest = document.querySelector("link[rel='manifest']")
  if (manifest) {
    const newHref = manifest.href.split('?')[0] + '?v=' + timestamp
    manifest.href = newHref
  }
}

// Update favicon on mount
updateFavicon()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthProvider>
        <BrandingProvider>
          <App />
        </BrandingProvider>
      </AuthProvider>
      <AppToaster />
    </BrowserRouter>
  </React.StrictMode>,
)
