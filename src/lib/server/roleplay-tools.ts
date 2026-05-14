/**
 * In-chat tools wired into the roleplay `streamText` call (US-AI-SDK-4).
 *
 * Two tools, two very different UX shapes:
 *
 *   1. `lookupVocab(word)`: user-triggered, surfaced in the chat UI.
 *      The client renders a clickable hint for each Dutch word in an AI
 *      message; clicking it sends a `tool_call` for `lookupVocab` so the
 *      model can narrate the definition. The tool's `execute` reads from
 *      the `vocab` table, returning the canonical translation + example.
 *      If the word is not in the deck, returns `{ found: false }` so the
 *      model can fall back to a generic explanation.
 *
 *   2. `flagSuspectedError(category, incorrect, correction, explanation)`:
 *      model-initiated, silent. Claude calls this mid-conversation when it
 *      spots a learner mistake but does not want to break immersion. The
 *      tool persists a `roleplay_errors` row keyed on the current session +
 *      user. The tool_call / tool_result are NOT rendered in the chat UI;
 *      the scorecard surfaces them after the session ends.
 *
 * Both tools are constructed via a factory so the per-request `db`, `userId`,
 * and `sessionId` close over the execute body without leaking into the
 * tool's input schema (which the model sees).
 *
 * Test surface: each tool's `execute` is exercised directly in
 * `__tests__/roleplay-tools.integration.test.ts` against the in-memory D1
 * harness, the bit that actually reads/writes rows.
 */
import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DB } from "../../db/client";
import { vocab, roleplayErrors } from "../../db/schema";
import { log } from "../logger";

export type RoleplayToolDeps = {
  drz: DB;
  userId: number;
  sessionId: number | null;
};

export type LookupVocabResult =
  | {
      found: true;
      nl: string;
      en: string;
      exampleSentenceNl: string | null;
      exampleSentenceEn: string | null;
      cefrLevel: string;
    }
  | { found: false; word: string };

export type FlagSuspectedErrorResult =
  | { recorded: true; errorId: number }
  | { recorded: false; reason: "no_session" | "empty_input" };

/**
 * Pure-function execute body for `lookupVocab`. Exposed for direct tests
 * without spinning up the tool harness.
 *
 * Strategy: exact-match on `nl` first (the indexed column); fall back to
 * lower-cased equality. Returns at most one row, the first match.
 */
export async function executeLookupVocab(
  deps: Pick<RoleplayToolDeps, "drz">,
  word: string,
): Promise<LookupVocabResult> {
  const trimmed = word.trim();
  if (!trimmed) return { found: false, word };

  const rows = await deps.drz
    .select()
    .from(vocab)
    .where(eq(vocab.nl, trimmed))
    .limit(1);

  // Fallback: lowercase exact-match. Dutch nouns can come back capitalised
  // mid-sentence; the seed stores them lower-case.
  let row = rows[0];
  if (!row && trimmed !== trimmed.toLowerCase()) {
    const lower = await deps.drz
      .select()
      .from(vocab)
      .where(eq(vocab.nl, trimmed.toLowerCase()))
      .limit(1);
    row = lower[0];
  }

  if (!row) return { found: false, word: trimmed };

  return {
    found: true,
    nl: row.nl,
    en: row.en,
    exampleSentenceNl: row.exampleSentenceNl,
    exampleSentenceEn: row.exampleSentenceEn,
    cefrLevel: row.cefrLevel,
  };
}

/**
 * Pure-function execute body for `flagSuspectedError`. Inserts a
 * `roleplay_errors` row if a session is in flight, otherwise no-ops with
 * a `reason` so the model knows why nothing got recorded.
 */
export async function executeFlagSuspectedError(
  deps: RoleplayToolDeps,
  args: {
    category: "grammar" | "vocab" | "spelling" | "register";
    incorrect: string;
    correction: string;
    explanationEn?: string;
  },
): Promise<FlagSuspectedErrorResult> {
  if (deps.sessionId == null) {
    return { recorded: false, reason: "no_session" };
  }
  if (!args.incorrect.trim() || !args.correction.trim()) {
    return { recorded: false, reason: "empty_input" };
  }

  const inserted = await deps.drz
    .insert(roleplayErrors)
    .values({
      sessionId: deps.sessionId,
      userId: deps.userId,
      category: args.category,
      incorrect: args.incorrect.trim(),
      correction: args.correction.trim(),
      explanationEn: args.explanationEn?.trim() ?? null,
    })
    .returning({ id: roleplayErrors.id });

  log.info("roleplay tool flagSuspectedError", {
    sessionId: deps.sessionId,
    userId: deps.userId,
    category: args.category,
    errorId: inserted[0].id,
  });

  return { recorded: true, errorId: inserted[0].id };
}

/**
 * Build the tools bag passed to `streamText`. The model sees the input
 * schemas (Zod) and descriptions; the dependency closure stays server-side.
 */
export function buildRoleplayTools(deps: RoleplayToolDeps) {
  return {
    lookupVocab: tool({
      description:
        "Look up the canonical English translation and an example sentence for a Dutch word from the learner's vocab deck. Use this when the learner asks what a word means, or when you want to gloss a word you just used.",
      inputSchema: z.object({
        word: z
          .string()
          .min(1)
          .describe("The Dutch word to look up. Lower-cased, no punctuation."),
      }),
      execute: async ({ word }) => executeLookupVocab(deps, word),
    }),
    flagSuspectedError: tool({
      description:
        "Silently record a learner error you noticed mid-conversation. Do NOT acknowledge the error in your reply, stay in character. The error is surfaced on the post-session scorecard. Call this at most once per learner turn.",
      inputSchema: z.object({
        category: z
          .enum(["grammar", "vocab", "spelling", "register"])
          .describe("What kind of mistake this is."),
        incorrect: z
          .string()
          .min(1)
          .describe("The exact incorrect Dutch phrase the learner wrote."),
        correction: z
          .string()
          .min(1)
          .describe("The corrected Dutch phrase."),
        explanationEn: z
          .string()
          .optional()
          .describe("Short English note (one sentence) on why it is wrong."),
      }),
      execute: async (args) => executeFlagSuspectedError(deps, args),
    }),
  };
}
