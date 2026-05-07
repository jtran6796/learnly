import { BACKEND_URL } from "./lib/config.js";
import { getSettings, setSetting, resetSettings, DEFAULTS } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);

// Main UI
const generateBtn = $("generate-btn");
const statusEl = $("status");
const metaEl = $("meta");
const metaMode = $("meta-mode");
const metaTitle = $("meta-title");
const questionsEl = $("questions");

// Settings UI
const settingsToggle = $("settings-toggle");
const settingsPanel = $("settings-panel");
const countSlider = $("count-slider");
const countValue = $("count-value");
const resetBtn = $("reset-settings");

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

// ---------- Settings panel ----------

function applySettingsToUI(settings) {
  // Radio: format
  document.querySelectorAll('input[name="format"]').forEach((el) => {
    el.checked = el.value === settings.format;
  });
  // Slider: count
  countSlider.value = String(settings.count);
  countValue.textContent = String(settings.count);
}

function toggleSettingsPanel() {
  const isOpen = !settingsPanel.classList.contains("hidden");
  if (isOpen) {
    settingsPanel.classList.add("hidden");
    settingsPanel.setAttribute("aria-hidden", "true");
    settingsToggle.setAttribute("aria-expanded", "false");
  } else {
    settingsPanel.classList.remove("hidden");
    settingsPanel.setAttribute("aria-hidden", "false");
    settingsToggle.setAttribute("aria-expanded", "true");
  }
}

settingsToggle.addEventListener("click", toggleSettingsPanel);

// Format radios — auto-save on change
document.querySelectorAll('input[name="format"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (e.target.checked) setSetting("format", e.target.value);
  });
});

// Count slider — update label live, save on change
countSlider.addEventListener("input", (e) => {
  countValue.textContent = e.target.value;
});
countSlider.addEventListener("change", (e) => {
  setSetting("count", Number(e.target.value));
});

// Reset
resetBtn.addEventListener("click", async () => {
  const fresh = await resetSettings();
  applySettingsToUI(fresh);
});

// ---------- Generate flow ----------

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/readability.js", "lib/extract.js"],
  });
  return results?.[0]?.result;
}

async function generateQuestions(content, settings) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, settings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend returned ${res.status}`);
  }
  return res.json();
}

function renderQuestions(questions) {
  questionsEl.innerHTML = "";
  questions.forEach((q) => {
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

    if (q.format === "multiple_choice") {
      renderMultipleChoice(card, q);
    } else {
      renderOpenEnded(card, q);
    }

    // Feedback row (visual only for MVP)
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

function renderOpenEnded(card, q) {
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
}

function renderMultipleChoice(card, q) {
  // q.options: string[], q.correctIndex: number, q.answer: string (explanation)
  const optionsList = document.createElement("div");
  optionsList.className = "mc-options";

  const groupName = `mc-${Math.random().toString(36).slice(2, 9)}`;
  let selectedIndex = null;
  let checked = false;

  q.options.forEach((opt, i) => {
    const optLabel = document.createElement("label");
    optLabel.className = "mc-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupName;
    input.value = String(i);
    input.addEventListener("change", () => {
      selectedIndex = i;
      checkBtn.disabled = false;
    });

    const span = document.createElement("span");
    span.textContent = opt;

    optLabel.appendChild(input);
    optLabel.appendChild(span);
    optionsList.appendChild(optLabel);
  });
  card.appendChild(optionsList);

  const checkBtn = document.createElement("button");
  checkBtn.className = "reveal-btn";
  checkBtn.textContent = "Check";
  checkBtn.disabled = true;
  card.appendChild(checkBtn);

  const result = document.createElement("div");
  result.className = "answer hidden";
  card.appendChild(result);

  checkBtn.addEventListener("click", () => {
    if (checked) return;
    checked = true;
    const correct = selectedIndex === q.correctIndex;

    // Mark options
    optionsList.querySelectorAll(".mc-option").forEach((el, i) => {
      if (i === q.correctIndex) el.classList.add("mc-correct");
      else if (i === selectedIndex) el.classList.add("mc-incorrect");
      el.querySelector("input").disabled = true;
    });

    result.innerHTML = "";
    const verdict = document.createElement("strong");
    verdict.textContent = correct ? "Correct! " : "Not quite. ";
    result.appendChild(verdict);
    result.appendChild(document.createTextNode(q.answer));
    result.classList.remove("hidden");
    checkBtn.disabled = true;
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

    const settings = await getSettings();
    const { questions, cached } = await generateQuestions(extracted.content, settings);
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

// ---------- Init ----------

(async function init() {
  const settings = await getSettings();
  applySettingsToUI(settings);
})();