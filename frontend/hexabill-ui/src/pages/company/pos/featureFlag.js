/**
 * Enterprise POS v2 — ON by default.
 * Opt out: VITE_POS_ENTERPRISE_V2=false or localStorage.hexabill_pos_enterprise_v2=0
 */
export function isPosEnterpriseV2() {
  if (import.meta.env.VITE_POS_ENTERPRISE_V2 === 'false') return false
  try {
    const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('hexabill_pos_enterprise_v2') : null
    if (ls === '0' || ls === 'false') return false
  } catch {
    /* ignore */
  }
  return true
}
