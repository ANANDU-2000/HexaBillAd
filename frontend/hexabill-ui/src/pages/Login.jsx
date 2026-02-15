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
      if (error.response?.status === 429) {
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

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex justify-center mb-4">
            <Logo size="large" showText={true} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            {isSuperAdminLogin ? 'Admin Portal' : 'Sign in'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500" style={{ fontFamily: "'Inter', sans-serif" }}>
            {isSuperAdminLogin ? 'Manage the platform' : companyName !== 'HexaBill' ? `Sign in to ${companyName}` : 'Billing & invoicing'}
          </p>
        </div>

        <div className="bg-white py-8 px-6 rounded-xl border border-neutral-200">
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
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
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
          <div className="text-center mt-4">
            <a href="/login" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Company user? Sign in to your billing app here →
            </a>
          </div>
        )}

        <div className="text-center text-sm text-neutral-400" style={{ fontFamily: "'Inter', sans-serif" }}>
          <p>© 2026 HexaBill</p>
        </div>
      </div>
    </div>
  )
}

export default Login