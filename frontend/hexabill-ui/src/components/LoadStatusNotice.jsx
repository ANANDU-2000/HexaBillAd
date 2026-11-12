import React from 'react'

/**
 * Shown by pages that use useRequestControl. Nothing renders while the request is fast (under 3 s).
 * slow -> "Still loading..." + Cancel; timedOut / cancelled -> message + Retry.
 */
export default function LoadStatusNotice({ phase, onCancel, onRetry, className = '' }) {
  if (phase !== 'slow' && phase !== 'timedOut' && phase !== 'cancelled') return null
  const btn = 'min-h-11 rounded-lg border border-neutral-300 bg-white px-4 text-sm text-neutral-700 hover:bg-neutral-50'
  return (
    <div role="status" data-testid="load-status-notice" data-phase={phase}
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-700 ${className}`}>
      {phase === 'slow' && (<>
        <span>Still loading…</span>
        <button type="button" onClick={onCancel} className={btn}>Cancel</button>
      </>)}
      {phase === 'timedOut' && (<>
        <span>This is taking too long. Nothing was changed.</span>
        <button type="button" onClick={onRetry} className={btn}>Retry</button>
      </>)}
      {phase === 'cancelled' && (<>
        <span>Loading cancelled.</span>
        <button type="button" onClick={onRetry} className={btn}>Retry</button>
      </>)}
    </div>
  )
}
