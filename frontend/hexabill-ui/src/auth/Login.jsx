import { forwardRef, useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useBranding } from '../tenant/TenantBrandingContext'
import { authAPI } from '../services/index'
import { getApiBaseUrlNoSuffix } from '../services/apiConfig'
import { isSystemAdmin } from '../utils/superAdmin'
import { getTenantHost } from '../tenant/tenantHost'

const fieldClass = (invalid, hasIcon, hasEnd) =>
  `block h-11 w-full rounded-md border bg-white px-3 text-base text-[#0F172A] shadow-none transition-colors placeholder:text-neutral-400 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-[#F3F4F6] disabled:opacity-40 lg:h-[38px] lg:text-sm dark:border-[#1E293B] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:disabled:bg-[#1E293B] ${hasIcon ? 'ps-9' : ''} ${hasEnd ? 'pe-12' : ''} ${invalid ? 'border-red-300 focus:ring-red-500/20' : 'border-[#E5E7EB]'}`

const AuthField = forwardRef(function AuthField({ id, label, error, icon: Icon, end, className = '', ...props }, ref) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="space-y-1 text-start">
      <label htmlFor={id} className="block text-xs font-medium leading-[1.4] text-neutral-700 dark:text-[#8B9BB4]">
        {label}
        <span className="ms-1 text-error" aria-hidden="true">*</span>
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={2} aria-hidden="true" />
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${fieldClass(!!error, !!Icon, !!end)} ${className}`}
          {...props}
        />
        {end && <div className="absolute inset-y-0 end-0 flex items-center">{end}</div>}
      </div>
      {error && (
        <p id={errorId} className="text-xs leading-[1.4] text-error dark:text-red-400">{error}</p>
      )}
    </div>
  )
})

function PasswordToggle({ shown, onClick, label }) {
  const Icon = shown ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center text-neutral-400 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 lg:h-8 lg:w-8 dark:hover:text-[#F8FAFC]"
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function AuthAlert({ children, onRetry }) {
  if (!children) return null
  return (
    <div role="alert" className="flex gap-2 rounded-md border border-error-border bg-[#FEF2F2] px-3 py-2 text-xs leading-[1.4] text-error-fg dark:border-red-900 dark:bg-[#450A0A] dark:text-red-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div>
        <p>{children}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 font-medium text-primary-600 hover:text-primary-700">
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

function Mark({ name, logoSrc, onLogoError }) {
  if (logoSrc) {
    return (
      <img src={logoSrc} alt="" className="h-8 w-8 object-contain" onError={onLogoError} />
    )
  }
  if (name) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-[20px] font-semibold leading-none text-white">
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }
  return <img src="/hexabill-logo.svg" alt="" className="h-8 w-8 object-contain" />
}

function publicLogoSrc(logoUrl) {
  if (!logoUrl || logoUrl.startsWith('data:') || logoUrl.startsWith('http')) return logoUrl || null
  const path = logoUrl.startsWith('/') ? logoUrl : `/uploads/${logoUrl}`
  return `${getApiBaseUrlNoSuffix()}${path}`
}

function loginFailureMessage(result) {
  if (result?.network) return 'Unable to reach the server. Please check your internet connection.'
  if (result?.status === 429) return 'Too many sign-in attempts. For security, sign-in is locked for 15 minutes.'
  if (result?.status === 401 || result?.status === 400) return 'Incorrect email or password. Please verify your credentials.'
  if (result?.status === 403) return 'Account is deactivated or access restricted. Contact your organization administrator.'
  return 'Authentication service is temporarily unavailable. Please try again shortly.'
}

const Login = ({ isSuperAdminLogin = false }) => {
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)
  const [alert, setAlert] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteConfirm, setInviteConfirm] = useState('')
  const [inviteFieldError, setInviteFieldError] = useState({ password: '', confirm: '' })
  const [logoFailed, setLogoFailed] = useState(false)
  const { login, logout } = useAuth()
  const { companyName, companyLogo, loading: brandingLoading } = useBranding()
  const navigate = useNavigate()
  const location = useLocation()
  const inviteToken = new URLSearchParams(location.search).get('invite')
  const lang = typeof localStorage !== 'undefined' ? (localStorage.getItem('hexabill_lang') || 'en') : 'en'
  const isRtl = lang === 'ar'
  const tenantLogin = !isSuperAdminLogin && getTenantHost().mode === 'tenant'
  const resolvedName = tenantLogin && companyName && companyName !== 'HexaBill' ? companyName : ''
  const showBrandSkeleton = tenantLogin && brandingLoading
  const logoSrc = tenantLogin && !logoFailed ? publicLogoSrc(companyLogo) : null

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ mode: 'onBlur', reValidateMode: 'onBlur' })

  useEffect(() => {
    setLogoFailed(false)
  }, [companyLogo])

  useEffect(() => {
    if (isSuperAdminLogin) {
      document.title = 'Admin Portal'
      return
    }
    if (brandingLoading && tenantLogin) return
    if (inviteToken && !isSuperAdminLogin) {
      document.title = resolvedName ? `${resolvedName} | Set your password` : 'Set your password'
      return
    }
    document.title = resolvedName ? `${resolvedName} | Sign in` : 'Sign in'
  }, [isSuperAdminLogin, brandingLoading, tenantLogin, resolvedName, inviteToken])

  const finishSignIn = async (result) => {
    if (!result?.success) {
      const lockedOut = result?.status === 429
      setLocked(lockedOut)
      setCanRetry(!!result?.network)
      setAlert(loginFailureMessage(result))
      return
    }

    const userPayload = result.data?.user || result.data || {}
    const tenantId = result.data?.tenantId ?? userPayload.tenantId
    const isSuperAdmin = isSystemAdmin({ ...userPayload, tenantId }, result.data?.token)

    if (isSuperAdminLogin) {
      if (isSuperAdmin) {
        navigate('/superadmin/dashboard')
      } else {
        await logout()
        setCanRetry(false)
        setAlert('This portal is restricted to platform administrators.')
      }
      return
    }

    if (isSuperAdmin) {
      await logout()
      setCanRetry(false)
      setAlert('This account belongs to the platform portal.')
      return
    }

    navigate(result.data?.mustChangePassword ? '/profile?forcePassword=1' : '/dashboard')
  }

  const onSubmit = async (data) => {
    if (loading || locked) return
    setAlert('')
    setCanRetry(false)
    setLoading(true)
    try {
      const result = await login({
        email: data.email,
        password: data.password,
        rememberMe: false
      })
      await finishSignIn(result)
    } finally {
      setLoading(false)
    }
  }

  const acceptInvite = async (event) => {
    event.preventDefault()
    if (loading) return
    const next = { password: '', confirm: '' }
    if (invitePassword.length < 8) next.password = 'Password must be at least 8 characters.'
    if (invitePassword !== inviteConfirm) next.confirm = 'Passwords do not match.'
    setInviteFieldError(next)
    setAlert('')
    setCanRetry(false)
    if (next.password || next.confirm) return

    setLoading(true)
    try {
      const result = await authAPI.acceptInvite(inviteToken, invitePassword)
      if (result?.success) {
        navigate('/login', { replace: true })
        return
      }
      setAlert('This invite link has expired or has already been used. Please request a new invite from your administrator.')
    } catch (error) {
      const network = !error.response
      setCanRetry(network)
      setAlert(network
        ? 'Unable to reach the server. Please check your internet connection.'
        : 'This invite link has expired or has already been used. Please request a new invite from your administrator.')
    } finally {
      setLoading(false)
    }
  }

  const heading = inviteToken && !isSuperAdminLogin
    ? 'Set your password'
    : isSuperAdminLogin
      ? 'Admin Portal'
      : (resolvedName || 'Sign in')

  const context = inviteToken && !isSuperAdminLogin
    ? (resolvedName ? `Set your password for ${resolvedName}` : 'This invite works only on your company address and can be used once.')
    : isSuperAdminLogin
      ? 'Platform administration'
      : tenantLogin
        ? (resolvedName ? 'Sign in' : '')
        : 'Access your company workspace.'

  const submitLabel = inviteToken && !isSuperAdminLogin
    ? (loading ? 'Setting password…' : 'Set password')
    : (loading ? 'Signing in…' : 'Sign in')

  return (
    <div className="auth-entry flex min-h-dvh w-full flex-col items-center justify-center overflow-x-hidden bg-[#F8FAFC] px-4 py-6 dark:bg-[#0B1220] md:px-6" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
      <main className="w-full max-w-[400px] rounded-lg border border-[#E5E7EB] bg-white p-6 dark:border-[#1E293B] dark:bg-[#121A22] lg:p-8">
        <header className="mb-6 text-start">
          {showBrandSkeleton ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-8 w-8 animate-pulse rounded-md bg-neutral-200 motion-reduce:animate-none dark:bg-[#1E293B]" />
              <div className="h-5 w-[120px] animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-[#1E293B]" />
            </div>
          ) : (
            <>
              <Mark
                name={isSuperAdminLogin ? '' : resolvedName}
                logoSrc={isSuperAdminLogin ? null : logoSrc}
                onLogoError={() => setLogoFailed(true)}
              />
              <h1 className="mt-3 text-xl font-semibold leading-[1.25] text-[#0F172A] dark:text-[#F8FAFC]">{heading}</h1>
              {context && <p className="mt-1 text-sm leading-[1.4] text-neutral-500 dark:text-[#8B9BB4]">{context}</p>}
            </>
          )}
        </header>

        <AuthAlert onRetry={canRetry ? () => document.querySelector('.auth-entry form')?.requestSubmit() : null}>{alert}</AuthAlert>

        {inviteToken && !isSuperAdminLogin ? (
          <form className="mt-4 space-y-4" onSubmit={acceptInvite} noValidate>
            <AuthField
              id="new-password"
              label="New password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={invitePassword}
              onChange={(event) => setInvitePassword(event.target.value)}
              onBlur={() => {
                if (invitePassword && invitePassword.length < 8) {
                  setInviteFieldError((prev) => ({ ...prev, password: 'Password must be at least 8 characters.' }))
                }
              }}
              error={inviteFieldError.password}
              icon={Lock}
              end={<PasswordToggle shown={showPassword} onClick={() => setShowPassword((value) => !value)} label={showPassword ? 'Hide password' : 'Show password'} />}
            />
            <AuthField
              id="confirm-password"
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={inviteConfirm}
              onChange={(event) => setInviteConfirm(event.target.value)}
              onBlur={() => {
                if (inviteConfirm && inviteConfirm !== invitePassword) {
                  setInviteFieldError((prev) => ({ ...prev, confirm: 'Passwords do not match.' }))
                }
              }}
              error={inviteFieldError.confirm}
              icon={Lock}
              end={<PasswordToggle shown={showConfirm} onClick={() => setShowConfirm((value) => !value)} label={showConfirm ? 'Hide password' : 'Show password'} />}
            />
            <SubmitButton loading={loading} disabled={loading}>{submitLabel}</SubmitButton>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full text-center text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className={`space-y-4 ${alert ? 'mt-4' : ''}`} onSubmit={handleSubmit(onSubmit)} noValidate>
            <AuthField
              id="email"
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="username"
              spellCheck={false}
              required
              icon={Mail}
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
            />
            <AuthField
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              icon={Lock}
              error={errors.password?.message}
              end={<PasswordToggle shown={showPassword} onClick={() => setShowPassword((value) => !value)} label={showPassword ? 'Hide password' : 'Show password'} />}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
            <SubmitButton loading={loading} disabled={loading || locked} locked={locked}>{submitLabel}</SubmitButton>
            <p className="text-xs leading-[1.4] text-neutral-500 dark:text-[#8B9BB4]">
              Need password help? Contact your company administrator.
            </p>
          </form>
        )}

        {isSuperAdminLogin && (
          <p className="mt-4 text-center">
            <Link to="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Company sign in
            </Link>
          </p>
        )}
      </main>
      <p className="mt-6 text-center text-xs text-neutral-500 dark:text-[#8B9BB4]">{resolvedName ? <>Powered by HexaBill</> : <>© {new Date().getFullYear()} HexaBill</>}</p>
    </div>
  )
}

function SubmitButton({ loading, locked, children, disabled }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-[15px] font-medium text-white hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-40 lg:h-[38px] lg:text-sm"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-pulse" aria-hidden="true" />}
      {!loading && locked && <Lock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  )
}

export default Login
