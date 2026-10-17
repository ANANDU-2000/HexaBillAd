// Pure helpers for the assistant panel. Kept free of React and of import.meta so they can be unit tested.

export const ASSISTANT_STORAGE_KEY = 'hexabill.assistant'

/** The panel is off unless the build or this browser switches it on, so shipping the code changes nothing for users. */
export const isAssistantEnabled = (env = {}, storage = globalThis.localStorage) => {
  if (String(env?.VITE_ENABLE_ASSISTANT || '').toLowerCase() === 'true') return true
  try {
    return storage?.getItem(ASSISTANT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Field name -> first message, so each input can show its own problem. */
export const fieldErrorMap = (errors) => {
  const map = {}
  for (const e of Array.isArray(errors) ? errors : []) {
    if (e?.field && !map[e.field]) map[e.field] = e.message
  }
  return map
}

/** A draft may be confirmed only when the server found no field errors and it is still a plain draft. */
export const canConfirm = (draft) =>
  Boolean(draft && draft.status === 'Draft' && Array.isArray(draft.errors) && draft.errors.length === 0 && draft.payloadHash)

/** One key per reviewed draft. Reusing it on a retry is what makes a second tap return the first result. */
export const newIdempotencyKey = (cryptoObj = globalThis.crypto) => {
  const id = cryptoObj?.randomUUID ? cryptoObj.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `assistant-${id}`
}

/**
 * What to tell the person after a failed confirm.
 * `retry` is true only when the server refused before doing anything, so asking again is safe.
 * A 5xx or a lost response may have saved the customer, so it is never offered as a blind retry.
 */
export const describeConfirmFailure = (status, message) => {
  const text = message || 'Could not confirm.'
  if (status === 410) return { text, retry: false, startOver: true }
  if (status === 409) return { text, retry: false, startOver: true }
  if (status === 400) return { text, retry: false, startOver: false }
  if (status === 404) return { text: 'This draft is no longer available. Review it again.', retry: false, startOver: true }
  return { text: 'The result is not certain. Check the Customers list before creating this customer again.', retry: false, startOver: true, uncertain: true }
}

export const emptyCustomerForm = () => ({ name: '', phone: '', email: '', trn: '', address: '', creditLimit: '', paymentTerms: '', customerType: 'Credit' })

/** Form values -> request body. Empty credit limit means 0; text is sent as typed and trimmed by the server. */
export const toDraftRequest = (form) => ({
  name: form.name,
  phone: form.phone,
  email: form.email,
  trn: form.trn,
  address: form.address,
  creditLimit: form.creditLimit === '' || form.creditLimit == null ? 0 : Number(form.creditLimit),
  paymentTerms: form.paymentTerms,
  customerType: form.customerType,
})
