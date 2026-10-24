import test from 'node:test'
import assert from 'node:assert/strict'
import { getSetting, getSettingBool } from '../src/utils/settingsKeys.js'

// Shape the Settings page receives after the API client camel-cases every response key.
const fromApi = {
  printMarginTopMm: '40', printMarginBottomMm: '20', featureLetterheadOnlyPrint: 'true', allowNegativeStock: 'true',
  invoiceSeriesStart: '7000', invoiceHeaderStyleLocked: 'true', companyNameEn: 'FROZENHUB', vatTrn: '105607243000003',
}

test('stored print margins and flags are read back, not replaced by defaults', () => {
  assert.equal(getSetting(fromApi, 'PRINT_MARGIN_TOP_MM') ?? '52', '40')
  assert.equal(getSetting(fromApi, 'PRINT_MARGIN_BOTTOM_MM') ?? '35', '20')
  assert.equal(getSettingBool(fromApi, 'Feature_LetterheadOnlyPrint'), true)
  assert.equal(getSettingBool(fromApi, 'ALLOW_NEGATIVE_STOCK'), true)
})

test('invoice numbering start and existing keys resolve from camel-cased responses', () => {
  assert.equal(getSetting(fromApi, 'INVOICE_SERIES_START'), '7000')
  assert.equal(getSettingBool(fromApi, 'INVOICE_HEADER_STYLE_LOCKED'), true)
  assert.equal(getSetting(fromApi, 'COMPANY_NAME_EN'), 'FROZENHUB')
  assert.equal(getSetting(fromApi, 'vat_trn'), '105607243000003')
})

test('exact keys still win and missing keys use the fallback', () => {
  assert.equal(getSetting({ INVOICE_SERIES_START: '8000', invoiceSeriesStart: '7000' }, 'INVOICE_SERIES_START'), '8000')
  assert.equal(getSetting(fromApi, 'LOW_STOCK_GLOBAL_THRESHOLD', 'none'), 'none')
})
