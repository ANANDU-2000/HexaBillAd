// Visual evidence for the UI redesign: full-page screenshots of chosen routes per viewport project.
// Usage: HEXABILL_SHOT_TAG=before|after HEXABILL_SHOT_ROUTES="/reports?tab=summary,/reports?tab=aging" (read-only).
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { signIn, feOrigin } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const TAG = process.env.HEXABILL_SHOT_TAG || 'shot'
const ROUTES = (process.env.HEXABILL_SHOT_ROUTES || '/reports?tab=summary').split(',').map((r) => r.trim()).filter(Boolean)

test('capture routes', async ({ page }, info) => {
  test.setTimeout(180000)
  await signIn(page, SLUG)
  mkdirSync('ui-shots', { recursive: true })
  for (const route of ROUTES) {
    await page.goto(`${feOrigin(SLUG)}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
    await page.screenshot({ path: `ui-shots/${TAG}-${name}-${info.project.name}.png`, fullPage: true })
  }
})
