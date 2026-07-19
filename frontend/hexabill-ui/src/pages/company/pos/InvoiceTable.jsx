import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * Virtualized body wrapper for large carts (100+ rows).
 * Renders a spacer + absolutely positioned row windows over a table-like grid.
 * For moderate carts, prefer native <table> for sticky column support.
 */
export function useInvoiceVirtualizer({ count, estimateSize = 36, enabled = true, scrollRef }) {
  const fallbackRef = useRef(null)
  const parentRef = scrollRef || fallbackRef
  const virtualizer = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 12,
  })
  return { parentRef, virtualizer, enabled: enabled && count > 40 }
}

export default function VirtualInvoiceSpacer({ virtualizer, children }) {
  if (!virtualizer) return children
  const total = virtualizer.getTotalSize()
  return (
    <div style={{ height: total, width: '100%', position: 'relative' }}>
      {children}
    </div>
  )
}
