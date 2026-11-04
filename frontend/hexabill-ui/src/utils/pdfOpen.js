/**
 * Popup-safe PDF open/download.
 * Browsers (iOS Safari, popup blockers) only allow window.open inside the click handler, not after an
 * awaited request. Call reserveTab() synchronously in the click handler, then showPdf() once the blob arrives.
 */
export function reserveTab() {
  try {
    const w = window.open('', '_blank')
    if (w && w.document) {
      w.document.title = 'Preparing PDF…'
      w.document.body.style.cssText = 'font-family:system-ui,sans-serif;padding:24px;color:#475569'
      w.document.body.textContent = 'Preparing PDF…'
    }
    return w || null
  } catch {
    return null
  }
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 1000)
}

/** Show a PDF blob in the reserved tab; falls back to a download when the tab was blocked or closed. */
export function showPdf(blob, filename, tab) {
  if (tab && !tab.closed) {
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    tab.location.href = url
    setTimeout(() => window.URL.revokeObjectURL(url), 120_000)
    return
  }
  downloadBlob(blob, filename)
}

export function closeTab(tab) {
  try {
    if (tab && !tab.closed) tab.close()
  } catch {
    /* ignore */
  }
}
