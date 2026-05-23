// Learnly backend - Cloudflare Worker

const ARTICLE_SYSTEM_PROMPT = `You are Learnly, a study assistant that helps students engage deeply with what they read.

Given an article or passage, generate study questions that test understanding. The user will specify:
- count: total number of questions (3, 5, or 7)
- format: "open" (open-ended), "multiple_choice", or "mix" (both formats)

Question TYPES:
- RECALL: tests memory of key facts/concepts directly from the text
- FLASHCARD: concise term/definition or concept/explanation pairs, useful for active recall
- SOCRATIC: open-ended, prompts critical thinking, no single right answer

Distribute questions based on format:
- "open" → ~40% recall, ~40% flashcard, ~20% socratic. For 5: 2 recall, 2 flashcard, 1 socratic. For 3: 1/1/1. For 7: 3/3/1.
- "mix" → same distribution as "open" (recall and flashcard get a mix of MC and open formats, socratic stays open).
- "multiple_choice" → 50/50 recall and flashcard, NO socratic. For 5: 3/2 or 2/3. For 3: 2/1. For 7: 4/3.

FORMAT rules:
- "open" → all questions are open-ended.
- "multiple_choice" → recall and flashcard questions are MC. Socratic stays open-ended.
- "mix" → roughly half MC and half open, distributed across types. Socratic always open-ended.

For MULTIPLE CHOICE questions:
- Provide exactly 4 options.
- Always place the correct answer at index 0. The server will shuffle positions.
- Distractors must be plausible: common misconceptions, related concepts, or near-misses.
- The "answer" field should explain why the correct option is right (1-2 sentences).

For OPEN-ENDED questions:
- "answer" is the answer the student should arrive at.

CONCEPT LABELS (every question requires one):
- Each question must include a "concept" field: a short label (2-6 words) naming the underlying idea being tested.
- Be consistent: the same underlying concept should always get the same label, even across batches.
- Granularity: specific enough to be useful for coverage tracking, general enough that related questions share a label.
  - Good: "Principle of least privilege", "TCP three-way handshake", "Mitochondrial function"
  - Too granular: "Least privilege definition", "Least privilege example", "Least privilege failures"
  - Too broad: "Security", "Networking", "Cell biology"
- Use Title Case for concept labels.

TOPIC COVERAGE (at the response level):
Include a top-level "topicCoverage" field with value "ongoing" or "well_covered":
- "ongoing": more important concepts remain to explore for this topic.
- "well_covered": you have surveyed the major concepts; further questions would mostly cover edge cases, secondary details, or review.
For an initial generation (no previously-seen concepts), this will almost always be "ongoing".

General rules:
- Questions must be answerable from the text (except Socratic, which extends from it).
- Avoid trivia. Focus on important ideas, mechanisms, relationships.
- Keep questions clear and one sentence where possible.

Respond ONLY with a JSON object, no preamble, no markdown fences:

{
  "topicCoverage": "ongoing" | "well_covered",
  "questions": [
    {
      "type": "recall" | "flashcard" | "socratic",
      "format": "open" | "multiple_choice",
      "concept": "Short concept label",
      "question": "...",
      "options": ["correct", "distractor", "distractor", "distractor"],
      "correctIndex": 0,
      "answer": "..."
    }
  ]
}`;

const TOPIC_SYSTEM_PROMPT = `You are Learnly, a study assistant. The user is studying a topic, typically from an educational video or course. Generate study questions covering the standard body of knowledge for this topic, drawing from your own knowledge of the subject.

When context is provided (course name, instructor, certification), calibrate the difficulty and style accordingly. CompTIA Security+ gets exam-level questions. An intro biology video gets undergrad-level questions. A popular-educator overview gets accessible questions.

For each topic, cover:
- Core definitions and key terminology
- Important concepts students commonly misunderstand
- Relationships to closely related ideas
- Practical applications where relevant

The user will specify:
- count: total number of questions (3, 5, or 7)
- format: "open" (open-ended), "multiple_choice", or "mix"

Question TYPES:
- RECALL: tests memory of key facts/definitions
- FLASHCARD: concise term/definition pairs for active recall
- SOCRATIC: open-ended, prompts critical thinking

Distribution and format rules are identical to article mode:
- "open" → 40% recall, 40% flashcard, 20% socratic
- "mix" → same distribution, mixed formats. Socratic stays open.
- "multiple_choice" → 50/50 recall/flashcard, NO socratic.

For MULTIPLE CHOICE:
- Exactly 4 options.
- Correct answer at index 0 (server shuffles).
- Plausible distractors: common misconceptions, related concepts.
- "answer" field explains why the correct option is right.

For OPEN-ENDED:
- "answer" is the answer the student should arrive at.

CONCEPT LABELS (every question requires one):
- Each question must include a "concept" field: a short label (2-6 words) naming the underlying idea being tested.
- Be consistent across batches: the same underlying concept gets the same label every time.
- Granularity: specific enough to track coverage, general enough that related questions share a label.
  - Good: "Zero Trust Architecture", "Adaptive Identity", "Policy Enforcement Points"
  - Too granular: "PEP definition", "PEP placement diagram"
  - Too broad: "Security", "Cybersecurity"
- Use Title Case.

TOPIC COVERAGE (at the response level):
Include a top-level "topicCoverage" field:
- "ongoing": more important concepts about this topic remain to explore.
- "well_covered": major concepts surveyed; further questions would be edge cases or review.
For an initial generation, this is almost always "ongoing".

Respond ONLY with JSON, no preamble or markdown fences:

{
  "topicCoverage": "ongoing" | "well_covered",
  "questions": [
    {
      "type": "recall" | "flashcard" | "socratic",
      "format": "open" | "multiple_choice",
      "concept": "Short concept label",
      "question": "...",
      "options": ["correct", "distractor", "distractor", "distractor"],
      "correctIndex": 0,
      "answer": "..."
    }
  ]
}`;

