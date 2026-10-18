// Daily close: record an owner capital movement and a drawer-to-bank move, check the server's expected cash and the
// screen both change by the right amounts, then remove both and check the figures return. Uses 2026-10-09 so
// the other daily-close specs are unaffected. Synthetic local tenant only; the test removes what it adds.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const DAY = '2026-10-09'
const NOTE = 'UX test movement'

async function api (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const expected = async () => Number((await api(`/api/daily-close/preview?businessDate=${DAY}&openingCash=0`)).json.data?.expectedCash)
const movements = async () => {
  const j = (await api(`/api/daily-close/movements?businessDate=${DAY}`)).json.data
  return Array.isArray(j) ? j : (j?.items || [])
}
async function removeTestMovements () {
  for (const m of await movements()) {
    if ((m.note || '') === NOTE) await api(`/api/daily-close/movements/${m.id}`, { method: 'DELETE' })
  }
}

const shownExpected = async (page) => {
  const txt = await page.getByText('Expected in drawer').filter({ visible: true }).first().locator('xpath=..').innerText()
  const nums = txt.match(/-?[\d,]+\.\d{2}/g) || []
  return nums.length ? Number(nums[nums.length - 1].replace(/,/g, '')) : null
}

async function addMovement (page, kind, amount) {
  await page.locator('label', { hasText: /^Type/ }).locator('select').selectOption(kind)
  await page.locator('label', { hasText: /^Amount/ }).locator('input[type="number"]').first().fill(String(amount))
  await page.locator('label', { hasText: /^Note/ }).locator('input').fill(NOTE)
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/daily-close\/movements$/.test(r.url()))
  await page.getByRole('button', { name: 'Add movement', exact: true }).click()
  const res = await saved
  if (res.status() >= 300) throw new Error(`POST movements ${res.status()}: ${await res.text()}`)
}

test('daily close: capital and transfer movements change expected cash, and removing them restores it', async ({ page }) => {
  await removeTestMovements()
  const before = await expected()
  expect(Number.isFinite(before), 'preview must return expected cash').toBe(true)
  try {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/daily-close`, { waitUntil: 'networkidle' })
    await page.locator('input[type="date"]').first().fill(DAY)
    await page.locator('label', { hasText: /^Opening cash/ }).locator('input').fill('0')
    await expect.poll(() => shownExpected(page)).toBeCloseTo(before, 2)

    await addMovement(page, 'OwnerCapitalIn', 25)
    await expect.poll(expected).toBeCloseTo(before + 25, 2)
    await expect.poll(() => shownExpected(page)).toBeCloseTo(before + 25, 2)

    await addMovement(page, 'DrawerToBank', 5)
    await expect.poll(expected).toBeCloseTo(before + 20, 2)
    await expect.poll(() => shownExpected(page)).toBeCloseTo(before + 20, 2)
    const mine = (await movements()).filter((m) => m.note === NOTE)
    expect(mine.map((m) => m.kind).sort(), 'both movements are stored').toEqual(['DrawerToBank', 'OwnerCapitalIn'])

    // Remove both through the screen.
    for (let n = 2; n > 0; n -= 1) {
      // The list must have refreshed before the next click, or the same row is deleted twice.
      await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(n)
      const gone = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/daily-close\/movements\/\d+$/.test(r.url()))
      await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
      expect((await gone).status()).toBeLessThan(300)
    }
    await expect.poll(expected).toBeCloseTo(before, 2)
    await expect.poll(() => shownExpected(page)).toBeCloseTo(before, 2)
  } finally {
    await removeTestMovements()
  }
})

// DC-08: a double click on Remove sends one delete, and the movement is gone.
test('daily close: a double click on Remove deletes the movement once', async ({ page }) => {
  await removeTestMovements()
  try {
    await signIn(page, SLUG)
    await page.goto(`${feOrigin(SLUG)}/daily-close`, { waitUntil: 'networkidle' })
    await page.locator('input[type="date"]').first().fill(DAY)
    await addMovement(page, 'OwnerCapitalIn', 5)
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(1)
    const deletes = []
    page.on('response', (r) => { if (r.request().method() === 'DELETE' && /\/api\/daily-close\/movements\/\d+$/.test(r.url())) deletes.push(r.status()) })
    await page.getByRole('button', { name: 'Remove', exact: true }).dblclick()
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)
    expect(deletes, 'one delete request, and it succeeded').toEqual([200])
  } finally {
    await removeTestMovements()
  }
})
