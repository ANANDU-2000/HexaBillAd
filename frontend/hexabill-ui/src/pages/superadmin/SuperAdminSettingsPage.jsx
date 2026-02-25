import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  HelpCircle,
  MessageSquare,
  ExternalLink,
  Settings,
  Flag,
  Mail,
  Megaphone,
  Lock,
  Plug,
  Save,
  Construction
} from 'lucide-react'
import { superAdminAPI } from '../../services'
import { Input, Select } from '../../components/Form'
import { LoadingCard, LoadingButton } from '../../components/Loading'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'defaults', name: 'Platform Defaults', icon: Settings },
  { id: 'features', name: 'Feature Flags', icon: Flag },
  { id: 'communication', name: 'Communication', icon: Mail },
  { id: 'announcement', name: 'Announcement Banner', icon: Megaphone },
  { id: 'security', name: 'Security', icon: Lock },
  { id: 'links', name: 'Help & Support', icon: HelpCircle }
]

const CURRENCIES = [
  { value: 'AED', label: 'AED' },
  { value: 'USD', label: 'USD' },
  { value: 'INR', label: 'INR' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' }
]

const SuperAdminSettingsPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('defaults')
  const [form, setForm] = useState({
    defaultTrialDays: 14,
    defaultCurrency: 'AED',
    invoicePrefix: 'INV',
    enableBranches: true,
    enableRoutes: true,
    enableAIInsights: false,
    enableWhatsApp: false,
    welcomeEmail: '',
    suspensionEmail: '',
    trialExpiryEmail: '',
    announcementText: '',
    announcementStart: '',
    announcementEnd: '',
    sessionTimeoutHours: 24,
    maxLoginAttempts: 5,
    maintenanceMode: false,
    maintenanceMessage: 'System under maintenance. Back shortly.',
    subscriptionGracePeriodDays: 5
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await superAdminAPI.getPlatformSettings()
      if (res?.success && res?.data) {
        const d = res.data
        setForm({
          defaultTrialDays: d.defaultTrialDays ?? 14,
          defaultCurrency: d.defaultCurrency || 'AED',
          invoicePrefix: d.invoicePrefix || 'INV',
          enableBranches: d.enableBranches !== false,
          enableRoutes: d.enableRoutes !== false,
          enableAIInsights: d.enableAIInsights === true,
          enableWhatsApp: d.enableWhatsApp === true,
          welcomeEmail: d.welcomeEmail || '',
          suspensionEmail: d.suspensionEmail || '',
          trialExpiryEmail: d.trialExpiryEmail || '',
          announcementText: d.announcementText || '',
          announcementStart: d.announcementStart || '',
          announcementEnd: d.announcementEnd || '',
          sessionTimeoutHours: d.sessionTimeoutHours ?? 24,
          maxLoginAttempts: d.maxLoginAttempts ?? 5,
          maintenanceMode: d.maintenanceMode === true,
          maintenanceMessage: d.maintenanceMessage || 'System under maintenance. Back shortly.',
          subscriptionGracePeriodDays: d.subscriptionGracePeriodDays ?? 5
        })
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error('Failed to load platform settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await superAdminAPI.updatePlatformSettings(form)
      if (res?.success) {
        toast.success('Platform settings saved')
      } else {
        toast.error(res?.message || 'Failed to save')
      }
    } catch (e) {
      if (!e?._handledByInterceptor) toast.error(e?.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6">
        <LoadingCard />
      </div>
    )
  }

  const TabContent = () => {
    if (activeTab === 'defaults') {
      return (
        <div className="space-y-4">
          <Input
            label="Default Trial Days"
            type="number"
            min={1}
            max={90}
            value={form.defaultTrialDays}
            onChange={(e) => setForm({ ...form, defaultTrialDays: parseInt(e.target.value, 10) || 14 })}
          />
          <Select
            label="Default Currency"
            options={CURRENCIES}
            value={form.defaultCurrency}
            onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
          />
          <Input
            label="Invoice Number Prefix"
            value={form.invoicePrefix}
            onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
            placeholder="INV"
          />
        </div>
      )
    }
    if (activeTab === 'features') {
      return (
        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer">
            <span>Enable Branches & Routes (default for new tenants)</span>
            <input
              type="checkbox"
              checked={form.enableBranches}
              onChange={(e) => setForm({ ...form, enableBranches: e.target.checked })}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer">
            <span>Enable Routes</span>
            <input
              type="checkbox"
              checked={form.enableRoutes}
              onChange={(e) => setForm({ ...form, enableRoutes: e.target.checked })}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer">
            <span>Enable AI Insights</span>
            <input
              type="checkbox"
              checked={form.enableAIInsights}
              onChange={(e) => setForm({ ...form, enableAIInsights: e.target.checked })}
              className="rounded"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer">
            <span>Enable WhatsApp Integration</span>
            <input
              type="checkbox"
              checked={form.enableWhatsApp}
              onChange={(e) => setForm({ ...form, enableWhatsApp: e.target.checked })}
              className="rounded"
            />
          </label>
        </div>
      )
    }
    if (activeTab === 'communication') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Variables: {'{companyName}'}, {'{trialEndDate}'}, {'{ownerEmail}'}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Email</label>
            <textarea
              value={form.welcomeEmail}
              onChange={(e) => setForm({ ...form, welcomeEmail: e.target.value })}
              rows={4}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Welcome to HexaBill, {companyName}..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suspension Notice</label>
            <textarea
              value={form.suspensionEmail}
              onChange={(e) => setForm({ ...form, suspensionEmail: e.target.value })}
              rows={4}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Your account has been suspended..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trial Expiry Warning</label>
            <textarea
              value={form.trialExpiryEmail}
              onChange={(e) => setForm({ ...form, trialExpiryEmail: e.target.value })}
              rows={4}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Your trial expires on {trialEndDate}..."
            />
          </div>
        </div>
      )
    }
    if (activeTab === 'announcement') {
      return (
        <div className="space-y-4">
          <Input
            label="Announcement Text"
            value={form.announcementText}
            onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
            placeholder="e.g. Maintenance on Sunday 2am-4am UAE time"
          />
          <Input
            label="Start Date (YYYY-MM-DD)"
            type="date"
            value={form.announcementStart}
            onChange={(e) => setForm({ ...form, announcementStart: e.target.value })}
          />
          <Input
            label="End Date (YYYY-MM-DD)"
            type="date"
            value={form.announcementEnd}
            onChange={(e) => setForm({ ...form, announcementEnd: e.target.value })}
          />
        </div>
      )
    }
    if (activeTab === 'security') {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 font-medium text-amber-900">
                <Construction className="h-5 w-5" />
                Maintenance Mode
              </span>
              <input
                type="checkbox"
                checked={form.maintenanceMode}
                onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
                className="rounded"
              />
            </label>
            <p className="text-sm text-amber-700 mt-2">When ON, all tenant users see a maintenance screen. SuperAdmin can still access.</p>
            {form.maintenanceMode && (
              <Input
                label="Maintenance Message"
                value={form.maintenanceMessage}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value })}
                placeholder="System under maintenance. Back shortly."
                className="mt-3"
              />
            )}
          </div>
          <Input
            label="Session Timeout (hours)"
            type="number"
            min={1}
            max={168}
            value={form.sessionTimeoutHours}
            onChange={(e) => setForm({ ...form, sessionTimeoutHours: parseInt(e.target.value, 10) || 24 })}
          />
          <Input
            label="Max Login Attempts Before Lockout"
            type="number"
            min={3}
            max={20}
            value={form.maxLoginAttempts}
            onChange={(e) => setForm({ ...form, maxLoginAttempts: parseInt(e.target.value, 10) || 5 })}
          />
          <Input
            label="Subscription Grace Period (days)"
            type="number"
            min={0}
            max={30}
            value={form.subscriptionGracePeriodDays}
            onChange={(e) => setForm({ ...form, subscriptionGracePeriodDays: parseInt(e.target.value, 10) || 5 })}
          />
          <p className="text-sm text-neutral-500">Days of full access after subscription expires before blocking. 0 = block immediately.</p>
        </div>
      )
    }
    if (activeTab === 'links') {
      return (
        <div className="space-y-4">
          <Link
            to="/help"
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition"
          >
            <span className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-neutral-500" />
              <span className="font-medium text-neutral-900">Help & Support</span>
            </span>
            <ExternalLink className="h-4 w-4 text-neutral-400" />
          </Link>
          <Link
            to="/feedback"
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-300 transition"
          >
            <span className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-neutral-500" />
              <span className="font-medium text-neutral-900">Feedback</span>
            </span>
            <ExternalLink className="h-4 w-4 text-neutral-400" />
          </Link>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary-600" />
          Platform Settings
        </h1>
        <div className="flex flex-col lg:flex-row gap-6">
          <nav className="lg:w-56 flex-shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg text-left whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
          <div className="flex-1 bg-white rounded-xl border border-neutral-200 p-6">
            <TabContent />
            {activeTab !== 'links' && (
              <div className="mt-6 pt-6 border-t flex justify-end">
                <LoadingButton
                  onClick={handleSave}
                  loading={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700"
                >
                  <Save className="h-4 w-4" />
                  Save
                </LoadingButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminSettingsPage
