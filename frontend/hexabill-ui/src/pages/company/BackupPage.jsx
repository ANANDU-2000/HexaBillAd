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
  const [cloudSettings, setCloudSettings] = useState({
    googleDriveClientId: '',
    googleDriveClientSecret: '',
    googleDriveRefreshToken: '',
    googleDriveEnabled: false
  })

  useEffect(() => {
    loadBackups()
    // Auto-refresh DISABLED - prevents UI interruption during user actions
    // User can manually refresh with refresh button
  }, [])

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
      toast.error('Failed to create backup')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFullBackup = async (exportToDesktop = false) => {
    try {
      setLoading(true)
      const response = await backupAPI.createFullBackup(exportToDesktop)
      if (response.success) {
        toast.success(exportToDesktop 
          ? 'Backup created! Note: On cloud hosting, use Download button to save to your computer.' 
          : 'Full backup created successfully! Click Download to save to your computer.')
        await loadBackups()
      } else {
        toast.error(response.message || 'Failed to create full backup')
      }
    } catch (error) {
      toast.error('Failed to create full backup')
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
      toast.error('Failed to download backup')
    }
  }

  const handleDeleteBackup = async (fileName) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return
    
    try {
      const response = await backupAPI.deleteBackup(fileName)
      if (response.success) {
        toast.success('Backup deleted')
        await loadBackups()
      } else {
        toast.error(response.message || 'Failed to delete backup')
      }
    } catch (error) {
      toast.error('Failed to delete backup')
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
      toast.error(error?.response?.data?.message || 'Failed to restore backup. Please check server logs.')
    } finally {
      setRestoring(false)
      setSelectedFile(null)
    }
  }

  const handleSaveCloudSettings = async () => {
    try {
      // TODO: Add API endpoint to save cloud settings to appsettings.json
      toast.success('Cloud settings saved! (Note: Restart server for changes to take effect)')
      setShowCloudSettings(false)
    } catch (error) {
      toast.error('Failed to save cloud settings')
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

        {/* Create Backup Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Database className="h-6 w-6 text-indigo-600 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900">Create Backup</h2>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCloudSettings(!showCloudSettings)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                title="Cloud Backup Settings"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Cloud Settings
              </button>
            )}
          </div>
          
          {/* Google Drive Settings (Admin Only) */}
          {isAdmin && showCloudSettings && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Google Drive Backup Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={cloudSettings.googleDriveClientId}
                    onChange={(e) => setCloudSettings(prev => ({ ...prev, googleDriveClientId: e.target.value }))}
                    placeholder="your-client-id.apps.googleusercontent.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={cloudSettings.googleDriveClientSecret}
                    onChange={(e) => setCloudSettings(prev => ({ ...prev, googleDriveClientSecret: e.target.value }))}
                    placeholder="your-client-secret"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Refresh Token</label>
                  <input
                    type="text"
                    value={cloudSettings.googleDriveRefreshToken}
                    onChange={(e) => setCloudSettings(prev => ({ ...prev, googleDriveRefreshToken: e.target.value }))}
                    placeholder="your-refresh-token"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={cloudSettings.googleDriveEnabled}
                      onChange={(e) => setCloudSettings(prev => ({ ...prev, googleDriveEnabled: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-xs text-gray-700">Enable Google Drive Backup</span>
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={handleSaveCloudSettings}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Save Cloud Settings
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Note: These settings are saved to appsettings.json. See BACKUP_CLOUD_INTEGRATION.md for setup instructions.
              </p>
            </div>
          )}
          
          {/* IMPORTANT NOTICE FOR CLOUD HOSTING */}
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3 mb-4">
            <p className="text-sm font-medium text-amber-800">
              📢 <strong>Cloud Hosting Notice (Render.com):</strong>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              "Export to Desktop" saves files to the <em>server's</em> desktop, not your local computer.
              <br />
              <strong>To save to YOUR computer:</strong> Create backup → Click <strong>Download</strong> button in the list below.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              <Database className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Database Backup'}
            </button>
            
            <button
              onClick={() => handleCreateFullBackup(false)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Full Backup (ZIP)'}
            </button>
            
            <button
              onClick={() => handleCreateFullBackup(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
              title="Creates backup on server. For cloud hosting (Render.com), use Download button instead."
            >
              <HardDrive className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Full Backup (Server Desktop)'}
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


