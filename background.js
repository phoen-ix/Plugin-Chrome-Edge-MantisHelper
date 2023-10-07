chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openInMantis',
    title: 'Open in Mantis',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'openInMantis') {
    let selectedText = info.selectionText;
    if (selectedText.startsWith('#')) {
      selectedText = selectedText.substring(1);
    }
    chrome.storage.sync.get(['customUrl'], (result) => {
      const fixedUrl = result.customUrl || 'https://example.com/view.php?id=';
      const completeUrl = `${fixedUrl}${selectedText}`;
      chrome.tabs.create({ url: completeUrl });
    });
  }
});
