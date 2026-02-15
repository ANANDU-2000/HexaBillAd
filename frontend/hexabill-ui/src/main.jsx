import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { BrandingProvider } from './contexts/TenantBrandingContext'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'
import './styles/tokens.css'

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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          // CRITICAL: Prevent error flooding - limit to 3 toasts at once
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
        // Limit max number of toasts to prevent flooding
        containerStyle={{
          top: 20,
        }}
        // Deduplicate identical toasts
        gutter={8}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
