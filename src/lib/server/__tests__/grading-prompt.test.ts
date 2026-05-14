/**
 * Unit tests for `buildGradingPrompt`.
 *
 * The prompt builder is shared between the non-streaming `gradeRoleplaySession`
 * server fn (generateObject) and the streaming `/api/roleplay/:sessionId/grade
 * -stream` route (streamObject). Both paths must score the same transcript the
 * same way, so the builder must be:
 *
 *   1. Deterministic for identical inputs (no Date.now, no Math.random).
 *   2. Inclusive of all scenario context the grader needs (success criteria,
 *      must-use vocab/grammar, CEFR difficulty, NPC name).
 *   3. Resilient to null/empty fields from D1 (mustUseVocab can be null).
 */
import { describe, it, expect } from "vitest";
import { buildGradingPrompt } from "../roleplay";

const baseScenario = {
  titleNl: "Bij de bakker",
  titleEn: "At the bakery",
  npcName: "Marieke",
  npcPersona: "A friendly baker in Utrecht",
  difficulty: "A2",
  mustUseVocab: ["brood", "stuk", "alstublieft"],
  mustUseGrammar: ["modaal werkwoord 'willen'"],
  successCriteria: ["bestel een brood", "vraag de prijs"],
};

const sampleTranscript = [
  { role: "user" as const, content: "Goedemorgen, ik wil een brood", ts: "t1" },
  { role: "assistant" as const, content: "Welk soort brood?", ts: "t2" },
  { role: "user" as const, content: "Volkoren alstublieft", ts: "t3" },
];

describe("buildGradingPrompt", () => {
  it("emits a system + user prompt pair", () => {
    const { system, prompt } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    expect(typeof system).toBe("string");
    expect(typeof prompt).toBe("string");
    expect(system.length).toBeGreaterThan(50);
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("includes CEFR difficulty and success criteria in the system prompt", () => {
    const { system } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    expect(system).toContain("A2");
    expect(system).toContain("bestel een brood");
    expect(system).toContain("vraag de prijs");
  });

  it("includes scenario title, NPC name, vocab and grammar in the user prompt", () => {
    const { prompt } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    expect(prompt).toContain("Bij de bakker");
    expect(prompt).toContain("At the bakery");
    expect(prompt).toContain("Marieke");
    expect(prompt).toContain("brood, stuk, alstublieft");
    expect(prompt).toContain("modaal werkwoord 'willen'");
  });

  it("formats the transcript with role labels (Learner / NPC name)", () => {
    const { prompt } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    expect(prompt).toContain("Learner: Goedemorgen, ik wil een brood");
    expect(prompt).toContain("Marieke: Welk soort brood?");
    expect(prompt).toContain("Learner: Volkoren alstublieft");
  });

  it("strips system entries from the transcript (only user + assistant lines)", () => {
    const transcriptWithSystem = [
      { role: "system" as const, content: "internal note", ts: "t0" },
      ...sampleTranscript,
    ];
    const { prompt } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: transcriptWithSystem,
    });
    expect(prompt).not.toContain("internal note");
    expect(prompt).toContain("Learner: Goedemorgen");
  });

  it("falls back to '(none)' when vocab and grammar arrays are empty", () => {
    const { prompt } = buildGradingPrompt({
      scenario: {
        ...baseScenario,
        mustUseVocab: [],
        mustUseGrammar: [],
      },
      transcript: sampleTranscript,
    });
    expect(prompt).toContain("Must-use vocab: (none)");
    expect(prompt).toContain("Must-use grammar: (none)");
  });

  it("handles null vocab / grammar / criteria from D1 without crashing", () => {
    const { system, prompt } = buildGradingPrompt({
      scenario: {
        ...baseScenario,
        mustUseVocab: null,
        mustUseGrammar: null,
        successCriteria: null,
      },
      transcript: sampleTranscript,
    });
    expect(prompt).toContain("Must-use vocab: (none)");
    expect(prompt).toContain("Must-use grammar: (none)");
    expect(system).toContain("complete a natural conversation");
  });

  it("is deterministic: identical inputs produce identical output", () => {
    const a = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    const b = buildGradingPrompt({
      scenario: baseScenario,
      transcript: sampleTranscript,
    });
    expect(a.system).toBe(b.system);
    expect(a.prompt).toBe(b.prompt);
  });

  it("handles an empty transcript without throwing", () => {
    const { prompt } = buildGradingPrompt({
      scenario: baseScenario,
      transcript: [],
    });
    // Transcript block present but empty between the header and the Grade line.
    expect(prompt).toMatch(/Transcript:\n\s*\nGrade /);
  });
});
