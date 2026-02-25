import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input, Select } from '../components/Form'
import { LoadingButton } from '../components/Loading'
import toast from 'react-hot-toast'
import api from '../services/api'
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Building2, User } from 'lucide-react'
import Logo from '../components/Logo'

const SignupPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Account, 2: Company, 3: Success
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    phone: '',
    country: 'AE',
    currency: 'AED',
    vatNumber: ''
  })
  const [errors, setErrors] = useState({})
  const [signupResult, setSignupResult] = useState(null)

  const validateStep1 = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors = {}
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (step === 1) {
      if (!validateStep1()) return
      setStep(2)
      return
    }

    if (step === 2) {
      if (!validateStep2()) return
    }

    try {
      setLoading(true)
      const response = await api.post('/auth/signup', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        companyName: formData.companyName,
        phone: formData.phone || null,
        country: formData.country,
        currency: formData.currency,
        vatNumber: formData.vatNumber || null
      })

      if (response.data.success) {
        setSignupResult(response.data.data)
        setStep(3)
        toast.success('Account created successfully!')
      } else {
        toast.error(response.data.message || 'Signup failed')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Signup failed. Please try again.'
      toast.error(errorMessage)
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors.reduce((acc, err) => {
          acc[Object.keys(acc).length] = err
          return acc
        }, {}))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoginAfterSignup = async () => {
    try {
      const loginResult = await login({
        email: formData.email,
        password: formData.password,
        rememberMe: false
      })

      if (loginResult.success) {
        navigate('/onboarding')
      } else {
        navigate('/login')
      }
    } catch (error) {
      console.error('Login error:', error)
      navigate('/login')
    }
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-neutral-200">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome Aboard!</h2>
          <p className="text-neutral-600 mb-8">
            Your account for <span className="font-bold text-neutral-900">{formData.companyName}</span> has been created.
            Ready to simplify your business operations?
          </p>

          <button
            onClick={handleLoginAfterSignup}
            className="w-full bg-primary-600 text-white py-4 rounded-xl hover:bg-primary-700 font-bold shadow-lg hover:shadow-primary-200 transition-all flex items-center justify-center space-x-2"
          >
            <span>Get Started Now</span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <p className="mt-6 text-sm text-neutral-500">
            Initial setup will take less than 2 minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="mx-auto flex justify-center mb-4">
            <Logo size="large" showText={true} />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Create your account</h1>
          <p className="mt-2 text-neutral-600">
            {step === 1 ? 'Start with your personal details' : 'Tell us about your business'}
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>1</div>
          <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-primary-600' : 'bg-neutral-200'}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}>2</div>
        </div>

        <div className="bg-white py-8 px-8 rounded-2xl border border-neutral-200 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                  required
                  icon={<User className="h-5 w-5 text-neutral-400" />}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={errors.password}
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  error={errors.confirmPassword}
                  required
                />
              </>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Input
                  label="Legal Company Name"
                  placeholder="Acme Trading LLC"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  error={errors.companyName}
                  required
                  icon={<Building2 className="h-5 w-5 text-neutral-400" />}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+971..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <Input
                    label="VAT (TRN)"
                    placeholder="Optional"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  >
                    <option value="AE">UAE</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="KW">Kuwait</option>
                    <option value="QA">Qatar</option>
                    <option value="BH">Bahrain</option>
                    <option value="OM">Oman</option>
                  </Select>
                  <Select
                    label="Currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="AED">AED</option>
                    <option value="SAR">SAR</option>
                    <option value="KWD">KWD</option>
                    <option value="QAR">QAR</option>
                    <option value="BHD">BHD</option>
                    <option value="OMR">OMR</option>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 gap-4">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 border border-neutral-300 rounded-xl text-neutral-600 font-semibold hover:bg-neutral-50 transition-all flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              ) : <div></div>}

              <LoadingButton
                type="submit"
                loading={loading}
                className="flex-[2] bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 font-bold shadow-md hover:shadow-primary-100 transition-all flex items-center justify-center space-x-2"
              >
                <span>{step === 1 ? 'Next Step' : 'Create My Account'}</span>
                {step === 1 && <ArrowRight className="h-5 w-5" />}
              </LoadingButton>
            </div>
          </form>

          <div className="mt-8 text-center pt-8 border-t border-neutral-100">
            <p className="text-sm text-neutral-600 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-bold">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400 max-w-xs mx-auto">
          By creating an account, you agree to our{' '}
          <Link to="/terms" className="hover:text-neutral-600 underline">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="hover:text-neutral-600 underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

export default SignupPage
