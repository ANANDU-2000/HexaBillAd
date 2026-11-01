import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidIban, validateInvoiceBankIban, invoiceBankReadiness } from '../src/features/settings/settingsUpdatePayload.js'

// AE070331234567890123456 is the published ISO 13616 example UAE IBAN (not a real account).
const EXAMPLE_IBAN = 'AE07 0331 2345 6789 0123 456'

test('IBAN checksum accepts the published UAE example and rejects a one-digit typo', () => {
  assert.equal(isValidIban(EXAMPLE_IBAN), true)
  assert.equal(isValidIban('AE070331234567890123457'), false)
  assert.equal(isValidIban('AE07033123456789012345'), false) // UAE length must be 23
  assert.equal(isValidIban(''), false)
})

test('bank details are all-or-none and IBAN must be valid', () => {
  const full = { invoiceBankName: 'ADCB Islamic', invoiceBankAccountName: 'FROZENHUB FOODSTUFF TRADING LLC SPC', invoiceBankIban: EXAMPLE_IBAN }
  assert.equal(validateInvoiceBankIban(full.invoiceBankIban, full), true)
  assert.equal(validateInvoiceBankIban('', { invoiceBankName: '', invoiceBankAccountName: '', invoiceBankIban: '' }), true)
  assert.match(String(validateInvoiceBankIban('', { ...full, invoiceBankIban: '' })), /all be filled/)
  assert.match(String(validateInvoiceBankIban('AE00123', { ...full, invoiceBankIban: 'AE00123' })), /not valid/)
})

test('readiness reports missing bank details instead of silently printing nothing', () => {
  assert.deepEqual(invoiceBankReadiness({ invoiceBankName: 'ADCB Islamic', invoiceBankAccountName: '', invoiceBankIban: '' }),
    { ready: false, missing: ['Account name', 'IBAN'] })
  assert.deepEqual(invoiceBankReadiness({ invoiceBankName: 'ADCB Islamic', invoiceBankAccountName: 'X', invoiceBankIban: EXAMPLE_IBAN }),
    { ready: true, missing: [] })
})
