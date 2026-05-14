/**
 * Unit tests for the roleplay system-prompt builder.
 *
 * Two properties matter:
 *
 *   1. The output shape is `SystemModelMessage[]` with cacheControl set on
 *      the static block. This is what makes Anthropic prompt caching kick in.
 *
 *   2. Same scenario inputs produce byte-identical prompt text across calls.
 *      The Anthropic cache key is the prefix bytes, so any drift here would
 *      silently destroy the cache hit rate.
 */
import { describe, it, expect } from "vitest";
import {
  buildRoleplaySystem,
  buildRoleplaySystemPromptText,
} from "../roleplay-system-prompt";
import type { RoleplayScenarioForPrompt } from "../roleplay-system-prompt";

const sampleScenario: RoleplayScenarioForPrompt = {
  npcName: "Marieke",
  npcPersona: "A friendly baker in Utrecht who loves small-talk.",
  titleNl: "Bij de bakker",
  openingNl: "Goedemorgen! Wat wil je vandaag?",
  mustUseVocab: ["brood", "stuk", "alstublieft"],
  mustUseGrammar: ["modaal werkwoord 'willen'"],
  successCriteria: ["bestel een brood", "vraag de prijs"],
  difficulty: "A2",
};

describe("buildRoleplaySystem", () => {
  it("returns exactly one SystemModelMessage with role=system", () => {
    const messages = buildRoleplaySystem(sampleScenario);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("system");
    expect(typeof messages[0].content).toBe("string");
    expect(messages[0].content.length).toBeGreaterThan(100);
  });

  it("attaches Anthropic ephemeral cacheControl on the system block", () => {
    const messages = buildRoleplaySystem(sampleScenario);
    expect(messages[0].providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("includes the NPC name, persona, and scenario title in the prompt body", () => {
    const messages = buildRoleplaySystem(sampleScenario);
    const text = messages[0].content;
    expect(text).toContain("Marieke");
    expect(text).toContain("friendly baker in Utrecht");
    expect(text).toContain("Bij de bakker");
    expect(text).toContain("A2");
  });

  it("produces byte-identical text for identical inputs (cache key stability)", () => {
    // The Anthropic prompt cache keys on the prefix bytes of the request.
    // Any nondeterminism in the builder (e.g. a stray timestamp, Date.now,
    // Math.random) would silently destroy the cache hit rate from turn 2.
    const a = buildRoleplaySystemPromptText(sampleScenario);
    const b = buildRoleplaySystemPromptText(sampleScenario);
    expect(a).toBe(b);
  });

  it("includes must-use vocab and grammar lines when provided", () => {
    const text = buildRoleplaySystemPromptText(sampleScenario);
    expect(text).toContain("brood, stuk, alstublieft");
    expect(text).toContain("modaal werkwoord 'willen'");
  });

  it("omits the must-use lines when the arrays are empty", () => {
    const text = buildRoleplaySystemPromptText({
      ...sampleScenario,
      mustUseVocab: [],
      mustUseGrammar: [],
    });
    expect(text).not.toContain("organically draw the user toward using");
    expect(text).not.toContain("Encourage natural use of grammar");
  });

  it("falls back to a default success line when successCriteria is empty", () => {
    const text = buildRoleplaySystemPromptText({
      ...sampleScenario,
      successCriteria: [],
    });
    expect(text).toContain("a natural conversation");
  });
});
