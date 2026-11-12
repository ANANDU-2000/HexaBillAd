import { useCallback, useEffect, useRef, useState } from 'react'
import { createRequestController } from '../services/requestControl.js'

/**
 * Per-page request control for read-only list fetches.
 *   const rc = useRequestControl()
 *   const t = rc.start()
 *   try { await api({ signal: t.signal }); if (!t.isCurrent()) return ... }
 *   catch (e) { const kind = t.classify(e) ... } finally { t.finish() }
 * Render <LoadStatusNotice phase={rc.phase} onCancel={rc.cancel} onRetry={refetch} />.
 */
export function useRequestControl(options) {
  const [phase, setPhase] = useState('idle')
  const ref = useRef(null)
  if (!ref.current) ref.current = createRequestController({ ...options, onChange: setPhase })
  useEffect(() => {
    const c = ref.current
    return () => c.dispose()
  }, [])
  const start = useCallback(() => ref.current.start(), [])
  const cancel = useCallback(() => ref.current.cancel(), [])
  return { start, cancel, phase }
}
