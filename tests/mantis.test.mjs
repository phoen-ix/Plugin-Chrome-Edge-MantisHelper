// Unit tests for data/mantis.js, the parsing the README's "Features" promise:
//   node --test tests/*.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

// A classic script for the service worker and the options page: its functions
// are globals. A fresh context has no URL (the browser's), so it gets Node's.
const { findIssueId, normalizeMantisUrl, LEGACY_DEFAULT_URL } = vm.runInNewContext(
  `${readFileSync(new URL('../data/mantis.js', import.meta.url), 'utf8')}
  ({ findIssueId, normalizeMantisUrl, LEGACY_DEFAULT_URL })`,
  { URL },
)

test('findIssueId: the number in the selection', () => {
  for (const text of ['1234', '#1234', '0001234', 'Issue #1234:', '0001234: Fix login bug', ' (1234). ', '„#1234“']) {
    assert.equal(findIssueId(text), '1234', text)
  }
})

test('findIssueId: # beats zero-padded beats plain', () => {
  assert.equal(findIssueId('See #12 and 0000034, 56'), '12')
  assert.equal(findIssueId('0000034 moved to 56'), '34')
  assert.equal(findIssueId('#12 duplicates #12'), '12')
})

test('findIssueId: none or ambiguous', () => {
  for (const text of ['', undefined, 'Issues 12 and 34', '#12 #34', '1e3', '0x1A', '-5', '1.5', '0', '#', '12345678901']) {
    assert.equal(findIssueId(text), null, String(text))
  }
})

test('normalizeMantisUrl: base, page and issue URLs end in view.php?id=', () => {
  const want = 'https://mantis.example.com/view.php?id='
  for (const url of [
    'https://mantis.example.com',
    ' https://mantis.example.com/ ',
    'https://mantis.example.com/my_view_page.php',
    'https://mantis.example.com/view.php?id=1234',
    'https://mantis.example.com/#top',
  ]) {
    assert.equal(normalizeMantisUrl(url), want, url)
  }
  assert.equal(normalizeMantisUrl('http://example.com/mantis/'), 'http://example.com/mantis/view.php?id=')
})

test('normalizeMantisUrl: URLs with a query are used as they are', () => {
  assert.equal(normalizeMantisUrl('https://bugs.example.com/show?bug_id=77'), 'https://bugs.example.com/show?bug_id=')
  assert.equal(normalizeMantisUrl('https://bugs.example.com/show?p=issue&key='), 'https://bugs.example.com/show?p=issue&key=')
})

test('normalizeMantisUrl: unusable values', () => {
  for (const url of ['', undefined, 'mantis.example.com', 'ftp://mantis.example.com/', 'javascript:alert(1)', LEGACY_DEFAULT_URL]) {
    assert.equal(normalizeMantisUrl(url), null, String(url))
  }
})
