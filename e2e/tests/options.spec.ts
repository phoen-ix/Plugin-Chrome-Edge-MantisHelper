import type { BrowserContext, Page } from '@playwright/test'

import { MANTIS, expect, storeUrl, storedUrl, test } from '../fixtures'

/* The options page (data/options.html): the Mantis URL, its preview and
 * validation, saving and restoring it. Every test starts from its own
 * profile; storeUrl() sets what an earlier session saved. */

const HINT = 'Enter the address of your Mantis installation, e.g. https://mantis.example.com/'

async function openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/data/options.html`)
  await expect(page.getByRole('heading', { name: 'Mantis Helper Options' })).toBeVisible()
  // Loaded from storage: the preview is filled in then.
  await expect(page.getByLabel('Mantis URL:')).toHaveAccessibleDescription(/./)
  return page
}

const isValid = (page: Page) => page.getByLabel('Mantis URL:').evaluate((el: HTMLInputElement) => el.checkValidity())

test('first visit: an empty field, the hint, and Save stores nothing', async ({ context, worker, extensionId }) => {
  const page = await openOptions(context, extensionId)
  await expect(page.getByLabel('Mantis URL:')).toHaveValue('')
  await expect(page.getByLabel('Mantis URL:')).toHaveAccessibleDescription(HINT)
  await page.getByRole('button', { name: 'Save' }).click()
  expect(await isValid(page)).toBe(false)
  await expect(page.getByRole('status')).toHaveText('')
  expect(await storedUrl(worker)).toBeUndefined()
})

test("Extension options on the extension's details page opens the options", async ({ context, extensionId }) => {
  const details = await context.newPage()
  await details.goto(`chrome://extensions/?id=${extensionId}`)
  const opened = context.waitForEvent('page')
  await details.getByRole('link', { name: 'Extension options' }).click()
  const page = await opened
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/data/options.html`)
  await expect(page.getByRole('heading', { name: 'Mantis Helper Options' })).toBeVisible()
})

test('the preview follows the typing; an address without http(s):// cannot be saved', async ({ context, worker, extensionId }) => {
  const page = await openOptions(context, extensionId)
  const input = page.getByLabel('Mantis URL:')
  await input.fill('https://mantis.example.com')
  await expect(input).toHaveAccessibleDescription(`Issue 1234 will open ${MANTIS}view.php?id=1234`)
  expect(await isValid(page)).toBe(true)
  for (const unusable of ['mantis.example.com', 'ftp://mantis.example.com/', 'https://']) {
    await input.fill(unusable)
    await expect(input).toHaveAccessibleDescription(HINT)
    expect(await isValid(page), unusable).toBe(false)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('')
  }
  expect(await storedUrl(worker)).toBeUndefined()
})

test('Save stores the normalized address, and the page shows it again next time', async ({ context, worker, extensionId }) => {
  const page = await openOptions(context, extensionId)
  await page.getByLabel('Mantis URL:').fill(' https://mantis.example.com ')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Options saved.')
  await expect(page.getByLabel('Mantis URL:')).toHaveValue(`${MANTIS}view.php?id=`)
  expect(await storedUrl(worker)).toBe(`${MANTIS}view.php?id=`)
  await page.close()

  const again = await openOptions(context, extensionId)
  await expect(again.getByLabel('Mantis URL:')).toHaveValue(`${MANTIS}view.php?id=`)
  await expect(again.getByLabel('Mantis URL:')).toHaveAccessibleDescription(`Issue 1234 will open ${MANTIS}view.php?id=1234`)
  await expect(again.getByRole('status')).toHaveText('')
})

for (const [what, typed, saved] of [
  ['a pasted issue link', 'https://mantis.example.com/view.php?id=4711#c5', `${MANTIS}view.php?id=`],
  ['a pasted page link', 'https://mantis.example.com/mantis/my_view_page.php', `${MANTIS}mantis/view.php?id=`],
  ['a URL with a query', 'https://bugs.example.com/show_bug.php?bug_id=', 'https://bugs.example.com/show_bug.php?bug_id='],
] as const) {
  test(`Save turns ${what} into the issue address`, async ({ context, worker, extensionId }) => {
    const page = await openOptions(context, extensionId)
    await page.getByLabel('Mantis URL:').fill(typed)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('Options saved.')
    await expect(page.getByLabel('Mantis URL:')).toHaveValue(saved)
    expect(await storedUrl(worker)).toBe(saved)
  })
}

test('typing after saving clears "Options saved."; Enter saves too', async ({ context, worker, extensionId }) => {
  const page = await openOptions(context, extensionId)
  const input = page.getByLabel('Mantis URL:')
  await input.fill(MANTIS)
  await input.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Options saved.')
  await input.pressSequentially('x')
  await expect(page.getByRole('status')).toHaveText('')
  expect(await storedUrl(worker)).toBe(`${MANTIS}view.php?id=`)
})

test('the v1.x placeholder that was saved as is shows as not configured', async ({ context, worker, extensionId }) => {
  await storeUrl(worker, 'https://example.com/view.php?id=')
  const page = await openOptions(context, extensionId)
  await expect(page.getByLabel('Mantis URL:')).toHaveValue('')
  await expect(page.getByLabel('Mantis URL:')).toHaveAccessibleDescription(HINT)
})

test('an unusable address saved by v1.x is shown with the hint, to be corrected', async ({ context, worker, extensionId }) => {
  await storeUrl(worker, 'mantis.example.com')
  const page = await openOptions(context, extensionId)
  const input = page.getByLabel('Mantis URL:')
  await expect(input).toHaveValue('mantis.example.com')
  await expect(input).toHaveAccessibleDescription(HINT)
  expect(await isValid(page)).toBe(false)
  await input.fill('https://mantis.example.com/')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Options saved.')
  expect(await storedUrl(worker)).toBe(`${MANTIS}view.php?id=`)
})
