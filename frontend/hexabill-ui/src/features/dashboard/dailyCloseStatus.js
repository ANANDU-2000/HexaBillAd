// Maps the daily-close status response to what the owner sees on the dashboard.
// Never reports "closed" unless the server says the row is Closed; a failed load is its own state.
export const describeDailyClose = (result) => {
  if (!result || result.error) return { key: 'unavailable', tone: 'neutral', title: 'Daily close status unavailable', detail: 'Could not load today’s status. Open Daily close to check.' }
  const current = result.current ?? null
  if (!current) return { key: 'not-started', tone: 'warning', title: 'Not closed yet', detail: 'No cash count has been saved for today.' }
  const status = String(current.status ?? '').toLowerCase()
  const variance = Number(current.variance ?? 0)
  if (status === 'closed') {
    const varianceNote = Math.abs(variance) >= 0.005
      ? (current.varianceReason ? 'Variance recorded with a reason.' : 'Variance recorded without a reason.')
      : 'Counted cash matches expected.'
    return { key: 'closed', tone: Math.abs(variance) >= 0.005 && !current.varianceReason ? 'warning' : 'success', title: 'Closed', detail: varianceNote, variance, closedAt: current.closedAt ?? null }
  }
  if (current.reopenedAt) return { key: 'reopened', tone: 'warning', title: 'Reopened', detail: current.reopenReason ? `Reason: ${current.reopenReason}` : 'Needs to be closed again.' }
  return { key: 'draft', tone: 'warning', title: 'Draft saved', detail: 'Cash count saved but not closed.' }
}