// Rate limiting
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

async function hashKey(input) {
  const buf = new TextEncoder().encode(input);
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

const ALLOWED_FORMATS = ["open", "multiple_choice", "mix"];
const ALLOWED_COUNTS = [3, 5, 7];
const ALLOWED_MODES = ["article", "topic"];
const DEFAULT_SETTINGS = { format: "mix", count: 5, scenarioMode: false };

function normalizeSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === "object") {
    if (ALLOWED_FORMATS.includes(raw.format)) settings.format = raw.format;
    if (ALLOWED_COUNTS.includes(raw.count)) settings.count = raw.count;
    if (typeof raw.scenarioMode === "boolean")
      settings.scenarioMode = raw.scenarioMode;
  }
  return settings;
}

function shuffleMultipleChoice(question) {
  if (
    question.format !== "multiple_choice" ||
    !Array.isArray(question.options)
  ) {
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

async function generateQuestions({
  mode,
  content,
  topic,
  context,
  settings,
  apiKey,
}) {
  let systemPrompt;
  let userMessage;
  const scenarioLine = settings.scenarioMode
    ? "\nUse scenario-based questions (realistic situations) where appropriate."
    : "";

  if (mode === "topic") {
    systemPrompt = TOPIC_SYSTEM_PROMPT;
    const contextLine = context ? `\nContext: ${context}` : "";
    userMessage = `Generate ${settings.count} study questions in "${settings.format}" format on this topic:${scenarioLine}\n\nTopic: ${topic}${contextLine}`;
  } else {
    systemPrompt = ARTICLE_SYSTEM_PROMPT;
    const trimmed = content.length > 12000 ? content.slice(0, 12000) : content;
    userMessage = `Generate ${settings.count} study questions in "${settings.format}" format for the following content:${scenarioLine}\n\n${trimmed}`;
  }

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
      system: systemPrompt,
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
  const topicCoverage =
    parsed.topicCoverage === "well_covered" ? "well_covered" : "ongoing";
  return {
    questions: parsed.questions.map(shuffleMultipleChoice),
    topicCoverage,
  };
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
      return jsonResponse(
        { error: "Rate limit exceeded. Try again later." },
        429,
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const mode = ALLOWED_MODES.includes(payload.mode)
      ? payload.mode
      : "article";
    const settings = normalizeSettings(payload.settings);

    let cacheKey;
    if (mode === "topic") {
      const topic = (payload.topic || "").trim();
      const context = (payload.context || "").trim();
      if (topic.length < 3) {
        return jsonResponse({ error: "Topic is too short or missing." }, 400);
      }
      cacheKey = `q:topic:v2:${await hashKey(`${topic}|${context}|${settings.format}|${settings.count}`)}`;
      try {
        if (env.LEARNLY_CACHE) {
          const cached = await env.LEARNLY_CACHE.get(cacheKey);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            return jsonResponse({ ...parsedCache, cached: true });
          }
        }
        const result = await generateQuestions({
          mode,
          topic,
          context,
          settings,
          apiKey: env.ANTHROPIC_API_KEY,
        });
        if (env.LEARNLY_CACHE) {
          await env.LEARNLY_CACHE.put(cacheKey, JSON.stringify(result), {
            expirationTtl: 60 * 60 * 24 * 7,
          });
        }
        return jsonResponse({ ...result, cached: false });
      } catch (err) {
        console.error("topic generation failed:", err);
        return jsonResponse({ error: "Failed to generate questions" }, 500);
      }
    } else {
      const content = (payload.content || "").trim();
      if (content.length < 100) {
        return jsonResponse(
          {
            error:
              "Content too short. Select more text or try a different page.",
          },
          400,
        );
      }
      cacheKey = `q:article:v2:${await hashKey(`${settings.format}|${settings.count}|${content}`)}`;

      try {
        if (env.LEARNLY_CACHE) {
          const cached = await env.LEARNLY_CACHE.get(cacheKey);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            return jsonResponse({ ...parsedCache, cached: true });
          }
        }
        const result = await generateQuestions({
          mode,
          content,
          settings,
          apiKey: env.ANTHROPIC_API_KEY,
        });
        if (env.LEARNLY_CACHE) {
          await env.LEARNLY_CACHE.put(cacheKey, JSON.stringify(result), {
            expirationTtl: 60 * 60 * 24 * 7,
          });
        }
        return jsonResponse({ ...result, cached: false });
      } catch (err) {
        console.error("article generation failed:", err);
        return jsonResponse({ error: "Failed to generate questions" }, 500);
      }
    }
  },
};

// Exports for testing
export { normalizeSettings, shuffleMultipleChoice, checkRateLimit, hashKey };

// Test helper: clear in-memory rate limit state between tests.
export function _resetRateLimits() {
  rateLimits.clear();
}
