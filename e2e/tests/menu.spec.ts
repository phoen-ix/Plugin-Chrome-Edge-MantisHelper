import { MANTIS, clickMenu, expect, selectionOf, sourcePage, storeUrl, tabOf, test } from '../fixtures'

/* The context menu "Open “<selection>” in Mantis": what its click handler
 * (background.js) opens for a selection, and where. Chrome's menu itself is
 * browser UI that cannot be driven, so each test calls the handler the way
 * Chrome does, with the selected text of a real page and that page's tab. */

declare const chrome: any
declare function setUpMenu(): void
declare function handleMenuClick(info: object, tab: unknown): Promise<void>

const ISSUE = `${MANTIS}view.php?id=1234`

test.describe('a configured extension', () => {
  test.beforeEach(async ({ worker }) => {
    await storeUrl(worker, `${MANTIS}view.php?id=`)
  })

  for (const selection of ['1234', '#1234', '0001234', 'Issue #1234: Fix login bug', '0001234: Fix login bug', 'See #1234 and 56.']) {
    test(`“${selection}” opens issue 1234 next to its tab`, async ({ context, worker }) => {
      const page = await sourcePage(context, selection)
      const tab = await tabOf(worker, page)
      const opened = context.waitForEvent('page')
      await clickMenu(worker, await selectionOf(page), tab)
      const issue = await opened
      await expect(issue).toHaveURL(ISSUE)
      expect(await tabOf(worker, issue)).toMatchObject({ windowId: tab.windowId, index: tab.index + 1, openerTabId: tab.id })
    })
  }

  for (const selection of ['Issues 12 and 34', 'Fix login bug', '1e3']) {
    test(`“${selection}” opens the invalid-selection hint next to its tab`, async ({ context, worker, extensionId }) => {
      const page = await sourcePage(context, selection)
      const tab = await tabOf(worker, page)
      const opened = context.waitForEvent('page')
      await clickMenu(worker, await selectionOf(page), tab)
      const hint = await opened
      await expect(hint).toHaveURL(`chrome-extension://${extensionId}/data/invalid_selection.html`)
      await expect(hint.getByRole('heading', { name: 'Invalid selection' })).toBeVisible()
      await expect(hint.getByText('No single issue number found in the selection.')).toBeVisible()
      expect(await tabOf(worker, hint)).toMatchObject({ windowId: tab.windowId, index: tab.index + 1, openerTabId: tab.id })
    })
  }

  test('a tab in a tab group opens the issue in the same group', async ({ context, worker }) => {
    const page = await sourcePage(context)
    const { id } = await tabOf(worker, page)
    await worker.evaluate((tabIds) => chrome.tabs.group({ tabIds }), id)
    const tab = await tabOf(worker, page)
    expect(tab.groupId).toBeGreaterThanOrEqual(0)
    const opened = context.waitForEvent('page')
    await clickMenu(worker, await selectionOf(page), tab)
    expect(await tabOf(worker, await opened)).toMatchObject({ groupId: tab.groupId, index: tab.index + 1 })
  })

  test('a popup window opens the issue as a tab of a normal window', async ({ context, worker }) => {
    const opened = context.waitForEvent('page')
    const popupWindow = await worker.evaluate(
      (url) => chrome.windows.create({ url, type: 'popup' }),
      'https://intranet.example.com/popup',
    )
    const popup = await opened
    await popup.getByText('Issue #1234: Fix login bug').selectText()
    const tabsOf = (windowType: string) => worker.evaluate((windowType) => chrome.tabs.query({ windowType }), windowType)
    const normalTabs = (await tabsOf('normal')).length
    const issueOpened = context.waitForEvent('page')
    await clickMenu(worker, await selectionOf(popup), popupWindow.tabs[0])
    await expect(await issueOpened).toHaveURL(ISSUE)
    expect(await tabsOf('popup')).toHaveLength(1)
    expect(await tabsOf('normal')).toHaveLength(normalTabs + 1)
  })

  // Outside of tabs, e.g. a side panel, Chrome passes tab id -1 (or no tab).
  for (const [where, tab] of [
    ['outside of a tab (tab id -1)', { id: -1, index: -1, windowId: -1 }],
    ['without a tab', undefined],
    ['in a window that has closed since', { id: 1, index: 0, windowId: 999999 }],
  ] as const) {
    test(`a selection ${where} opens the issue in a new tab`, async ({ context, worker }) => {
      const opened = context.waitForEvent('page')
      await clickMenu(worker, '#1234', tab)
      await expect(await opened).toHaveURL(ISSUE)
    })
  }

  // A real incognito window cannot be driven: switching on "Allow in Incognito"
  // unloads an extension loaded with --load-extension. So the handler gets the
  // tab of a normal page, marked incognito.
  test('a selection in an incognito tab opens the hint as a plain new tab', async ({ context, worker, extensionId }) => {
    const page = await sourcePage(context, 'Issues 12 and 34')
    await context.newPage()
    const tab = await tabOf(worker, page)
    const opened = context.waitForEvent('page')
    await clickMenu(worker, await selectionOf(page), { ...tab, incognito: true })
    const hint = await opened
    await expect(hint).toHaveURL(`chrome-extension://${extensionId}/data/invalid_selection.html`)
    // Not next to the incognito tab: Chrome would put it in a normal window.
    const hintTab = await tabOf(worker, hint)
    expect(hintTab.index).not.toBe(tab.index + 1)
    expect(hintTab.openerTabId).toBeUndefined()
  })

  test('another menu item of the browser is ignored', async ({ context, worker }) => {
    const page = await sourcePage(context)
    const tabs = () => worker.evaluate(() => chrome.tabs.query({}).then((t: unknown[]) => t.length))
    const before = await tabs()
    await clickMenu(worker, '1234', await tabOf(worker, page), 'someOtherMenu')
    expect(await tabs()).toBe(before)
  })
})

