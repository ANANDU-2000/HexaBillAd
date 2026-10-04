import { useCallback, useEffect, useState } from 'react'
import { backupAPI } from '../../services'
import { useAuth } from '../../hooks/useAuth'
import {
  AlertCircle, CheckCircle, Clock, Cloud, Download, Eye, Folder, HardDrive, Laptop, RefreshCw, RotateCcw, ShieldCheck, Trash2, Upload
} from 'lucide-react'
import toast from 'react-hot-toast'
import { isAdminOrOwner } from '../../utils/roles'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'

const ZONES = [
  { id: 'Asia/Kolkata', label: 'India Standard Time' },
  { id: 'Asia/Dubai', label: 'Gulf Standard Time' },
  { id: 'UTC', label: 'UTC' }
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const formatWhen = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const formatBytes = (bytes) => {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const zoneLabel = (id) => ZONES.find((zone) => zone.id === id)?.label || id || 'UTC'

const StatusIcon = ({ status }) => {
  if (status === 'Automatic backup active' || status === 'Connected') return <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
  if (status === 'Needs attention' || status === 'Configured, device offline' || status === 'Disconnected') return <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
  if (status === 'Running') return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin motion-reduce:animate-none" aria-hidden="true" />
  return <ShieldCheck className="h-5 w-5 text-neutral-500" aria-hidden="true" />
}

const BackupPage = () => {
  const { user } = useAuth()
  const isAdmin = isAdminOrOwner(user)
  const [status, setStatus] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [pairing, setPairing] = useState(null)
  const [schedule, setSchedule] = useState({
    enabled: false,
    time: '23:00',
    frequency: 'daily',
    timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    weeklyDay: 0,
    includeInvoicePdfs: false,
    retentionCount: 7
  })
  const [includeInvoicePdfs, setIncludeInvoicePdfs] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [preview, setPreview] = useState(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [fileToDelete, setFileToDelete] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)

  const loadStatus = useCallback(async () => {
    try {
      const response = await backupAPI.getLocalStatus()
      if (response?.success) setStatus(response.data)
    } catch {
      setStatus(null)
    }
  }, [])

  const loadBackups = useCallback(async () => {
    try {
      const response = await backupAPI.getBackups()
      setBackups(response?.data || response || [])
    } catch {
      toast.error('Could not load backup history.')
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return undefined
    loadStatus()
    loadBackups()
    const timer = setInterval(loadStatus, 60000)
    return () => clearInterval(timer)
  }, [isAdmin, loadStatus, loadBackups])

  useEffect(() => {
    if (!status?.deviceId) return
    setSchedule((current) => ({
      ...current,
      enabled: !!status.scheduleEnabled,
      time: status.time || current.time,
      frequency: status.frequency || 'daily',
      timeZoneId: status.timeZoneId || current.timeZoneId,
      weeklyDay: status.weeklyDay ?? 0,
      includeInvoicePdfs: !!status.includeInvoicePdfs,
      retentionCount: status.retentionCount || 7
    }))
  }, [status])

  const history = (status?.history?.length ? status.history : (Array.isArray(backups) ? backups : []).map((backup) => ({
    id: backup.fileName,
    fileName: backup.fileName,
    createdAt: backup.createdDate || backup.createdAt,
    type: 'Backup',
    device: backup.location || 'Server',
    sizeBytes: backup.fileSize,
    status: 'Saved',
    verified: false,
    canDownload: true,
    canRestore: true,
    canDelete: true
  })))

  const downloadFile = async (fileName) => {
    try {
      const blob = await backupAPI.downloadBackup(fileName)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Backup could not be downloaded.')
    }
  }

  const handleBackupNow = async () => {
    if (loading) return
    setLoading(true)
    try {
      await backupAPI.createFullBackup(true, includeInvoicePdfs)
      toast.success('Backup downloaded')
      await loadBackups()
      await loadStatus()
    } catch {
      toast.error('Backup could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  const handlePair = async () => {
    try {
      const response = await backupAPI.createPairingCode()
      if (!response?.success) {
        toast.error(response?.message || 'This PC could not be connected.')
        return
      }
      setPairing(response.data)
    } catch (error) {
      toast.error(error?.response?.data?.message || 'This PC could not be connected.')
    }
  }

  const handleSaveSchedule = async () => {
    if (!status?.deviceId) {
      toast.error('Connect a PC before saving a schedule.')
      return
    }
    try {
      const response = await backupAPI.saveDeviceSchedule(status.deviceId, schedule)
      if (!response?.success) {
        toast.error(response?.message || 'Schedule could not be saved.')
        return
      }
      toast.success('Schedule saved')
      setShowSchedule(false)
      await loadStatus()
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Schedule could not be saved.')
    }
  }

  const openRestore = async (row, file) => {
    setSelected(row || (file ? { fileName: file.name, sizeBytes: file.size, createdAt: null, type: 'Uploaded backup' } : null))
    setUploadFile(file || null)
    setPreview(null)
    try {
      const response = file
        ? await backupAPI.previewBackupUpload(file)
        : await backupAPI.previewBackup(row.fileName)
      const data = response?.data
      if (!response?.success || data?.isCompatible === false) {
        toast.error(data?.compatibilityMessage || 'This backup could not be checked.')
        return
      }
      setPreview(data)
      setShowRestoreConfirm(true)
    } catch {
      toast.error('This backup could not be checked.')
    }
  }

  const handleRestore = async () => {
    setShowRestoreConfirm(false)
    setRestoring(true)
    try {
      const response = uploadFile
        ? await backupAPI.restoreBackupFromFile(uploadFile)
        : await backupAPI.restoreBackup(selected.fileName, null)
      if (response?.success) {
        toast.success('Backup restored')
        setSelected(null)
        setUploadFile(null)
        await loadBackups()
      } else toast.error(response?.message || 'Restore failed')
    } catch {
      toast.error('Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async () => {
    const name = fileToDelete
    setFileToDelete(null)
    try {
      const response = await backupAPI.deleteBackup(name)
      if (response?.success) {
        toast.success('Backup deleted')
        await loadBackups()
        await loadStatus()
      } else toast.error('Backup could not be deleted.')
    } catch {
      toast.error('Backup could not be deleted.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-neutral-700 dark:text-neutral-300">
        You do not have access to backup and restore.
      </div>
    )
  }

  const localOn = status?.featureEnabled
  const statusText = localOn ? (status?.status || 'Not configured') : 'Manual backup'
  const counts = preview?.manifest?.recordCounts

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-[#F8FAFC]">Backup and restore</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-[#8B9BB4]">Company data only. A paired PC saves the scheduled copy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleBackupNow} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
            <Download className="h-4 w-4" aria-hidden="true" />
            {loading ? 'Creating…' : 'Backup now'}
          </button>
          {localOn && (
            <>
              <button type="button" onClick={() => setShowSchedule((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]">
                <Clock className="h-4 w-4" aria-hidden="true" /> Schedule
              </button>
              <button type="button" onClick={handlePair} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]">
                <Laptop className="h-4 w-4" aria-hidden="true" /> Connect this PC
              </button>
            </>
          )}
          <button type="button" onClick={() => setShowAdvanced((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]">
            <HardDrive className="h-4 w-4" aria-hidden="true" /> Advanced
          </button>
        </div>
      </div>

      <section aria-live="polite" className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-[#1E293B] dark:bg-[#121A22]">
        <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-1">
          <StatusIcon status={statusText} />
          <div>
            <p className="text-xs text-neutral-500 dark:text-[#8B9BB4]">Backup status</p>
            <p className="text-sm font-medium text-neutral-900 dark:text-[#F8FAFC]">{statusText}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-[#8B9BB4]">Last successful</p>
          <p className="text-sm text-neutral-900 dark:text-[#F8FAFC]">{formatWhen(status?.lastSuccessAt)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-[#8B9BB4]">Next backup</p>
          <p className="text-sm text-neutral-900 dark:text-[#F8FAFC]">{status?.online && status?.scheduleEnabled ? formatWhen(status?.nextRunAt) : localOn && status?.scheduleEnabled ? 'When the PC reconnects' : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-[#8B9BB4]">Device / folder</p>
          <p className="text-sm text-neutral-900 dark:text-[#F8FAFC]">{status?.deviceName || 'No PC connected'}</p>
          <p className="text-xs text-neutral-500 dark:text-[#8B9BB4]">{status?.folderLabel || 'No folder chosen'}{status?.lastSeenAt ? ` · Last seen ${formatWhen(status.lastSeenAt)}` : ''}</p>
        </div>
      </section>

      {status?.serverCopyEnabled && (
        <p className="mb-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-[#8B9BB4]">
          <Cloud className="h-4 w-4" aria-hidden="true" /> Server copy is enabled. Local PC backup is separate.
        </p>
      )}

      {pairing?.code && (
        <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-[#1E293B] dark:bg-[#121A22]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-[#F8FAFC]">Connect this PC</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-[#8B9BB4]">On this computer, run HexaBill Backup Agent and enter this code. It expires at {formatWhen(pairing.expiresAt)}. Use this site: {window.location.origin}</p>
          <p className="mt-2 font-mono text-lg tracking-widest text-neutral-900 dark:text-[#F8FAFC]" aria-label="Pairing code">{pairing.code}</p>
        </section>
      )}

      {showSchedule && localOn && (
        <form className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-[#1E293B] dark:bg-[#121A22]" onSubmit={(event) => { event.preventDefault(); handleSaveSchedule() }}>
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-800 dark:text-[#F8FAFC]">
            <input type="checkbox" checked={schedule.enabled} onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.checked }))} />
            Automatic backup
          </label>
          <label className="text-sm text-neutral-700 dark:text-[#8B9BB4]">
            Frequency
            <select value={schedule.frequency} onChange={(event) => setSchedule((current) => ({ ...current, frequency: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-2 text-neutral-900 dark:border-[#1E293B] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="text-sm text-neutral-700 dark:text-[#8B9BB4]">
            Time
            <input type="time" value={schedule.time} onChange={(event) => setSchedule((current) => ({ ...current, time: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-2 text-neutral-900 dark:border-[#1E293B] dark:bg-[#0B1220] dark:text-[#F8FAFC]" />
          </label>
          <label className="text-sm text-neutral-700 dark:text-[#8B9BB4]">
            Timezone
            <select value={schedule.timeZoneId} onChange={(event) => setSchedule((current) => ({ ...current, timeZoneId: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-2 text-neutral-900 dark:border-[#1E293B] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
              {!ZONES.some((zone) => zone.id === schedule.timeZoneId) && <option value={schedule.timeZoneId}>{zoneLabel(schedule.timeZoneId)}</option>}
              {ZONES.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
            </select>
          </label>
          {schedule.frequency === 'weekly' && (
            <label className="text-sm text-neutral-700 dark:text-[#8B9BB4]">
              Day
              <select value={schedule.weeklyDay} onChange={(event) => setSchedule((current) => ({ ...current, weeklyDay: Number(event.target.value) }))} className="mt-1 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-2 dark:border-[#1E293B] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
                {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm text-neutral-700 dark:text-[#8B9BB4]">
            Retention
            <select value={schedule.retentionCount} onChange={(event) => setSchedule((current) => ({ ...current, retentionCount: Number(event.target.value) }))} className="mt-1 block min-h-11 w-full rounded-md border border-neutral-300 bg-white px-2 dark:border-[#1E293B] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
              <option value={7}>7 backups</option>
              <option value={14}>14 backups</option>
              <option value={30}>30 backups</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-800 dark:text-[#F8FAFC]">
            <input type="checkbox" checked={schedule.includeInvoicePdfs} onChange={(event) => setSchedule((current) => ({ ...current, includeInvoicePdfs: event.target.checked }))} />
            Include invoice PDFs
          </label>
          <div className="text-sm text-neutral-600 dark:text-[#8B9BB4] sm:col-span-2">
            <p>Device: {status?.deviceName || 'Not connected'} {status?.online ? '· Connected' : '· Device disconnected'}</p>
            <p className="mt-1 flex items-center gap-1"><Folder className="h-4 w-4" aria-hidden="true" /> {status?.folderLabel || 'Folder is chosen on the PC'}</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white">Save schedule</button>
          </div>
        </form>
      )}

      {showAdvanced && (
        <label className="mb-4 flex min-h-11 items-center gap-2 text-sm text-neutral-700 dark:text-[#8B9BB4]">
          <input type="checkbox" checked={includeInvoicePdfs} onChange={(event) => setIncludeInvoicePdfs(event.target.checked)} />
          Include invoice PDFs in Backup now
        </label>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white dark:border-[#1E293B] dark:bg-[#121A22]">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-[#1E293B]">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-[#F8FAFC]">Backup history</h2>
          <button type="button" aria-label="Refresh history" onClick={() => { loadBackups(); loadStatus() }} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-[#8B9BB4] dark:hover:bg-[#1E293B]">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">No backups yet.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-neutral-500 dark:text-[#8B9BB4]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date / time</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Device</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Verified</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id || row.fileName} className="border-t border-neutral-100 dark:border-[#1E293B]">
                      <td className="px-4 py-3 text-neutral-900 dark:text-[#F8FAFC]">{formatWhen(row.createdAt)}</td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3">{row.device}</td>
                      <td className="px-4 py-3">{formatBytes(row.sizeBytes)}</td>
                      <td className="px-4 py-3">{row.status}{row.detail ? ` · ${row.detail}` : ''}</td>
                      <td className="px-4 py-3">{row.verified ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label="View details" onClick={() => setDetail(row)} className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-[#1E293B]"><Eye className="h-4 w-4" /></button>
                          {row.canDownload && row.fileName && <button type="button" aria-label="Download" onClick={() => downloadFile(row.fileName)} className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-[#1E293B]"><Download className="h-4 w-4" /></button>}
                          {row.canRestore && row.fileName && <button type="button" aria-label="Restore" onClick={() => openRestore(row)} className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-neutral-100 dark:hover:bg-[#1E293B]"><RotateCcw className="h-4 w-4" /></button>}
                          {row.canDelete && row.fileName && <button type="button" aria-label="Delete backup file" onClick={() => setFileToDelete(row.fileName)} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {history.map((row) => (
                <article key={row.id || row.fileName} className="rounded-md border border-neutral-200 p-3 dark:border-[#1E293B]">
                  <p className="text-sm font-medium text-neutral-900 dark:text-[#F8FAFC]">{formatWhen(row.createdAt)}</p>
                  <p className="text-xs text-neutral-500">{row.type} · {row.device} · {formatBytes(row.sizeBytes)}</p>
                  <p className="text-xs text-neutral-600 dark:text-[#8B9BB4]">{row.status}{row.verified ? ' · Verified' : ''}{row.detail ? ` · ${row.detail}` : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="min-h-11 px-2 text-sm" onClick={() => setDetail(row)}>View</button>
                    {row.canRestore && row.fileName && <button type="button" className="min-h-11 px-2 text-sm" onClick={() => openRestore(row)}>Restore</button>}
                    {row.canDownload && row.fileName && <button type="button" className="min-h-11 px-2 text-sm" onClick={() => downloadFile(row.fileName)}>Download</button>}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm dark:border-[#1E293B] dark:text-[#F8FAFC]">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload a backup
          <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) openRestore(null, file) }} />
        </label>
      </div>

      {detail && (
        <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-[#1E293B] dark:bg-[#121A22]" aria-label="Backup details">
          <h2 className="font-semibold text-neutral-900 dark:text-[#F8FAFC]">Backup details</h2>
          <p className="mt-1 text-neutral-700 dark:text-[#8B9BB4]">{formatWhen(detail.createdAt)} · {detail.type} · {detail.device}</p>
          <p>Size: {formatBytes(detail.sizeBytes)} · {detail.verified ? 'Verified' : 'Not verified'} · {detail.status}</p>
          {detail.detail && <p>{detail.detail}</p>}
          <button type="button" className="mt-2 min-h-11 text-sm text-indigo-700 dark:text-indigo-300" onClick={() => setDetail(null)}>Close</button>
        </section>
      )}

      {localOn && status?.devices?.length > 1 && (
        <section className="mt-4 text-sm text-neutral-700 dark:text-[#8B9BB4]">
          <h2 className="font-medium text-neutral-900 dark:text-[#F8FAFC]">Paired PCs</h2>
          <ul className="mt-1 space-y-1">
            {status.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{device.name} — {device.online ? 'Connected' : 'Offline'}{device.lastSeenAt ? `, last seen ${formatWhen(device.lastSeenAt)}` : ''} · {device.folderLabel || 'No folder'}</span>
                <button type="button" className="min-h-11 text-red-700" onClick={() => backupAPI.revokeDevice(device.id).then(() => loadStatus())}>Disconnect</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDangerModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDelete}
        title="Delete backup file"
        message="This removes the server copy of the selected backup. Local copies on a PC are not deleted."
        confirmLabel="Delete"
        requireTypedText="DELETE"
      />
      <ConfirmDangerModal
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={handleRestore}
        title="Restore this backup"
        message={`Backup: ${formatWhen(selected?.createdAt)}\nSize: ${formatBytes(selected?.sizeBytes || uploadFile?.size)}\nContains: database${counts ? `, ${counts.sales || 0} sales, ${counts.customers || 0} customers` : ''}${includeInvoicePdfs || status?.includeInvoicePdfs ? ', files' : ''}.\n\nRestore replaces current company data with the selected backup.`}
        confirmLabel={restoring ? 'Restoring…' : 'Restore'}
        requireTypedText="RESTORE"
      />
    </div>
  )
}

export default BackupPage
