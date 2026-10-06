// Keep an uncertain payment's original request across form closes and page reloads.
// These records contain no credentials. Server host/JWT authorization is authoritative.
export function ledgerPaymentScope({ origin, tenantId, userId, customerId }) {
  if (!origin || !(Number(tenantId) > 0) || !(Number(userId) > 0) || customerId == null) return null
  return `hexabill:ledger-payment:v1:${origin}:${tenantId}:${userId}:${customerId}`
}

export function ledgerPaymentForm(data, isAllocate) {
  return JSON.stringify({
    kind: isAllocate ? 'allocate' : 'create',
    amount: Number(data.amount),
    saleId: isAllocate ? null : (data.saleId ? Number(data.saleId) : null),
    mode: (data.method || data.mode || 'CASH').toUpperCase(),
    reference: data.ref || data.reference || null,
    date: data.paymentDate || null,
    adjustment: Boolean(data.applySettlementAdjustment),
    reason: data.applySettlementAdjustment ? (data.settlementAdjustmentReason || '').trim() : null,
  })
}

export function createLedgerPaymentJournal(storage, newKey = () => crypto.randomUUID()) {
  const read = (scope) => {
    if (!scope) throw new Error('Select a tenant and customer before saving a payment.')
    let raw
    try { raw = storage.getItem(scope) } catch { throw new Error('Payment recovery storage is unavailable. Enable browser storage before saving.') }
    if (!raw) return null
    try {
      const intent = JSON.parse(raw)
      if (intent.version !== 1 || intent.scope !== scope || !['create', 'allocate'].includes(intent.kind)
        || !/^[0-9a-f-]{36}$/i.test(intent.idempotencyKey) || !(intent.request?.amount > 0)
        || typeof intent.form !== 'string') throw new Error('Invalid saved intent')
      return intent
    } catch { throw new Error('Saved payment recovery data could not be read. Contact support before recording another payment.') }
  }
  return {
    read,
    begin(scope, draft) {
      const pending = read(scope)
      if (pending) {
        if (pending.form !== draft.form) throw new Error('Retry the previous payment before recording a different payment.')
        return pending
      }
      const intent = JSON.parse(JSON.stringify({ ...draft, version: 1, scope, idempotencyKey: newKey() }))
      try { storage.setItem(scope, JSON.stringify(intent)) }
      catch { throw new Error('Payment recovery storage is unavailable. Enable browser storage before saving.') }
      return intent
    },
    complete(scope, idempotencyKey) {
      if (read(scope)?.idempotencyKey === idempotencyKey) storage.removeItem(scope)
    },
  }
}
