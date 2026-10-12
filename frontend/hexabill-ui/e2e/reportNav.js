/** Opens a report by its short label (e.g. "Aging") whatever the width: phone select, active-group tab, or group menu. */
export async function openReport(page, label) {
  const select = page.locator('select[aria-label="Report"]').filter({ visible: true })
  if (await select.count()) {
    const value = await select.locator(`option[data-short="${label}"]`).getAttribute('value')
    await select.selectOption(value)
    return
  }
  const tab = page.getByRole('tab', { name: label, exact: true }).filter({ visible: true }).first()
  if (await tab.count()) {
    await tab.click()
    return
  }
  const groups = page.locator('button[aria-haspopup="menu"]').filter({ visible: true })
  const n = await groups.count()
  for (let i = 0; i < n; i++) {
    await groups.nth(i).click()
    const item = page.getByRole('menuitem', { name: label, exact: true })
    if (await item.count()) {
      await item.click()
      return
    }
    await page.keyboard.press('Escape')
  }
  throw new Error(`Report "${label}" not found in the switcher`)
}
