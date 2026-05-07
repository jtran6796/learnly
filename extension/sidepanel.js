import { BACKEND_URL } from "./lib/config.js";

const $ = (id) => document.getElementById(id);
const generateBtn = $("generate-btn");
const statusEl = $("status");
const metaEl = $("meta");
const metaMode = $("meta-mode");
const metaTitle = $("meta-title");
const questionsEl = $("questions");

function setStatus(text, isError = false) {
  if (!text) {
    statusEl.classList.add("hidden");
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
  statusEl.classList.toggle("error", isError);
}

function setMeta(mode, title) {
  metaMode.textContent =
    mode === "selection" ? "From your selection" : "From the article";
  metaTitle.textContent = title;
  metaEl.classList.remove("hidden");
}

function clearOutput() {
  questionsEl.innerHTML = "";
  metaEl.classList.add("hidden");
  setStatus("");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromTab(tabId) {
  // Inject Readability first, then the extractor.
  // chrome.scripting.executeScript runs files in order and returns
  // the result of the last one.
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/readability.js", "lib/extract.js"],
  });
  return results?.[0]?.result;
}

async function generateQuestions(content) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend returned ${res.status}`);
  }
  return res.json();
}

function renderQuestions(questions) {
  questionsEl.innerHTML = "";
  questions.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "question-card";

    const type = document.createElement("span");
    type.className = `question-type ${q.type}`;
    type.textContent = q.type;
    card.appendChild(type);

    const qText = document.createElement("p");
    qText.className = "question-text";
    qText.textContent = q.question;
    card.appendChild(qText);

    const revealBtn = document.createElement("button");
    revealBtn.className = "reveal-btn";
    revealBtn.textContent = "Show answer";
    card.appendChild(revealBtn);

    const answer = document.createElement("div");
    answer.className = "answer hidden";
    answer.textContent = q.answer;
    card.appendChild(answer);

    revealBtn.addEventListener("click", () => {
      const hidden = answer.classList.toggle("hidden");
      revealBtn.textContent = hidden ? "Show answer" : "Hide answer";
    });

    // Feedback row (visual only for MVP - no persistence)
    const feedback = document.createElement("div");
    feedback.className = "feedback-row";
    ["Got it", "Review again"].forEach((label) => {
      const b = document.createElement("button");
      b.className = "feedback-btn";
      b.textContent = label;
      b.addEventListener("click", () => {
        feedback
          .querySelectorAll(".feedback-btn")
          .forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
      });
      feedback.appendChild(b);
    });
    card.appendChild(feedback);

    questionsEl.appendChild(card);
  });
}

generateBtn.addEventListener("click", async () => {
  clearOutput();
  generateBtn.disabled = true;
  setStatus("Reading the page…");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || tab.url?.startsWith("chrome://")) {
      throw new Error("Can't run on this page. Try a regular website.");
    }

    const extracted = await extractFromTab(tab.id);
    if (!extracted || extracted.mode === "error") {
      throw new Error(extracted?.error || "Extraction failed.");
    }

    setMeta(extracted.mode, extracted.title);
    setStatus("Generating questions…");

    const { questions, cached } = await generateQuestions(extracted.content);
    renderQuestions(questions);
    setStatus(cached ? "Loaded from cache." : "");
    setTimeout(() => setStatus(""), 2000);
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong.", true);
  } finally {
    generateBtn.disabled = false;
  }
});
