import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Upload,
  Save,
  Building2,
  DollarSign,
  Globe,
  Image,
  Trash2,
  Eye,
  Download,
  Database,
  RefreshCw,
  Trash,
  HardDrive,
  FolderDown,
  Shield,
  History
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Input, Select, TextArea } from '../../components/Form'
import { LoadingButton } from '../../components/Loading'
import Modal from '../../components/Modal'
import { LoadingCard } from '../../components/Loading'
import { TabNavigation } from '../../components/ui'
import { adminAPI } from '../../services'
import toast from 'react-hot-toast'
import { isAdminOrOwner } from '../../utils/roles'  // CRITICAL: Multi-tenant role checking
import { useBranding } from '../../contexts/TenantBrandingContext'

const SettingsPage = () => {
  const { user } = useAuth()
  const { refresh: refreshBranding } = useBranding()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [backups, setBackups] = useState([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [activeTab, setActiveTab] = useState(location.state?.tab === 'backup' ? 'backup' : 'company')
  const [showClearDataModal, setShowClearDataModal] = useState(false)
  const [clearDataConfirmation, setClearDataConfirmation] = useState('')
  const [clearDataCheckbox, setClearDataCheckbox] = useState(false)
  const [loadingClearData, setLoadingClearData] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [settings, setSettings] = useState({
    companyNameEn: 'HexaBill',
    companyNameAr: 'هيكسابيل',
    companyTrn: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    defaultCurrency: 'AED',
    vatPercentage: 5,
    invoiceTemplate: '',
    logoUrl: '',
    cloudBackupEnabled: false,
    cloudBackupClientId: '',
    cloudBackupClientSecret: '',
    cloudBackupRefreshToken: '',
    cloudBackupFolderId: ''
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: settings
  })

  const currencyOptions = [
    { value: 'AED', label: 'AED - UAE Dirham' },
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' }
  ]

  useEffect(() => {
    if (location.state?.tab === 'backup') setActiveTab('backup')
  }, [location.state?.tab])

  useEffect(() => {
    fetchSettings()
    if (isAdminOrOwner(user)) {
      fetchBackups()
    }

    // Update app icon on mount if logo exists
    const updateIconOnMount = async () => {
      try {
        const response = await adminAPI.getSettings()
        if (response.success) {
          const logoUrl = response.data.COMPANY_LOGO ||
            response.data.LOGO_URL ||
            response.data.company_logo ||
            response.data.logoUrl ||
            ''
          if (logoUrl) {
            await updateAppIcon(logoUrl)
          }
        }
      } catch (error) {
        console.error('Error loading logo for icon:', error)
      }
    }
    updateIconOnMount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBackups = async () => {
    try {
      setLoadingBackups(true)
      const response = await adminAPI.getBackups()
      if (response.success) {
        setBackups(response.data || [])
      }
    } catch (error) {
      console.error('Failed to load backups:', error)
    } finally {
      setLoadingBackups(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setLoadingBackups(true)
      const response = await adminAPI.createBackup()
      if (response.success) {
        toast.success('Backup created successfully!')
        await fetchBackups()
      } else {
        toast.error(response.message || 'Failed to create backup')
      }
    } catch (error) {
      toast.error('Failed to create backup')
    } finally {
      setLoadingBackups(false)
    }
  }

  const handleCreateFullBackup = async (exportToDesktop = false) => {
    try {
      setLoadingBackups(true)
      const response = await adminAPI.createFullBackup(exportToDesktop)
      if (response.success) {
        toast.success(exportToDesktop
          ? 'Full backup created and exported to Desktop!'
          : 'Full backup created successfully!')
        await fetchBackups()
      } else {
        toast.error(response.message || 'Failed to create full backup')
      }
    } catch (error) {
      toast.error('Failed to create full backup')
    } finally {
      setLoadingBackups(false)
    }
  }

  const handleDownloadBackup = async (fileName) => {
    try {
      const blob = await adminAPI.downloadBackup(fileName)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Backup downloaded')
    } catch (error) {
      toast.error('Failed to download backup')
    }
  }

  const handleDeleteBackup = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return

    try {
      const response = await adminAPI.deleteBackup(fileName)
      if (response.success) {
        toast.success('Backup deleted')
        await fetchBackups()
      } else {
        toast.error(response.message || 'Failed to delete backup')
      }
    } catch (error) {
      toast.error('Failed to delete backup')
    }
  }

  const handleRestoreBackup = async (fileName) => {
    if (!window.confirm(`This will restore the database from ${fileName}. This action cannot be undone. Continue?`)) return

    try {
      const response = await adminAPI.restoreBackup(fileName)
      if (response.success) {
        toast.success('Backup restored successfully! Refreshing data...')
        // Refresh settings and backups, then use client-side navigation instead of full page reload
        await fetchSettings()
        await fetchBackups()
        setTimeout(() => {
          navigate(0) // Client-side reload using react-router
        }, 1000)
      } else {
        toast.error(response.message || 'Failed to restore backup')
      }
    } catch (error) {
      toast.error('Failed to restore backup')
    }
  }

  const handleClearAllData = async () => {
    if (!clearDataCheckbox || clearDataConfirmation.trim().toUpperCase() !== 'CLEAR') {
      toast.error('Check the box and type CLEAR to confirm')
      return
    }
    try {
      setLoadingClearData(true)
      const response = await settingsAPI.clearData()
      if (response?.success) {
        toast.success(response.message || 'All transactional data has been cleared.')
        setShowClearDataModal(false)
        setClearDataConfirmation('')
        setClearDataCheckbox(false)
        setTimeout(() => navigate(0), 1500)
      } else {
        toast.error(response?.message || 'Failed to clear data')
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to clear data')
    } finally {
      setLoadingClearData(false)
    }
  }

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getSettings()
      if (response.success && response.data) {
        // Map backend keys to frontend keys
        // Get logo URL - check multiple possible keys
        const logoUrl = response.data.COMPANY_LOGO ||
          response.data.COMPANY_LOGO_URL ||
          response.data.company_logo ||
          response.data.logoUrl ||
          ''

        const mappedSettings = {
          companyNameEn: response.data.COMPANY_NAME_EN || response.data.companyNameEn || '',
          companyNameAr: response.data.COMPANY_NAME_AR || response.data.companyNameAr || '',
          companyTrn: response.data.COMPANY_TRN || response.data.companyTrn || '',
          companyAddress: response.data.COMPANY_ADDRESS || response.data.companyAddress || '',
          companyPhone: response.data.COMPANY_PHONE || response.data.companyPhone || '',
          companyEmail: response.data.COMPANY_EMAIL || response.data.companyEmail || '',
          defaultCurrency: response.data.CURRENCY || response.data.defaultCurrency || 'AED',
          vatPercentage: parseFloat(response.data.VAT_PERCENT || response.data.vatPercentage || '5'),
          invoiceTemplate: response.data.INVOICE_TEMPLATE || response.data.invoiceTemplate || '',
          logoUrl: logoUrl,
          cloudBackupEnabled: response.data.CLOUD_BACKUP_ENABLED === 'true' || response.data.cloudBackupEnabled === true,
          cloudBackupClientId: response.data.CLOUD_BACKUP_CLIENT_ID || response.data.cloudBackupClientId || '',
          cloudBackupClientSecret: response.data.CLOUD_BACKUP_CLIENT_SECRET || response.data.cloudBackupClientSecret || '',
          cloudBackupRefreshToken: response.data.CLOUD_BACKUP_REFRESH_TOKEN || response.data.cloudBackupRefreshToken || '',
          cloudBackupFolderId: response.data.CLOUD_BACKUP_FOLDER_ID || response.data.cloudBackupFolderId || ''
        }
        setSettings(mappedSettings)
        // Set form values
        Object.keys(mappedSettings).forEach(key => {
          setValue(key, mappedSettings[key])
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      setSaving(true)
      // Map frontend keys to backend keys
      const backendSettings = {
        COMPANY_NAME_EN: data.companyNameEn || '',
        COMPANY_NAME_AR: data.companyNameAr || '',
        COMPANY_TRN: data.companyTrn || '',
        COMPANY_ADDRESS: data.companyAddress || '',
        COMPANY_PHONE: data.companyPhone || '',
        COMPANY_EMAIL: data.companyEmail || '',
        CURRENCY: data.defaultCurrency || 'AED',
        VAT_PERCENT: data.vatPercentage?.toString() || '5',
        INVOICE_TEMPLATE: data.invoiceTemplate || '',
        CLOUD_BACKUP_ENABLED: data.cloudBackupEnabled?.toString() || 'false',
        CLOUD_BACKUP_CLIENT_ID: data.cloudBackupClientId || '',
        CLOUD_BACKUP_CLIENT_SECRET: data.cloudBackupClientSecret || '',
        CLOUD_BACKUP_REFRESH_TOKEN: data.cloudBackupRefreshToken || '',
        CLOUD_BACKUP_FOLDER_ID: data.cloudBackupFolderId || ''
      }

      // Only include logoUrl if it's set
      if (data.logoUrl) {
        backendSettings.COMPANY_LOGO = data.logoUrl
      }

      const response = await adminAPI.updateSettings(backendSettings)
      if (response.success) {
        setSettings(data)
        await refreshBranding()
        toast.success('Settings saved successfully!')
      } else {
        toast.error(response.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      const msg = error?.response?.data?.message || error?.response?.data?.errors?.[0] || error?.message || 'Failed to save settings'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    try {
      setUploadingLogo(true)
      setSaving(true)

      const reader = new FileReader()
      reader.onload = (e) => setLogoPreview(e.target.result)
      reader.readAsDataURL(file)

      const response = await adminAPI.uploadLogo(file)
      if (response?.success) {
        const logoUrl = response.data || `/uploads/${file.name}`
        setSettings(prev => ({ ...prev, logoUrl }))
        setValue('logoUrl', logoUrl)
        await updateAppIcon(logoUrl)
        await refreshBranding()
        toast.success('Logo uploaded. App name and logo updated.')
        setShowLogoModal(false)
        await fetchSettings()
      } else {
        toast.error(response?.message || 'Failed to upload logo')
      }
    } catch (error) {
      console.error('Logo upload error:', error)
      toast.error(error?.response?.data?.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      setSaving(false)
    }
  }

  const handleLogoDelete = async () => {
    try {
      setSaving(true)
      const response = await adminAPI.deleteLogo()
      if (response?.success) {
        setLogoPreview(null)
        setSettings(prev => ({ ...prev, logoUrl: '' }))
        setValue('logoUrl', '')
        await updateAppIcon('/vite.svg')
        await refreshBranding()
        toast.success('Logo removed.')
        await fetchSettings()
      } else {
        toast.error(response?.message || 'Failed to delete logo')
      }
    } catch (error) {
      console.error('Logo delete error:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete logo')
    } finally {
      setSaving(false)
    }
  }

  // Update app icon and manifest when logo changes
  const updateAppIcon = async (logoUrl) => {
    try {
      // Get full URL for logo
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'
      const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${apiBaseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`

      // Update favicon in document
      const favicon = document.querySelector("link[rel='icon']") || document.createElement('link')
      favicon.rel = 'icon'
      favicon.type = logoUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
      favicon.href = fullLogoUrl
      if (!document.querySelector("link[rel='icon']")) {
        document.head.appendChild(favicon)
      }

      // Update apple-touch-icon for iOS
      let appleIcon = document.querySelector("link[rel='apple-touch-icon']")
      if (!appleIcon) {
        appleIcon = document.createElement('link')
        appleIcon.rel = 'apple-touch-icon'
        document.head.appendChild(appleIcon)
      }
      appleIcon.href = fullLogoUrl

      // Update manifest.webmanifest dynamically
      const manifestLink = document.querySelector("link[rel='manifest']")
      if (manifestLink) {
        try {
          const manifestResponse = await fetch('/manifest.webmanifest')
          const manifest = await manifestResponse.json()

          // Update icons in manifest
          manifest.icons = [
            {
              src: fullLogoUrl,
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: fullLogoUrl,
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: fullLogoUrl,
              sizes: "any",
              type: logoUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
            }
          ]

          // Update manifest file (this requires backend support or we store in localStorage)
          // For now, we'll update the link to force refresh
          manifestLink.href = `/manifest.webmanifest?t=${Date.now()}`

          // Store manifest in localStorage for dynamic updates
          localStorage.setItem('appManifest', JSON.stringify(manifest))
        } catch (err) {
          console.warn('Could not update manifest:', err)
        }
      }

      console.log('✅ App icon updated successfully')
    } catch (error) {
      console.error('Error updating app icon:', error)
    }
  }

  if (loading) {
    return <LoadingCard message="Loading settings..." />
  }

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    ...(isAdminOrOwner(user) ? [{ id: 'backup', label: 'Backup', icon: Database }] : [])
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your company settings and preferences</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2" />
            Export Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Company Tab */}
        {activeTab === 'company' && (
          <>
            {/* Company Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Building2 className="h-6 w-6 text-primary-600 mr-3" />
                <h2 className="text-lg font-semibold text-neutral-900">Company Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Company Name (English)"
                  placeholder="HexaBill"
                  required
                  error={errors.companyNameEn?.message}
                  {...register('companyNameEn', { required: 'Company name is required' })}
                />

                <Input
                  label="Company Name (Arabic)"
                  placeholder="ستار بلس لتجارة المواد الغذائية"
                  error={errors.companyNameAr?.message}
                  {...register('companyNameAr')}
                />

                <Input
                  label="TRN Number"
                  placeholder="TRN123456789"
                  error={errors.companyTrn?.message}
                  {...register('companyTrn')}
                />

                <Input
                  label="Phone Number"
                  placeholder="+971 4 123 4567"
                  error={errors.companyPhone?.message}
                  {...register('companyPhone')}
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="info@hexabill.com"
                  error={errors.companyEmail?.message}
                  {...register('companyEmail')}
                />

                <div className="md:col-span-2">
                  <TextArea
                    label="Address"
                    placeholder="Dubai, UAE"
                    rows={3}
                    error={errors.companyAddress?.message}
                    {...register('companyAddress')}
                  />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Image className="h-6 w-6 text-primary-600 mr-3" />
                <h2 className="text-lg font-semibold text-neutral-900">Company Logo</h2>
              </div>

              <div className="flex items-center space-x-6">
                {/* Logo Preview */}
                <div className="flex-shrink-0">
                  {logoPreview || settings.logoUrl ? (
                    <div className="relative">
                      <img
                        src={logoPreview || (settings.logoUrl?.startsWith('http') ? settings.logoUrl : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${settings.logoUrl?.startsWith('/') ? '' : '/'}${settings.logoUrl}`)}
                        alt="Company Logo"
                        className="h-24 w-24 object-contain border border-gray-200 rounded-lg"
                        onError={(e) => {
                          // Fallback if logo not found
                          e.target.style.display = 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleLogoDelete}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                      <Image className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {logoPreview || settings.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </button>

                    <p className="text-sm text-gray-500">
                      Recommended size: 200x200px. Supported formats: PNG, JPG, GIF, SVG. Max size: 5MB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <>
            {/* Business Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <DollarSign className="h-6 w-6 text-primary-600 mr-3" />
                <h2 className="text-lg font-semibold text-neutral-900">Business Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Default Currency"
                  options={currencyOptions}
                  error={errors.defaultCurrency?.message}
                  {...register('defaultCurrency', { required: 'Default currency is required' })}
                />

                <Input
                  label="VAT Percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="5"
                  error={errors.vatPercentage?.message}
                  {...register('vatPercentage', {
                    required: 'VAT percentage is required',
                    min: { value: 0, message: 'VAT must be 0 or greater' },
                    max: { value: 100, message: 'VAT must be 100 or less' }
                  })}
                />
              </div>
            </div>

            {/* Invoice Template */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Globe className="h-6 w-6 text-primary-600 mr-3" />
                <h2 className="text-lg font-semibold text-neutral-900">Invoice Template</h2>
              </div>

              <div className="space-y-4">
                <TextArea
                  label="Custom Invoice Template (HTML)"
                  placeholder="Enter custom HTML template for invoices..."
                  rows={8}
                  error={errors.invoiceTemplate?.message}
                  {...register('invoiceTemplate')}
                />

                <div className="flex space-x-3">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Template
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && isAdminOrOwner(user) && (
          <>
            {/* Cloud Backup Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Globe className="h-6 w-6 text-purple-600 mr-3" />
                <h2 className="text-lg font-semibold text-neutral-900">Cloud Backup Settings</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="cloudBackupEnabled"
                    {...register('cloudBackupEnabled')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="cloudBackupEnabled" className="ml-2 block text-sm text-gray-900">
                    Enable Google Drive Cloud Backup
                  </label>
                </div>

                {watch('cloudBackupEnabled') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-purple-200">
                    <Input
                      label="Client ID"
                      type="text"
                      placeholder="your-client-id.apps.googleusercontent.com"
                      error={errors.cloudBackupClientId?.message}
                      {...register('cloudBackupClientId')}
                    />
                    <Input
                      label="Client Secret"
                      type="password"
                      placeholder="your-client-secret"
                      error={errors.cloudBackupClientSecret?.message}
                      {...register('cloudBackupClientSecret')}
                    />
                    <Input
                      label="Refresh Token"
                      type="password"
                      placeholder="your-refresh-token"
                      error={errors.cloudBackupRefreshToken?.message}
                      {...register('cloudBackupRefreshToken')}
                    />
                    <Input
                      label="Folder ID (Optional)"
                      type="text"
                      placeholder="Leave empty for root folder"
                      error={errors.cloudBackupFolderId?.message}
                      {...register('cloudBackupFolderId')}
                    />
                  </div>
                )}

                <p className="text-sm text-gray-500 pl-6">
                  Configure Google Drive OAuth credentials to enable automatic cloud backups.
                  See documentation for setup instructions.
                </p>
              </div>
            </div>

            {/* Backup & Restore Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <Database className="h-6 w-6 text-indigo-600 mr-3" />
                  <h2 className="text-lg font-semibold text-neutral-900">Backup & Restore</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={loadingBackups}
                    className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                    title="Create database backup only"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    {loadingBackups ? 'Creating...' : 'Database Backup'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateFullBackup(false)}
                    disabled={loadingBackups}
                    className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                    title="Create FULL backup (database + files)"
                  >
                    <HardDrive className="h-4 w-4 mr-2" />
                    {loadingBackups ? 'Creating...' : 'Full Backup (ZIP)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateFullBackup(true)}
                    disabled={loadingBackups}
                    className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    title="Create FULL backup and save to Desktop"
                  >
                    <FolderDown className="h-4 w-4 mr-2" />
                    {loadingBackups ? 'Exporting...' : 'Export to Desktop'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <span>Available Backups:</span>
                  <button
                    type="button"
                    onClick={fetchBackups}
                    disabled={loadingBackups}
                    className="text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingBackups ? (
                  <div className="text-center py-4 text-gray-500">Loading backups...</div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    No backups found. Create your first backup.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {backups.map((fileName, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                          <p className="text-xs text-gray-500">
                            {fileName.includes('_')
                              ? new Date(fileName.split('_')[1]?.replace('.db', '') || fileName.split('_')[1]?.replace('.sql', '') || '').toLocaleString()
                              : 'Date unknown'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(fileName)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(fileName)}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                            title="Restore"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(fileName)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Clear all data - Owner/Admin only */}
            <div className="mt-8 bg-white rounded-lg border-2 border-red-200 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">Reset company data</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Wipe all sales, purchases, expenses, and returns. Keeps users, products, and customers; resets stock and balances to zero.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClearDataConfirmation('')
                    setClearDataCheckbox(false)
                    setShowClearDataModal(true)
                  }}
                  className="bg-white text-red-600 border-2 border-red-300 px-6 py-2.5 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2 flex-shrink-0"
                >
                  <History className="h-5 w-5" />
                  Clear all data
                </button>
              </div>
            </div>
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            loading={saving}
            className="px-8 py-3"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </LoadingButton>
        </div>
      </form>

      {/* Logo Upload Modal */}
      <Modal
        isOpen={showLogoModal}
        onClose={() => !uploadingLogo && setShowLogoModal(false)}
        title="Upload Company Logo"
        size="md"
      >
        <div className="space-y-6">
          <div className={`border-2 border-dashed rounded-lg p-6 text-center transition ${uploadingLogo ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300'}`}>
            {uploadingLogo ? (
              <div className="flex flex-col items-center justify-center py-2">
                <RefreshCw className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
                <span className="mt-3 block text-sm font-medium text-gray-700">Uploading…</span>
                <span className="mt-1 block text-xs text-gray-500">Logo will appear in header and profile when done.</span>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">Click to upload logo</span>
                    <span className="mt-1 block text-sm text-gray-500">PNG, JPG, GIF, SVG up to 5MB</span>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="sr-only"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowLogoModal(false)}
              disabled={uploadingLogo}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingLogo ? 'Uploading…' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear all data modal - serious confirmation */}
      <Modal
        isOpen={showClearDataModal}
        onClose={() => {
          setShowClearDataModal(false)
          setClearDataConfirmation('')
          setClearDataCheckbox(false)
        }}
        title="Danger: Clear all company data"
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="space-y-5 border-2 border-red-600 rounded-xl p-1">
          <div className="bg-red-600 p-4 rounded-xl text-white flex items-start space-x-3">
            <Shield className="h-10 w-10 opacity-80 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-lg leading-tight text-white mb-1">Reset all transactional data</h4>
              <p className="text-sm text-red-100 leading-snug">
                This will permanently delete all sales, purchases, expenses, and returns for your company. Users, products, and customers are kept; stock and balances are set to zero.
              </p>
              <p className="text-sm font-bold text-white mt-2">This action cannot be undone.</p>
            </div>
          </div>
          <div className="space-y-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={clearDataCheckbox}
                onChange={(e) => setClearDataCheckbox(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm font-medium text-red-800">I understand this will permanently delete all transactional data.</span>
            </label>
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase tracking-wider mb-1">Type CLEAR to confirm</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-red-300 rounded-xl bg-white text-red-800 font-bold focus:ring-2 focus:ring-red-400 outline-none transition-all"
                placeholder="CLEAR"
                value={clearDataConfirmation}
                onChange={(e) => setClearDataConfirmation(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowClearDataModal(false)
                setClearDataConfirmation('')
                setClearDataCheckbox(false)
              }}
              className="flex-1 px-4 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-all border border-gray-300"
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleClearAllData}
              loading={loadingClearData}
              disabled={clearDataConfirmation.trim().toUpperCase() !== 'CLEAR' || !clearDataCheckbox}
              className="flex-2 px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg border-2 border-red-700 disabled:opacity-50 disabled:grayscale transition-all"
            >
              Clear all data
            </LoadingButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SettingsPage

