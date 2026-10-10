// Dev probe: what prints for a route. Usage: node e2e/probe-print.mjs <outDir> /reports /vat-return ...
import { chromium } from '@playwright/test'
import { signIn, feOrigin } from './session.js'
const [outDir, ...routes] = process.argv.slice(2)
const slug = process.env.SLUG || 'gulfharvest'
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await signIn(page, slug)
for (const route of routes) {
  await page.goto(`${feOrigin(slug)}${route}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(1500)
  const stats = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
      return cs.visibility === 'visible' && cs.display !== 'none' && r.width > 0 && r.height > 0 && el.childElementCount === 0 && el.textContent.trim()
    })
    return { visibleTextNodes: vis.length, sample: vis.slice(0, 5).map((e) => e.textContent.trim().slice(0, 40)), chrome: !!document.querySelector('aside:not([style*="display: none"])') && getComputedStyle(document.querySelector('header') || document.body).display }
  })
  await page.screenshot({ path: `${outDir}/print${route.replace(/\//g, '_')}.png`, fullPage: false })
  console.log(route, JSON.stringify(stats))
  await page.emulateMedia({ media: 'screen' })
}
await browser.close()
