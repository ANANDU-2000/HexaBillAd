import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { 
  User, 
  Mail, 
  Phone, 
  Shield,
  Save,
  Lock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  History
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { useBranding } from '../../contexts/TenantBrandingContext'
import Modal from '../../components/Modal'
import { LoadingCard } from '../../components/Loading'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const ProfilePage = () => {
  const { user: currentUser, updateUser } = useAuth()
  const { companyName } = useBranding()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

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
    formState: { errors: errorsPassword }
  } = useForm()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      if (data.success && data.data) {
        setProfile(data.data)
        setValue('name', data.data.name)
        setValue('phone', data.data.phone || '')
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
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      
      if (result.success && result.data) {
        setProfile(result.data)
        // Update user in auth context with new name
        if (updateUser) {
          updateUser({ ...currentUser, name: result.data.name })
        }
        toast.success('Profile updated successfully!')
      } else {
        toast.error(result.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (data) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/auth/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        })
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success('Password changed successfully!')
        setShowPasswordModal(false)
        resetPassword()
      } else {
        toast.error(result.message || 'Failed to change password')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !profile) {
    return <LoadingCard message="Loading profile..." />
  }

  const role = profile?.role || currentUser?.role
  const roleChipClass = role === 'Owner' ? 'bg-amber-100 text-amber-800' : role === 'Admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="p-4 sm:p-6 w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            My Profile
          </h1>
          <p className="text-sm text-gray-500 mt-1">Account details and security</p>
        </div>

        {/* Profile header card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-6 sm:px-6 sm:py-7">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <User className="h-8 w-8 sm:h-10 sm:w-10" />
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
                value={profile?.email || currentUser?.email}
                disabled
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
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

        {/* Status chips */}
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

        {/* Owner/Admin: Clear all data - link to Settings > Backup */}
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

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          resetPassword()
        }}
        title="Change Password"
      >
        <form onSubmit={handleSubmitPassword(handleChangePassword)} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
              Choose a strong password with at least 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
            <input
              type="password"
              {...registerPassword('currentPassword', { 
                required: 'Current password is required'
              })}
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
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errorsPassword.newPassword && <p className="text-red-500 text-xs mt-1">{errorsPassword.newPassword.message}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false)
                resetPassword()
              }}
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

