/**
 * Builder for the roleplay NPC system prompt, returned as a shape ready to pass
 * straight into `streamText({ system })`.
 *
 * Why an array of SystemModelMessage and not a plain string:
 *
 *   The system prompt is large (persona + scenario brief + rules + success
 *   criteria + must-use vocab/grammar lists) and identical across every turn
 *   of one scenario. Re-sending it on every user turn burns input tokens.
 *
 *   Anthropic prompt caching solves this. By attaching
 *   `providerOptions.anthropic.cacheControl = { type: 'ephemeral' }` to the
 *   system block, the Anthropic API stores the tokens for a few minutes and
 *   bills cache reads at ~10% of normal input cost on subsequent turns.
 *
 *   The AI SDK only forwards `providerOptions` when the `system` field is
 *   given as `SystemModelMessage[]` (i.e. role/content/providerOptions),
 *   never as a bare string. That is the only reason this helper exists —
 *   it returns the array shape rather than a string.
 *
 * Cache key correctness:
 *
 *   The cache key is the byte-equal prefix of the input. As long as the
 *   system message bytes are identical turn-to-turn, the cache hits. All
 *   per-turn variation lives in the user `messages` array, which is sent
 *   AFTER the cached system block. That ordering is what makes the cache
 *   hit on every turn from turn 2 onward.
 */
import type { SystemModelMessage } from "ai";

export type RoleplayScenarioForPrompt = {
  npcName: string;
  npcPersona: string;
  titleNl: string;
  openingNl: string;
  mustUseVocab: string[];
  mustUseGrammar: string[];
  successCriteria: string[];
  difficulty: string;
};

/**
 * Build the static persona/scenario text block. Pure — same inputs always
 * produce the same bytes, which is the precondition for the Anthropic cache
 * key to hit across turns.
 */
export function buildRoleplaySystemPromptText(s: RoleplayScenarioForPrompt): string {
  const successLine = s.successCriteria.length > 0
    ? s.successCriteria.join("; ")
    : "a natural conversation";
  const vocabLine = s.mustUseVocab.length > 0
    ? `Try to organically draw the user toward using: ${s.mustUseVocab.join(", ")}.`
    : "";
  const grammarLine = s.mustUseGrammar.length > 0
    ? `Encourage natural use of grammar: ${s.mustUseGrammar.join(", ")}.`
    : "";

  return `You are ${s.npcName}. ${s.npcPersona}

You are roleplaying with a Dutch language learner at CEFR level ${s.difficulty}.
Scenario: ${s.titleNl}
Your opening line was: "${s.openingNl}"

RULES, non-negotiable:
- Reply ONLY in Dutch. Never switch to English, even if the user does.
- Stay in character as ${s.npcName} at all times.
- Keep replies short (1 to 3 sentences). This is a spoken-style conversation, not an essay.
- Speak naturally at CEFR ${s.difficulty} level, simple sentence structures, common vocab. No idioms or advanced register unless the learner uses them first.
- Do NOT correct the user's Dutch. Do NOT explain grammar. Just respond as the character would.
- If the user types in English or asks for help in English, gently nudge back to Dutch in character (e.g. "Sorry, ik begrijp het niet helemaal. Kun je het in het Nederlands proberen?").
- If the user types "klaar", "done", or "einde", the conversation will end on the next turn, give a brief, in-character farewell.

Scenario success looks like the user achieving: ${successLine}.
${vocabLine}
${grammarLine}

Begin the conversation in your role. The user will reply.`;
}

/**
 * Build the system field for `streamText`. Returns a single cached system
 * message; pass it straight as `system: buildRoleplaySystem(...)`.
 *
 * The whole prompt is static per scenario, so we cache the whole block.
 * If we ever interleave per-turn dynamic context (e.g. last-turn correction
 * hint), put the dynamic part in a SECOND, non-cached SystemModelMessage
 * appended after this one, so the cache prefix stays intact.
 */
export function buildRoleplaySystem(
  s: RoleplayScenarioForPrompt,
): SystemModelMessage[] {
  return [
    {
      role: "system",
      content: buildRoleplaySystemPromptText(s),
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
  ];
}
