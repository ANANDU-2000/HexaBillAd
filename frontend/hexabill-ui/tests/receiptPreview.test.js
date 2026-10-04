import test, { before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

let ReceiptPreview, renderer, requests
const detail = { receiptNumber: 'REC-1', documentFingerprint: 'review-1', receivedFrom: 'Saved customer',
  amountReceived: 1330, currency: 'AED', isHistoricalSnapshot: true, invoices: [], receiptDate: '2026-10-01' }
before(async () => {
  const require = createRequire(import.meta.url)
  globalThis.__receiptTestAPI = {
    generateReceipt: async () => { requests += 1; return { success: true, data: { detail } } },
    generateReceiptBatch: async () => { requests += 1; return { success: true, data: { detail } } },
    getReceiptPdf: async () => { throw new Error('Receipt details changed. Reopen the preview before downloading.') },
  }
  const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/ReceiptPreviewModal.jsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'receipt-fixtures', setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => {
        if (['react', 'react/jsx-runtime'].includes(args.path))
          return { path: pathToFileURL(require.resolve(args.path)).href, external: true }
        if (['./Modal', '../services', '../tenant/TenantBrandingContext', 'lucide-react'].includes(args.path)) {
          return { path: args.path, namespace: 'fixture' }
        }
      })
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ loader: 'js', contents:
        args.path === './Modal' ? 'export default function Modal({isOpen, children}) { return isOpen ? children : null }' :
          args.path === '../services' ? 'export const paymentsAPI = globalThis.__receiptTestAPI' :
            args.path === '../tenant/TenantBrandingContext' ? 'export function useBranding() { return { currency: "AED" } }' :
            'export const Printer=()=>null, Download=()=>null, X=()=>null, Loader2=()=>null' }))
    } }] })
  ReceiptPreview = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default
})
beforeEach(() => { requests = 0; globalThis.window = { open: () => null } })
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null })
async function mount() {
  await act(async () => { renderer = create(React.createElement(ReceiptPreview, { isOpen: true, paymentIds: [1], onClose() {} }),
    { createNodeMock: () => ({ innerHTML: '<p>Saved receipt</p>' }) }) })
}
function button(label) {
  return renderer.root.findAllByType('button').find(item =>
    React.Children.toArray(item.props.children).some(child => typeof child === 'string' && child.includes(label)))
}

test('receipt keeps its preview and explains a blocked print window', async () => {
  await mount()
  act(() => button('Print receipt').props.onClick())
  const alert = renderer.root.findByProps({ role: 'alert' })
  assert.match(alert.props.children, /print window was blocked/)
  assert.ok(button('Download PDF'))
  assert.match(JSON.stringify(renderer.toJSON()), /Saved customer/)
})

test('PDF rejection shows actionable inline error and permits retry', async () => {
  await mount()
  await act(async () => { await button('Download PDF').props.onClick() })
  assert.match(renderer.root.findByProps({ role: 'alert' }).props.children, /Reopen the preview/)
  assert.equal(button('Download PDF').props.disabled, false)
  assert.match(JSON.stringify(renderer.toJSON()), /Saved customer/)
})

test('same selected payment IDs do not repeatedly mint or fetch on parent rerender', async () => {
  await mount()
  await act(async () => { renderer.update(React.createElement(ReceiptPreview, { isOpen: true, paymentIds: [1], onClose() {} })) })
  assert.equal(requests, 1)
})

test('PDF download sends reviewed IDs and fingerprint and cleans up its object URL', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  const originalPdf = globalThis.__receiptTestAPI.getReceiptPdf
  const calls = []
  const link = { click() { calls.push('click') }, remove() { calls.push('remove') } }
  globalThis.document = { createElement: () => link, body: { appendChild() {} } }
  URL.createObjectURL = () => 'blob:receipt-fixture'
  URL.revokeObjectURL = (url) => calls.push(url)
  globalThis.__receiptTestAPI.getReceiptPdf = async (ids, fingerprint) => {
    assert.deepEqual(ids, [1])
    assert.equal(fingerprint, 'review-1')
    return new Blob(['%PDF-fixture'], { type: 'application/pdf' })
  }
  try {
    await mount()
    await act(async () => { await button('Download PDF').props.onClick() })
    assert.equal(link.download, 'receipt-REC-1.pdf')
    assert.deepEqual(calls, ['click', 'remove'])
    context.mock.timers.tick(1000)
    assert.deepEqual(calls, ['click', 'remove', 'blob:receipt-fixture'])
  } finally {
    globalThis.document = originalDocument
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    globalThis.__receiptTestAPI.getReceiptPdf = originalPdf
  }
})
