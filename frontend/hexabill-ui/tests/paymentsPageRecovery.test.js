import test, {before,beforeEach,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {act,create} from 'react-test-renderer'
import {build} from 'esbuild'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'

let Page,renderer,rows,calls,committed
before(async()=>{
  const require=createRequire(import.meta.url)
  const result=await build({entryPoints:[fileURLToPath(new URL('../src/features/payments/PaymentsPage.jsx',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/^(?:react(?:\/jsx-runtime)?|lucide-react)$/},a=>({path:pathToFileURL(require.resolve(a.path)).href,external:true}))
    b.onResolve({filter:/(?:services\/index|useAuth|TenantBrandingContext|useDebounce|react-hot-toast|react-hook-form|react-router-dom|components\/(?:Loading|Form|Modal|ReceiptPreviewModal|EditPaymentModal|ConfirmDangerModal))$/},a=>({path:a.path,namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>{
      const root='globalThis.paymentsPageFixture'
      if(a.path.endsWith('services/index'))return{loader:'js',contents:`export const paymentsAPI=new Proxy({},{get:(_,k)=>${root}.api[k]});export const customersAPI=new Proxy({},{get:(_,k)=>${root}.customers[k]});export const salesAPI={};`}
      if(a.path==='react-router-dom')return{loader:'js',contents:`export const useSearchParams=()=>[${root}.params,()=>{}];export const useLocation=()=>({state:null});export const useNavigate=()=>()=>{};`}
      if(a.path==='react-hook-form')return{loader:'js',contents:`export const useForm=()=>({register:name=>({name}),handleSubmit:fn=>()=>fn(${root}.form),watch:name=>${root}.form[name],reset:()=>{},setValue:()=>{},formState:{errors:{}}});`}
      if(a.path.endsWith('useAuth'))return{loader:'js',contents:`export const useAuth=()=>({user:${root}.user});`}
      if(a.path.endsWith('useDebounce'))return{loader:'js',contents:'export const useDebounce=value=>value;'}
      if(a.path.endsWith('TenantBrandingContext'))return{loader:'js',contents:'export const useBranding=()=>({currency:"AED"});'}
      if(a.path.endsWith('Loading'))return{loader:'js',contents:'import React from "react";export const LoadingCard=()=>null;export const LoadingButton=({children,loading,...props})=>React.createElement("button",{...props,disabled:loading},children);'}
      if(a.path.endsWith('Form'))return{loader:'js',contents:'import React from "react";export const Input=({label,...props})=>React.createElement("input",{...props,"aria-label":label});export const Select=({label,options,...props})=>React.createElement("select",{...props,"aria-label":label},options.map(o=>React.createElement("option",{key:o.value,value:o.value},o.label)));'}
      if(a.path.endsWith('/Modal'))return{loader:'js',contents:'import React from "react";export default ({isOpen,children})=>isOpen?React.createElement("div",{},children):null;'}
      return{loader:'js',contents:'export default Object.assign(()=>null,{error:()=>{},success:()=>{}});'}
    })
  }}]})
  Page=(await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default
})
beforeEach(()=>{
  rows=new Map();calls=[];committed=new Map()
  globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail}}
  globalThis.window={location:{origin:'http://gulfharvest-test.localhost:5186'},sessionStorage:{getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k),key:i=>[...rows.keys()][i],get length(){return rows.size}},addEventListener(){},removeEventListener(){},dispatchEvent(){}}
  const customer={id:1,name:'Synthetic customer',balance:100}
  globalThis.paymentsPageFixture={user:{id:2,tenantId:1,role:'Owner'},params:new URLSearchParams(),form:{customerId:'1',saleId:'',amount:'20',method:'Cash',paymentDate:'2026-10-08'},loseAt:20,customers:{getCustomers:async()=>({success:true,data:{items:[customer]}}),getCustomer:async()=>({success:true,data:customer}),getOutstandingInvoices:async()=>({success:true,data:[]})},api:{getPayments:async()=>({success:true,data:{items:[]}}),createPayment:async(body,key)=>{
    assert.ok(key,'every component POST must supply its saved idempotency key')
    calls.push({body:structuredClone(body),key});committed.set(key,body)
    if(globalThis.paymentsPageFixture.loseAt===body.amount){globalThis.paymentsPageFixture.loseAt=null;throw new Error('Lost committed response')}
    return{success:true,data:{payment:{id:committed.size,...body,status:['CHEQUE','CREDIT'].includes(body.mode)?'PENDING':'CLEARED'}}}
  }}}
})
afterEach(()=>{if(renderer)act(()=>renderer.unmount());renderer=null;delete globalThis.window;delete globalThis.paymentsPageFixture;delete globalThis.CustomEvent})
const textOf=node=>typeof node==='string'||typeof node==='number'?String(node):(node.children||[]).map(textOf).join('')
const button=name=>renderer.root.findAllByType('button').find(b=>textOf(b).includes(name))
async function mount(){await act(async()=>{renderer=create(React.createElement(Page))})}
async function click(name){const b=button(name);assert.ok(b,`button ${name} must be visible`);await act(async()=>{await b.props.onClick()})}

test('Payments page single save preserves key/body after reload and blocks replacing its draft',async()=>{
  await mount();await click('Add Payment')
  await act(async()=>{await renderer.root.findByType('form').props.onSubmit()})
  assert.equal(calls.length,1)
  globalThis.paymentsPageFixture.form.amount='35'
  await act(async()=>{await renderer.root.findByType('form').props.onSubmit()})
  assert.equal(calls.length,1)
  act(()=>renderer.unmount());renderer=null;await mount()
  await click('Retry previous payment')
  assert.deepEqual(calls[1],calls[0])
  assert.equal(committed.size,1)
  assert.equal(rows.size,0)
})

test('actual bulk component retains confirmed rows and resumes only original remaining payments after remount',async()=>{
  await mount();await click('Bulk Payment')
  const setRow=async(index,label,value)=>{await act(async()=>{renderer.root.findAll(node=>node.props['aria-label']===label)[index].props.onChange({target:{value}})})}
  await setRow(0,'Customer','1');await setRow(0,'Amount','10')
  await click('Add Another Payment');await setRow(1,'Customer','1');await setRow(1,'Amount','20')
  await click('Save All Payments')
  assert.deepEqual(calls.map(c=>c.body.amount),[10,20])
  assert.match(textOf(renderer.root),/1 of 2 confirmed/)
  act(()=>renderer.unmount());renderer=null;await mount();await click('Resume bulk payments')
  assert.ok(renderer.root.findAll(node=>node.props['aria-label']==='Amount').every(node=>node.props.disabled))
  await click('Retry remaining payments')
  assert.deepEqual(calls.map(c=>c.body.amount),[10,20,20])
  assert.deepEqual(calls[2],calls[1])
  assert.equal(committed.size,2)
  assert.equal(rows.size,0)
})

test('pending/credit form choice posts the existing CREDIT mode with a saved key',async()=>{
  globalThis.paymentsPageFixture.form.method='Pending'
  globalThis.paymentsPageFixture.form.amount='7'
  await mount();await click('Add Payment')
  await act(async()=>{await renderer.root.findByType('form').props.onSubmit()})
  assert.equal(calls.length,1)
  assert.equal(calls[0].body.mode,'CREDIT')
  assert.equal(calls[0].body.paymentDate,'2026-10-08T00:00:00.000Z')
  assert.equal(rows.size,0)
})
