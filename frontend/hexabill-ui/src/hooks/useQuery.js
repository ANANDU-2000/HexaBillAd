import { useCallback, useEffect, useRef, useState } from 'react'
import { useRequestControl } from './useRequestControl.js'

/**
 * Small data-fetch hook (no react-query). `fetcher(signal)` must resolve with the data.
 * A new `deps` value or refetch() aborts the previous call and only the latest response is applied.
 */
export function useQuery(fetcher, deps = [], { enabled = true } = {}) {
  const rc = useRequestControl()
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    const t = rc.start()
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fetcherRef.current(t.signal)
      if (!t.isCurrent()) return
      setState({ data, error: null, loading: false })
    } catch (error) {
      const kind = t.classify(error)
      if (kind === 'superseded') return
      setState((s) => ({ ...s, error: kind === 'error' ? error : new Error(kind), loading: false }))
    } finally {
      t.finish()
    }
  }, [rc.start])

  useEffect(() => {
    if (enabled) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { ...state, phase: rc.phase, cancel: rc.cancel, refetch: run }
}
