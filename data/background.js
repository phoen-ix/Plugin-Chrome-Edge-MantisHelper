importScripts('mantis.js');

const MENU_ID = 'openInMantis';
const MENU_PROPERTIES = {
  title: 'Open “%s” in Mantis',
  contexts: ['selection']
};

// Chrome keeps the menu across browser restarts and restores it before onInstalled
// fires after a browser update, so update an existing menu instead of failing on the
// duplicate id. onStartup repairs a menu that Chrome did not get to save.
function setUpMenu() {
  chrome.contextMenus.create({ id: MENU_ID, ...MENU_PROPERTIES }, () => {
    if (chrome.runtime.lastError) {
      chrome.contextMenus.update(MENU_ID, MENU_PROPERTIES);
    }
  });
}

chrome.runtime.onInstalled.addListener(setUpMenu);
chrome.runtime.onStartup.addListener(setUpMenu);
chrome.contextMenus.onClicked.addListener(handleMenuClick);

async function handleMenuClick(info, tab) {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const { customUrl } = await chrome.storage.sync.get('customUrl');
  const urlPrefix = normalizeMantisUrl(customUrl);
  if (!urlPrefix) {
    // Not configured yet, or configured with an unusable URL
    await chrome.runtime.openOptionsPage();
    return;
  }

  const issueId = findIssueId(info.selectionText);
  if (issueId) {
    await openBesideTab(`${urlPrefix}${issueId}`, tab);
    return;
  }
  const hintUrl = chrome.runtime.getURL('data/invalid_selection.html');
  if (tab?.incognito) {
    // Chrome opens extension pages from incognito tabs in a normal window
    await chrome.tabs.create({ url: hintUrl });
  } else {
    await openBesideTab(hintUrl, tab);
  }
}

// Opens the URL next to the tab the menu was used in and in its tab group, like Chrome
// does for links. Outside of tabs (e.g. side panels) Chrome passes tab id -1, and popup
// windows have no tab strip, so those get a plain new tab.
async function openBesideTab(url, tab) {
  const sourceWindow = tab?.id >= 0 ? await chrome.windows.get(tab.windowId).catch(() => null) : null;
  if (sourceWindow?.type !== 'normal') {
    await chrome.tabs.create({ url });
    return;
  }
  const newTab = await chrome.tabs.create({ url, windowId: tab.windowId, index: tab.index + 1, openerTabId: tab.id });
  // Chrome only adds it to the group by itself when it lands between two tabs of the group
  if (tab.groupId >= 0 && newTab.groupId !== tab.groupId) {
    // Fails e.g. while a tab is being dragged; the tab is open either way
    await chrome.tabs.group({ groupId: tab.groupId, tabIds: newTab.id }).catch(() => {});
  }
}
