import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
after(()=>{delete globalThis.localStorage})

test('payment-management navigation is discoverable for permitted roles and hidden from Staff',async()=>{
  globalThis.localStorage={getItem:()=>null}
  const require=createRequire(import.meta.url)
  const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/navigation/moreMenuConfig.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':'{}'},plugins:[{name:'external-icons',setup(b){b.onResolve({filter:/^(?:react|lucide-react)$/},a=>({path:pathToFileURL(require.resolve(a.path)).href,external:true}))}}]})
  const {visibleSidebar,visibleMoreMenu}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  for(const role of ['Owner','Admin','Manager']) {
    const user={role,email:'synthetic@tenant.local'}
    assert.equal(visibleSidebar(user).flatMap(g=>g.items).filter(i=>i.href==='/payments').length,1)
    assert.equal(visibleMoreMenu(user,{hideBottomNav:true}).flatMap(g=>g.items).filter(i=>i.href==='/payments').length,1)
  }
  const staff={role:'Staff',email:'synthetic@tenant.local',pageAccess:'invoices,reports'}
  assert.equal(visibleSidebar(staff).flatMap(g=>g.items).some(i=>i.href==='/payments'),false)
  assert.equal(visibleMoreMenu(staff).flatMap(g=>g.items).some(i=>i.href==='/payments'),false)
})
