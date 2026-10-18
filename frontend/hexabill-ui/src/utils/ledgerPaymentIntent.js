// Keep an uncertain payment's original request across form closes and page reloads.
// These records contain no credentials. Server host/JWT authorization is authoritative.
export function ledgerPaymentScope({ origin, tenantId, userId, customerId }) {
  if (!origin || !(Number(tenantId) > 0) || !(Number(userId) > 0) || customerId == null) return null
  return `hexabill:ledger-payment:v1:${origin}:${tenantId}:${userId}:${customerId}`
}

export function ledgerPaymentAccountPrefix(identity) {
  const scope = ledgerPaymentScope({ ...identity, customerId: '*' })
  return scope ? scope.slice(0, -1) : null
}

/**
 * True when the server answered 400/422 for a payment: its checks (amount, customer, open invoices) run AFTER it looks up the
 * idempotency key, so such an answer proves this key saved nothing and the saved request can be released. Everything else
 * (no answer, 5xx, 401/403/404, 409, or "key already used for a different request") may hide a saved payment and stays uncertain.
 */
export function isDefinitivePaymentRejection(error) {
  const status = Number(error?.response?.status)
  if (status !== 400 && status !== 422) return false
  const message = String(error?.response?.data?.message || '')
  return !/idempotency key/i.test(message)
}

/** The sentence to show for a rejected payment: the server's own words, never a generic "unconfirmed". */
export function paymentRejectionMessage(error) {
  const data = error?.response?.data
  if (data?.message) return String(data.message)
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.join(', ')
  if (error?.message) return String(error.message)
  return 'The payment could not be saved.'
}

/** A bulk-form row rebuilt from a saved batch row (used to hand a rejected or unsent payment back for editing). */
export function bulkRowFromSaved(row) {
  const mode = String(row.request.mode || 'CASH').toUpperCase()
  let date = ''
  try { date = JSON.parse(row.form)?.date || '' } catch { /* the form text is ours; keep the date empty if it is damaged */ }
  return {
    customerId: String(row.request.customerId),
    amount: String(row.request.amount),
    method: mode === 'CREDIT' ? 'PENDING' : mode,
    paymentDate: date,
    reference: row.request.reference || '',
  }
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
    list(identity) {
      const prefix = ledgerPaymentAccountPrefix(identity)
      if (!prefix) return []
      const intents = []
      try {
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index)
          if (key?.startsWith(prefix)) intents.push(read(key))
        }
      } catch (error) { throw new Error(error.message || 'Payment recovery storage is unavailable.') }
      return intents.filter(Boolean)
    },
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
    /** Release a saved payment the server definitively rejected (see isDefinitivePaymentRejection). Only the matching key is removed. */
    discard(scope, idempotencyKey) {
      if (read(scope)?.idempotencyKey === idempotencyKey) storage.removeItem(scope)
    },
  }
}

export function paymentBatchScope(identity) {
  const prefix = ledgerPaymentAccountPrefix(identity)
  return prefix ? prefix.replace('hexabill:ledger-payment:v1:', 'hexabill:payment-batch:v1:') : null
}

