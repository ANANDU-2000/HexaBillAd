import { useEffect, useState } from 'react'

/**
 * "Jump to section" picker for long forms on phones and tablets. It reads the page's own h2/h3 headings inside
 * `selector`, so long pages need no restructuring. Hidden from 1024px up and when a page has fewer than 4 sections.
 */
const PageSectionJump = ({ selector = 'main form', label = 'Jump to section' }) => {
  const [items, setItems] = useState([])

  useEffect(() => {
    const t = setTimeout(() => {
      const root = document.querySelector(selector)
      if (!root) { setItems([]); return }
      const found = []
      root.querySelectorAll('h2, h3').forEach((el, i) => {
        const text = (el.textContent || '').trim()
        if (!text || el.closest('[hidden]') || el.getClientRects().length === 0) return
        if (!el.id) el.id = `section-${i}`
        el.style.scrollMarginTop = '96px'
        found.push({ id: el.id, text: text.slice(0, 48) })
      })
      setItems(found)
    }, 150)
    return () => clearTimeout(t)
  }, [selector])

  if (items.length < 4) return null
  return (
    <label className="block lg:hidden">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        defaultValue=""
        onChange={(e) => {
          const el = document.getElementById(e.target.value)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          e.target.value = ''
        }}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
      >
        <option value="">{label}…</option>
        {items.map((it) => <option key={it.id} value={it.id}>{it.text}</option>)}
      </select>
    </label>
  )
}

export default PageSectionJump
