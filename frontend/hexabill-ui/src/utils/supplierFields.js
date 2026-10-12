import { cleanText, fixMoney } from './productFields.js'

// Repairs the supplier form instead of rejecting it. Returns the values to send and plain notes for the client.
// error is set only when nothing sensible can be guessed (no name).
export function fixEmail (value) {
  const raw = String(value ?? '').trim()
  if (!raw) return { value: '', note: '' }
  let email = raw.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase()
  email = email.replace(/\.con$/, '.com').replace(/@gmial\./, '@gmail.').replace(/@gamil\./, '@gmail.')
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!ok) return { value: '', note: `Email "${raw}" is not valid, so it was left empty. Add it later by editing the supplier.` }
  return { value: email, note: email !== raw ? `Email tidied to ${email}.` : '' }
}

export function fixPhone (value) {
  const raw = String(value ?? '').trim()
  if (!raw) return { value: '', note: '' }
  const cleaned = raw.replace(/[^0-9+\-()\s]/g, '').replace(/\s+/g, ' ').trim()
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 5) return { value: '', note: `Phone "${raw}" looks too short, so it was left empty.` }
  return { value: cleaned, note: cleaned !== raw ? `Phone tidied to ${cleaned}.` : '' }
}

export function fixSupplierForm (form) {
  const notes = []
  const name = cleanText(form.name)
  if (name !== String(form.name ?? '').trim() && name) notes.push('Extra spaces removed from the name.')
  const email = fixEmail(form.email)
  const phone = fixPhone(form.phone)
  let credit
  const rawCredit = form.creditLimit
  if (rawCredit !== '' && rawCredit != null) {
    const c = fixMoney(rawCredit, 'Credit limit')
    credit = c.value
    if (c.note) notes.push(c.note)
  }
  ;[email, phone].forEach(f => { if (f.note) notes.push(f.note) })
  return {
    error: name ? '' : 'Type the supplier name, for example: Gulf Frozen Foods',
    values: {
      name,
      phone: phone.value || undefined,
      email: email.value || undefined,
      address: cleanText(form.address) || undefined,
      creditLimit: credit,
      paymentTerms: cleanText(form.paymentTerms) || undefined,
    },
    notes,
  }
}
