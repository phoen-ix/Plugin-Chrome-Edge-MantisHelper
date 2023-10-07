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

    // Check if selectedText is defined, not just white spaces, and is a number
    if (selectedText && selectedText.trim() && !isNaN(selectedText.trim())) {
      if (selectedText.startsWith('#')) {
        selectedText = selectedText.substring(1);
      }
      chrome.storage.sync.get(['customUrl'], (result) => {
        const fixedUrl = result.customUrl || 'https://example.com/view.php?id=';
        const completeUrl = `${fixedUrl}${selectedText}`;
        chrome.tabs.create({ url: completeUrl });
      });
    } else {
      // Open a new tab with an error message
      chrome.tabs.create({ url: chrome.runtime.getURL('data/invalid_selection.html') });

    }
  }
});

