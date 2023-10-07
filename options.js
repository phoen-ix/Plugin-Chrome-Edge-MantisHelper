document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['customUrl'], (result) => {
    document.getElementById('customUrl').value = result.customUrl || 'https://example.com/view.php?id=';
  });
});

document.getElementById('optionsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const customUrl = document.getElementById('customUrl').value;
  chrome.storage.sync.set({ customUrl }, () => {
    alert('Options saved.');
  });
});
