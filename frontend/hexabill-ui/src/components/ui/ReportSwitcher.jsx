import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * One-row report picker. Group buttons open a list of that group's reports; the active group's
 * reports also sit beside them as an underlined tab strip. Phones get a single grouped select.
 *
 * groups: [{ label, tabs: [{ id, name, shortLabel }] }]
 */
export default function ReportSwitcher({ groups, activeId, onChange, right = null }) {
  const [openGroup, setOpenGroup] = useState(null)
  const rootRef = useRef(null)
  const activeGroup = groups.find((g) => g.tabs.some((t) => t.id === activeId)) || groups[0]

  useEffect(() => {
    if (!openGroup) return
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpenGroup(null) }
    const onKey = (e) => { if (e.key === 'Escape') setOpenGroup(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [openGroup])

  const pick = (id) => { setOpenGroup(null); onChange(id) }

  return (
    <div ref={rootRef} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2">
      {/* Phones: one grouped select */}
      <select
        aria-label="Report"
        value={activeId}
        onChange={(e) => pick(e.target.value)}
        className="my-1 min-h-11 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-base md:hidden"
      >
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.tabs.map((t) => <option key={t.id} value={t.id} data-short={t.shortLabel || t.name}>{t.name}</option>)}
          </optgroup>
        ))}
      </select>

      {/* Tablet and up */}
      <div className="hidden items-center md:flex">
        {groups.map((g) => {
          const isActive = g === activeGroup
          return (
            <div key={g.label} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openGroup === g.label}
                onClick={() => setOpenGroup(openGroup === g.label ? null : g.label)}
                className={`inline-flex h-9 items-center gap-1 px-2.5 text-[13px] font-semibold ${isActive ? 'text-primary-700' : 'text-neutral-600 hover:text-neutral-900'}`}
              >
                {g.label}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              {openGroup === g.label && (
                <div role="menu" className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
                  {g.tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      aria-label={t.shortLabel || t.name}
                      onClick={() => pick(t.id)}
                      className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-neutral-100 ${t.id === activeId ? 'font-semibold text-primary-700' : 'text-neutral-800'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <span className="hidden h-5 w-px bg-neutral-300 md:block" aria-hidden />

      <div role="tablist" aria-label={`${activeGroup?.label} reports`} className="hidden min-w-0 flex-1 items-center overflow-x-auto md:flex">
        {activeGroup?.tabs.map((t) => {
          const active = t.id === activeId
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pick(t.id)}
              className={`h-9 shrink-0 border-b-2 px-3 text-[13px] font-medium ${active ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`}
            >
              {t.shortLabel || t.name}
            </button>
          )
        })}
      </div>

      {right && <div className="ms-auto flex shrink-0 items-center gap-1">{right}</div>}
    </div>
  )
}
