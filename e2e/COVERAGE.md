# E2E coverage

Inventory of every user-facing page, feature, form, action and error state of the extension, and the test
that covers it (`<spec> › [<describe> ›] <title>` for `e2e/tests/<spec>.spec.ts`; run with `scripts/e2e.sh`).
❌ rows give one reason: (a) needs hardware or an external account, (b) irreversible external effect,
(c) covered at another layer (test cited), (d) cannot be driven, (e) time-box overrun.

Extracted 2026-10-31 from:
- pages and scripts: `jq -c '{options_page, sw: .background.service_worker, content_scripts, action}' manifest.json`
  (options page, service worker; no content scripts, no toolbar action) and
  `grep -ho "getURL('[^']*')" data/*.js` (the hint page)
- browser APIs the service worker and the options page use:
  `grep -ohE 'chrome\.[a-zA-Z]+\.[a-zA-Z]+(\.[a-zA-Z]+)?' data/*.js | sort -u` (13)
- forms and controls: `grep -nE '<(form|input|button|h1|p id)' data/*.html`
- the README's "Features" and "How to Use"

**35 items (4 page × state cells, 31 features, actions and error states): 32 ✅, 3 ❌ (d).**
Roles: one, the browser's user (no sign-in). No language switch (English only), no theme.
How the tests work: `fixtures.ts` loads the unpacked extension (`manifest.json`, `data/`, `icons/`, what the
README's "Package it" ships) into a fresh headless Chromium profile per test; Chrome's context menu itself is
browser UI, so the menu tests call the service worker's click handler the way Chrome does, with the selected
text of a real page and that page's tab. Fake sites on `*.example.com` are Playwright routes. A page error or
a console error in any page or in the service worker fails a test.

## Pages × states (breadth: `sweep.spec.ts`)

Every page, not configured and configured, at 1280 × 800, 390 × 844 and 320 × 256 (1280 × 1024 zoomed to
400 %, WCAG 1.4.10): title, its heading, nothing sticking out sideways or above the top.

| Page | Not configured | Configured |
|---|---|---|
| `data/options.html` (manifest `options_page`) | ✅ sweep › data/options.html, not configured, … | ✅ sweep › data/options.html, configured, … |
| `data/invalid_selection.html` (opened by the menu) | ✅ sweep › data/invalid_selection.html, not configured, … | ✅ sweep › data/invalid_selection.html, configured, … |

## Context menu "Open “…” in Mantis" (`data/background.js`)

| Feature / state | Test |
|---|---|
| Registered on install, for selections, with the selection in its title (`Open “%s” in Mantis`) | ✅ menu › the menu is registered on install, with the selection in its title, and again after a restart or update |
| Set up again after a browser restart or update (Chrome restored it: duplicate id → update) | ✅ menu › the menu is registered on install, … and again after a restart or update |
| The menu entry as drawn by the browser (right-click, title with the selection) | ❌ (d) browser UI outside the page; neither Playwright nor CDP can open or read it. Its title and contexts are asserted at the API (row 1) |
| A single issue number opens `<prefix><id>` in a new tab next to the source tab (index + 1, opener) | ✅ menu › a configured extension › “1234” opens issue 1234 next to its tab |
| `#1234`, zero-padded `0001234`, a number in text (`Issue #1234: Fix login bug`, `0001234: Fix login bug`), `#` wins over a plain number | ✅ menu › a configured extension › “#1234” / “0001234” / “Issue #1234: Fix login bug” / “0001234: Fix login bug” / “See #1234 and 56.” opens issue 1234 next to its tab (the full matrix: `tests/mantis.test.mjs` › findIssueId: …) |
| No number, several equally likely ones, or a non-number (`1e3`) opens the hint page next to the source tab | ✅ menu › a configured extension › “Issues 12 and 34” / “Fix login bug” / “1e3” opens the invalid-selection hint next to its tab |
| The hint page: heading and text | ✅ menu › a configured extension › “Issues 12 and 34” opens the invalid-selection hint next to its tab |
| Source tab in a tab group: the new tab joins the group | ✅ menu › a configured extension › a tab in a tab group opens the issue in the same group |
| Joining the group fails (e.g. while a tab is dragged): the tab stays open | ❌ (d) a tab drag is browser UI that cannot be held open from a test |
| Selection in a popup window: a tab of a normal window | ✅ menu › a configured extension › a popup window opens the issue as a tab of a normal window |
| Selection outside of a tab (tab id -1, e.g. a side panel): a plain new tab | ✅ menu › a configured extension › a selection outside of a tab (tab id -1) opens the issue in a new tab |
| No tab passed: a plain new tab | ✅ menu › a configured extension › a selection without a tab opens the issue in a new tab |
| Source window gone by the time the handler runs: a plain new tab | ✅ menu › a configured extension › a selection in a window that has closed since opens the issue in a new tab |
| Incognito tab, no single number: the hint opens as a plain new tab (Chrome puts it in a normal window) | ✅ menu › a configured extension › a selection in an incognito tab opens the hint as a plain new tab |
| The same from a real incognito window ("Allow in Incognito" on) | ❌ (d) switching on "Allow in Incognito" (chrome://extensions details) unloads an extension loaded with `--load-extension` (its pages then fail with ERR_BLOCKED_BY_CLIENT), and the incognito profile is not part of Playwright's persistent context; the branch is covered with the tab marked incognito (row above) |
| Another menu item's click is ignored | ✅ menu › a configured extension › another menu item of the browser is ignored |
| Not configured: the menu opens the options instead | ✅ menu › not configured yet: the menu opens the options instead |
| v1.x placeholder `https://example.com/view.php?id=` stored: options instead | ✅ menu › configured with the v1.x placeholder: the menu opens the options instead |
| Unusable URL stored (no http(s)): options instead | ✅ menu › configured with an unusable URL: the menu opens the options instead |
| Configure on the options page, then open a selected issue (URL with its own query) | ✅ menu › configure the options, then open a selected issue |

## Options page (`data/options.html`, `data/options.js`)

| Feature / state | Test |
|---|---|
| Opened from chrome://extensions › Mantis Helper › "Extension options" | ✅ options › Extension options on the extension's details page opens the options |
| First visit: empty field, the hint as its description | ✅ options › first visit: an empty field, the hint, and Save stores nothing |
| Save with an empty field: blocked (required), nothing stored | ✅ options › first visit: an empty field, the hint, and Save stores nothing |
| Live preview "Issue 1234 will open …" while typing | ✅ options › the preview follows the typing; an address without http(s):// cannot be saved |
| Unusable address (`mantis.example.com`, `ftp://…`, `https://`): hint, field invalid, Save stores nothing | ✅ options › the preview follows the typing; an address without http(s):// cannot be saved |
| Save: normalised to `…/view.php?id=` (trimmed), stored, "Options saved." | ✅ options › Save stores the normalized address, and the page shows it again next time |
| Reopened: the saved address and its preview | ✅ options › Save stores the normalized address, and the page shows it again next time |
| A pasted issue link (`view.php?id=4711#c5`), a page link (`my_view_page.php`), a URL with a query (used as is) | ✅ options › Save turns a pasted issue link / a pasted page link / a URL with a query into the issue address (the full matrix: `tests/mantis.test.mjs` › normalizeMantisUrl: …) |
| Enter in the field saves; typing afterwards clears "Options saved." | ✅ options › typing after saving clears "Options saved."; Enter saves too |
| v1.x placeholder stored: shown as not configured | ✅ options › the v1.x placeholder that was saved as is shows as not configured |
| Unusable address from v1.x stored: shown with the hint, corrected and saved | ✅ options › an unusable address saved by v1.x is shown with the hint, to be corrected |

Not inventoried as features: the browser's validation bubble on Save (browser UI; the tests assert the field's
validity instead), `chrome.storage.sync` syncing between the user's devices (Chrome's, with a Google account),
store installation and packaging (README "Package it"; the fixture loads exactly those files).
