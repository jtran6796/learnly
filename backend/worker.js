// Learnly backend - Cloudflare Worker
// Takes scraped page content, returns 5 mixed questions from Claude Haiku 4.5
//
// Setup:
//   npm install -g wrangler
//   wrangler login
//   wrangler secret put ANTHROPIC_API_KEY
//   wrangler deploy

const SYSTEM_PROMPT = `You are Learnly, a study assistant that helps students engage deeply with what they read.

Given an article or passage, generate exactly 5 questions that test understanding:
- 2 RECALL questions (test memory of key facts/concepts directly from the text)
- 2 FLASHCARD questions (concise term/definition or concept/explanation pairs, useful for active recall)
- 1 SOCRATIC question (open-ended, prompts critical thinking, no single right answer)

Each question must include the answer the student should arrive at.

Rules:
- Questions must be answerable from the text (except Socratic, which extends from it).
- Avoid trivia. Focus on important ideas, mechanisms, relationships.
- Keep questions clear and one sentence where possible.
- Do not number the questions; the JSON structure handles ordering.

Respond ONLY with a JSON object in this exact shape, no preamble, no markdown fences:

{
  "questions": [
    { "type": "recall", "question": "...", "answer": "..." },
    { "type": "recall", "question": "...", "answer": "..." },
    { "type": "flashcard", "question": "...", "answer": "..." },
    { "type": "flashcard", "question": "...", "answer": "..." },
    { "type": "socratic", "question": "...", "answer": "..." }
  ]
}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your extension origin in production
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function generateQuestions(content, apiKey) {
  // Truncate very long content to keep token costs predictable
  const trimmed = content.length > 12000 ? content.slice(0, 12000) : content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate 5 study questions for this content:\n\n${trimmed}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  // Strip any accidental code fences just in case
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Model returned no questions");
  }
  return parsed.questions;
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

    try {
      const questions = await generateQuestions(content, env.ANTHROPIC_API_KEY);
      return jsonResponse({ questions, cached: false });
    } catch (err) {
      console.error("generateQuestions failed:", err);
      return jsonResponse({ error: "Failed to generate questions" }, 500);
    }
  },
};
