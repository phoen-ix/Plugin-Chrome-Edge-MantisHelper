import { defineConfig } from '@playwright/test'

/* The docs tour (./docs): screenshots of the extension's own pages, and a
 * render check of every page it shows. The tour loads the unpacked extension
 * into a persistent Chromium profile itself (extensions need one), so these
 * `use` options are handed to that launch rather than to Playwright's own
 * browser:
 *
 *   npx playwright test -c playwright.docs.config.ts
 *
 * Screenshots land in ../docs/screenshots (DOCS_SCREENSHOT_DIR overrides).
 * scripts/docs-screenshots.sh wraps it. */
export default defineConfig({
  testDir: './docs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // A retried render check would hide a flaky page.
  retries: 0,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    locale: 'en-GB',
    timezoneId: 'Europe/Vienna',
    launchOptions: {
      // The fake sites fail to resolve inside Chromium, as an unknown host does, without a DNS query;
      // a tab the extension opens loads before its route exists and is retried once it does.
      args: ['--lang=en-GB', '--host-resolver-rules=MAP *.example.com ~NOTFOUND'],
      env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB:en', LC_ALL: 'en_GB.UTF-8' },
    },
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'off',
    trace: 'off',
  },
})
