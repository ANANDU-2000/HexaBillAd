import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import VatReturnPage from '../../src/features/reports/VatReturnPage.jsx'
import '../../src/index.css'

const mode = new URLSearchParams(location.search).get('state') || 'loaded'
const base = {
  reportKind: 'Management',
  periodLabel: 'Q3-2026',
  periodStart: '2026-08-01',
  periodEnd: '2026-10-31',
  status: mode === 'locked' ? 'Locked' : 'Calculated',
  periodId: 42,
  companyName: 'Synthetic Tenant Ltd',
  vatTrn: mode === 'missing-trn' ? '' : '100000000000099',
  trnStatus: mode === 'missing-trn' ? 'VAT TRN missing' : 'TRN not verified',
  canFreezeVatReport: mode !== 'missing-trn',
  address: 'Synthetic Business Bay, Dubai',
  phone: '+971 50 000 0000',
  standardOutputNet: 1000,
  standardOutputVat: 50,
  recoverableInputVat: 25,
  netVatPayable: 25,
  box1a: 1000,
  box1b: 50,
  box12: 25,
  box13a: 25,
  transactionCount: 4,
  warnings: mode === 'warning' ? ['Purchase VAT is derived; review source evidence.'] : [],
  validationIssues: mode === 'warning' ? [{ ruleId: 'V015', message: 'Derived VAT requires review.', severity: 'Warning' }] : [],
  outputLines: [
    { type: 'Sale', reference: 'GH-SALE-001', date: '2026-09-03', customerName: 'Synthetic Customer', netAmount: 1000, vatAmount: 50, vatScenario: 'Standard' }
  ],
  inputLines: [
    { type: 'Purchase', reference: 'GH-PUR-001', date: '2026-09-04', supplierName: 'Synthetic Supplier', netAmount: 400, vatAmount: 20, claimableVat: 20 },
    { type: 'Expense', reference: 'GH-EXP-001', date: '2026-09-05', categoryName: 'Office', netAmount: 100, vatAmount: 5, claimableVat: 5 }
  ],
  creditNoteLines: [
    { side: 'Output', reference: 'GH-CN-001', date: '2026-09-06', netAmount: 100, vatAmount: 5 }
  ],
  reverseChargeLines: []
}

window.__vatHarnessMode = mode
window.__vatHarnessDto = mode === 'empty'
  ? { ...base, outputLines: [], inputLines: [], creditNoteLines: [], standardOutputVat: 0, recoverableInputVat: 0, netVatPayable: 0, box1a: 0, box1b: 0, box12: 0, transactionCount: 0 }
  : base

function ActionErrorScreenshotHarness() {
  useEffect(() => {
    if (mode !== 'action-error') return undefined
    const timer = window.setTimeout(() => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Recalculate'))
      button?.click()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [])
  return <VatReturnPage />
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter><ActionErrorScreenshotHarness /></MemoryRouter>
)
