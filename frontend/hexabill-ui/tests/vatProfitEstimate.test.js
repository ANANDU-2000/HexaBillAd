import test, { before, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

let Card, renderer
before(async () => {
  const require = createRequire(import.meta.url)
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/features/reports/VatProfitEstimateCard.jsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'react-instance', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, args =>
        ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
    } }],
  })
  Card = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default
})
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null })
function render(report) {
  act(() => { renderer = create(React.createElement(Card, { report })) })
  return JSON.stringify(renderer.toJSON())
}

test('profit view shows the server-calculated five-percent estimate with filing distinction', () => {
  const text = render({ vatCalculationBasis: 'ProfitBased', profitSales: 1050, profitCogs: 700,
    profitExpenses: 50, profitAmount: 300, profitVatEstimate: 15, profitVat: 999, box13a: 37 })
  assert.match(text, /Profit-based VAT estimate · 5%/)
  assert.match(text, /15\.00 AED/)
  assert.match(text, /300\.00 AED/)
  assert.match(text, /not for VAT filing/)
  assert.doesNotMatch(text, /999\.00|37\.00/)
})

test('sales-based tenant and unavailable report have no profit VAT card', () => {
  assert.equal(render({ vatCalculationBasis: 'SalesBased', profitVatEstimate: 15 }), 'null')
  act(() => { renderer.update(React.createElement(Card, { report: null })) })
  assert.equal(renderer.toJSON(), null)
})

test('missing server estimate requests refresh instead of inventing a zero', () => {
  const text = render({ vatCalculationBasis: 'ProfitBased', profitAmount: 300, profitVat: 999 })
  assert.match(text, /Refresh to load estimate/)
  assert.doesNotMatch(text, /999\.00 AED/)
})

test('PascalCase response renders a zero estimate for a loss without a VAT refund', () => {
  const text = render({ VatCalculationBasis: 'ProfitBased', ProfitAmount: -30, ProfitVatEstimate: 0 })
  assert.match(text, /-30\.00 AED/)
  assert.match(text, /zero when profit is zero or negative/)
  assert.doesNotMatch(text, /Refund|Payable/)
})

test('switching from profit tenant to sales-based tenant removes the previous estimate', () => {
  render({ vatCalculationBasis: 'ProfitBased', profitAmount: 300, profitVatEstimate: 15 })
  act(() => { renderer.update(React.createElement(Card, { report: { vatCalculationBasis: 'SalesBased' } })) })
  assert.equal(renderer.toJSON(), null)
})
