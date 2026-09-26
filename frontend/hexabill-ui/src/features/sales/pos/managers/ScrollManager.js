/** Scroll invoice row into vertical center of its scroll parent. */
export function scrollRowIntoCenter(rowEl, { smooth = true } = {}) {
  if (!rowEl || typeof rowEl.scrollIntoView !== 'function') return
  try {
    rowEl.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'center',
      inline: 'nearest',
    })
  } catch {
    rowEl.scrollIntoView(true)
  }
}

export function scrollRowIndexIntoCenter(rowRefsMap, index, opts) {
  const el = rowRefsMap?.current?.[index]
  if (el) scrollRowIntoCenter(el, opts)
}
