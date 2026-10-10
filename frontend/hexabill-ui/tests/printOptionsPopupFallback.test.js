import test, { before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

let PrintOptions, renderer, toasts, originalSetTimeout, frameWindow, frameLoads

before(async () => {
  const require = createRequire(import.meta.url)
  globalThis.__printTestAPI = {
    getInvoicePdf: async () => new Blob(['%PDF-invoice'], { type: 'application/pdf' }),
    getDeliveryNotePdf: async () => new Blob(['%PDF-dn'], { type: 'application/pdf' }),
  }
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/PrintOptionsModal.jsx', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    plugins: [{
      name: 'print-fixtures',
      setup (builder) {
        builder.onResolve({ filter: /.*/ }, (args) => {
          if (['react', 'react/jsx-runtime'].includes(args.path)) {
            return { path: pathToFileURL(require.resolve(args.path)).href, external: true }
          }
          if (['../services', 'lucide-react', 'react-hot-toast'].includes(args.path)) {
            return { path: args.path, namespace: 'fixture' }
          }
        })
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
          loader: 'js',
          contents:
            args.path === '../services' ? 'export const salesAPI = globalThis.__printTestAPI' :
              args.path === 'react-hot-toast'
                ? 'const toast = Object.assign((m)=>globalThis.__printToasts.push(["default", m]), { success:(m)=>globalThis.__printToasts.push(["success", m]), error:(m)=>globalThis.__printToasts.push(["error", m]) }); export default toast'
                : 'export const X=()=>null, Printer=()=>null, FileText=()=>null',
        }))
      },
    }],
  })
  PrintOptions = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default
})

beforeEach(() => {
  toasts = []
  globalThis.__printToasts = toasts
  globalThis.window = { open: () => { throw new Error('Iframe printing must not open a popup') } }
  frameWindow = null
  frameLoads = true
  originalSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0 }
  const link = { href: '', download: '', click () { globalThis.__printClicks.push(this.download) }, remove () {} }
  globalThis.__printClicks = []
  globalThis.document = {
    createElement: (tag) => tag === 'iframe'
      ? { style: {}, setAttribute () {}, get contentWindow () { return frameWindow } }
      : link,
    body: {
      appendChild (element) {
        element.parentNode = this
        if (frameLoads) queueMicrotask(() => element.onload?.())
      },
      removeChild (element) { element.parentNode = null },
    },
    write () {},
  }
  globalThis.URL.createObjectURL = () => 'blob:print-fixture'
  globalThis.URL.revokeObjectURL = () => {}
})

afterEach(() => {
  if (renderer) act(() => renderer.unmount())
  renderer = null
  globalThis.setTimeout = originalSetTimeout
})

function button (label) {
  return renderer.root.findAllByType('button').find((item) =>
    React.Children.toArray(item.props.children).some((child) => typeof child === 'string' && child.includes(label))
    || React.Children.toArray(item.props.children).some((child) => {
      if (!child || typeof child !== 'object') return false
      return React.Children.toArray(child.props?.children).some((c) => typeof c === 'string' && c.includes(label))
    }))
}

test('invoice print downloads PDF when iframe printing is unavailable', async () => {
  await act(async () => {
    renderer = create(React.createElement(PrintOptions, {
      saleId: 17,
      invoiceNo: 'INV-17',
      onClose () {},
      onPrint () {},
    }))
  })
  await act(async () => { await button('Print').props.onClick() })
  assert.deepEqual(globalThis.__printClicks, ['invoice-INV-17.pdf'])
  assert.ok(toasts.some((t) => t[0] === 'success' && /PDF downloaded/i.test(t[1])))
})

test('delivery note downloads PDF when iframe printing is unavailable', async () => {
  await act(async () => {
    renderer = create(React.createElement(PrintOptions, {
      saleId: 17,
      invoiceNo: 'INV-17',
      onClose () {},
    }))
  })
  await act(async () => { await button('Delivery Note').props.onClick() })
  assert.deepEqual(globalThis.__printClicks, ['delivery-note-INV-17.pdf'])
  assert.ok(toasts.some((t) => t[0] === 'success' && /PDF downloaded/i.test(t[1])))
})

test('iframe prints once without opening a popup or downloading another copy', async () => {
  let prints = 0, closes = 0, callbacks = 0
  frameWindow = { focus () {}, print () { prints++ } }
  await act(async () => {
    renderer = create(React.createElement(PrintOptions, {
      saleId: 17, invoiceNo: 'INV-17', onClose () { closes++ }, onPrint () { callbacks++ },
    }))
  })
  await act(async () => { await button('Print').props.onClick() })
  assert.equal(prints, 1)
  assert.equal(closes, 1)
  assert.equal(callbacks, 1)
  assert.deepEqual(globalThis.__printClicks, [])
})

test('missing PDF iframe load event still opens one print dialog', async () => {
  let prints = 0
  frameLoads = false
  frameWindow = { focus () {}, print () { prints++ } }
  await act(async () => {
    renderer = create(React.createElement(PrintOptions, { saleId: 17, onClose () {} }))
  })
  await act(async () => { await button('Delivery Note').props.onClick() })
  assert.equal(prints, 1)
  assert.deepEqual(globalThis.__printClicks, [])
})
