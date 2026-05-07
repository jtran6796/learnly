# Learnly Backend

Cloudflare Worker that takes scraped page content and returns 5 mixed study questions from Claude Haiku 4.5.

## Setup

```bash
npm install -g wrangler
wrangler login
```

Set your Anthropic API key as a secret:

```bash
wrangler secret put ANTHROPIC_API_KEY
# paste your key when prompted
```

(Optional) Enable caching:

```bash
wrangler kv namespace create LEARNLY_CACHE
# copy the returned id into wrangler.toml and uncomment the kv_namespaces block
```

## Run locally

```bash
wrangler dev
# server runs at http://127.0.0.1:8787
```

## Deploy

```bash
wrangler deploy
# returns a URL like https://learnly-backend.<your-subdomain>.workers.dev
```

Update `BACKEND_URL` in `extension/lib/config.js` to point at this URL.

## Test

```bash
curl -X POST http://127.0.0.1:8787 \
  -H "Content-Type: application/json" \
  -d '{"content":"Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy. During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds."}'
```
