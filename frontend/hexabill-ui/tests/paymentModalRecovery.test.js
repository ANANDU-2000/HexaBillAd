import test, { before, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

let PaymentModal, renderer, rows, sends, committed
before(async () => {
  const require = createRequire(import.meta.url)
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/PaymentModal.jsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
    plugins: [{ name: 'fixture', setup(builder) {
      builder.onResolve({ filter: /^(?:react(?:\/jsx-runtime)?|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
      builder.onResolve({ filter: /(?:services|useAuth|TenantBrandingContext|react-hot-toast|ConfirmDangerModal)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
        if (args.path.endsWith('services')) return { contents: 'export const paymentsAPI = globalThis.paymentModalFixture.paymentsAPI; export const salesAPI = {}; export const subscriptionAPI = {checkFeature:async()=>({success:true,data:false})};', loader: 'js' }
        if (args.path.endsWith('useAuth')) return { contents: 'export const useAuth=()=>({user:globalThis.paymentModalFixture.user});', loader: 'js' }
        if (args.path.endsWith('TenantBrandingContext')) return { contents: 'export const useBranding=()=>({currency:"AED"});', loader: 'js' }
        return { contents: 'export default Object.assign(()=>null,{error:()=>{},success:()=>{}});', loader: 'js' }
      })
    } }],
  })
  // Mocks dereference the fixture at call time, allowing each test to replace state.
  const source = result.outputFiles[0].text.replace('globalThis.paymentModalFixture.paymentsAPI', 'new Proxy({}, {get:(_,key)=>globalThis.paymentModalFixture.paymentsAPI[key]})')
  PaymentModal = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default
})
beforeEach(() => {
  rows = new Map(); sends = []; committed = new Map()
  globalThis.window = { location: { origin: 'http://gulfharvest-test.localhost:5186' }, sessionStorage: {
    getItem: key => rows.get(key) ?? null, setItem: (key,value) => rows.set(key,value), removeItem: key => rows.delete(key),
  } }
  globalThis.paymentModalFixture = { user: {id:2,tenantId:1}, loseResponse:true, paymentsAPI: {
    checkDuplicatePayment: async () => ({hasDuplicate:false}),
    getInvoiceAmount: async () => ({success:true,data:{invoiceNo:'ZZ-TEST-003',totalAmount:60,paidAmount:0,outstandingAmount:60}}),
    createPayment: async (body,key) => {
      sends.push({body:structuredClone(body),key})
      if (!committed.has(key)) committed.set(key,{id:committed.size+1,...body,status:'CLEARED'})
      if (globalThis.paymentModalFixture.loseResponse) { globalThis.paymentModalFixture.loseResponse=false; throw new Error('Lost response after server commit') }
      return {success:true,data:{payment:committed.get(key)}}
    },
  } }
})
afterEach(() => { if(renderer) act(()=>renderer.unmount()); renderer=null; delete globalThis.window; delete globalThis.paymentModalFixture })
async function mount() {
  await act(async()=>{renderer=create(React.createElement(PaymentModal,{isOpen:true,customerId:1,onClose:()=>{}}))})
  await act(async()=>{renderer.root.findByProps({type:'number'}).props.onChange({target:{value:'20'}})})
}
async function submit() { await act(async()=>{await renderer.root.findByType('form').props.onSubmit({preventDefault(){}})}) }

test('actual modal retry after committed lost response keeps one payment and frozen body', async()=>{
  await mount(); await submit(); await submit()
  assert.equal(sends.length,1)
  await submit()
  assert.equal(sends.length,2)
  assert.equal(sends[1].key,sends[0].key)
  assert.deepEqual(sends[1].body,sends[0].body)
  assert.equal(committed.size,1)
})

test('changed draft is blocked while explicit recovery retains the original payload', async()=>{
  await mount(); await submit(); await submit()
  await act(async()=>{renderer.root.findByProps({type:'number'}).props.onChange({target:{value:'35'}})})
  await submit()
  assert.equal(sends.length,1)
  const retry=renderer.root.findAllByType('button').find(b=>b.children.includes('Retry previous payment'))
  await act(async()=>{await retry.props.onClick()})
  assert.deepEqual(sends[1],sends[0])
  assert.equal(committed.size,1)
})

test('recovery bypasses duplicate check and a rejected recovery cannot discard uncertainty', async()=>{
  await mount(); await submit(); await submit()
  globalThis.paymentModalFixture.paymentsAPI.checkDuplicatePayment=async()=>{throw new Error('Recovery must not duplicate-check')}
  const send=globalThis.paymentModalFixture.paymentsAPI.createPayment
  globalThis.paymentModalFixture.paymentsAPI.createPayment=async()=>{const error=new Error('Rejected recovery');error.response={status:403};throw error}
  await submit()
  assert.equal(rows.size,1)
  globalThis.paymentModalFixture.paymentsAPI.createPayment=send
  await submit()
  assert.deepEqual(sends[1],sends[0])
  assert.equal(rows.size,0)
  assert.equal(committed.size,1)
})

test('actual modal reload exposes recovery for the original payment before new entry', async()=>{
  await mount(); await submit(); await submit()
  act(()=>renderer.unmount()); renderer=null
  await mount()
  const retry=renderer.root.findAllByType('button').find(b=>b.children.some(t=>typeof t==='string' && t.includes('Retry previous payment')))
  assert.ok(retry,'saved payment must have a visible recovery action after remount')
  await act(async()=>{await retry.props.onClick()})
  assert.equal(sends.length,2)
  assert.deepEqual(sends[1],sends[0])
  assert.equal(rows.size,0)
  assert.equal(committed.size,1)
})

test('invoice amount service envelope loads the invoice and autofills its outstanding amount', async()=>{
  await act(async()=>{renderer=create(React.createElement(PaymentModal,{isOpen:true,customerId:1,invoiceId:3,onClose:()=>{}}))})
  assert.equal(renderer.root.findByProps({type:'number'}).props.value,60)
  assert.match(JSON.stringify(renderer.toJSON()),/ZZ-TEST-003/)
})
