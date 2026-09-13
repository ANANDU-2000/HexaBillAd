import MobileSheet from './MobileSheet'

/**
 * MobileActionSheet — bottom sheet listing discrete actions (View, Edit,
 * Download, Delete, …) typically opened from a "more" (⋯) button on a
 * mobile card. Each item auto-sizes to 44px tap height.
 *
 * props:
 *  - open, onClose
 *  - title (default "Actions")
 *  - actions: [{ label, icon?, onClick, tone?: 'default'|'danger', show?: bool }]
 *  - dismissLabel — optional Cancel button (default "Cancel")
 *  - Header actions can carry a leading icon via lucide component.
 */
const MobileActionSheet = ({ open, onClose, title = 'Actions', actions = [], dismissLabel = 'Cancel' }) => {
  const visible = actions.filter((a) => a.show !== false)

  return (
    <MobileSheet
      open={open}
      onClose={onClose}
      title={title}
      ariaLabel={title}
      closeOnOverlayClick
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[48px] px-4 rounded-xl border border-neutral-300 bg-white text-neutral-700 font-semibold text-base active:bg-neutral-100"
        >
          {dismissLabel}
        </button>
      }
    >
      <div className="px-3 py-3 space-y-1" role="menu">
        {visible.map((action, idx) => {
          const Icon = action.icon
          const isDanger = action.tone === 'danger'
          return (
            <button
              key={idx}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose()
                action.onClick && action.onClick()
              }}
              className={`flex items-center w-full gap-3 min-h-[48px] px-3 rounded-lg text-left font-medium active:bg-neutral-100 transition-colors ${
                isDanger ? 'text-error' : action.iconColor || 'text-neutral-800'
              }`}
            >
              {Icon && <Icon className={`h-5 w-5 shrink-0 ${isDanger ? 'text-error' : 'text-neutral-500'}`} aria-hidden />}
              <span className="text-base">{action.label}</span>
            </button>
          )
        })}
      </div>
    </MobileSheet>
  )
}

export default MobileActionSheet