// Batch metadata records planned keys and confirmed progress. Each money request
// still uses the same per-customer journal as single payments and the ledger.
export function createPaymentBatchJournal(storage, newKey = () => crypto.randomUUID()) {
  const save = (scope, batch) => {
    try { storage.setItem(scope, JSON.stringify(batch)) }
    catch { throw new Error('Bulk payment recovery storage is unavailable. Retry the saved batch before starting another.') }
  }
  const read = (scope) => {
    if (!scope) throw new Error('Select a tenant before saving bulk payments.')
    let raw
    try { raw = storage.getItem(scope) } catch { throw new Error('Bulk payment recovery storage is unavailable.') }
    if (!raw) return null
    try {
      const batch = JSON.parse(raw)
      const prefix = scope.replace('hexabill:payment-batch:v1:', 'hexabill:ledger-payment:v1:')
      if (batch.version !== 1 || batch.scope !== scope || !Array.isArray(batch.rows) || !batch.rows.length
        || batch.rows.some(row => row.scope !== `${prefix}${row.request?.customerId}` || typeof row.form !== 'string'
          || !/^[0-9a-f-]{36}$/i.test(row.key) || typeof row.confirmed !== 'boolean'
          || !Number.isFinite(row.request?.amount) || row.request.amount <= 0
          || !(Number(row.request.customerId) > 0)
          || JSON.parse(row.form)?.kind !== 'create')) throw new Error('Invalid batch')
      return batch
    } catch { throw new Error('Saved bulk payment recovery data could not be read. Contact support before starting another batch.') }
  }
  return {
    read,
    begin(scope, drafts) {
      const previous = read(scope)
      if (previous) throw new Error('Resume the saved bulk payments before starting another batch.')
      const ledger = createLedgerPaymentJournal(storage)
      const prefix = scope.replace('hexabill:payment-batch:v1:', 'hexabill:ledger-payment:v1:')
      if (!drafts.length || drafts.some(row => !row.scope?.startsWith(prefix) || !(Number(row.request?.customerId) > 0)
        || !Number.isFinite(row.request?.amount) || row.request.amount <= 0)) {
        throw new Error('Enter a valid positive amount for every payment.')
      }
      for (const row of drafts) {
        if (ledger.read(row.scope)) throw new Error('Retry the previous payment for this customer before starting bulk payments.')
      }
      const batch = JSON.parse(JSON.stringify({version:1,scope,rows:drafts.map(row => ({...row,key:newKey(),confirmed:false}))}))
      save(scope,batch)
      return batch
    },
    async execute(scope, send, onProgress = () => {}) {
      const batch = read(scope)
      if (!batch) throw new Error('No saved bulk payments to resume.')
      for (const row of batch.rows) {
        const ledger = createLedgerPaymentJournal(storage, () => row.key)
        const pending = ledger.read(row.scope)
        if (row.confirmed) {
          if (pending?.idempotencyKey === row.key) ledger.complete(row.scope,row.key)
          onProgress(JSON.parse(JSON.stringify(batch)))
          continue
        }
        if (pending && pending.idempotencyKey !== row.key) {
          throw new Error('Retry the previous payment for this customer before resuming bulk payments.')
        }
        if (!row.confirmed) {
          const intent = ledger.begin(row.scope, {kind:'create',form:row.form,request:row.request})
          let response
          try {
            response = await send(intent.request, intent.idempotencyKey)
          } catch (error) {
            if (!isDefinitivePaymentRejection(error)) throw error
            // The server refused this payment and saved nothing for its key. Keep what was confirmed, release this and the
            // unsent rows as an editable draft, and remove the saved batch so nothing is left "waiting for confirmation".
            const index = batch.rows.indexOf(row)
            const message = paymentRejectionMessage(error)
            const handedBack = batch.rows.slice(index).map((r, i) => ({ request: r.request, form: r.form, rejected: i === 0, message: i === 0 ? message : null }))
            ledger.discard(row.scope, intent.idempotencyKey)
            try { storage.removeItem(scope) } catch { throw new Error('The payment was refused. Reload the page to clear the saved bulk payments.') }
            const result = JSON.parse(JSON.stringify({ ...batch, rows: batch.rows.slice(0, index) }))
            result.rejected = { index, message, rows: handedBack }
            return result
          }
          if (!response?.success) throw new Error(response?.message || 'Payment is unconfirmed. Resume the saved batch.')
          row.confirmed = true
          save(scope,batch) // Persist success before removing the per-customer intent.
        }
        if (pending || row.confirmed) ledger.complete(row.scope,row.key)
        onProgress(JSON.parse(JSON.stringify(batch)))
      }
      try { storage.removeItem(scope) } catch { throw new Error('Payments confirmed. Resume the saved batch to finish recovery cleanup.') }
      return batch
    },
  }
}
