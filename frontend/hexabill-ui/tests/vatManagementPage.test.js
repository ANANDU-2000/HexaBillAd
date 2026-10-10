import test, { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { MemoryRouter } from 'react-router-dom'

let Page
let renderer
let report = null
const savedWindow = globalThis.window
const savedDocument = globalThis.document
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, confirm() { return false }, print() {} }
globalThis.document ??= { visibilityState: 'hidden', addEventListener() {}, removeEventListener() {} }

before(async () => {
  const require = createRequire(import.meta.url)
  const bundleDir = await mkdtemp(join(process.cwd(), 'tests', 'vat-page-test-'))
  const bundlePath = join(bundleDir, 'page.mjs')
  const result = await build({
    entryPoints: [process.env.VAT_PAGE_UNDER_TEST
      ? resolve(process.env.VAT_PAGE_UNDER_TEST)
      : fileURLToPath(new URL('../src/features/reports/VatReturnPage.jsx', import.meta.url))],
    bundle: true, outfile: bundlePath, format: 'esm', platform: 'node', jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{ name: 'page-test-mocks', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args =>
        ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
      builder.onResolve({ filter: /^react-router-dom$/ }, args => ({ path: args.path, external: true }))
      builder.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'icons', namespace: 'vat-test' }))
      builder.onLoad({ filter: /^icons$/, namespace: 'vat-test' }, () => ({
        contents: `export const RefreshCw=()=>null, Lock=()=>null, Send=()=>null, Download=()=>null,
          ArrowLeft=()=>null, Calendar=()=>null, ShieldCheck=()=>null, AlertTriangle=()=>null,
          CheckCircle=()=>null, Activity=()=>null, ExternalLink=()=>null, ChevronDown=()=>null, ChevronUp=()=>null, Loader2=()=>null`, loader: 'js'
      }))
      builder.onResolve({ filter: /services\/index/ }, () => ({ path: 'services', namespace: 'vat-test' }))
      builder.onLoad({ filter: /^services$/, namespace: 'vat-test' }, () => ({
        contents: `export const reportsAPI = {
          getVatReturn: async params => globalThis.__vatGetVatReturn
            ? globalThis.__vatGetVatReturn(params)
            : ({ success: true, data: { data: globalThis.__vatManagementReport } }),
          getComprehensiveSalesLedger: async params => globalThis.__vatGetSalesLedger
            ? globalThis.__vatGetSalesLedger(params)
            : ({ data: { summary: { totalSales: 2000, totalSalesVat: 0 } } }),
          getVatReturnPeriods: async () => ({ success: true, data: [] }),
          trackVatEvent: async () => ({ success: true }),
          calculateVatReturn: async (...args) => globalThis.__vatCalculateVatReturn
            ? globalThis.__vatCalculateVatReturn(...args)
            : ({ success: true }),
          backfillVatScenario: async () => ({ success: true }),
          lockVatReturnPeriod: async () => ({ success: true }),
          submitVatReturnPeriod: async () => ({ success: true }),
          exportVatReturnExcel: async () => new Blob(),
          exportVatReturnCsv: async () => new Blob(),
          exportVatManagementPdf: async () => new Blob(),
          exportVatManagementExcel: async () => new Blob(),
          exportVatManagementCsv: async () => new Blob(),
          getVatReturnSuggestPeriod: async () => ({ success: true })
        }`, loader: 'js'
      }))
      builder.onResolve({ filter: /hooks\/useAuth/ }, () => ({ path: 'auth', namespace: 'vat-test' }))
      builder.onLoad({ filter: /^auth$/, namespace: 'vat-test' }, args => ({
        contents: args.path === 'auth'
          ? `export const useAuth = () => ({ user: { role: 'Owner', isOwner: true } })`
          : `export const isAdminOrOwner = () => true`, loader: 'js'
      }))
      builder.onResolve({ filter: /utils\/roles/ }, () => ({ path: 'roles', namespace: 'vat-test' }))
      builder.onResolve({ filter: /utils\/currency/ }, () => ({ path: 'currency', namespace: 'vat-test' }))
      builder.onLoad({ filter: /^(roles|currency)$/, namespace: 'vat-test' }, args => ({
        contents: args.path === 'roles'
          ? `export const isAdminOrOwner = () => true`
          : `export const formatCurrency = value => (Number(value) || 0).toFixed(2) + ' AED'`, loader: 'js'
      }))
      builder.onResolve({ filter: /^react-hot-toast$/ }, () => ({ path: 'toast', namespace: 'vat-test' }))
      builder.onLoad({ filter: /^toast$/, namespace: 'vat-test' }, args => args.path === 'toast'
        ? ({ contents: `const toast = Object.assign(() => {}, { success() {}, error() {} }); export default toast`, loader: 'js' })
        : undefined)
    } }]
  })
  Page = (await import(pathToFileURL(bundlePath).href)).default
  await rm(bundleDir, { recursive: true, force: true })
})

