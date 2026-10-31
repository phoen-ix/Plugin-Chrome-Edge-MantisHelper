import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, expect, test, type BrowserContext, type Locator, type Page, type Worker } from '@playwright/test'

/* The docs tour: one screenshot per page of the extension (the gallery is
 * docs/screenshots/README.md). It is also a render check (ci.yml runs it):
 * every test asserts something page-specific before it shoots, and a page
 * that throws fails the test.
 *
 * The context menu itself is browser UI that no screenshot can show; the hint
 * page is opened the way the menu opens it, through the service worker's
 * click handler. */

// Globals of the extension's service worker, for worker.evaluate().
declare const chrome: any
declare function handleMenuClick(info: object, tab: unknown): Promise<void>

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = path.resolve(process.env.DOCS_SCREENSHOT_DIR ?? path.join(ROOT, 'docs/screenshots'))
mkdirSync(OUT, { recursive: true })

const MANTIS_URL = 'https://mantis.example.com/'

let profile: string
let context: BrowserContext
let worker: Worker
let extensionId: string
let pageErrors: Error[] = []

// A fresh browser per test: in a browser that has already shown a page, the
// text in form fields does not always come out with the same pixels.
test.beforeEach(async ({}, info) => {
  pageErrors = []
  // What ships (README "Package it"), not the checkout with e2e/node_modules.
  profile = mkdtempSync(path.join(tmpdir(), 'mantis-helper-docs-'))
  const ext = path.join(profile, 'extension')
  for (const p of ['manifest.json', 'data', 'icons']) cpSync(path.join(ROOT, p), path.join(ext, p), { recursive: true })
  const u = info.project.use
  context = await chromium.launchPersistentContext(path.join(profile, 'user-data'), {
    // The full Chromium in new headless mode; the headless shell has no extensions.
    channel: 'chromium',
    args: [...(u.launchOptions?.args ?? []), `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    env: u.launchOptions?.env,
    viewport: u.viewport,
    deviceScaleFactor: u.deviceScaleFactor,
    locale: u.locale,
    timezoneId: u.timezoneId,
    ...u.contextOptions,
  })
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
  extensionId = new URL(worker.url()).host
})

test.afterEach(async () => {
  await context.close()
  rmSync(profile, { recursive: true, force: true })
  expect(pageErrors.map((e) => e.message)).toEqual([])
})

function track(page: Page): Page {
  page.on('pageerror', (e) => pageErrors.push(e))
  return page
}

/** The options page, with `customUrl` stored first (undefined: never configured). */
async function optionsPage(customUrl?: string): Promise<Page> {
  await worker.evaluate(
    (url) => (url === undefined ? chrome.storage.sync.clear() : chrome.storage.sync.set({ customUrl: url })),
    customUrl,
  )
  const page = track(await context.newPage())
  await page.goto(`chrome-extension://${extensionId}/data/options.html`)
  await expect(page).toHaveTitle('Mantis Helper Options')
  return page
}

/** `contentOnly`: only the content, from the top-left corner, instead of
 * the whole viewport - for a page that is mostly empty. `around`: only that
 * element and a margin of the page around it. */
async function shoot(page: Page, name: string, opts: { contentOnly?: boolean; around?: Locator } = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.mouse.move(0, 0)
  let clip: { x: number; y: number; width: number; height: number } | undefined
  if (opts.contentOnly) {
    // The text's own boxes: the block elements span the whole width.
    const { right, bottom } = await page.evaluate(() => {
      const range = document.createRange()
      return [...document.body.children].reduce(
        (box, el) => {
          range.selectNodeContents(el)
          const r = range.getBoundingClientRect()
          return { right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) }
        },
        { right: 0, bottom: 0 },
      )
    })
    clip = { x: 0, y: 0, width: Math.ceil(right) + 24, height: Math.min(2400, Math.ceil(bottom) + 24) }
  }
  if (opts.around) {
    const box = (await opts.around.boundingBox())!
    const x = Math.floor(box.x) - 32
    const y = Math.floor(box.y) - 32
    clip = { x, y, width: Math.ceil(box.x + box.width) + 32 - x, height: Math.ceil(box.y + box.height) + 32 - y }
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled', caret: 'hide', clip })
}

test('options: not configured yet', async () => {
  const page = await optionsPage()
  await expect(page.getByLabel('Mantis URL:')).toHaveValue('')
  await expect(page.locator('#preview')).toHaveText(/^Enter the address of your Mantis installation/)
  await shoot(page, 'options-empty', { around: page.locator('form') })
})

test('options: unusable URL', async () => {
  const page = await optionsPage()
  const input = page.getByLabel('Mantis URL:')
  await input.fill('mantis.example.com')
  await expect(page.locator('#preview')).toHaveText(/^Enter the address of your Mantis installation/)
  // What Save checks; a click would also raise the browser's validation
  // bubble, which fades in and out of the shot.
  expect(await input.evaluate((el: HTMLInputElement) => el.form!.checkValidity())).toBe(false)
  await shoot(page, 'options-invalid', { around: page.locator('form') })
})

test('options: saved', async () => {
  const page = await optionsPage()
  await page.getByLabel('Mantis URL:').fill(MANTIS_URL)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#status')).toHaveText('Options saved.')
  await expect(page.getByLabel('Mantis URL:')).toHaveValue(`${MANTIS_URL}view.php?id=`)
  await expect(page.locator('#preview')).toHaveText(`Issue 1234 will open ${MANTIS_URL}view.php?id=1234`)
  expect(await worker.evaluate(() => chrome.storage.sync.get('customUrl'))).toEqual({
    customUrl: `${MANTIS_URL}view.php?id=`,
  })
  await shoot(page, 'options-saved', { around: page.locator('form') })
})

/** WCAG contrast ratio of two opaque computed colours, "rgb(r, g, b)". */
function contrast(...colors: string[]): number {
  const [hi, lo] = colors
    .map((color) => {
      const [r, g, b] = color.match(/\d+/g)!.map((v) => {
        const c = Number(v) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    })
    .sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

test('options: contrast, and a window shorter than the form', async () => {
  const page = await optionsPage()
  const style = (selector: string, prop: string) =>
    page.locator(selector).evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), prop)
  // WCAG AA: 4.5:1 for the button's text, 3:1 for the field's border on the card.
  expect(contrast(await style('button', 'color'), await style('button', 'background-color'))).toBeGreaterThanOrEqual(4.5)
  expect(
    contrast(await style('#customUrl', 'border-top-color'), await style('#optionsForm', 'background-color')),
  ).toBeGreaterThanOrEqual(3)
  // The page scrolls; it does not cut off the top of the form.
  await page.setViewportSize({ width: 1280, height: 200 })
  await page.evaluate(() => window.scrollTo(0, 0))
  expect((await page.locator('#optionsForm').boundingBox())!.y).toBeGreaterThanOrEqual(0)
})

test('context menu: no single issue number in the selection', async () => {
  await optionsPage(`${MANTIS_URL}view.php?id=`)
  const hint = context.waitForEvent('page')
  // What a click on "Open “Issues 12 and 34” in Mantis" does in that tab.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    await handleMenuClick({ menuItemId: 'openInMantis', selectionText: 'Issues 12 and 34' }, tab)
  })
  const page = track(await hint)
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/data/invalid_selection.html`)
  await expect(page.getByRole('heading', { name: 'Invalid selection' })).toBeVisible()
  await shoot(page, 'menu-invalid-selection', { contentOnly: true })
})
