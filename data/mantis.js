// Helpers shared by the background script and the options page.

// Version 1.x pre-filled this placeholder in the options, so it was often saved as-is
const LEGACY_DEFAULT_URL = 'https://example.com/view.php?id=';

// Returns the issue number in the selected text, or null if there is none or
// it is ambiguous. "#1234" wins over "0001234" (Mantis pads its ids), which
// wins over any other standalone number.
function findIssueId(text) {
  const matches = String(text ?? '').split(/\s+/)
    .map(word => word.replace(/^[(\[{<"'„“”‚‘’«»‹›]+|[)\]}>"'„“”‚‘’«»‹›:;,.!?]+$/g, ''))
    .map(word => /^(#?)0*([1-9]\d{0,9})$/.exec(word))
    .filter(Boolean);
  const candidates = [
    matches.filter(match => match[1]),
    matches.filter(match => match[0].startsWith('0')),
    matches
  ].find(group => group.length) || [];
  const ids = new Set(candidates.map(match => match[2]));
  return ids.size === 1 ? [...ids][0] : null;
}

// Returns the URL prefix the issue number is appended to, or null if the value
// is not an http(s) URL. Base, page and issue URLs become ".../view.php?id=",
// other URLs with a query are used as they are.
function normalizeMantisUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === LEGACY_DEFAULT_URL) {
    return null;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  url.hash = '';
  if (!url.search) {
    url.pathname = url.pathname.replace(/[^/]*\.php$/i, '').replace(/\/?$/, '/view.php');
    url.search = '?id=';
    return url.href;
  }
  // Drop the number of a pasted issue link, e.g. ".../view.php?id=1234"
  return url.href.replace(/([?&](?:bug_)?id=)\d+$/, '$1');
}