afterEach(() => {
  if (renderer) act(() => renderer.unmount())
  renderer = null
  globalThis.__vatManagementReport = null
  globalThis.__vatGetVatReturn = null
  globalThis.__vatGetSalesLedger = null
  globalThis.__vatCalculateVatReturn = null
})
after(() => {
  if (savedWindow === undefined) delete globalThis.window
  else globalThis.window = savedWindow
  if (savedDocument === undefined) delete globalThis.document
  else globalThis.document = savedDocument
})

async function render(dto) {
  globalThis.__vatManagementReport = dto
  await act(async () => {
    renderer = create(React.createElement(MemoryRouter, null, React.createElement(Page)))
    await new Promise(resolve => setImmediate(resolve))
  })
  return JSON.stringify(renderer.toJSON())
}

test('zero-rated sales do not appear as standard-rated taxable sales in the rendered summary', async () => {
  const text = await render({
    periodLabel: 'Q1-2025', standardOutputNet: 0, standardOutputVat: 0,
    recoverableInputVat: 0, netVatPayable: 0,
    outputLines: [{ type: 'Sale', reference: 'ZERO-1', netAmount: 2000, vatAmount: 0, vatScenario: 'ZeroRated' }],
    inputLines: [], creditNoteLines: [], validationIssues: []
  })
  assert.match(text, /Standard-rated sales/)
  assert.doesNotMatch(text, /2,000\.00 AED/)
  assert.match(text, /Management report\. Not an FTA filing\./)
})

test('a purchase fully offset by a return keeps the server input-VAT total at zero', async () => {
  const text = await render({
    periodLabel: 'Q1-2025', standardOutputNet: 0, standardOutputVat: 0,
    recoverableInputVat: 0, netVatPayable: 0,
    outputLines: [],
    inputLines: [{ type: 'Purchase', reference: 'PUR-1', netAmount: 100, vatAmount: 5, claimableVat: 5 }],
    creditNoteLines: [{ reference: 'PUR-RET-1', netAmount: 100, vatAmount: 5, side: 'Input' }],
    validationIssues: []
  })
  assert.match(text, /Total Purchase and Expense \(net\)/)
  assert.match(text, /0\.00 AED/)
  assert.doesNotMatch(text, /5\.00 AED/)
})

