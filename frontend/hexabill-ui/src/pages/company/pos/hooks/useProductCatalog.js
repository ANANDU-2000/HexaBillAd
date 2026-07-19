import { useMemo } from 'react'

const FREQ_KEY = 'hexabill_pos_product_freq'
const LAST_KEY = 'hexabill_pos_last_billed'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function recordProductBilled(productId) {
  if (productId == null) return
  const id = String(productId)
  try {
    const freq = readJson(FREQ_KEY, {})
    freq[id] = (freq[id] || 0) + 1
    localStorage.setItem(FREQ_KEY, JSON.stringify(freq))
    const last = readJson(LAST_KEY, [])
    const next = [id, ...last.filter((x) => x !== id)].slice(0, 30)
    localStorage.setItem(LAST_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

/**
 * Client-only catalog: filter + Recent (session) + Frequent + Last billed + All.
 */
export function useProductCatalog({ products, cart, searchTerm, pageSize = 10, page = 0 }) {
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

    const freqMap = readJson(FREQ_KEY, {})
    const frequent = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .filter(filterOne)
      .filter((p) => !seen.has(String(p.id)))
      .slice(0, 20)

    const lastIds = readJson(LAST_KEY, [])
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
    }
  }, [products, cart, searchTerm, pageSize, page])
}
