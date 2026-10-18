import { useRef } from 'react'

export const SHEET_STATES = ['peek', 'half', 'full']
const HEIGHT = { peek: '196px', half: '52%', full: 'calc(100% - 8px)' }
const DRAG_THRESHOLD_PX = 40

/** Next state after a drag of `deltaY` px (negative = up); a tap cycles peek → half → full → peek. */
export function nextSheetState(current, deltaY) {
  const i = SHEET_STATES.indexOf(current)
  if (deltaY <= -DRAG_THRESHOLD_PX) return SHEET_STATES[Math.min(i + 1, SHEET_STATES.length - 1)]
  if (deltaY >= DRAG_THRESHOLD_PX) return SHEET_STATES[Math.max(i - 1, 0)]
  return Math.abs(deltaY) < 6 ? SHEET_STATES[(i + 1) % SHEET_STATES.length] : current
}

/** Phone list over the map: a handle you tap or drag, a fixed header and a scrolling body. Not modal; the map stays usable at "peek". */
export default function MapBottomSheet({ state, onStateChange, header, children }) {
  const startY = useRef(null)
  const end = (e) => {
    if (startY.current == null) return
    const delta = e.clientY - startY.current
    startY.current = null
    onStateChange(nextSheetState(state, delta))
  }
  return (
    <div
      data-testid="route-map-sheet"
      data-state={state}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col border-t border-neutral-300 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.14)] transition-[height] duration-200 ease-out"
      style={{ height: HEIGHT[state], paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <button
        type="button"
        aria-label={state === 'full' ? 'Collapse the stop list' : 'Expand the stop list'}
        className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
        onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId) }}
        onPointerUp={end}
        onPointerCancel={() => { startY.current = null }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStateChange(nextSheetState(state, 0)) } }}
      >
        <span className="h-1 w-10 bg-neutral-300" aria-hidden />
      </button>
      <div className="shrink-0 px-3 pb-2">{header}</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-neutral-200">{children}</div>
    </div>
  )
}
