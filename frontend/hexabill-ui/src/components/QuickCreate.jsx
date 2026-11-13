import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart, Wallet, Receipt, Truck, Banknote, UserPlus, PackagePlus, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getQuickCreateActions } from '../navigation/quickCreate.js'
import MobileSheet from './mobile/MobileSheet'

const ICONS = { ShoppingCart, Wallet, Receipt, Truck, Banknote, UserPlus, PackagePlus }

function ActionList ({ actions, onPick, variant }) {
  const sheet = variant !== 'menu'
  return (
    <ul className={sheet ? 'divide-y divide-neutral-100' : 'py-1'} role={sheet ? undefined : 'none'}>
      {actions.map((a) => {
        const Icon = ICONS[a.icon] || Plus
        return (
          <li key={a.id} role={sheet ? undefined : 'none'}>
            <button
              type="button"
              role={sheet ? undefined : 'menuitem'}
              onClick={() => onPick(a)}
              className={sheet
                ? 'group flex min-h-[60px] w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 focus-visible:bg-neutral-50'
                : 'flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50 focus-visible:bg-neutral-50'}
              data-quick-create={a.id}
            >
              <span className={sheet
                ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-white'
                : 'shrink-0'}>
                <Icon className={sheet ? 'h-5 w-5' : 'h-5 w-5 text-neutral-500'} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={sheet ? 'block text-[15px] font-semibold leading-snug text-text-primary' : 'block text-sm font-medium text-text-primary'}>{a.label}</span>
                <span className="block truncate text-xs text-neutral-500">{a.hint}</span>
              </span>
              {sheet && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" strokeWidth={2} aria-hidden />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Phone: bottom sheet opened from the bottom navigation. */
export function QuickCreateSheet ({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const actions = getQuickCreateActions(user)
  const pick = (a) => { onClose(); navigate(a.href) }
  return (
    <MobileSheet open={open} onClose={onClose} title="Create" size="sm">
      <ActionList actions={actions} onPick={pick} variant="sheet" />
    </MobileSheet>
  )
}

/** Tablet/desktop: "New" menu in the top bar. */
export function QuickCreateMenu () {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const actions = getQuickCreateActions(user)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (actions.length === 0) return null
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-primary h-touch gap-1 px-3 xl:min-h-[40px]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" aria-hidden /> New <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Create" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
          <ActionList actions={actions} onPick={(a) => { setOpen(false); navigate(a.href) }} variant="menu" />
        </div>
      )}
    </div>
  )
}