test('ProfitBased tenants still have all statutory detail tabs', async () => {
  const text = await render({
    vatCalculationBasis: 'ProfitBased', periodLabel: 'Q1-2025',
    standardOutputNet: 100, standardOutputVat: 5, recoverableInputVat: 0, netVatPayable: 5,
    profitSales: 100, profitCogs: 40, profitExpenses: 10, profitAmount: 50,
    profitVatEstimate: 2.5, profitEstimateNotForFiling: true,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  })
  for (const tab of ['Summary', 'Sales', 'Purchases', 'Expenses', 'Credit Notes', 'Return boxes (draft)', 'Checks']) {
    assert.match(text, new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('VAT tabs remain horizontally scrollable with 44px non-shrinking touch targets', async () => {
  await render({
    periodLabel: 'Q1-2025', standardOutputVat: 0, recoverableInputVat: 0, netVatPayable: 0,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  })
  const tabNav = renderer.root.findAllByType('nav').find(node => node.props['aria-label'] === 'VAT tabs')
  assert.ok(tabNav)
  assert.match(tabNav.props.className, /overflow-x-auto/)
  const tabButtons = tabNav.findAllByType('button')
  assert.equal(tabButtons.length, 7)
  for (const button of tabButtons) {
    assert.match(button.props.className, /min-h-11/)
    assert.match(button.props.className, /flex-none/)
  }
})

test('VAT error panel shows a copyable server correlation ID and a safe retry message', async () => {
  globalThis.__vatGetVatReturn = async () => {
    throw {
      response: {
        status: 503,
        data: { message: 'Synthetic report service unavailable.' },
        headers: { 'x-correlation-id': 'vat-test-0001' }
      }
    }
  }
  await act(async () => {
    renderer = create(React.createElement(MemoryRouter, null, React.createElement(Page)))
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
  })
  const text = JSON.stringify(renderer.toJSON())
  assert.match(text, /Synthetic report service unavailable/)
  assert.match(text, /vat-test-0001/)
  assert.match(text, /Copy reference ID/)
  assert.doesNotMatch(text, /request URL not available/)
  const copyButton = renderer.root.findAllByType('button').find(button => button.children.join('') === 'Copy reference ID')
  assert.ok(copyButton)
  assert.match(copyButton.props.className, /min-h-11/)
})

test('VAT action failures show a correlation ID and Retry reruns the failed action', async () => {
  let attempts = 0
  globalThis.__vatCalculateVatReturn = async () => {
    attempts += 1
    if (attempts === 1) throw {
      response: {
        status: 503,
        data: { message: 'Synthetic calculation service unavailable.' },
        headers: { 'x-correlation-id': 'vat-action-0002' }
      }
    }
    return { success: true, data: { data: {
      periodLabel: 'Q1-2025', standardOutputVat: 5, recoverableInputVat: 0, netVatPayable: 5,
      outputLines: [{ reference: 'RETRY-SALE', netAmount: 100, vatAmount: 5 }],
      inputLines: [], creditNoteLines: [], validationIssues: []
    } } }
  }
  await render({
    periodLabel: 'Q1-2025', standardOutputVat: 0, recoverableInputVat: 0, netVatPayable: 0,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  })
  const calculate = renderer.root.findAllByType('button').find(button => button.children.join('').includes('Recalculate'))
  assert.ok(calculate)
  await act(async () => {
    calculate.props.onClick()
    await new Promise(resolve => setImmediate(resolve))
  })
  assert.equal(attempts, 1)
  let text = JSON.stringify(renderer.toJSON())
  assert.match(text, /Synthetic calculation service unavailable/)
  assert.match(text, /vat-action-0002/)
  assert.match(text, /Copy reference ID/)
  const retry = renderer.root.findAllByType('button').find(button => button.children.join('') === 'Retry')
  assert.ok(retry)
  await act(async () => {
    retry.props.onClick()
    await new Promise(resolve => setImmediate(resolve))
  })
  assert.equal(attempts, 2)
  text = JSON.stringify(renderer.toJSON())
  assert.doesNotMatch(text, /VAT action failed|vat-action-0002/)
  assert.match(text, /Calculation.*complete/)
})

test('valid-format non-sample TRN is shown as unverified while local lifecycle actions remain available', async () => {
  const text = await render({
    periodLabel: 'Q1-2025', status: 'Calculated', periodId: 42,
    companyName: 'Synthetic Tenant', vatTrn: '100000000000099', trnStatus: 'TRN not verified', canFreezeVatReport: true,
    standardOutputVat: 5, recoverableInputVat: 0, netVatPayable: 5,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  })
  assert.match(text, /TRN not verified/)
  const lock = renderer.root.findAllByType('button').find(button => button.children.join('').includes('Lock period'))
  assert.ok(lock)
  assert.equal(lock.props.disabled, false)
})

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function selectNewPeriod() {
  const dates = renderer.root.findAll(node => node.type === 'input' && node.props.type === 'date')
  assert.equal(dates.length, 2)
  await act(async () => {
    dates[0].props.onChange({ target: { value: '2025-01-01' } })
    dates[1].props.onChange({ target: { value: '2025-03-31' } })
  })
  const apply = renderer.root.findAllByType('button').find(button => button.children.join('') === 'Apply')
  assert.ok(apply)
  await act(async () => {
    apply.props.onClick()
    await new Promise(resolve => setImmediate(resolve))
  })
}

async function mountWithPendingRequest() {
  await act(async () => {
    renderer = create(React.createElement(MemoryRouter, null, React.createElement(Page)))
    await new Promise(resolve => setImmediate(resolve))
  })
  await selectNewPeriod()
}

test('a stale report response cannot replace the newer selected period', async () => {
  const oldRequest = deferred()
  const newRequest = deferred()
  let calls = 0
  globalThis.__vatGetVatReturn = () => (++calls === 1 ? oldRequest.promise : newRequest.promise)

  await mountWithPendingRequest()
  assert.equal(calls, 2)
  newRequest.resolve({ success: true, data: { data: {
    periodLabel: 'NEW-PERIOD', standardOutputVat: 5, recoverableInputVat: 0, netVatPayable: 5,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  } } })
  await act(async () => { await newRequest.promise; await new Promise(resolve => setImmediate(resolve)) })
  oldRequest.resolve({ success: true, data: { data: {
    periodLabel: 'OLD-PERIOD', standardOutputVat: 99, recoverableInputVat: 0, netVatPayable: 99,
    outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
  } } })
  await act(async () => { await oldRequest.promise; await new Promise(resolve => setImmediate(resolve)) })

  const text = JSON.stringify(renderer.toJSON())
  assert.match(text, /NEW-PERIOD/)
  assert.doesNotMatch(text, /OLD-PERIOD|99\.00 AED/)
})

test('a stale Sales Ledger fallback cannot alter the newer report', async () => {
  const oldLedger = deferred()
  let reportCalls = 0
  globalThis.__vatGetVatReturn = () => {
    reportCalls += 1
    if (reportCalls === 1) return Promise.resolve({ success: true, data: { data: {
      periodLabel: 'OLD-PERIOD', box1a: 0, outputLines: [], inputLines: [], creditNoteLines: [], validationIssues: []
    } } })
    return Promise.resolve({ success: true, data: { data: {
      periodLabel: 'NEW-PERIOD', standardOutputNet: 900, standardOutputVat: 45, recoverableInputVat: 0,
      netVatPayable: 45, outputLines: [{ type: 'Sale', reference: 'NEW-1', netAmount: 900, vatAmount: 45, vatScenario: 'Standard' }],
      inputLines: [], creditNoteLines: [], validationIssues: []
    } } })
  }
  globalThis.__vatGetSalesLedger = () => oldLedger.promise

  await act(async () => {
    renderer = create(React.createElement(MemoryRouter, null, React.createElement(Page)))
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))
  })
  assert.equal(reportCalls, 1)
  await selectNewPeriod()
  assert.equal(reportCalls, 2)
  await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  oldLedger.resolve({ data: { summary: { totalSales: 777, totalSalesVat: 0 } } })
  await act(async () => { await oldLedger.promise; await new Promise(resolve => setImmediate(resolve)) })

  const text = JSON.stringify(renderer.toJSON())
  assert.match(text, /NEW-PERIOD/)
  assert.doesNotMatch(text, /777\.00 AED/)
})
