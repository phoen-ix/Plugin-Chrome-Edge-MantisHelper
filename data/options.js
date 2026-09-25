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

document.addEventListener('DOMContentLoaded', async () => {
  const { customUrl } = await chrome.storage.sync.get('customUrl');
  input.value = customUrl && customUrl !== LEGACY_DEFAULT_URL ? customUrl : '';
  update();
});

input.addEventListener('input', () => {
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
