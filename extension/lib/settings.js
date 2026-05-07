// Settings storage wrapper.
// Uses chrome.storage.sync so settings follow the user across devices.

const DEFAULTS = Object.freeze({
  format: "mix", // "open" | "multiple_choice" | "mix"
  count: 5, // 3 | 5 | 7
});

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

export async function setSetting(key, value) {
  if (!(key in DEFAULTS)) {
    console.warn(`settings: unknown key "${key}"`);
    return;
  }
  await chrome.storage.sync.set({ [key]: value });
}

export async function resetSettings() {
  await chrome.storage.sync.set(DEFAULTS);
  return { ...DEFAULTS };
}

export { DEFAULTS };