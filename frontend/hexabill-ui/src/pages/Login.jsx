import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBranding } from '../contexts/TenantBrandingContext'
import { Input } from '../components/Form'
import { LoadingButton } from '../components/Loading'
import { showToast } from '../utils/toast'
import Logo from '../components/Logo'
import { isSystemAdmin } from '../utils/superAdmin'

const Login = ({ isSuperAdminLogin = false }) => {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { login, logout } = useAuth()
  const { companyName } = useBranding()
  const navigate = useNavigate()
  const emailInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm()

  // Keyboard shortcuts: Ctrl+L to focus login, Enter to submit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        emailInputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const result = await login({
        email: data.email,
        password: data.password,
        rememberMe: rememberMe
      })

      if (result?.success) {
        // Post-login check
        const user = result.data.user || result.data // Assuming user data is returned in result.data.user or result.data based on API response structure. The useAuth hook usually returns user object.
        // Actually, modify this to use the user object from result if available, otherwise fetch from state?
        // Let's rely on result content.

        // However, useAuth login result might return raw response.
        // The App.jsx uses isSystemAdmin(user)

        const userPayload = result.data?.user || result.data || {}
        const tenantId = result.data?.tenantId ?? userPayload.tenantId
        const isSuperAdmin = isSystemAdmin({ ...userPayload, tenantId: tenantId }, result.data?.token)

        if (isSuperAdminLogin) {
          if (isSuperAdmin) {
            showToast.success('Super Admin Login successful!')
            navigate('/superadmin/dashboard')
          } else {
            await logout()
            showToast.error('This is the Admin Portal. Use the main app to sign in with your company account. If you need admin access, contact your administrator.')
          }
        } else {
          if (isSuperAdmin) {
            await logout()
            showToast.error('Use the Admin Portal to sign in as Super Admin, or sign in here with a company account (e.g. owner1@hexabill.com).')
          } else {
            showToast.success('Login successful!')
            navigate('/dashboard')
          }
        }

      } else {
        // Check for specific error codes
        if (result?.status === 429) {
          showToast.error('Too many attempts. Please try again later.')
        } else if (result?.status === 401) {
          showToast.error('Email or password incorrect.')
        } else if (result?.status === 500) {
          showToast.error('Server error — try again later.')
        } else {
          showToast.error(result?.message || 'Login failed')
        }
      }
    } catch (error) {
      const isConnectionError = !error.response &&
        (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' ||
          error.message?.includes('Network Error') || error.message?.includes('Failed to fetch'))
      if (isConnectionError) {
        showToast.error('Service temporarily unavailable. Please try again in a moment or contact support.')
      } else if (error.response?.status === 429) {
        showToast.error('Too many attempts. Please try again later.')
      } else if (error.response?.status === 401) {
        showToast.error('Email or password incorrect.')
      } else if (error.response?.status === 500) {
        showToast.error('Server error — try again later.')
      } else {
        showToast.error(error.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const lang = typeof localStorage !== 'undefined' ? (localStorage.getItem('hexabill_lang') || 'en') : 'en'
  const isRtl = lang === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'
  const textAlign = isRtl ? 'text-right' : 'text-left'

  return (
    <div className="h-screen bg-neutral-50 flex overflow-hidden" dir={dir} lang={lang}>
      {/* Split screen: left brand (desktop), right form — works LTR/RTL */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-start lg:justify-start lg:bg-gradient-to-br lg:from-primary-50 lg:via-primary-100 lg:to-primary-50 lg:border-r lg:border-primary-200 lg:px-10 lg:py-8 overflow-y-auto">
        <div className={`max-w-lg w-full ${isRtl ? 'text-right' : 'text-left'}`}>
          <Logo size="large" showText={true} />
          <h2 className="mt-4 text-2xl font-bold text-primary-900 leading-tight">
            Complete Business Management Software
          </h2>
          <p className="mt-2 text-sm text-primary-700 leading-snug">
            Streamline invoicing, inventory, POS, customer management, and financial reporting — all in one platform for businesses in the Gulf, India, and worldwide.
          </p>

          {/* Key Features - Compact Grid */}
          <div className="mt-5 grid grid-cols-1 gap-2.5">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Professional Invoicing & Billing</h3>
                <p className="text-xs text-primary-600 mt-0.5">Create, send, track invoices. Multi-currency, automated reminders.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Point of Sale (POS) System</h3>
                <p className="text-xs text-primary-600 mt-0.5">Fast checkout, barcode scanning, receipt printing, real-time updates.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Smart Inventory Management</h3>
                <p className="text-xs text-primary-600 mt-0.5">Track stock, low stock alerts, multi-location, automated reorder.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Customer & Payment Management</h3>
                <p className="text-xs text-primary-600 mt-0.5">Customer ledger, payment tracking, credit limits, balance reports.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Advanced Analytics & Reports</h3>
                <p className="text-xs text-primary-600 mt-0.5">Sales reports, profit analysis, expense tracking, tax reports.</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary-900 text-sm">Multi-Branch & Route Management</h3>
                <p className="text-xs text-primary-600 mt-0.5">Multiple locations, delivery routes, staff assignments, branch reports.</p>
              </div>
            </div>
          </div>

          {/* Business Benefits - Compact */}
          <div className="mt-5 p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-primary-200">
            <h3 className="font-bold text-primary-900 text-sm mb-2">Why Choose HexaBill?</h3>
            <ul className="space-y-1 text-xs text-primary-700">
              <li className="flex items-center gap-1.5">
                <span className="text-primary-600 font-semibold">✓</span>
                <span><strong>Save Time:</strong> Automate invoicing & inventory</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-primary-600 font-semibold">✓</span>
                <span><strong>Grow Faster:</strong> Real-time insights & data-driven decisions</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-primary-600 font-semibold">✓</span>
                <span><strong>Scale Easily:</strong> Single location to multi-branch</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-primary-600 font-semibold">✓</span>
                <span><strong>Stay Compliant:</strong> Tax reports, VAT, audit trails</span>
              </li>
            </ul>
          </div>

          {/* SEO Keywords - Compact */}
          <div className="mt-4 text-xs text-primary-600 leading-snug">
            <p>
              <strong>Perfect for:</strong> Retail, wholesale, restaurants, e-commerce, manufacturing.
              <strong className="text-primary-700"> Trusted across UAE, Saudi Arabia, India & 50+ countries.</strong>
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 overflow-y-auto">
        <div className={`max-w-md w-full space-y-6 ${textAlign}`}>
          <div className={isRtl ? 'text-right' : 'text-center'}>
            <div className={`mb-4 lg:hidden ${isRtl ? 'flex justify-end' : 'mx-auto flex justify-center'}`}>
              <Logo size="large" showText={true} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900" style={{ fontFamily: "'Inter', sans-serif" }}>
              {isSuperAdminLogin ? 'Admin Portal' : 'Sign in'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500" style={{ fontFamily: "'Inter', sans-serif" }}>
              {isSuperAdminLogin ? 'Manage the platform' : companyName !== 'HexaBill' ? `Sign in to ${companyName} — Admins, Staff & Owners` : 'Sign in with your company account'}
            </p>
          </div>

          <div className={`bg-white py-8 px-6 rounded-xl border border-neutral-200 ${(errors.email || errors.password) ? 'animate-shake' : ''}`}>
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <Input
                ref={emailInputRef}
                label="Email Address"
                type="email"
                placeholder="Enter your email address"
                required
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                icon={<Mail className="h-5 w-5 text-gray-400" />}
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  error={errors.password?.message}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  icon={<Lock className="h-5 w-5 text-neutral-400" />}
                />
                <button
                  type="button"
                  className={`absolute top-8 text-neutral-400 hover:text-neutral-600 ${isRtl ? 'left-3' : 'right-3'}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                  />
                  <label htmlFor="remember-me" className={isRtl ? 'mr-2 ml-0' : 'ml-2'} dir={dir}>
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <a href="#" className="font-medium text-primary-600 hover:text-primary-500" dir={dir}>
                    Forgot your password?
                  </a>
                </div>
              </div>

              <LoadingButton
                type="submit"
                loading={loading}
                disabled={loading}
                className="w-full"
              >
                Sign in
              </LoadingButton>
            </form>
          </div>

          {/* Admin Portal: link to main app so company users don't get stuck */}
          {isSuperAdminLogin && (
            <div className={isRtl ? 'text-right mt-4' : 'text-center mt-4'}>
              <a href="/login" className="text-sm text-primary-600 hover:text-primary-700 font-medium" dir={dir}>
                {isRtl ? '← Company user? Sign in to your billing app here' : 'Company user? Sign in to your billing app here →'}
              </a>
            </div>
          )}

          <div className={`text-sm text-neutral-400 ${isRtl ? 'text-right' : 'text-center'}`} style={{ fontFamily: "'Inter', sans-serif" }}>
            <p>© 2026 HexaBill</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login