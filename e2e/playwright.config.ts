import { defineConfig } from '@playwright/test'

/* The e2e suite (./tests, inventory in COVERAGE.md): every test loads the
 * unpacked extension into its own headless Chromium profile (fixtures.ts) and
 * drives its pages and the context menu's click handler.
 *
 *   npx playwright test            # scripts/e2e.sh wraps it
 *
 * The docs tour has its own config (playwright.docs.config.ts). */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
    timezoneId: 'Europe/Vienna',
    launchOptions: {
      // The fake sites fail to resolve inside Chromium, as an unknown host does, without a DNS query;
      // a tab the extension opens loads before its route exists and is retried once it does.
      args: ['--lang=en-GB', '--host-resolver-rules=MAP *.example.com ~NOTFOUND'],
      env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB:en', LC_ALL: 'en_GB.UTF-8' },
    },
    trace: 'retain-on-failure',
  },
})
