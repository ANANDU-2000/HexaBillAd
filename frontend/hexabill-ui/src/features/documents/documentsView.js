// What the Documents screen says about a document and what it may offer. Pure; no React, no network.

export const DOC_TYPES = ['Licence', 'Policy', 'Manual', 'Other']
export const VISIBILITIES = [
  { value: 'OwnerOnly', label: 'Owner and admins only' },
  { value: 'AllStaff', label: 'All staff (once approved)' },
]
export const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.webp,.csv,.txt'
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE = /\.(png|jpe?g|webp)$/i

/** A reason the chosen file cannot be uploaded, checked before anything is sent; the server checks again. */
export function fileProblem(file) {
  if (!file) return 'Choose a file.'
  if (!/\.(pdf|png|jpe?g|webp|csv|txt)$/i.test(file.name || '')) return 'Upload a PDF, PNG, JPEG, WebP, CSV or text file.'
  if (file.size === 0) return 'The file is empty.'
  if (IMAGE.test(file.name) && file.size > MAX_IMAGE_BYTES) return 'Images can be at most 10 MB.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'Documents can be at most 20 MB.'
  return null
}

export function currentVersion(doc) {
  return (doc?.versions || []).find((v) => v.id === doc.currentVersionId) || null
}

export function latestPending(doc) {
  return (doc?.versions || []).find((v) => v.status === 'NeedsReview') || null
}

/** One line for the search state of the version people rely on. */
export function describeSearch(version) {
  if (!version) return { tone: 'neutral', label: 'Waiting for approval', detail: 'Only an approved version can be found by the assistant.' }
  if (version.searchStatus === 'Searchable') return { tone: 'success', label: 'Searchable', detail: 'The assistant can quote this document and show where it came from.' }
  if (version.searchStatus === 'NotSearchable') return { tone: 'warning', label: 'Not searchable', detail: version.searchNote || 'Its text could not be read.' }
  return { tone: 'neutral', label: 'Not indexed yet', detail: 'Use "Rebuild search" to read it again.' }
}

/** Days until the version expires (negative when past), or null when it has no expiry. */
export function daysToExpiry(version, now = new Date()) {
  if (!version?.expiresOn) return null
  const end = new Date(version.expiresOn)
  if (Number.isNaN(end.getTime())) return null
  return Math.floor((end.getTime() - now.getTime()) / 86400000)
}

export function expiryLabel(version, now = new Date()) {
  const days = daysToExpiry(version, now)
  if (days == null) return null
  if (days < 0) return { tone: 'error', text: `Expired ${-days} day${days === -1 ? '' : 's'} ago. It is no longer searchable.` }
  if (days <= 30) return { tone: 'warning', text: `Expires in ${days} day${days === 1 ? '' : 's'}` }
  return { tone: 'neutral', text: `Expires ${new Date(version.expiresOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` }
}

/** Plain size, never raw bytes. */
export function sizeLabel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Form values -> multipart fields. Blank optional values are left out. */
export function buildUploadForm({ file, title, docType, visibility, expiresOn, documentId }) {
  const form = new FormData()
  form.append('File', file)
  if (documentId) form.append('DocumentId', documentId)
  else {
    form.append('Title', (title || '').trim())
    form.append('DocType', docType || 'Other')
    form.append('Visibility', visibility || 'OwnerOnly')
  }
  if (expiresOn) form.append('ExpiresOn', new Date(`${expiresOn}T00:00:00Z`).toISOString())
  return form
}
