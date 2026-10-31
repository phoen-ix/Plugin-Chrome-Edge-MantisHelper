import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test'

/* Fixtures of the e2e suite (tests/): every test gets a fresh Chromium profile
 * with the unpacked extension loaded, its service worker (`worker`, for
 * chrome.* calls and the menu's click handler) and its id. A page error or a
 * console error in any page of the profile or in the worker fails the test.
 * Fake sites on *.example.com are served by routes, so nothing reaches the
 * network. */

// Globals of the extension's service worker, for worker.evaluate().
declare const chrome: any
declare function handleMenuClick(info: object, tab: unknown): Promise<void>

export const MANTIS = 'https://mantis.example.com/'
const SOURCE = 'https://intranet.example.com/notes'

type Fixtures = { context: BrowserContext; worker: Worker; extensionId: string }

export const test = base.extend<Fixtures, { extensionPath: string }>({
  // What ships (README "Package it"), not the checkout with e2e/node_modules.
  extensionPath: [
    async ({}, use) => {
      const dir = mkdtempSync(path.join(tmpdir(), 'mantis-helper-e2e-'))
      const root = fileURLToPath(new URL('..', import.meta.url))
      for (const p of ['manifest.json', 'data', 'icons']) cpSync(path.join(root, p), path.join(dir, p), { recursive: true })
      await use(dir)
      rmSync(dir, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

  context: async ({ extensionPath, viewport, locale, timezoneId, launchOptions }, use) => {
    const context = await chromium.launchPersistentContext('', {
      // The full Chromium in new headless mode; the headless shell has no extensions.
      channel: 'chromium',
      args: [...(launchOptions.args ?? []), `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      env: launchOptions.env,
      viewport,
      locale,
      timezoneId,
    })
    const errors: string[] = []
    context.on('weberror', (e) => errors.push(e.error().message))
    context.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await context.route(/^https:\/\/[^/]*\.example\.com\//, (route) =>
      route.fulfill({ contentType: 'text/html', body: `<!DOCTYPE html><title>${route.request().url()}</title><p>Issue #1234: Fix login bug</p>` }),
    )
    await use(context)
    await context.close()
    expect(errors, 'page errors').toEqual([])
  },

  // Its console errors (e.g. "Unchecked runtime.lastError") fail the test too.
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    const errors: string[] = []
    worker.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await use(worker)
    expect(errors, 'service worker errors').toEqual([])
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host)
  },
})

export { expect }

/** Stores `customUrl` as the options page would (undefined: never configured). */
export async function storeUrl(worker: Worker, customUrl?: string): Promise<void> {
  await worker.evaluate(
    (url) => (url === undefined ? chrome.storage.sync.clear() : chrome.storage.sync.set({ customUrl: url })),
    customUrl,
  )
}

export async function storedUrl(worker: Worker): Promise<string | undefined> {
  return (await worker.evaluate(() => chrome.storage.sync.get('customUrl'))).customUrl
}

/** chrome.tabs.Tab of a page. Without the "tabs" permission tabs cannot be
 * looked up by URL, so the page becomes the active tab of its window. */
export async function tabOf(worker: Worker, page: Page): Promise<any> {
  await page.bringToFront()
  const [tab] = await worker.evaluate(() => chrome.tabs.query({ active: true, lastFocusedWindow: true }))
  return tab
}

/** What a click on "Open “<selection>” in Mantis" in `tab` does: the
 * service worker's onClicked handler, called with what Chrome passes it. */
export async function clickMenu(worker: Worker, selectionText: string, tab: unknown, menuItemId = 'openInMantis'): Promise<void> {
  await worker.evaluate(({ info, tab }) => handleMenuClick(info, tab), { info: { menuItemId, selectionText }, tab })
}

/** A page of a fake intranet site, with `selection` selected on it. */
export async function sourcePage(context: BrowserContext, selection = 'Issue #1234: Fix login bug'): Promise<Page> {
  const page = await context.newPage()
  await page.route(SOURCE, (route) => route.fulfill({ contentType: 'text/html', body: `<!DOCTYPE html><title>Notes</title><p>${selection}</p>` }))
  await page.goto(SOURCE)
  if (selection) await page.getByText(selection).selectText()
  return page
}

/** The selected text of a page, as Chrome passes it to the menu (selectionText). */
export async function selectionOf(page: Page): Promise<string> {
  return page.evaluate(() => getSelection()!.toString())
}
