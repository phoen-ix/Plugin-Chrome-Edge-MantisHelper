#!/usr/bin/env bash
# Run the e2e suite (e2e/tests/, inventory in e2e/COVERAGE.md): every test
# loads the unpacked extension into its own headless Chromium profile.
#
#   scripts/e2e.sh [playwright args]      # e.g. -g 'options' or --repeat-each=3
#
# No server, no Docker: the pages are the extension's own (chrome-extension://)
# and fake sites are served by Playwright routes, so nothing binds a port, there
# is no compose project and PORT_BASE is not used. ARTIFACTS: where Playwright's
# test results and traces go (default: a temp dir). Node + `npm ci` and
# `npx playwright install chromium` in e2e/ are the caller's.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS="${ARTIFACTS:-$(mktemp -d)}"

cd "$ROOT/e2e"
echo "e2e: results in $ARTIFACTS/test-results"
npx playwright test --output "$ARTIFACTS/test-results" "$@"
