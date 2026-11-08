/**
 * P-02: one scheduler for background polling jobs.
 * Each named job runs on its own timer chain, but a tick is skipped (and retried shortly) while ANY pause reason holds:
 * tab hidden, device offline, a modal/dialog open, a dirty form registered, or the user typed within the last 10 s.
 * Intervals get +-10 % jitter; a job that throws backs off exponentially (x2 per failure, max 5 min) and resets on success.
 * Driver live location keeps its own timer (F02) and must NOT use this.
 */
export const TYPING_PAUSE_MS = 10000
export const MAX_BACKOFF_MS = 5 * 60 * 1000
const RECHECK_MS = 2000 // how soon a paused tick looks again

export function nextDelay (baseMs, failures, random = Math.random) {
  const backoff = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** Math.max(0, failures))
  const jitter = 1 + (random() * 0.2 - 0.1)
  return Math.round(backoff * jitter)
}

export function createScheduler ({
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
  random = Math.random,
  env = defaultEnv(),
} = {}) {
  const jobs = new Map()
  const dirty = new Set()
  let lastTypedAt = -Infinity

  const pauseReason = () => {
    if (env.hidden()) return 'hidden'
    if (env.offline()) return 'offline'
    if (env.modalOpen()) return 'modal'
    if (dirty.size > 0) return 'dirty'
    if (now() - lastTypedAt < TYPING_PAUSE_MS) return 'typing'
    return null
  }

  function schedule (job, delay) {
    clearTimer(job.timer)
    job.timer = setTimer(() => tick(job), delay)
  }

  async function tick (job) {
    if (!jobs.has(job.name)) return
    if (pauseReason()) { schedule(job, RECHECK_MS); return }
    try {
      await job.fn()
      job.failures = 0
    } catch (_) {
      job.failures += 1
    }
    if (jobs.has(job.name)) schedule(job, nextDelay(job.intervalMs, job.failures, random))
  }

  return {
    /** Register (or replace) a named job. Returns an unregister function. First run is after one interval. */
    register (name, fn, { intervalMs }) {
      this.unregister(name)
      const job = { name, fn, intervalMs, failures: 0, timer: null }
      jobs.set(name, job)
      schedule(job, nextDelay(intervalMs, 0, random))
      return () => this.unregister(name)
    },
    unregister (name) {
      const job = jobs.get(name)
      if (!job) return
      clearTimer(job.timer)
      jobs.delete(name)
    },
    /** A page with unsaved input marks itself dirty; polling pauses until every key is cleared. */
    setDirty (key, isDirty) { if (isDirty) dirty.add(key); else dirty.delete(key) },
    noteTyping () { lastTypedAt = now() },
    pauseReason,
    jobNames: () => [...jobs.keys()],
  }
}

function defaultEnv () {
  return {
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    offline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
    modalOpen: () => typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'),
  }
}

export const scheduler = createScheduler()

if (typeof document !== 'undefined') {
  const onInput = () => scheduler.noteTyping()
  document.addEventListener('keydown', onInput, true)
  document.addEventListener('input', onInput, true)
}
