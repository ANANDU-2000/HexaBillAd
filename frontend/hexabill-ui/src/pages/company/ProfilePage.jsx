import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Lock,
  CheckCircle,
  AlertCircle,
  History,
  Camera,
  Globe
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { useBranding } from '../../contexts/TenantBrandingContext'
import Modal from '../../components/Modal'
import { LoadingCard } from '../../components/Loading'
import { authAPI } from '../../services'
import toast from 'react-hot-toast'

import { getApiBaseUrlNoSuffix } from '../../services/apiConfig'
const getUploadsUrl = (path) => (path ? `${getApiBaseUrlNoSuffix()}/uploads/${path}` : null)

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' }
]

const ProfilePage = () => {
  const { user: currentUser, updateUser } = useAuth()
  const { companyName } = useBranding()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm()

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    watch: watchPassword,
    formState: { errors: errorsPassword }
  } = useForm()

  const newPassword = watchPassword('newPassword')

  useEffect(() => {
    loadProfile()
  }, [])

  // Apply language preference to document (RTL for Arabic)
  useEffect(() => {
    const lang = profile?.languagePreference || localStorage.getItem('hexabill_lang') || 'en'
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'en'
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [profile?.languagePreference])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const response = await authAPI.getProfile()
      if (response?.success && response?.data) {
        const data = response.data
        setProfile(data)
        setValue('name', data.name)
        setValue('phone', data.phone || '')
        setValue('languagePreference', data.languagePreference || 'en')
      } else {
        toast.error('Failed to load profile')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (data) => {
    try {
      setLoading(true)
      const payload = { name: data.name, phone: data.phone || '', languagePreference: data.languagePreference || 'en' }
      const response = await authAPI.updateProfile(payload)
      if (response?.success && response?.data) {
        setProfile(response.data)
        if (updateUser) {
          updateUser({ ...currentUser, name: response.data.name })
        }
        localStorage.setItem('hexabill_lang', response.data.languagePreference || 'en')
        toast.success('Profile updated successfully!')
      } else {
        toast.error(response?.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(error?.response?.data?.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Please choose a JPEG, PNG, GIF or WebP image')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    try {
      setUploadingPhoto(true)
      const response = await authAPI.uploadProfilePhoto(file)
      if (response?.success && response?.data) {
        setProfile(response.data)
        toast.success('Profile photo updated')
      } else {
        toast.error(response?.message || 'Failed to upload photo')
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleChangePasswordSubmit = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('New password and confirm password do not match')
      return
    }
    try {
      setLoading(true)
      const result = await authAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword })
      if (result?.success) {
        toast.success('Password changed successfully!')
        setShowPasswordModal(false)
        resetPassword()
      } else {
        toast.error(result?.message || 'Failed to change password')
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const getPasswordStrength = (p) => {
    if (!p || p.length < 6) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
    if (/\d/.test(p)) s++
    if (/[^a-zA-Z0-9]/.test(p)) s++
    if (p.length >= 12) s++
    return Math.min(5, s)
  }

  if (loading && !profile) {
    return <LoadingCard message="Loading profile..." />
  }

  const role = profile?.role || currentUser?.role
  const roleChipClass = role === 'Owner' ? 'bg-amber-100 text-amber-800' : role === 'Admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
  const photoUrl = getUploadsUrl(profile?.profilePhotoUrl)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="p-4 sm:p-6 w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            My Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">Account details and security</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-6 sm:px-6 sm:py-7">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/40">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 sm:h-10 sm:w-10" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-800 text-white hover:bg-blue-900 border-2 border-white shadow transition disabled:opacity-50"
                  title="Change photo"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold truncate">{profile?.name || currentUser?.name}</h2>
                <p className="text-blue-100 text-sm truncate mt-0.5">{profile?.email || currentUser?.email}</p>
                <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${roleChipClass}`}>
                  <Shield className="h-3.5 w-3.5" />
                  {role || 'User'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(handleUpdateProfile)} className="p-5 sm:p-6 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Mail className="h-4 w-4 text-gray-500" />
                Email
              </label>
              <input
                type="email"
                value={profile?.email || currentUser?.email || ''}
                readOnly
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-amber-600 mt-1">
                Email cannot be changed here. If you need a new email, ask your admin to update or recreate your account.
              </p>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <User className="h-4 w-4 text-gray-500" />
                Name
              </label>
              <input
                type="text"
                {...register('name', { required: 'Name is required' })}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Phone className="h-4 w-4 text-gray-500" />
                Phone
              </label>
              <input
                type="text"
                {...register('phone')}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Globe className="h-4 w-4 text-gray-500" />
                Language / اللغة
              </label>
              <select
                {...register('languagePreference')}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LANGUAGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Interface language (English / Arabic). Targets Arabic-speaking markets.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Lock className="h-4 w-4" />
                Change password
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
              <p className="text-sm font-semibold text-gray-900">Active</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account</p>
              <p className="text-sm font-semibold text-gray-900">{companyName || currentUser?.name || 'Your account'}</p>
            </div>
          </div>
        </div>

        {isAdminOrOwner(currentUser) && (
          <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Danger zone
            </h3>
            <p className="text-sm text-red-700 mt-1 mb-3">
              Reset company data: wipe sales, purchases, expenses. Keeps users, products, customers; resets stock and balances.
            </p>
            <button
              type="button"
              onClick={() => navigate('/settings', { state: { tab: 'backup' } })}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-white border-2 border-red-300 rounded-xl hover:bg-red-50 transition-colors"
            >
              <History className="h-4 w-4" />
              Clear all data
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); resetPassword() }}
        title="Change Password"
      >
        <form onSubmit={handleSubmitPassword(handleChangePasswordSubmit)} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" />
              Use at least 8 characters with upper and lower case and a number. Avoid common passwords.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
            <input
              type="password"
              {...registerPassword('currentPassword', { required: 'Current password is required' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errorsPassword.currentPassword && <p className="text-red-500 text-xs mt-1">{errorsPassword.currentPassword.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <input
              type="password"
              {...registerPassword('newPassword', {
                required: 'New password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
                validate: (v) => {
                  if (!v) return true
                  const weak = ['123456', '12345678', '1234', 'password', 'qwerty', 'abc123', 'admin', 'letmein']
                  if (weak.some(w => v.toLowerCase().includes(w))) return 'Avoid common passwords'
                  if (!/[a-z]/.test(v) || !/[A-Z]/.test(v)) return 'Use both upper and lower case'
                  if (!/\d/.test(v)) return 'Include at least one number'
                  return true
                }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errorsPassword.newPassword && <p className="text-red-500 text-xs mt-1">{errorsPassword.newPassword.message}</p>}
            {newPassword && (
              <div className="mt-1 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded ${getPasswordStrength(newPassword) >= i ? 'bg-green-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
            <input
              type="password"
              {...registerPassword('confirmPassword', { required: 'Please confirm your new password' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errorsPassword.confirmPassword && <p className="text-red-500 text-xs mt-1">{errorsPassword.confirmPassword.message}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => { setShowPasswordModal(false); resetPassword() }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ProfilePage
