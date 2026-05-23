import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSettings,
  shuffleMultipleChoice,
  checkRateLimit,
  hashKey,
  _resetRateLimits,
} from "./worker.js";

describe("normalizeSettings", () => {
  it("returns defaults when input is missing or invalid", () => {
    const defaults = { format: "mix", count: 5, scenarioMode: false };
    expect(normalizeSettings(undefined)).toEqual(defaults);
    expect(normalizeSettings(null)).toEqual(defaults);
    expect(normalizeSettings({})).toEqual(defaults);
    expect(normalizeSettings("not an object")).toEqual(defaults);
  });

  it("accepts all valid formats", () => {
    expect(normalizeSettings({ format: "open", count: 5, scenarioMode: false }).format).toBe("open");
    expect(
      normalizeSettings({ format: "multiple_choice", count: 5, scenarioMode: false }).format,
    ).toBe("multiple_choice");
    expect(normalizeSettings({ format: "mix", count: 5, scenarioMode: false }).format).toBe("mix");
  });

  it("accepts all valid counts", () => {
    expect(normalizeSettings({ format: "open", count: 3, scenarioMode: false }).count).toBe(3);
    expect(normalizeSettings({ format: "open", count: 5, scenarioMode: false }).count).toBe(5);
    expect(normalizeSettings({ format: "open", count: 7, scenarioMode: false }).count).toBe(7);
  });

  it("rejects invalid format and falls back to default", () => {
    expect(normalizeSettings({ format: "banana", count: 5, scenarioMode: false }).format).toBe(
      "mix",
    );
  });

  it("rejects invalid count and falls back to default", () => {
    expect(normalizeSettings({ format: "open", count: 999, scenarioMode: false }).count).toBe(5);
    expect(normalizeSettings({ format: "open", count: -1, scenarioMode: false }).count).toBe(5);
    expect(normalizeSettings({ format: "open", count: "5", scenarioMode: false }).count).toBe(5); // string, not number
  });

  it("normalizes one valid field even if the other is invalid", () => {
    const result = normalizeSettings({ format: "open", count: 999, scenarioMode: false });
    expect(result.format).toBe("open");
    expect(result.count).toBe(5);
    expect(result.scenarioMode).toBe(false);
  });
});

describe("shuffleMultipleChoice", () => {
  it("returns open-format questions unchanged", () => {
    const q = {
      type: "recall",
      format: "open",
      question: "What is X?",
      answer: "Y",
    };
    expect(shuffleMultipleChoice(q)).toEqual(q);
  });

  it("returns the question unchanged if options is not an array", () => {
    const q = { format: "multiple_choice", question: "X", answer: "Y" };
    expect(shuffleMultipleChoice(q)).toEqual(q);
  });

  it("preserves the correct answer after shuffling", () => {
    const q = {
      type: "recall",
      format: "multiple_choice",
      question: "What is X?",
      options: ["correct", "distractor1", "distractor2", "distractor3"],
      correctIndex: 0,
      answer: "explanation",
    };

    // Run many times to guard against random failures
    for (let i = 0; i < 50; i++) {
      const shuffled = shuffleMultipleChoice(q);
      expect(shuffled.options).toHaveLength(4);
      expect(shuffled.options[shuffled.correctIndex]).toBe("correct");
      // All original options still present
      expect(new Set(shuffled.options)).toEqual(new Set(q.options));
    }
  });

  it("actually shuffles positions (correctIndex isn't always 0)", () => {
    const q = {
      format: "multiple_choice",
      options: ["correct", "a", "b", "c"],
      correctIndex: 0,
    };
    const positions = new Set();
    for (let i = 0; i < 200; i++) {
      positions.add(shuffleMultipleChoice(q).correctIndex);
    }
    // With 200 trials over 4 positions, we should see at least 3 different positions
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it("does not mutate the original question", () => {
    const original = {
      format: "multiple_choice",
      options: ["correct", "a", "b", "c"],
      correctIndex: 0,
    };
    const originalOptionsRef = original.options;
    shuffleMultipleChoice(original);
    expect(original.options).toBe(originalOptionsRef); // same reference
    expect(original.options).toEqual(["correct", "a", "b", "c"]); // same contents
    expect(original.correctIndex).toBe(0);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows the first request from a new IP", () => {
    expect(checkRateLimit("1.2.3.4")).toBe(true);
  });

  it("allows up to 100 requests in the same window", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit("1.2.3.4")).toBe(true);
    }
  });

  it("blocks the 101st request", () => {
    for (let i = 0; i < 100; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4")).toBe(false);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 100; i++) checkRateLimit("1.1.1.1");
    expect(checkRateLimit("1.1.1.1")).toBe(false);
    expect(checkRateLimit("2.2.2.2")).toBe(true);
  });

  it("handles the 'unknown' IP fallback", () => {
    expect(checkRateLimit("unknown")).toBe(true);
  });
});

describe("hashKey", () => {
  it("produces deterministic output for the same input", async () => {
    const a = await hashKey("hello world");
    const b = await hashKey("hello world");
    expect(a).toBe(b);
  });

  it("produces different output for different inputs", async () => {
    const a = await hashKey("hello world");
    const b = await hashKey("hello there");
    expect(a).not.toBe(b);
  });

  it("returns a 32-character hex string", async () => {
    const result = await hashKey("anything");
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });

  it("handles empty input", async () => {
    const result = await hashKey("");
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });
  
  it("treats input as raw string (no normalization)", async () => {
    const a = await hashKey("topic|context|open|5");
    const b = await hashKey("topic|context|open|5");
    const c = await hashKey("topic|context|open|7");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
