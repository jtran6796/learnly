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

async function generateQuestions(content, apiKey) {
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
        { role: "user", content: `Generate 5 study questions for this content:\n\n${trimmed}` },
      ],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.questions;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const payload = await request.json();
    const questions = await generateQuestions(payload.content, env.ANTHROPIC_API_KEY);
    return new Response(JSON.stringify({ questions }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};