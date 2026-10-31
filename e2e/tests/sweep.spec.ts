import { MANTIS, expect, storeUrl, test } from '../fixtures'

/* Breadth: every page of the extension (the manifest's options_page and the
 * hint page background.js opens), not configured and configured, at desktop
 * and phone width. Each shows its heading, with no page error (fixtures.ts
 * fails the test on one) and nothing sticking out sideways. There is no
 * sign-in and no language switch: the only role is the browser's user. */

const PAGES = [
  { path: 'data/options.html', title: 'Mantis Helper Options', heading: 'Mantis Helper Options' },
  { path: 'data/invalid_selection.html', title: 'Mantis Helper: invalid selection', heading: 'Invalid selection' },
]

for (const { path, title, heading } of PAGES) {
  for (const [state, url] of [
    ['not configured', undefined],
    ['configured', `${MANTIS}view.php?id=`],
  ] as const) {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      test(`${path}, ${state}, ${viewport.width} × ${viewport.height}`, async ({ context, worker, extensionId }) => {
        await storeUrl(worker, url)
        const page = await context.newPage()
        await page.setViewportSize(viewport)
        await page.goto(`chrome-extension://${extensionId}/${path}`)
        await expect(page).toHaveTitle(title)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        // Nothing sticks out sideways (a centred box that is too wide would go
        // past the left edge, where it could not be scrolled to).
        const { left, right } = await page.evaluate(() => {
          const boxes = [...document.body.querySelectorAll('*')].map((el) => el.getBoundingClientRect())
          return { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)) }
        })
        expect(left).toBeGreaterThanOrEqual(0)
        expect(right).toBeLessThanOrEqual(viewport.width)
      })
    }
  }
}
