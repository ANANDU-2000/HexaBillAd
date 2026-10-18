// Login through the real form (the other specs set the session directly). Wrong password, empty submit,
// correct login reaching the dashboard, and logout. Synthetic local tenant owner only.
import { test, expect } from '@playwright/test'
import { feOrigin, ownerPassword } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const EMAIL = `${SLUG}@hexabill.company`

async function loginForm (page) {
  await page.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'networkidle' })
  return {
    email: page.getByLabel(/email/i).filter({ visible: true }).first(),
    password: page.locator('input[type="password"]').filter({ visible: true }).first(),
    submit: page.getByRole('button', { name: /^Sign in$/ }).filter({ visible: true }).first(),
  }
}

test('wrong password: the user is told, stays on the login page, and no session is stored', async ({ page }) => {
  const form = await loginForm(page)
  await form.email.fill(EMAIL)
  await form.password.fill('not-the-password-' + Date.now())
  await form.submit.click()
  await expect(page.getByText(/incorrect|invalid|wrong|not match/i).filter({ visible: true }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeFalsy()
  // The entered email is kept so the user only retypes the password.
  await expect(form.email).toHaveValue(EMAIL)
})

test('empty submit shows what is missing next to the fields', async ({ page }) => {
  const form = await loginForm(page)
  await form.submit.click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(/required|enter your|email|password/i).filter({ visible: true }).first()).toBeVisible()
})

test('correct password reaches the dashboard; logout returns to the login page and clears the session', async ({ page }, info) => {
  test.skip(!ownerPassword(), 'HEXABILL_OWNER_PASSWORD (or e2e/.env.local) is not set')
  const form = await loginForm(page)
  await form.email.fill(EMAIL)
  await form.password.fill(ownerPassword())
  const login = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/auth\/login$/.test(r.url()))
  await form.submit.click()
  expect((await login).status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy()

  if (info.project.use.viewport.width < 768) {
    // Phones: sign out is in the More sheet (bottom navigation).
    await page.getByRole('button', { name: 'More options' }).filter({ visible: true }).first().click()
    await page.getByRole('button', { name: /sign out|log ?out/i }).filter({ visible: true }).first().click()
  } else {
    await page.getByRole('button', { name: 'Account menu' }).filter({ visible: true }).first().click()
    await page.getByRole('menuitem', { name: /log ?out|sign out/i }).or(page.getByRole('button', { name: /log ?out|sign out/i })).filter({ visible: true }).first().click()
  }
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeFalsy()
})
