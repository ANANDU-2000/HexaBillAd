import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { backupAPI } from '../../services'
import { useAuth } from '../../hooks/useAuth'
import { Database, HardDrive, Download, Trash2, RefreshCw, Upload, FileText, X, Settings, Cloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { isAdminOrOwner } from '../../utils/roles'  // CRITICAL: Multi-tenant role checking
import ConfirmDangerModal from '../../components/ConfirmDangerModal'

const BackupPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = isAdminOrOwner(user)  // MULTI-TENANT: Both Admin and Owner can backup
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showCloudSettings, setShowCloudSettings] = useState(false)
  const [showScheduleSettings, setShowScheduleSettings] = useState(false)
  const [cloudSettings, setCloudSettings] = useState({
    googleDriveClientId: '',
    googleDriveClientSecret: '',
    googleDriveRefreshToken: '',
    googleDriveEnabled: false
  })
  const [scheduleSettings, setScheduleSettings] = useState({
    enabled: false,
    time: '21:00', // Default 9 PM
    frequency: 'daily', // daily, weekly
    retentionDays: 30
  })

  useEffect(() => {
    loadBackups()
  }, [])

  const loadSchedule = async () => {
    try {
      const res = await backupAPI.getSchedule()
      if (res.success && res.data) {
        setScheduleSettings({
          enabled: res.data.enabled ?? false,
          time: res.data.time || '21:00',
          frequency: res.data.frequency || 'daily',
          retentionDays: res.data.retentionDays ?? 30
        })
      }
    } catch (e) {
      console.error('Failed to load backup schedule', e)
    }
  }

  const loadBackups = async () => {
    try {
      const response = await backupAPI.getBackups()
      if (response.success) {
        setBackups(response.data || [])
      }
    } catch (error) {
      console.error('Failed to load backups:', error)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setLoading(true)
      const response = await backupAPI.createBackup()
      if (response.success) {
        toast.success('Backup created successfully!')
        await loadBackups()
      } else {
        toast.error(response.message || 'Failed to create backup')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to create backup')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFullBackup = async (downloadToBrowser = false) => {
    try {
      setLoading(true)
      const response = await backupAPI.createFullBackup(downloadToBrowser)
      if (response.success) {
        if (downloadToBrowser) {
          toast.success('Backup downloaded to your computer!')
        } else {
          toast.success('Full backup created successfully! Click Download to save to your computer.')
        }
        await loadBackups()
      } else {
        toast.error(response.message || 'Failed to create full backup')
      }
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to create full backup')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackup = async (fileName) => {
    try {
      const blob = await backupAPI.downloadBackup(fileName)
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
      if (!error?._handledByInterceptor) toast.error('Failed to download backup')
    }
  }

  const handleDeleteBackup = (fileName) => {
    setFileToDelete(fileName)
  }

  const handleConfirmDeleteBackup = async () => {
    if (!fileToDelete) return

    try {
      const response = await backupAPI.deleteBackup(fileToDelete)
      if (response.success) {
        toast.success('Backup deleted')
        await loadBackups()
      } else {
        toast.error(response.message || 'Failed to delete backup')
      }
    } catch (error) {
      toast.error('Failed to delete backup')
    } finally {
      setFileToDelete(null)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleRestoreClick = () => {
    if (!selectedFile) {
      toast.error('Please select a backup file')
      return
    }
    setShowRestoreConfirm(true)
  }

  const handleRestore = async () => {
    if (!selectedFile) return
    setShowRestoreConfirm(false)
    try {
      setRestoring(true)
      toast.loading('Restoring backup... This may take a few minutes.')

      let response

      // Check if selectedFile is a File object (uploaded) or object with name (from list)
      if (selectedFile instanceof File) {
        // File uploaded from computer - use upload endpoint
        response = await backupAPI.restoreBackupFromFile(selectedFile)
      } else {
        // File selected from backup list - use restore endpoint
        const fileName = selectedFile.name || selectedFile.fileName
        response = await backupAPI.restoreBackup(fileName, null)
      }

      if (response.success) {
        toast.success('Backup restored successfully! Refreshing data...')
        // Refresh backup list and use client-side navigation instead of full page reload
        await loadBackups()
        setTimeout(() => {
          navigate(0) // Client-side reload using react-router
        }, 1000)
      } else {
        toast.error(response.message || 'Failed to restore backup')
      }
    } catch (error) {
      console.error('Restore error:', error)
      if (!error?._handledByInterceptor) toast.error(error?.response?.data?.message || 'Failed to restore backup. Please check server logs.')
    } finally {
      setRestoring(false)
      setSelectedFile(null)
    }
  }

  const handleSaveCloudSettings = async () => {
    try {
      // NOTE: Cloud backup (S3/Google Drive) is not yet implemented
      // For production, backups should be stored in S3/Cloudflare R2/Google Cloud Storage
      // instead of ephemeral server filesystem
      toast.error('Cloud backup settings are not yet implemented. For production, configure S3/cloud storage backups.')
      setShowCloudSettings(false)
    } catch (error) {
      if (!error?._handledByInterceptor) toast.error('Failed to save cloud settings')
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6">
      <div className="w-full">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Manage database backups and restore from previous backups</p>
        </div>

        {/* Last Successful Backup Indicator */}
        {backups.length > 0 && (() => {
          const sorted = [...backups].sort((a, b) => new Date(b.createdDate || b.createdAt || 0) - new Date(a.createdDate || a.createdAt || 0))
          const lastBackup = sorted[0]
          const lastDate = lastBackup ? new Date(lastBackup.createdDate || lastBackup.createdAt) : null
          const hoursAgo = lastDate ? (Date.now() - lastDate.getTime()) / (1000 * 60 * 60) : Infinity
          const statusColor = hoursAgo < 24 ? 'text-green-700 bg-green-50 border-green-200' : hoursAgo < 72 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'
          const statusText = hoursAgo < 24 ? 'Recent' : hoursAgo < 72 ? 'Consider creating a new backup' : 'Backup is outdated'
          return (
            <div className={`mb-4 p-3 rounded-lg border ${statusColor}`}>
              <p className="text-sm font-medium">
                Last successful backup: <strong>{lastDate ? lastDate.toLocaleString() : '—'}</strong>
                <span className="ml-2 text-xs">({statusText})</span>
              </p>
            </div>
          )
        })()}

        {/* Create Backup Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Database className="h-6 w-6 text-indigo-600 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Create Backup</h2>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCloudSettings(!showCloudSettings)
                    setShowScheduleSettings(false)
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  title="Cloud Backup Settings"
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  Cloud Settings
                </button>
                <button
                  onClick={async () => {
                    setShowScheduleSettings(!showScheduleSettings)
                    setShowCloudSettings(false)
                    if (!showScheduleSettings) await loadSchedule()
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  title="Backup Schedule Settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Schedule
                </button>
              </div>
            )}
          </div>

          {/* Backup Schedule Settings (Admin Only) */}
          {isAdmin && showScheduleSettings && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Backup Schedule Settings</h3>
              <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                <p className="text-xs text-blue-800 mb-3">
                  Configure automatic daily backups. Backups run automatically at the scheduled time.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={scheduleSettings.enabled}
                        onChange={(e) => setScheduleSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Enable automatic backups</span>
                    </label>
                  </div>
                  {scheduleSettings.enabled && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Backup Time</label>
                        <input
                          type="time"
                          value={scheduleSettings.time}
                          onChange={(e) => setScheduleSettings(prev => ({ ...prev, time: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                        <select
                          value={scheduleSettings.frequency}
                          onChange={(e) => setScheduleSettings(prev => ({ ...prev, frequency: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly (Sunday)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Retention (days)</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={scheduleSettings.retentionDays}
                          onChange={(e) => setScheduleSettings(prev => ({ ...prev, retentionDays: parseInt(e.target.value) || 30 }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Backups older than this will be automatically deleted</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await backupAPI.saveSchedule(scheduleSettings)
                      if (res.success) {
                        toast.success('Backup schedule saved.')
                        setShowScheduleSettings(false)
                      } else toast.error(res.message || 'Failed to save schedule')
                    } catch (e) {
                      if (!e?._handledByInterceptor) toast.error('Failed to save schedule')
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Save Schedule
                </button>
                <button
                  onClick={() => setShowScheduleSettings(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Automatic backups run at the scheduled time. Older backups are deleted after the retention period.
              </p>
            </div>
          )}

          {/* Cloud Backup Settings (Admin Only) */}
          {isAdmin && showCloudSettings && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Cloud backup (S3 / offline)</h3>
              <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                <p className="text-xs text-blue-800 mb-2">
                  <strong>S3 (recommended for production):</strong> Backups can be uploaded to AWS S3 or compatible storage (e.g. Cloudflare R2). Configure in <code className="bg-blue-100 px-1">appsettings.json</code>: <code className="bg-blue-100 px-1">BackupSettings:S3:Enabled</code> = true, <code className="bg-blue-100 px-1">Bucket</code>, <code className="bg-blue-100 px-1">Region</code>, <code className="bg-blue-100 px-1">AwsAccessKeyId</code>, <code className="bg-blue-100 px-1">AwsSecretAccessKey</code>. Optional: <code className="bg-blue-100 px-1">Prefix</code> for folder path.
                </p>
                <p className="text-xs text-blue-700 mb-2">
                  <strong>Offline / desktop:</strong> Use &quot;Full Backup (Download to PC/Desktop)&quot; to save a copy on your computer. Server backups are ephemeral on cloud hosts; keep a local or S3 copy.
                </p>
              </div>
              <button
                onClick={() => setShowCloudSettings(false)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          )}

          {/* Offline / Desktop backup notice */}
          <div className="bg-blue-50 border border-blue-300 rounded-md p-3 mb-4">
            <p className="text-sm font-medium text-blue-800">
              💾 <strong>Offline &amp; desktop backup</strong>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              To keep a copy on your computer (desktop or folder): use <strong>Full Backup (Download to Browser)</strong>.
              The file will download to your default Downloads folder so you have an offline copy even if the server is down.
              You can also download any backup from the list below.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCreateFullBackup(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
              title="Creates backup and downloads to your computer (offline/desktop copy)"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Full Backup (Download to PC/Desktop)'}
            </button>
            <button
              onClick={() => handleCreateFullBackup(false)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Full Backup (Server Only)'}
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Database className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Database Backup'}
            </button>
          </div>
        </div>

        {/* Restore Backup Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-4">
            <Upload className="h-6 w-6 text-green-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Restore Backup</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Select Backup File (.zip)
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">({formatBytes(selectedFile.size)})</span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-600 hover:text-red-800"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> To restore from a backup file:
              </p>
              <ol className="text-xs text-yellow-700 mt-2 ml-4 list-decimal space-y-1">
                <li>Select a backup ZIP file from the list below</li>
                <li>Or upload a backup file from your computer</li>
                <li>Click "Restore" - this will replace ALL current data</li>
                <li>Make sure to backup current data first!</li>
              </ol>
            </div>

            <button
              onClick={handleRestoreClick}
              disabled={!selectedFile || restoring}
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${restoring ? 'animate-spin' : ''}`} />
              {restoring ? 'Restoring...' : 'Restore from Backup'}
            </button>
          </div>
        </div>

        {/* Backup List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-gray-600 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Backup History</h2>
            </div>
            <button
              onClick={loadBackups}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No backups found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {backup.fileName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(backup.createdDate).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatBytes(backup.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {backup.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedFile({ name: backup.fileName, size: backup.fileSize })
                              toast.success('Backup file selected. Click "Restore" button above to restore.')
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Select for Restore"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadBackup(backup.fileName)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(backup.fileName)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDangerModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDeleteBackup}
        title="Delete backup"
        message={fileToDelete ? `Are you sure you want to delete ${fileToDelete}?` : ''}
        confirmLabel="Delete"
      />
      <ConfirmDangerModal
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={() => handleRestore()}
        title="Restore from backup"
        message="WARNING: This will REPLACE ALL CURRENT DATA with the backup data.\n\nMake sure you have a backup of current data first. Continue?"
        confirmLabel="Restore"
      />
    </div>
  )
}

export default BackupPage


