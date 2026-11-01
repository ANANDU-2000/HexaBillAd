/**
 * Shared business-date presets for the UAE (Asia/Dubai, UTC+4, no daylight saving).
 * All values are calendar dates (YYYY-MM-DD) in Dubai, inclusive on both ends.
 * The API turns them into [from 00:00 Dubai, to+1 00:00 Dubai) — never add a day here.
 */

export const BUSINESS_TIME_ZONE = 'Asia/Dubai'

export const PERIOD_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Week' },
  { id: 'last30', label: '30 Days' },
  { id: 'month', label: 'Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
]

const PERIOD_IDS = new Set(PERIOD_PRESETS.map((p) => p.id))

export function isPeriodId (value) {
  return PERIOD_IDS.has(value)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate (value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Today's calendar date in Dubai for the given instant. */
export function dubaiToday (now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function shift (isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthStart (isoDate) {
  return `${isoDate.slice(0, 7)}-01`
}

/**
 * Resolve a preset to an inclusive { from, to } Dubai date range.
 * 'all' → { from: '', to: '' }. 'custom' → null (caller keeps its own dates).
 */
export function resolvePeriod (period, now = new Date()) {
  const today = dubaiToday(now)
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = shift(today, -1)
      return { from: y, to: y }
    }
    case 'week':
      // Rolling seven business days including today (1 Nov → 26 Oct..1 Nov).
      return { from: shift(today, -6), to: today }
    case 'last30':
      return { from: shift(today, -29), to: today }
    case 'month':
      return { from: monthStart(today), to: today }
    case 'lastMonth': {
      const lastDayPrev = shift(monthStart(today), -1)
      return { from: monthStart(lastDayPrev), to: lastDayPrev }
    }
    case 'all':
      return { from: '', to: '' }
    default:
      return null
  }
}

/** Number of calendar days in an inclusive range (for chart buckets). */
export function daysInRange (from, to) {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return 0
  const ms = new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)
  return Math.round(ms / 86400000) + 1
}
