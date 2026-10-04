import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeInvoiceSettlementShortfall,
  SETTLEMENT_TOLERANCE_AED,
  MAX_SETTLEMENT_ADJUSTMENT_AED
} from '../src/utils/salePaymentSettlement.js'

describe('computeInvoiceSettlementShortfall', () => {
  it('returns 1 AED shortfall for 1331 invoice and 1330 cash', () => {
    assert.equal(computeInvoiceSettlementShortfall(1331, 1330), 1)
  })

  it('returns 0 within tolerance', () => {
    assert.equal(computeInvoiceSettlementShortfall(100, 100 - SETTLEMENT_TOLERANCE_AED), 0)
  })

  it('returns 0 when shortfall exceeds max adjustment', () => {
    assert.equal(computeInvoiceSettlementShortfall(200, 200 - MAX_SETTLEMENT_ADJUSTMENT_AED - 1), 0)
  })

  it('returns 0 when cash covers outstanding', () => {
    assert.equal(computeInvoiceSettlementShortfall(50, 50), 0)
    assert.equal(computeInvoiceSettlementShortfall(50, 60), 0)
  })
})
