import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Upload, Download, Trash2, CheckCircle2, RefreshCcw, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsAPI } from '../../services/index'
import { useAuth } from '../../hooks/useAuth'
import { isAdminOrOwner } from '../../utils/roles'
import { readApiErrorReason } from '../../utils/apiError'
import { LoadingCard } from '../../components/Loading'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/Modal'
import ConfirmDangerModal from '../../components/ConfirmDangerModal'
import {
  ACCEPTED_EXTENSIONS, DOC_TYPES, VISIBILITIES, fileProblem, currentVersion, latestPending, describeSearch, expiryLabel, sizeLabel, buildUploadForm,
} from './documentsView'

const TONES = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  error: 'bg-error-bg text-error-fg',
  neutral: 'bg-neutral-100 text-neutral-700',
}

const inputClass = 'block w-full min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-base md:text-sm'

function UploadModal({ documentId, documentTitle, onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('Licence')
  const [visibility, setVisibility] = useState('OwnerOnly')
  const [expiresOn, setExpiresOn] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const sending = useRef(false)
  const isVersion = !!documentId

  const submit = async (e) => {
    e.preventDefault()
    if (sending.current) return
    const problem = fileProblem(file)
    if (problem) { setError(problem); return }
    if (!isVersion && title.trim().length < 2) { setError('Give the document a title of at least 2 characters.'); return }
    sending.current = true
    setError('')
    setProgress(0)
    try {
      await documentsAPI.upload(buildUploadForm({ file, title, docType, visibility, expiresOn, documentId }), setProgress)
      toast.success(isVersion ? 'New version uploaded. It waits for your approval.' : 'Uploaded. Review and approve it to use it.')
      onDone()
    } catch (err) {
      setError(readApiErrorReason(err, 'The upload did not work. Check the file and try again.'))
      setProgress(null)
    } finally {
      sending.current = false
    }
  }

  return (
    <Modal isOpen title={isVersion ? `New version of “${documentTitle}”` : 'Upload a document'} onClose={() => progress == null && onClose()}>
      <form onSubmit={submit} className="space-y-3" data-testid="upload-form">
        <div>
          <label htmlFor="doc-file" className="mb-1 block text-xs font-medium text-neutral-700">File (PDF, image, CSV or text, up to 20 MB)</label>
          <input id="doc-file" type="file" accept={ACCEPTED_EXTENSIONS} className={inputClass} onChange={(e) => { setFile(e.target.files?.[0] || null); setError('') }} />
        </div>
        {!isVersion && (
          <>
            <div>
              <label htmlFor="doc-title" className="mb-1 block text-xs font-medium text-neutral-700">Title</label>
              <input id="doc-title" className={inputClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="doc-type" className="mb-1 block text-xs font-medium text-neutral-700">Type</label>
                <select id="doc-type" className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="doc-visibility" className="mb-1 block text-xs font-medium text-neutral-700">Who can read it</label>
                <select id="doc-visibility" className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                  {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
        <div>
          <label htmlFor="doc-expiry" className="mb-1 block text-xs font-medium text-neutral-700">Expiry date (optional, for example a licence)</label>
          <input id="doc-expiry" type="date" className={inputClass} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </div>
        {progress != null && (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded bg-neutral-200">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-error" data-testid="upload-error">{error}</p>}
        <p className="text-xs text-neutral-600">The file is checked for type and size. This is not a virus scan. A new document waits for approval before anyone can use it.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm" disabled={progress != null} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={progress != null} className="btn btn-primary min-h-11 px-4">
            <Upload className="h-4 w-4" aria-hidden /> {progress != null ? `Uploading ${progress}%` : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DocumentCard({ doc, canManage, busy, onUploadVersion, onApprove, onDelete, onReindex, onDownload }) {
  const current = currentVersion(doc)
  const pending = latestPending(doc)
  const search = describeSearch(current)
  const expiry = expiryLabel(current)
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2" data-testid={`doc-${doc.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-text-primary break-words">{doc.title}</p>
          <p className="text-xs text-neutral-600">{doc.docType} · {doc.visibility === 'AllStaff' ? 'All staff' : 'Owner and admins'}{current ? ` · version ${current.versionNumber} · ${sizeLabel(current.sizeBytes)}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${TONES[search.tone]}`} data-testid={`doc-search-${doc.id}`}>{search.label}</span>
          {expiry && <span className={`rounded-full px-2 py-1 text-xs font-medium ${TONES[expiry.tone]}`}>{expiry.text}</span>}
        </div>
      </div>
      <p className="text-xs text-neutral-600">{search.detail}</p>
      {pending && canManage && (
        <div className="rounded-md border border-warning-border bg-warning-bg p-2 text-sm" data-testid={`pending-${doc.id}`}>
          <p className="text-warning-fg">Version {pending.versionNumber} ({pending.fileName}) needs your review. {current ? `Version ${current.versionNumber} stays in use until you approve it.` : 'Nothing can use this document until you approve it.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary-600 px-3 text-sm font-medium text-white disabled:opacity-60" onClick={() => onApprove(doc, pending)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve version {pending.versionNumber}
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-sm" onClick={() => onDownload(doc, pending)}>
              <Download className="h-4 w-4" aria-hidden /> Check the file first
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {current && (
          <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm" onClick={() => onDownload(doc, current)}>
            <Download className="h-4 w-4" aria-hidden /> Download
          </button>
        )}
        {canManage && (
          <>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm" onClick={() => onUploadVersion(doc)}>
              <Plus className="h-4 w-4" aria-hidden /> New version
            </button>
            {current && (
              <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-neutral-300 px-3 text-sm disabled:opacity-60" onClick={() => onReindex(doc)}>
                <RefreshCcw className="h-4 w-4" aria-hidden /> Rebuild search
              </button>
            )}
            <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-error-border px-3 text-sm text-error-fg disabled:opacity-60" onClick={() => onDelete(doc)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** Company documents: licences, policies and manuals. Owners and admins manage them; staff read approved shared ones. */
export default function DocumentsPage() {
  const { user } = useAuth()
  const canManage = isAdminOrOwner(user)
  const [state, setState] = useState({ loading: true, error: false, docs: [] })
  const [upload, setUpload] = useState(null) // { documentId?, documentTitle? }
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: false }))
    try {
      const res = await documentsAPI.list()
      setState({ loading: false, error: false, docs: res?.data ?? [] })
    } catch {
      setState({ loading: false, error: true, docs: [] })
    }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn, failure) => {
    if (busy) return
    setBusy(true)
    try { await fn() } catch (e) { toast.error(readApiErrorReason(e, failure)) } finally { setBusy(false) }
  }

  const approve = (doc, version) => run(async () => {
    await documentsAPI.approve(doc.id, version.id)
    toast.success(`Version ${version.versionNumber} approved`)
    await load(true)
  }, 'The version could not be approved.')

  const reindex = (doc) => run(async () => {
    await documentsAPI.reindex(doc.id)
    toast.success('Search rebuilt')
    await load(true)
  }, 'The search could not be rebuilt.')

  const remove = () => run(async () => {
    await documentsAPI.remove(toDelete.id)
    setToDelete(null)
    toast.success('Document deleted')
    await load(true)
  }, 'The document could not be deleted.')

  const download = (doc, version) => run(async () => {
    const blob = await documentsAPI.download(doc.id, version.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = version.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'The file could not be downloaded.')

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h2 font-semibold text-text-primary">Documents</h1>
        {canManage && (
          <button type="button" className="btn btn-primary min-h-11 px-4" onClick={() => setUpload({})}>
            <Upload className="h-4 w-4" aria-hidden /> Upload document
          </button>
        )}
      </div>
      <p className="text-sm text-neutral-600">
        {canManage
          ? 'Keep licences, policies and manuals here. A version is only used by the assistant after you approve it, and only the approved version can be found.'
          : 'Documents your company has shared with all staff.'}
      </p>
      {state.loading && <LoadingCard />}
      {!state.loading && state.error && <ErrorState title="Documents could not be loaded" message="Check your connection and try again." onAction={() => load()} />}
      {!state.loading && !state.error && state.docs.length === 0 && (
        <EmptyState icon={FileText} title="No documents yet" description={canManage ? 'Upload a licence, policy or manual to get started.' : 'Nothing has been shared with staff yet.'}
          primaryAction={canManage ? { label: 'Upload document', onClick: () => setUpload({}) } : undefined} />
      )}
      {!state.loading && !state.error && state.docs.length > 0 && (
        <ul className="space-y-3" data-testid="document-list">
          {state.docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              canManage={canManage}
              busy={busy}
              onUploadVersion={(d) => setUpload({ documentId: d.id, documentTitle: d.title })}
              onApprove={approve}
              onDelete={setToDelete}
              onReindex={reindex}
              onDownload={download}
            />
          ))}
        </ul>
      )}
      {upload && (
        <UploadModal
          documentId={upload.documentId}
          documentTitle={upload.documentTitle}
          onClose={() => setUpload(null)}
          onDone={() => { setUpload(null); load(true) }}
        />
      )}
      <ConfirmDangerModal
        isOpen={!!toDelete}
        title="Delete this document?"
        message={toDelete ? `“${toDelete.title}” and all its versions will be removed and can no longer be found. Older backups may still hold the file until they expire.` : ''}
        confirmLabel="Delete document"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
