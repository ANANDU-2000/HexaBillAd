// Company documents end to end: the owner uploads, approves, and the assistant finds the text with its source; a new version
// replaces the old text only after approval; a picture is stored but honestly "not searchable"; a bad file is stopped with a reason;
// staff see only approved documents shared with them and cannot manage anything. Synthetic local tenant only; removes what it creates.
import { test, expect } from '@playwright/test'
import { signIn, feOrigin, apiLogin, API, EDGE } from './session.js'

const SLUG = process.env.HEXABILL_E2E_SLUG || 'gulfharvest'
const HOST = { 'X-HexaBill-Original-Host': `${SLUG}.localhost`, 'X-HexaBill-Edge-Secret': EDGE }

async function ownerApi (path, init = {}) {
  const s = await apiLogin(SLUG)
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...HOST, ...(init.headers || {}) } })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const docs = async () => (await ownerApi('/api/tenant-documents')).json.data || []

async function removeLeftovers () {
  for (const d of await docs()) if (/^UX Doc /.test(d.title)) await ownerApi(`/api/tenant-documents/${d.id}`, { method: 'DELETE' })
}

async function upload (page, { title, name, mime, text, buffer, visibility, documentId }) {
  await page.getByRole('button', { name: documentId ? /New version/ : 'Upload document' }).first().click()
  const form = page.getByTestId('upload-form')
  await expect(form).toBeVisible()
  await form.locator('#doc-file').setInputFiles({ name, mimeType: mime, buffer: buffer || Buffer.from(text) })
  if (!documentId) {
    await form.locator('#doc-title').fill(title)
    if (visibility) await form.locator('#doc-visibility').selectOption(visibility)
  }
  await form.getByRole('button', { name: /^Upload/ }).click()
}

