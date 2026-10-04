import { useCallback, useMemo, useRef, useState } from 'react'
import { getPosDraftKey } from './usePosDraft.js'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function readHistory(key) {
  const data = key ? readJson(key, null) : null
  if (data?.version !== 1 || data.scope !== key || !Array.isArray(data.entries)) return []
  return data.entries.filter((entry) => Array.isArray(entry) && entry.length === 2 &&
    typeof entry[0] === 'string' && /^[1-9]\d*$/.test(entry[0]) &&
    Number.isSafeInteger(entry[1]) && entry[1] > 0).slice(0, 200)
}

/**
 * Client-only catalog: filter + Recent (session) + Frequent + Last billed + All.
 */
export function useProductCatalog({ products, cart, searchTerm, pageSize = 10, page = 0,
  tenantId, userId, readOnly = false }) {
  const identityKey = getPosDraftKey(tenantId, userId)
  const historyKey = identityKey ? `${identityKey}_product_history` : null
  const currentScope = useRef({ historyKey, readOnly })
  currentScope.current = { historyKey, readOnly }
  const [historyUpdate, setHistoryUpdate] = useState(null)
  const recordProductBilled = useCallback((productId) => {
    if (!historyKey || readOnly || currentScope.current.readOnly ||
      currentScope.current.historyKey !== historyKey) return
    const id = String(productId)
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return
    try {
      const entries = readHistory(historyKey)
      const count = entries.find(([entryId]) => entryId === id)?.[1] || 0
      const next = [[id, Math.min(count + 1, Number.MAX_SAFE_INTEGER)],
        ...entries.filter(([entryId]) => entryId !== id)].slice(0, 200)
      localStorage.setItem(historyKey, JSON.stringify({ version: 1, scope: historyKey, entries: next }))
      setHistoryUpdate({ key: historyKey, entries: next })
    } catch { /* Storage can be unavailable; product selection still works. */ }
  }, [historyKey, readOnly])

  return useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase()
    const filterOne = (p) => {
      if (!term) return true
      return (
        p.nameEn?.toLowerCase().includes(term) ||
        p.nameAr?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        String(p.category || p.group || '').toLowerCase().includes(term)
      )
    }

    const byId = new Map(products.map((p) => [String(p.id), p]))

    // Session recent from cart (most recent first)
    const seen = new Set()
    const recent = []
    for (let i = cart.length - 1; i >= 0; i--) {
      const id = cart[i]?.productId
      if (id == null || seen.has(String(id))) continue
      seen.add(String(id))
      const p = byId.get(String(id))
      if (p && filterOne(p)) recent.push(p)
    }

    const history = readOnly ? [] : historyUpdate?.key === historyKey
      ? historyUpdate.entries : readHistory(historyKey)
    const frequent = [...history]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .filter(filterOne)
      .filter((p) => !seen.has(String(p.id)))
      .slice(0, 20)

    const lastIds = history.map(([id]) => id)
    const lastBilled = lastIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .filter(filterOne)
      .filter((p) => !seen.has(String(p.id)) && !frequent.some((f) => String(f.id) === String(p.id)))
      .slice(0, 15)

    const exclude = new Set([
      ...recent.map((p) => String(p.id)),
      ...frequent.map((p) => String(p.id)),
      ...lastBilled.map((p) => String(p.id)),
    ])

    const all = products.filter(filterOne).filter((p) => !exclude.has(String(p.id))).slice(0, 200)

    const flat = term
      ? products.filter(filterOne).slice(0, 200)
      : [...recent, ...frequent, ...lastBilled, ...all]

    const totalPages = Math.max(1, Math.ceil(flat.length / pageSize) || 1)
    const safePage = Math.min(Math.max(0, page), totalPages - 1)
    const start = safePage * pageSize
    const pageItems = flat.slice(start, start + pageSize)

    const categories = [
      ...new Set(
        products
          .map((p) => p.category || p.group)
          .filter(Boolean)
          .map(String)
      ),
    ].slice(0, 24)

    return {
      recent: term ? [] : recent,
      frequent: term ? [] : frequent,
      lastBilled: term ? [] : lastBilled,
      all: term ? flat : all,
      flat,
      pageItems,
      page: safePage,
      totalPages,
      start,
      categories,
      recordProductBilled,
    }
  }, [products, cart, searchTerm, pageSize, page, historyKey, readOnly, historyUpdate, recordProductBilled])
}
