// Dev probe: report elements wider than the viewport on a route. Usage: node e2e/probe-overflow.mjs /products 768 [tenant]
import { chromium } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
const [route = '/dashboard', width = '768', slug = 'gulfharvest'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' })
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } })
await signIn(page, slug)
await page.goto(`${feOrigin(slug)}${route}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const out = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const res = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 && r.width > 0) {
      const parentOver = el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1
      if (!parentOver) res.push({ tag: el.tagName, cls: String(el.className).slice(0, 140), right: Math.round(r.right), w: Math.round(r.width) })
    }
  }
  const chain = []
  let el = document.querySelector('table')
  while (el && el !== document.body) {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
    chain.push(`${el.tagName}.${String(el.className).slice(0, 60)} | ox=${cs.overflowX} disp=${cs.display} w=${Math.round(r.width)} sw=${el.scrollWidth}`)
    el = el.parentElement
  }
  // Bisect: which subtree, when hidden, removes the page overflow?
  const base = document.documentElement.scrollWidth
  const culprits = []
  const visit = (node, depth) => {
    for (const child of node.children) {
      const prev = child.style.display
      child.style.display = 'none'
      const sw = document.documentElement.scrollWidth
      child.style.display = prev
      if (sw < base) {
        culprits.push(`${'  '.repeat(depth)}${child.tagName}.${String(child.className).slice(0, 90)} -> ${sw}`)
        if (depth < 14) visit(child, depth + 1)
        break
      }
    }
  }
  visit(document.body, 0)
  window.scrollTo(500, 0)
  const sx = window.scrollX
  const se = document.scrollingElement; se.scrollLeft = 500
  const near = [...document.querySelectorAll('body *')].map((e) => [e, e.getBoundingClientRect()])
    .filter(([, r]) => Math.abs(r.right - base) < 20 && r.width > 0)
    .map(([e, r]) => `${e.tagName}.${String(e.className).slice(0, 70)} pos=${getComputedStyle(e).position} right=${Math.round(r.right)}`).slice(0, 6)
  return { vw, scroll: base, scrollX: sx, scrollingElLeft: se.scrollLeft, near }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
