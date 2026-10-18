// Choose a value in a shared <Select>, whether it rendered as a native <select> (short lists) or as the
// searchable picker (more than 8 options). `trigger` is the select or the picker's combobox button.
export async function pickValue (page, trigger, value) {
  const tag = await trigger.evaluate((el) => el.tagName)
  if (tag === 'SELECT') {
    await trigger.selectOption({ value: String(value) })
    return
  }
  await trigger.click()
  await page.locator(`[role="listbox"] [role="option"][data-value="${String(value)}"]`).click()
}

// Same, but narrows the list by typing first (what a user does).
export async function searchAndPick (page, trigger, text, value) {
  await trigger.click()
  await page.getByRole('searchbox', { name: 'Search Customer' }).fill(text)
  await page.locator(`[role="listbox"] [role="option"][data-value="${String(value)}"]`).click()
}
