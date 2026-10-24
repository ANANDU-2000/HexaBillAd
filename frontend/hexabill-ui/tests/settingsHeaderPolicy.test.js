import test from 'node:test'
import assert from 'node:assert/strict'
import { addInvoiceHeaderStyleForUpdate } from '../src/features/settings/settingsUpdatePayload.js'

test('company settings update omits server-managed header policy for FrozenHub', () => {
  const payload = addInvoiceHeaderStyleForUpdate(
    { COMPANY_NAME_EN: 'FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C' },
    { invoiceHeaderStyle: 'BilingualMonochrome', invoiceHeaderStyleLocked: true },
  )

  assert.equal(payload.COMPANY_NAME_EN, 'FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C')
  assert.equal(Object.hasOwn(payload, 'INVOICE_HEADER_STYLE'), false)
})

test('company settings update still includes an editable header preference for other tenants', () => {
  const payload = addInvoiceHeaderStyleForUpdate(
    {},
    { invoiceHeaderStyle: 'BilingualMonochrome', invoiceHeaderStyleLocked: false },
  )

  assert.equal(payload.INVOICE_HEADER_STYLE, 'BilingualMonochrome')
})