test('documents: upload, approve, find with source, replace, picture not searchable, bad file refused', async ({ page }) => {
  test.setTimeout(150_000)
  await removeLeftovers()
  const stamp = Date.now()
  const title = `UX Doc ${stamp}`
  const oldWord = `zqold${stamp}`
  const newWord = `zqnew${stamp}`
  try {
    await signIn(page, SLUG)
    await page.addInitScript(() => { try { localStorage.setItem('hexabill.assistant', '1') } catch { /* blocked */ } })
    await page.goto(`${feOrigin(SLUG)}/documents`, { waitUntil: 'networkidle' })

    // A file that is not allowed is stopped on the screen with a reason, before it is sent.
    await page.getByRole('button', { name: 'Upload document' }).first().click()
    const form = page.getByTestId('upload-form')
    await form.locator('#doc-file').setInputFiles({ name: 'run.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
    await form.locator('#doc-title').fill('Bad file')
    await form.getByRole('button', { name: /^Upload/ }).click()
    await expect(form.getByTestId('upload-error')).toContainText('Upload a PDF, PNG, JPEG, WebP, CSV or text file')
    await form.getByRole('button', { name: 'Cancel' }).click()

    // Upload, then it waits for approval and is not searchable.
    await expect(page.getByTestId('upload-form')).toHaveCount(0)
    await upload(page, { title, name: 'policy.txt', mime: 'text/plain', text: `Returns policy.\n\nGoods may be returned within ${oldWord} days.\n`, visibility: 'AllStaff' })
    const card = page.getByTestId('document-list').locator('li').filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(card).toContainText('Waiting for approval')
    const id = (await docs()).find((d) => d.title === title).id
    expect((await ownerApi('/api/assistant/tools/search_company_documents', { method: 'POST', body: JSON.stringify({ query: oldWord }) })).json.data.data).toHaveLength(0)

    // Approve: it becomes searchable and the assistant finds it with its source.
    await card.getByRole('button', { name: /Approve version 1/ }).click()
    await expect(page.getByTestId(`doc-search-${id}`)).toHaveText('Searchable')
    await page.getByRole('button', { name: 'Open assistant' }).filter({ visible: true }).first().click()
    const panel = page.getByRole('dialog', { name: 'Assistant' })
    await panel.getByLabel('Look up').selectOption('search_company_documents')
    await panel.getByLabel('Words to look for').fill(oldWord)
    await panel.getByRole('button', { name: 'Search' }).click()
    const hit = panel.getByRole('list', { name: 'Results' }).locator('li').first()
    await expect(hit).toContainText(title)
    await expect(hit).toContainText('version 1')
    await expect(hit).toContainText(/lines? \d/)
    await expect(hit).toContainText(oldWord)
    await panel.getByRole('button', { name: /Close/ }).first().click()

    // A new version replaces the old text only once approved.
    await upload(page, { documentId: id, name: 'policy-v2.txt', mime: 'text/plain', text: `Returns policy v2.\n\nGoods may be returned within ${newWord} days.\n` })
    await expect(card).toContainText('Version 2')
    const oldStill = (await ownerApi('/api/assistant/tools/search_company_documents', { method: 'POST', body: JSON.stringify({ query: oldWord }) })).json.data.data
    expect(oldStill).toHaveLength(1)
    await card.getByRole('button', { name: /Approve version 2/ }).click()
    await expect(card).not.toContainText('needs your review')
    await expect(card.getByText(/· version 2 ·/)).toBeVisible()
    expect((await ownerApi('/api/assistant/tools/search_company_documents', { method: 'POST', body: JSON.stringify({ query: oldWord }) })).json.data.data).toHaveLength(0)
    expect((await ownerApi('/api/assistant/tools/search_company_documents', { method: 'POST', body: JSON.stringify({ query: newWord }) })).json.data.data).toHaveLength(1)

    // A picture is stored and approved but plainly not searchable.
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    await upload(page, { title: `UX Doc scan ${stamp}`, name: 'scan.png', mime: 'image/png', buffer: png })
    const scan = page.getByTestId('document-list').locator('li').filter({ hasText: `UX Doc scan ${stamp}` })
    await scan.getByRole('button', { name: /Approve version 1/ }).click()
    await expect(scan).toContainText('Not searchable')
    await expect(scan).toContainText('OCR')

    // Delete asks first, then removes the text from search.
    await card.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete document' }).click()
    await expect(card).toHaveCount(0)
    expect((await ownerApi('/api/assistant/tools/search_company_documents', { method: 'POST', body: JSON.stringify({ query: newWord }) })).json.data.data).toHaveLength(0)
  } finally {
    await removeLeftovers()
  }
})

test('documents: staff see only approved documents shared with them, and cannot manage', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await removeLeftovers()
  const stamp = Date.now()
  const email = `ux-docstaff-${stamp}@hexabill.company`
  const password = `UxDoc-${stamp}-Pass!`
  let staffId
  try {
    const created = await ownerApi('/api/users', { method: 'POST', body: JSON.stringify({ name: `UX docstaff ${stamp}`, email, password, role: 'Staff', phone: null }) })
    expect(created.status, JSON.stringify(created.json).slice(0, 200)).toBeLessThan(300)
    staffId = created.json.data?.userId ?? created.json.data?.id ?? created.json.data?.Id
    const mk = async (title, visibility, approve) => {
      const form = new FormData()
      form.append('File', new Blob([`policy text ${title}`], { type: 'text/plain' }), 'p.txt')
      form.append('Title', title); form.append('DocType', 'Policy'); form.append('Visibility', visibility)
      const s = await apiLogin(SLUG)
      const r = await fetch(`${API}/api/tenant-documents`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}`, ...HOST }, body: form })
      const d = (await r.json()).data
      if (approve) await ownerApi(`/api/tenant-documents/${d.id}/versions/${d.versions[0].id}/approve`, { method: 'POST' })
      return d.id
    }
    await mk(`UX Doc shared ${stamp}`, 'AllStaff', true)
    await mk(`UX Doc owneronly ${stamp}`, 'OwnerOnly', true)
    await mk(`UX Doc waiting ${stamp}`, 'AllStaff', false)

    const ctx = await browser.newContext({ viewport: page.viewportSize() })
    const staffPage = await ctx.newPage()
    const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...HOST }, body: JSON.stringify({ email, password }) })
    const d = (await login.json()).data || {}
    await staffPage.goto(`${feOrigin(SLUG)}/login`, { waitUntil: 'domcontentloaded' })
    await staffPage.evaluate((s) => { localStorage.setItem('token', s.token); localStorage.setItem('user', JSON.stringify(s.user)) }, { token: d.token || d.Token, user: { id: d.userId, role: 'Staff', name: d.name, tenantId: d.tenantId } })
    await staffPage.goto(`${feOrigin(SLUG)}/documents`, { waitUntil: 'networkidle' })
    const list = staffPage.getByTestId('document-list')
    await expect(list).toContainText(`UX Doc shared ${stamp}`)
    await expect(list).not.toContainText('owneronly')
    await expect(list).not.toContainText('waiting')
    await expect(staffPage.getByRole('button', { name: 'Upload document' })).toHaveCount(0)
    await expect(staffPage.getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await expect(staffPage.getByRole('button', { name: /Approve version/ })).toHaveCount(0)
    await ctx.close()
  } finally {
    await removeLeftovers()
    if (staffId) await ownerApi(`/api/users/${staffId}`, { method: 'DELETE' })
  }
})
