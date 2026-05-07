# Learnly Extension

Chrome extension (Manifest V3) that extracts the page you're reading and generates 5 mixed study questions in a side panel.

## Setup

### 1. Add Readability.js

Mozilla's Readability library does the article extraction. Install and copy it in:

```bash
npm install @mozilla/readability
cp node_modules/@mozilla/readability/Readability.js extension/lib/readability.js
```

(Or download `Readability.js` directly from https://github.com/mozilla/readability and drop it in `extension/lib/`.)

### 2. Add icons

Drop three PNGs in `extension/icons/`: `icon16.png`, `icon48.png`, `icon128.png`. Anything will do for now — even a solid color.

### 3. Point at your backend

Edit `extension/lib/config.js` and set `BACKEND_URL` to your worker URL (or `http://127.0.0.1:8787` for local dev).

### 4. Load in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder

The Learnly icon should appear in your toolbar. Pin it for easy access.

## Use it

1. Open any article (Wikipedia, a blog, news, etc.)
2. Optionally select a passage
3. Click the Learnly icon — side panel opens
4. Click "Generate questions"
5. Reveal answers, mark "Got it" or "Review again"

## File structure

```
extension/
├── manifest.json          # MV3 manifest
├── background.js          # Opens side panel on icon click
├── sidepanel.html         # UI
├── sidepanel.css          # Styles
├── sidepanel.js           # Main logic
├── icons/                 # 16/48/128 px icons (you provide)
└── lib/
    ├── config.js          # BACKEND_URL
    ├── extract.js         # Runs in-page: selection or Readability
    └── readability.js     # Mozilla Readability (you provide)
```
