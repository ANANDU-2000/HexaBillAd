import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart, Wallet, Receipt, Truck, Banknote, UserPlus, PackagePlus, ChevronDown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getQuickCreateActions } from '../navigation/quickCreate.js'
import MobileSheet from './mobile/MobileSheet'

const ICONS = { ShoppingCart, Wallet, Receipt, Truck, Banknote, UserPlus, PackagePlus }

function ActionList ({ actions, onPick, variant }) {
  return (
    <ul className={variant === 'menu' ? 'py-1' : 'divide-y divide-surface-border'} role={variant === 'menu' ? 'none' : undefined}>
      {actions.map((a) => {
        const Icon = ICONS[a.icon] || Plus
        return (
          <li key={a.id} role={variant === 'menu' ? 'none' : undefined}>
            <button
              type="button"
              role={variant === 'menu' ? 'menuitem' : undefined}
              onClick={() => onPick(a)}
              className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50 focus-visible:bg-neutral-50"
              data-quick-create={a.id}
            >
              <Icon className="h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">{a.label}</span>
                <span className="block truncate text-xs text-neutral-500">{a.hint}</span>
              </span>
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
      <div className="-mx-4 -my-2"><ActionList actions={actions} onPick={pick} variant="sheet" /></div>
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
        className="btn btn-primary min-h-11 lg:min-h-[40px] gap-1 px-3"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="h-4 w-4" aria-hidden /> New <ChevronDown className="h-4 w-4 opacity-80" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Create" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-surface-border bg-white shadow-lg">
          <ActionList actions={actions} onPick={(a) => { setOpen(false); navigate(a.href) }} variant="menu" />
        </div>
      )}
    </div>
  )
}
