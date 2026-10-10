import test from 'node:test'
import assert from 'node:assert/strict'
import { createLedgerPaymentJournal, createPaymentBatchJournal, ledgerPaymentForm, ledgerPaymentScope, paymentBatchScope } from '../src/utils/ledgerPaymentIntent.js'

function fixture() {
  const rows=new Map()
  const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k),key:i=>[...rows.keys()][i],get length(){return rows.size}}
  const identity={origin:'http://gulfharvest-test.localhost:5186',tenantId:1,userId:2}
  const scope=paymentBatchScope(identity)
  const drafts=[10,20,30].map(amount=>({scope:ledgerPaymentScope({...identity,customerId:1}),
    form:ledgerPaymentForm({amount,method:'CASH',paymentDate:'2026-10-08'},false),
    request:{customerId:1,amount,mode:'CASH',paymentDate:'2026-10-08T00:00:00Z'}}))
  return {storage,rows,identity,scope,drafts,journal:createPaymentBatchJournal(storage)}
}

test('partial bulk commit followed by lost response resumes frozen remaining rows without reposting the confirmed prefix',async()=>{
  const f=fixture(),committed=new Map(),calls=[]
  let lose=true
  const send=async(body,key)=>{calls.push({body:structuredClone(body),key});committed.set(key,body)
    if(body.amount===20&&lose){lose=false;throw new Error('Lost committed response')}
    return {success:true,data:{id:key}}}
  const original=f.journal.begin(f.scope,f.drafts)
  await assert.rejects(f.journal.execute(f.scope,send),/Lost committed response/)
  assert.deepEqual(f.journal.read(f.scope).rows.map(r=>r.confirmed),[true,false,false])
  assert.equal(committed.size,2)
  f.drafts[1].request.amount=99
  const remounted=createPaymentBatchJournal(f.storage)
  await remounted.execute(f.scope,send)
  assert.deepEqual(calls.map(c=>c.body.amount),[10,20,20,30])
  assert.equal(calls[1].key,calls[2].key)
  assert.equal(calls[3].key,original.rows[2].key)
  assert.equal(committed.size,3)
  assert.equal(f.rows.size,0)
})

test('rejected recovery preserves the original batch and cannot start a replacement',async()=>{
  const f=fixture();const original=f.journal.begin(f.scope,f.drafts)
  await assert.rejects(f.journal.execute(f.scope,async()=>{throw new Error('403')}),/403/)
  assert.throws(()=>f.journal.begin(f.scope,f.drafts),/Resume the saved/)
  assert.deepEqual(f.journal.read(f.scope).rows,original.rows)
})

test('independent equal-amount rows for one customer retain different payment identities',async()=>{
  const f=fixture();f.drafts=[f.drafts[0],f.drafts[0]]
  const batch=f.journal.begin(f.scope,f.drafts),calls=[]
  await f.journal.execute(f.scope,async(body,key)=>{calls.push(key);return {success:true}})
  assert.equal(new Set(calls).size,2)
  assert.notEqual(batch.rows[0].key,batch.rows[1].key)
})

test('new bulk entry cannot overwrite an uncertain single payment for its customer',()=>{
  const f=fixture();const ledger=createLedgerPaymentJournal(f.storage)
  const draft=f.drafts[0];const single=ledger.begin(draft.scope,{kind:'create',...draft})
  assert.throws(()=>f.journal.begin(f.scope,f.drafts),/Retry the previous payment/)
  assert.equal(f.journal.read(f.scope),null)
  assert.equal(ledger.read(draft.scope).idempotencyKey,single.idempotencyKey)
})

test('confirmed progress storage failure retains the original key for safe replay',async()=>{
  const f=fixture();f.journal.begin(f.scope,f.drafts)
  const originalSet=f.storage.setItem;let fail=true;const keys=[]
  f.storage.setItem=(key,value)=>{if(key===f.scope&&fail){fail=false;throw new Error('Storage failure')}originalSet(key,value)}
  const send=async(body,key)=>{keys.push(key);return {success:true}}
  await assert.rejects(f.journal.execute(f.scope,send),/storage/)
  await createPaymentBatchJournal(f.storage).execute(f.scope,send)
  assert.equal(keys[0],keys[1])
  assert.equal(new Set(keys).size,3)
})

test('saved batch and per-customer pending discovery isolate host, tenant and user',async()=>{
  const f=fixture();f.journal.begin(f.scope,f.drafts)
  await assert.rejects(f.journal.execute(f.scope,async()=>{throw new Error('lost')}))
  const ledger=createLedgerPaymentJournal(f.storage)
  assert.equal(ledger.list(f.identity).length,1)
  for(const change of [{tenantId:2},{userId:3},{origin:'http://zayogya-test.localhost:5186'}]) {
    assert.equal(f.journal.read(paymentBatchScope({...f.identity,...change})),null)
    assert.deepEqual(ledger.list({...f.identity,...change}),[])
  }
})

test('unavailable batch storage prevents any money request',async()=>{
  const f=fixture();f.storage.setItem=()=>{throw new Error('Blocked')}
  assert.throws(()=>f.journal.begin(f.scope,f.drafts),/storage/)
  assert.equal(f.rows.size,0)
})
