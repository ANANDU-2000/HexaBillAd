import { useEffect, useRef, useState } from 'react'

/**
 * Animates a money/number value from its previous value to the new one (about 600 ms, ease-out).
 * The final text is always exactly `format(value)`; reduced motion or a first paint of 0 shows it immediately.
 */
const CountUp = ({ value, format = (v) => String(v), duration = 600, className = '' }) => {
  const target = Number(value) || 0
  const [shown, setShown] = useState(target)
  const fromRef = useRef(target)
  const frameRef = useRef(0)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    if (reduce || from === target) { setShown(target); fromRef.current = target; return undefined }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(from + (target - from) * eased)
      if (p < 1) frameRef.current = requestAnimationFrame(tick)
      else { setShown(target); fromRef.current = target }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frameRef.current); fromRef.current = target }
  }, [target, duration])

  return <span className={className}>{format(shown)}</span>
}

export default CountUp
