/**
 * DisabledState - Task 20
 * 40% opacity, tooltip on hover, never hide. Wrap disabled elements.
 */
import { useState } from 'react'

export default function DisabledState({
  children,
  reason = 'Complete setup to enable',
  disabled = true,
  className = '',
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!disabled) return children

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <div className="opacity-40 pointer-events-none cursor-not-allowed" aria-disabled="true">
        {children}
      </div>
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded shadow-lg whitespace-nowrap z-50"
          role="tooltip"
        >
          {reason}
        </div>
      )}
    </div>
  )
}
