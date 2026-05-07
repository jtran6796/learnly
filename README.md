# Learnly

AI study buddy that turns whatever you're reading into questions.

Browser extension (Manifest V3) → Cloudflare Worker → Claude Haiku 4.5 → 5 mixed-format questions in a side panel.

## What's here

- `extension/` — Chrome extension (popup, side panel, content extraction with Mozilla Readability)
- `backend/` — Cloudflare Worker that calls Claude and returns questions

## Quick start

1. Deploy the backend — see `backend/README.md`
2. Set up the extension — see `extension/README.md`
3. Point the extension at your backend URL in `extension/lib/config.js`

## How it works

1. User opens an article and clicks the Learnly icon
2. Side panel opens; user clicks "Generate questions"
3. Extension extracts content:
   - If text is selected → use selection
   - Else → run Mozilla Readability on the page
4. Content sent to Cloudflare Worker
5. Worker checks cache (KV, optional), else calls Claude Haiku 4.5
6. Returns JSON with 5 questions: 2 recall, 2 flashcard, 1 Socratic
7. Side panel renders them with reveal-answer + "got it / review again" buttons

## MVP scope (v0.1)

- ✅ Article extraction (Readability + selection fallback)
- ✅ 5 mixed-format questions
- ✅ Reveal answers, mark feedback (visual only)
- ✅ Manual trigger
- ✅ Backend rate limiting
- ✅ Optional content-hash caching via Cloudflare KV
- ❌ Accounts, persistence, spaced repetition (deferred)
- ❌ PDFs, Google Docs, YouTube (deferred)
- ❌ Mobile (deferred)

## Next steps

After validating the MVP feels good:

- Persistence: save question decks to `chrome.storage` or a DB
- Spaced repetition: surface "review again" cards on a schedule
- Settings: model choice, question count, difficulty
- Auth + Stripe: free tier (10/day) → Pro
- Expand surfaces: PDF support, YouTube transcripts
