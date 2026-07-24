/** Short Web Audio tones — no external sound files. */

let sharedCtx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {})
  }
  return sharedCtx
}

function playTone({ frequency, durationMs, type = 'sine', gain = 0.08 }) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency
    g.gain.value = gain
    osc.connect(g)
    g.connect(ctx.destination)
    const now = ctx.currentTime
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
    osc.start(now)
    osc.stop(now + durationMs / 1000 + 0.02)
  } catch {
    /* ignore audio failures */
  }
}

export function playScanSuccessBeep() {
  playTone({ frequency: 880, durationMs: 80, type: 'sine', gain: 0.09 })
}

export function playScanErrorBeep() {
  playTone({ frequency: 220, durationMs: 180, type: 'square', gain: 0.06 })
}
