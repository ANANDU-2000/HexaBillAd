/**
 * Download or share a barcode labels PDF blob from the API.
 */
export async function downloadOrShareBarcodePdf(blob, { fileName = 'barcode-labels.pdf', share = false } = {}) {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Invalid PDF response')
  }
  // API may return JSON error as blob when status is not 2xx — callers should check content-type
  if (blob.type && blob.type.includes('application/json')) {
    const text = await blob.text()
    let msg = 'Failed to generate barcode PDF'
    try {
      const parsed = JSON.parse(text)
      msg = parsed.message || msg
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (share && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Barcode labels', text: 'Product barcode labels' })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
  return 'downloaded'
}
