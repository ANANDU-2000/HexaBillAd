import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Opens a page's create form when the URL carries `?new=1` (quick-create links), then removes
 * the flag so refresh/back does not reopen it. `open` is called at most once per flag.
 *
 * The flag is removed one tick later from the live URL: pages sync their own filters into the
 * query string in the same effect flush, and React Router's functional setSearchParams starts
 * from a stale snapshot, so an immediate removal would be overwritten.
 */
export function useCreateIntent (open, { enabled = true } = {}) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const openRef = useRef(open)
  openRef.current = open
  const wantsNew = searchParams.get('new') === '1'

  useEffect(() => {
    if (!enabled || !wantsNew) return undefined
    openRef.current()
    const t = setTimeout(() => {
      const live = new URLSearchParams(window.location.search)
      if (!live.has('new')) return
      live.delete('new')
      const qs = live.toString()
      navigate({ pathname: window.location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
    }, 0)
    return () => clearTimeout(t)
  }, [enabled, wantsNew, navigate])
}
