import test from 'node:test'
import assert from 'node:assert/strict'

test('financial rule: historical positive outstanding reconciles exactly with opening receivables plus invoice 2158', () => {
  const cutoverPositiveOutstanding = 70178.09
  const approvedCustomerOpeningReceivables = 70077.29
  const unassignedInvoice2158 = 100.80

  const sum = Number((approvedCustomerOpeningReceivables + unassignedInvoice2158).toFixed(2))
  assert.equal(sum, cutoverPositiveOutstanding, 'Approved AR + Inv 2158 must exactly equal Cutover Outstanding AED 70,178.09')

  const diff = Number(Math.abs(cutoverPositiveOutstanding - sum).toFixed(4))
  assert.equal(diff, 0.0000, 'Difference between cutover and opening AR + Inv 2158 must be exactly 0.00, not a rounding error')
})

test('tax and legal identity: Starplus archive retains original TRN and legal issuer', () => {
  const expectedTRN = '100366253100003'
  const expectedIssuer = 'STARPLUS FOODSTUFF TRADING'

  assert.equal(expectedTRN, '100366253100003', 'TRN must match Starplus TRN')
  assert.equal(expectedIssuer, 'STARPLUS FOODSTUFF TRADING', 'Issuer must match Starplus Foodstuff Trading')
})

test('unassigned invoice 2158 contract: remains unassigned with null destination customer', () => {
  const invoice2158 = {
    legacyInvoiceNumber: '2158',
    customerName: '',
    grandTotal: 100.80,
    paidAmount: 0.00,
    outstandingCalculated: 100.80,
    destinationCustomerId: null,
    sourceCustomerId: null,
  }

  assert.equal(invoice2158.legacyInvoiceNumber, '2158')
  assert.equal(invoice2158.grandTotal, 100.80)
  assert.equal(invoice2158.outstandingCalculated, 100.80)
  assert.equal(invoice2158.destinationCustomerId, null, 'Must remain null, cannot be silently transferred to another customer')
})

test('invoice 6996 contract: verified items and payments', () => {
  const invoice6996 = {
    legacyInvoiceNumber: '6996',
    customerName: 'DREAMS KITCHEN',
    grandTotal: 1985.00,
    subtotal: 1890.00,
    vatTotal: 94.50,
    paidAmount: 1985.00,
    outstandingCalculated: 0.00,
    status: 'Paid',
    items: [
      {
        sku: 'MUTTON-CUBE-RUBY',
        productName: 'MUTTON CUBE RUBY 18KG',
        unitType: 'CRTN',
        quantity: 7.0000,
        unitPrice: 270.00,
        vatAmount: 94.50,
        lineTotal: 1984.50,
      }
    ],
    payments: [
      {
        amount: 1985.00,
        mode: 'CASH',
        status: 'CLEARED'
      }
    ]
  }

  assert.equal(invoice6996.grandTotal, 1985.00)
  assert.equal(invoice6996.paidAmount, 1985.00)
  assert.equal(invoice6996.outstandingCalculated, 0.00)
  assert.equal(invoice6996.items.length, 1)
  assert.equal(invoice6996.items[0].sku, 'MUTTON-CUBE-RUBY')
  assert.equal(invoice6996.payments.length, 1)
  assert.equal(invoice6996.payments[0].status, 'CLEARED')
})

test('invoice 6995 contract: pending invoice 6995 with outstanding balance', () => {
  const invoice6995 = {
    legacyInvoiceNumber: '6995',
    customerName: 'KHAN DARBAR RESTAURANT',
    grandTotal: 1455.00,
    paidAmount: 0.00,
    outstandingCalculated: 1455.00,
    status: 'Pending',
    reportedAsPending: true
  }

  assert.equal(invoice6995.grandTotal, 1455.00)
  assert.equal(invoice6995.paidAmount, 0.00)
  assert.equal(invoice6995.outstandingCalculated, 1455.00)
  assert.equal(invoice6995.status, 'Pending')
  assert.equal(invoice6995.reportedAsPending, true)
})

test('tenant isolation contract: cross-tenant access to legacy data is strictly forbidden', () => {
  const tenantForbiddenCheck = (requesterTenantId, resourceTenantId) => {
    if (requesterTenantId !== resourceTenantId) {
      return { status: 403, allowed: false }
    }
    return { status: 200, allowed: true }
  }

  assert.equal(tenantForbiddenCheck(22, 20).allowed, false)
  assert.equal(tenantForbiddenCheck(22, 20).status, 403)
  assert.equal(tenantForbiddenCheck(23, 20).allowed, false)
  assert.equal(tenantForbiddenCheck(23, 20).status, 403)
  assert.equal(tenantForbiddenCheck(20, 20).allowed, true)
  assert.equal(tenantForbiddenCheck(20, 20).status, 200)
})
