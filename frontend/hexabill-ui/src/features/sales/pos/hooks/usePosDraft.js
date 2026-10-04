import { useCallback, useEffect, useRef } from 'react'

export function getPosDraftKey(tenantId, userId) {
  const ids = [tenantId, userId]
  if (!ids.every((id) => (typeof id === 'number' || typeof id === 'string') &&
    /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id)))) return null
  return `hexabill_pos_draft_v1_${Number(tenantId)}_${Number(userId)}`
}

/**
 * User + tenant scoped localStorage draft for an in-progress invoice.
 * Unowned legacy drafts are intentionally not restored or migrated.
 */
export function usePosDraft({
  tenantId,
  userId,
  enabled,
  getSnapshot,
  onRestore,
  intervalMs = 3000,
  isEditMode = false,
  readOnly = false,
}) {
  const key = getPosDraftKey(tenantId, userId)
  const snapshotRef = useRef({ key, getSnapshot, readOnly, enabled, isEditMode })
  snapshotRef.current = { key, getSnapshot, readOnly, enabled, isEditMode }
  const promptedRef = useRef(null)

  const clearDraft = useCallback(() => {
    if (readOnly || snapshotRef.current.readOnly || !key || snapshotRef.current.key !== key) return
    try {
      localStorage.removeItem(key)
    } catch { /* ignore */ }
  }, [key, readOnly])

  const saveDraftNow = useCallback(() => {
    if (!enabled || isEditMode || readOnly || !key || snapshotRef.current.key !== key ||
      snapshotRef.current.readOnly || !snapshotRef.current.enabled || snapshotRef.current.isEditMode) return
    try {
      const snap = snapshotRef.current.getSnapshot?.()
      if (!snap) return
      const hasItems = Array.isArray(snap.cart) && snap.cart.some((i) => i?.productId)
      if (!hasItems && !(Number(snap.discount) > 0)) {
        localStorage.removeItem(key)
        return
      }
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, scope: key, snapshot: snap, savedAt: Date.now() })
      )
    } catch { /* ignore */ }
  }, [enabled, isEditMode, readOnly, key])

  useEffect(() => {
    if (!enabled || isEditMode || readOnly || !key) return undefined
    const id = setInterval(saveDraftNow, intervalMs)
    return () => clearInterval(id)
  }, [enabled, isEditMode, readOnly, key, intervalMs, saveDraftNow])

  useEffect(() => {
    if (!enabled || isEditMode || readOnly || !key || promptedRef.current === key) return
    promptedRef.current = key
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.version !== 1 || parsed.scope !== key) return
      const snap = parsed.snapshot
      if (!Array.isArray(snap?.cart)) return
      const hasItems = snap.cart.some((i) => i?.productId)
      if (!hasItems) return
      const age = Date.now() - parsed.savedAt
      if (!Number.isFinite(parsed.savedAt) || age < 0 || age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key)
        return
      }
      onRestore?.(snap)
    } catch { /* ignore */ }
  }, [enabled, isEditMode, readOnly, key, onRestore])

  return { clearDraft, saveDraftNow, draftKey: key }
}