for (const [state, url] of [
  ['not configured yet', undefined],
  ['configured with the v1.x placeholder', 'https://example.com/view.php?id='],
  ['configured with an unusable URL', 'mantis.example.com'],
] as const) {
  test(`${state}: the menu opens the options instead`, async ({ context, worker, extensionId }) => {
    await storeUrl(worker, url)
    const page = await sourcePage(context)
    const opened = context.waitForEvent('page')
    await clickMenu(worker, await selectionOf(page), await tabOf(worker, page))
    const options = await opened
    await expect(options).toHaveURL(`chrome-extension://${extensionId}/data/options.html`)
    await expect(options.getByRole('heading', { name: 'Mantis Helper Options' })).toBeVisible()
  })
}

test('the menu is registered on install, with the selection in its title, and again after a restart or update', async ({ worker }) => {
  // update() fails for a menu id that does not exist.
  await worker.evaluate(() => chrome.contextMenus.update('openInMantis', {}))
  expect(await worker.evaluate(() => [
    chrome.runtime.onStartup.hasListener(setUpMenu),
    chrome.contextMenus.onClicked.hasListener(handleMenuClick),
  ])).toEqual([true, true])
  // On a restart or an update Chrome restores the menu before the extension sets
  // it up again: the duplicate id must turn into an update of the menu.
  const calls = await worker.evaluate(async () => {
    const calls: unknown[] = []
    const { create, update } = chrome.contextMenus
    let settled = () => {}
    const created = new Promise<void>((resolve) => (settled = resolve))
    chrome.contextMenus.create = (props: object, done?: () => void) => (
      calls.push(['create', props]), create(props, () => (done?.(), settled()))
    )
    chrome.contextMenus.update = (id: string, props: object) => (calls.push(['update', id, props]), update(id, props))
    try {
      setUpMenu()
      await created
    } finally {
      Object.assign(chrome.contextMenus, { create, update })
    }
    return calls
  })
  const menu = { title: 'Open “%s” in Mantis', contexts: ['selection'] }
  expect(calls).toEqual([
    ['create', { id: 'openInMantis', ...menu }],
    ['update', 'openInMantis', menu],
  ])
})

test('configure the options, then open a selected issue', async ({ context, worker, extensionId }) => {
  await storeUrl(worker, undefined)
  const options = await context.newPage()
  await options.goto(`chrome-extension://${extensionId}/data/options.html`)
  await options.getByLabel('Mantis URL:').fill('https://bugs.example.com/show_bug.php?bug_id=')
  await options.getByRole('button', { name: 'Save' }).click()
  await expect(options.getByRole('status')).toHaveText('Options saved.')
  const page = await sourcePage(context, 'Reported as #4711 yesterday')
  const opened = context.waitForEvent('page')
  await clickMenu(worker, await selectionOf(page), await tabOf(worker, page))
  await expect(await opened).toHaveURL('https://bugs.example.com/show_bug.php?bug_id=4711')
})
