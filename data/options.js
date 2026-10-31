const HINT = 'Enter the address of your Mantis installation, e.g. https://mantis.example.com/';

const form = document.getElementById('optionsForm');
const input = document.getElementById('customUrl');
const preview = document.getElementById('preview');
const statusMessage = document.getElementById('status');

// Validates the input with the same rules as the context menu and shows which
// address an issue number will open.
function update() {
  const urlPrefix = normalizeMantisUrl(input.value);
  input.setCustomValidity(urlPrefix || !input.value ? '' : HINT);
  preview.textContent = urlPrefix ? `Issue 1234 will open ${urlPrefix}1234` : HINT;
}

// The saved URL arrives asynchronously. Whatever the user typed before it did
// wins; otherwise the late load wiped it, and Save then had nothing to save.
let typed = false;

document.addEventListener('DOMContentLoaded', async () => {
  const { customUrl } = await chrome.storage.sync.get('customUrl');
  if (typed) {
    return;
  }
  input.value = customUrl && customUrl !== LEGACY_DEFAULT_URL ? customUrl : '';
  update();
});

input.addEventListener('input', () => {
  typed = true;
  statusMessage.textContent = '';
  update();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const customUrl = normalizeMantisUrl(input.value);
  if (!customUrl) {
    return;
  }
  input.value = customUrl;
  update();
  await chrome.storage.sync.set({ customUrl });
  statusMessage.textContent = 'Options saved.';
});
