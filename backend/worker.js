// Learnly backend - Cloudflare Worker
// Takes scraped page content + settings, returns N mixed questions from Claude Haiku 4.5
//
// Setup:
//   npm install -g wrangler
//   wrangler login
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler deploy

const SYSTEM_PROMPT = `You are Learnly, a study assistant that helps students engage deeply with what they read.

Given an article or passage, generate study questions that test understanding. The user will specify:
- count: total number of questions (3, 5, or 7)
- format: "open" (open-ended), "multiple_choice", or "mix" (both formats)

Question TYPES (always present, regardless of format):
- RECALL: tests memory of key facts/concepts directly from the text
- FLASHCARD: concise term/definition or concept/explanation pairs, useful for active recall
- SOCRATIC: open-ended, prompts critical thinking, no single right answer

Distribute the requested count roughly as: ~40% recall, ~40% flashcard, ~20% socratic. For 5 questions: 2 recall, 2 flashcard, 1 socratic. For 3: 1 recall, 1 flashcard, 1 socratic. For 7: 3 recall, 3 flashcard, 1 socratic.

FORMAT rules:
- "open" → all questions are open-ended (single answer field).
- "multiple_choice" → recall and flashcard questions are MC. Socratic stays open-ended (MC doesn't fit it).
- "mix" → roughly half MC and half open-ended, distributed across types. Socratic always open-ended.

For MULTIPLE CHOICE questions:
- Provide exactly 4 options.
- Always place the correct answer at index 0. The server will shuffle positions.
- Distractors must be plausible: common misconceptions, related concepts, or near-misses. Avoid joke or obviously-wrong options.
- The "answer" field should explain why the correct option is right (1-2 sentences).

For OPEN-ENDED questions:
- "answer" is the answer the student should arrive at.

General rules:
- Questions must be answerable from the text (except Socratic, which extends from it).
- Avoid trivia. Focus on important ideas, mechanisms, relationships.
- Keep questions clear and one sentence where possible.

Respond ONLY with a JSON object in this exact shape, no preamble, no markdown fences:

{
  "questions": [
    {
      "type": "recall" | "flashcard" | "socratic",
      "format": "open" | "multiple_choice",
      "question": "...",
      "options": ["correct answer", "distractor", "distractor", "distractor"],  // ONLY for multiple_choice; omit for open
      "correctIndex": 0,  // ONLY for multiple_choice; omit for open
      "answer": "..."
    }
  ]
}`;

// Simple in-memory rate limit per IP (resets on worker cold start; good enough for MVP)
const rateLimits = new Map();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

async function hashContent(text, settings) {
  // Include settings in the cache key so different settings produce different cached results
  const buf = new TextEncoder().encode(`${settings.format}|${settings.count}|${text}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Validate and normalize settings from client. Don't trust the client.
const ALLOWED_FORMATS = ["open", "multiple_choice", "mix"];
const ALLOWED_COUNTS = [3, 5, 7];
const DEFAULT_SETTINGS = { format: "mix", count: 5 };

function normalizeSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === "object") {
    if (ALLOWED_FORMATS.includes(raw.format)) settings.format = raw.format;
    if (ALLOWED_COUNTS.includes(raw.count)) settings.count = raw.count;
  }
  return settings;
}

// Fisher-Yates shuffle for MC options. Updates correctIndex to track the right answer.
function shuffleMultipleChoice(question) {
  if (question.format !== "multiple_choice" || !Array.isArray(question.options)) {
    return question;
  }
  const correctText = question.options[question.correctIndex];
  const shuffled = [...question.options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    ...question,
    options: shuffled,
    correctIndex: shuffled.indexOf(correctText),
  };
}

async function generateQuestions(content, settings, apiKey) {
  const trimmed = content.length > 12000 ? content.slice(0, 12000) : content;

  const userMessage = `Generate ${settings.count} study questions in "${settings.format}" format for the following content:\n\n${trimmed}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Model returned no questions");
  }

  // Shuffle MC options server-side so correct answers are uniformly distributed
  return parsed.questions.map(shuffleMultipleChoice);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(ip)) {
      return jsonResponse({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const content = (payload.content || "").trim();
    if (content.length < 100) {
      return jsonResponse(
        { error: "Content too short. Select more text or try a different page." },
        400,
      );
    }

    const settings = normalizeSettings(payload.settings);

    try {
      const cacheKey = `q:${await hashContent(content, settings)}`;
      if (env.LEARNLY_CACHE) {
        const cached = await env.LEARNLY_CACHE.get(cacheKey);
        if (cached) {
          return jsonResponse({ questions: JSON.parse(cached), cached: true });
        }
      }

      const questions = await generateQuestions(content, settings, env.ANTHROPIC_API_KEY);

      if (env.LEARNLY_CACHE) {
        await env.LEARNLY_CACHE.put(cacheKey, JSON.stringify(questions), {
          expirationTtl: 60 * 60 * 24 * 7,
        });
      }

      return jsonResponse({ questions, cached: false });
    } catch (err) {
      console.error("generateQuestions failed:", err);
      return jsonResponse({ error: "Failed to generate questions" }, 500);
    }
  },
};