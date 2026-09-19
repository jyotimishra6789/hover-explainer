const key = document.getElementById('key');
const status = document.getElementById('status');
chrome.storage.local.get('apiKey').then(({ apiKey }) => { if (apiKey) key.value = apiKey; });
document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ apiKey: key.value.trim() });
  status.textContent = 'Saved.';
  setTimeout(() => (status.textContent = ''), 1500);
});
