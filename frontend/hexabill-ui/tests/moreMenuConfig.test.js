import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const menuSrc = fs.readFileSync(path.join(root, '../src/navigation/moreMenuConfig.js'), 'utf8')
const bottomNavSrc = fs.readFileSync(path.join(root, '../src/components/BottomNav.jsx'), 'utf8')

/** Parse `{ id: 'x', ..., href: '/y', ..., bottomNav: true }` style item lines. */
function itemsWithBottomNavFlag () {
  const flagged = []
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?href:\s*'([^']+)'[\s\S]*?\}/g
  let m
  while ((m = re.exec(menuSrc))) {
    const block = m[0]
    if (/bottomNav:\s*true/.test(block)) flagged.push({ id: m[1], href: m[2] })
  }
  return flagged
}

function bottomTabHrefs () {
  const hrefs = []
  const re = /href:\s*'(\/[^']+)'/g
  let m
  while ((m = re.exec(bottomNavSrc))) hrefs.push(m[1])
  return new Set(hrefs)
}

test('bottomNav flag only marks routes that exist in BottomNav tabs', () => {
  const tabs = bottomTabHrefs()
  const flagged = itemsWithBottomNavFlag()
  assert.ok(flagged.length >= 3, 'expected Home/Sale/Ledger bottomNav flags')
  for (const item of flagged) {
    assert.ok(
      tabs.has(item.href),
      `${item.id} (${item.href}) has bottomNav:true but is not a BottomNav tab — it vanishes from mobile More`
    )
  }
})

test('sidebar hrefs in catalog are unique', () => {
  const hrefs = [...menuSrc.matchAll(/href:\s*'(\/[^']+)'/g)].map((m) => m[1])
  // Only count sidebar:true blocks roughly via unique hrefs in MORE_MENU_GROUPS
  assert.equal(new Set(hrefs).size, hrefs.length, `duplicate hrefs: ${hrefs.filter((h, i) => hrefs.indexOf(h) !== i)}`)
})
