import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced localStorage draft for in-progress invoice.
 * Restores once on mount (caller shows confirm via onRestore).
 */
export function usePosDraft({
  tenantId,
  enabled,
  getSnapshot,
  onRestore,
  intervalMs = 3000,
  isEditMode = false,
}) {
  const key = `hexabill_pos_draft_${tenantId || 'default'}`
  const getSnapshotRef = useRef(getSnapshot)
  getSnapshotRef.current = getSnapshot
  const promptedRef = useRef(false)

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch { /* ignore */ }
  }, [key])

  const saveDraftNow = useCallback(() => {
    if (!enabled || isEditMode) return
    try {
      const snap = getSnapshotRef.current?.()
      if (!snap) return
      const hasItems = (snap.cart || []).some((i) => i.productId)
      if (!hasItems && !(Number(snap.discount) > 0)) {
        localStorage.removeItem(key)
        return
      }
      localStorage.setItem(
        key,
        JSON.stringify({ ...snap, savedAt: Date.now() })
      )
    } catch { /* ignore */ }
  }, [enabled, isEditMode, key])

  useEffect(() => {
    if (!enabled || isEditMode) return undefined
    const id = setInterval(saveDraftNow, intervalMs)
    return () => clearInterval(id)
  }, [enabled, isEditMode, intervalMs, saveDraftNow])

  useEffect(() => {
    if (!enabled || isEditMode || promptedRef.current) return
    promptedRef.current = true
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed?.cart?.length) return
      const hasItems = parsed.cart.some((i) => i.productId)
      if (!hasItems) return
      const age = Date.now() - (parsed.savedAt || 0)
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key)
        return
      }
      onRestore?.(parsed)
    } catch { /* ignore */ }
  }, [enabled, isEditMode, key, onRestore])

  return { clearDraft, saveDraftNow, draftKey: key }
}
