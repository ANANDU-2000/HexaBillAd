import test from 'node:test'
import assert from 'node:assert/strict'
import { syncBillingHistorySearchParams, readBillingHistorySearchParams } from '../src/utils/billingHistoryUrl.js'

test('syncBillingHistorySearchParams writes filters and omits defaults', () => {
  const params = new URLSearchParams('page=2&search=old')
  syncBillingHistorySearchParams(params, { search: 'inv-1', page: 3, period: 'custom', from: '2026-01-01', to: '' })
  assert.equal(params.get('search'), 'inv-1')
  assert.equal(params.get('page'), '3')
  assert.equal(params.get('from'), '2026-01-01')
  assert.equal(params.has('to'), false)
  syncBillingHistorySearchParams(params, { search: '', page: 1, period: 'all', from: '', to: '' })
  assert.equal(params.has('search'), false)
  assert.equal(params.has('page'), false)
  assert.equal(params.has('period'), false)
  assert.equal(params.has('from'), false)
})

test('deprecated source tabs are dropped and never restrict the history', () => {
  for (const tab of ['operating', 'legacy', 'all']) {
    const params = new URLSearchParams(`tab=${tab}&search=6996&page=2`)
    const state = readBillingHistorySearchParams(params)
    assert.equal(state.hadDeprecatedTab, true)
    assert.equal(state.search, '6996', 'valid search survives')
    assert.equal(state.page, 2, 'valid page survives')
    assert.equal(state.status, 'all')
    assert.equal(state.period, 'all')
    syncBillingHistorySearchParams(params, state)
    assert.equal(params.has('tab'), false)
    assert.equal(params.get('search'), '6996')
  }
})

test('presets are stored by name, custom ranges by dates', () => {
  const params = new URLSearchParams()
  syncBillingHistorySearchParams(params, { period: 'week', from: '2026-10-26', to: '2026-11-01' })
  assert.equal(params.get('period'), 'week')
  assert.equal(params.has('from'), false, 'a rolling preset must not freeze its dates into the URL')
  const back = readBillingHistorySearchParams(params)
  assert.equal(back.period, 'week')
  assert.equal(back.from, '')

  const custom = readBillingHistorySearchParams(new URLSearchParams('from=2026-10-01&to=2026-10-31'))
  assert.equal(custom.period, 'custom', 'old from/to links open as a custom range')
  assert.equal(custom.from, '2026-10-01')
  assert.equal(custom.to, '2026-10-31')
})

test('invalid values fall back to safe defaults', () => {
  const s = readBillingHistorySearchParams(new URLSearchParams('status=drop&sort=x&page=-4&from=2026-02-30&period=forever'))
  assert.equal(s.status, 'all')
  assert.equal(s.sort, 'newest')
  assert.equal(s.page, 1)
  assert.equal(s.from, '')
  assert.equal(s.period, 'all')
})

test('status and sort round-trip', () => {
  const params = new URLSearchParams()
  syncBillingHistorySearchParams(params, { status: 'unpaid', sort: 'oldest', period: 'all' })
  const s = readBillingHistorySearchParams(params)
  assert.equal(s.status, 'unpaid')
  assert.equal(s.sort, 'oldest')
})
