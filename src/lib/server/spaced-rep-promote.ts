/**
 * Agentic spaced-rep promotion from roleplay performance.
 *
 * After `gradeRoleplaySession` writes the rubric + per-error rows, this
 * module runs a short agentic loop that asks Claude to look at the rubric +
 * transcript and decide which 1-3 *concepts* (vocab patterns or grammar
 * structures) should be promoted (ease + interval bump) or demoted (ease
 * drop, interval reset) in the learner's spaced-rep queue.
 *
 * The model is given a single tool, `promoteOrDemoteSpacedRep`, defined
 * with Zod. We call it via `streamText({ tools, stopWhen: stepCountIs(5) })`
 * so the model can make a sequence of tool calls (typically 1-3, sometimes
 * a no-op) and then return a short text summary.
 *
 * Promotion/demotion arithmetic mirrors the SM-2 rules used elsewhere in
 * `spaced-rep.ts`:
 *
 *   promote (concept landed well in the roleplay)
 *     - ease   += 0.15 (cap at 3.0 so growth flattens)
 *     - interval *= ease, rounded up to nearest day
 *     - repetitions += 1
 *
 *   demote (concept misused or avoided)
 *     - ease   -= 0.2 (floor 1.3)
 *     - interval reset to 1
 *     - repetitions reset to 0
 *
 * The tool writes to the existing `spaced_rep_queue` table with
 * `itemType = "concept"` and `itemKey = conceptSlug` so per-error rows
 * (itemType "roleplay_error") stay separate. The agent is therefore
 * additive over the per-error enqueue path that already runs in
 * `gradeRoleplaySession`; it surfaces higher-level patterns rather than
 * individual mistakes.
 */
import { streamText, stepCountIs, tool, type LanguageModel } from "ai";
import type { DB } from "../../db/client";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { spacedRepQueue } from "../../db/schema";
import { log } from "../logger";

const MAX_EASE = 3.0;
const MIN_EASE = 1.3;

export type PromoteAction = "promote" | "demote";

export type PromoteToolCall = {
  conceptSlug: string;
  action: PromoteAction;
};

export type PromoteFromRoleplayInput = {
  userId: number;
  sessionId: number;
  scenarioSlug: string;
  rubric: {
    grammar: number;
    vocabulary: number;
    taskCompletion: number;
    fluency: number;
    politeness: number;
  };
  feedbackEn: string;
  errors: Array<{
    category: string;
    incorrect: string;
    correction: string;
    explanationEn?: string | null;
    conceptSlug?: string | null;
  }>;
  transcript: Array<{ role: string; content: string }>;
};

export type PromoteFromRoleplayResult = {
  toolCalls: PromoteToolCall[];
  text: string;
};

/**
 * Zod schema for the agent tool. Exported for the integration test so the
 * stubbed model can emit a matching tool call shape.
 */
export const promoteOrDemoteSpacedRepInputSchema = z.object({
  conceptSlug: z
    .string()
    .min(1)
    .describe(
      "Stable kebab-case slug for the concept being promoted or demoted, e.g. 'dat-clauses', 'modal-verbs', 'past-tense-zijn-vs-hebben'. Pick one slug per call.",
    ),
  action: z
    .enum(["promote", "demote"])
    .describe(
      "promote = learner used this concept correctly and confidently; bump ease + interval. demote = learner misused or avoided this concept; drop ease, reset interval.",
    ),
});

function todayIso(): string {
  return new Date().toISOString();
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Apply one promote / demote to the queue. Inserts a new row if the
 * concept is not yet tracked. Idempotent in the trivial sense (a second
 * promote bumps ease again) but does not deduplicate within a single
 * agent run; the agent is prompted to call once per concept.
 */
export async function applyPromoteOrDemote(
  drz: DB,
  userId: number,
  call: PromoteToolCall,
  sessionId: number,
): Promise<{ created: boolean; easeFactor: number; intervalDays: number }> {
  const existing = await drz
    .select()
    .from(spacedRepQueue)
    .where(
      and(
        eq(spacedRepQueue.userId, userId),
        eq(spacedRepQueue.itemType, "concept"),
        eq(spacedRepQueue.itemKey, call.conceptSlug),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const r = existing[0];
    let newEase = r.easeFactor;
    let newInterval = r.intervalDays;
    let newReps = r.repetitions;
    if (call.action === "promote") {
      newEase = Math.min(MAX_EASE, r.easeFactor + 0.15);
      newInterval = Math.max(1, Math.ceil(r.intervalDays * newEase));
      newReps = r.repetitions + 1;
    } else {
      newEase = Math.max(MIN_EASE, r.easeFactor - 0.2);
      newInterval = 1;
      newReps = 0;
    }
    await drz
      .update(spacedRepQueue)
      .set({
        easeFactor: newEase,
        intervalDays: newInterval,
        repetitions: newReps,
        lastReviewedAt: todayIso(),
        nextReviewDate: addDays(todayIso(), newInterval),
        payload: {
          conceptSlug: call.conceptSlug,
          source: "roleplay-agent",
          lastAction: call.action,
          lastSessionId: sessionId,
        },
      })
      .where(eq(spacedRepQueue.id, r.id));
    return { created: false, easeFactor: newEase, intervalDays: newInterval };
  }

  // Fresh concept: seed with sane defaults then apply the first action.
  const baseEase = 2.5;
  let newEase = baseEase;
  let newInterval = 1;
  let newReps = 0;
  if (call.action === "promote") {
    newEase = Math.min(MAX_EASE, baseEase + 0.15);
    newInterval = Math.max(1, Math.ceil(1 * newEase));
    newReps = 1;
  } else {
    newEase = Math.max(MIN_EASE, baseEase - 0.2);
    newInterval = 1;
    newReps = 0;
  }
  await drz.insert(spacedRepQueue).values({
    userId,
    itemType: "concept",
    itemKey: call.conceptSlug,
    payload: {
      conceptSlug: call.conceptSlug,
      source: "roleplay-agent",
      lastAction: call.action,
      lastSessionId: sessionId,
    },
    easeFactor: newEase,
    intervalDays: newInterval,
    repetitions: newReps,
    nextReviewDate: addDays(todayIso(), newInterval),
    lastReviewedAt: todayIso(),
  });
  return { created: true, easeFactor: newEase, intervalDays: newInterval };
}

/**
 * Build the agent system + user prompt. Exported so tests can assert the
 * shape without re-running the model.
 */
export function buildPromotePrompt(input: PromoteFromRoleplayInput): {
  system: string;
  prompt: string;
} {
  const errorLines = input.errors.length
    ? input.errors
        .map(
          (e, i) =>
            `${i + 1}. [${e.category}] "${e.incorrect}" -> "${e.correction}"${
              e.conceptSlug ? ` (concept: ${e.conceptSlug})` : ""
            }${e.explanationEn ? ` ${e.explanationEn}` : ""}`,
        )
        .join("\n")
    : "(no specific errors recorded)";

  const transcriptLines = input.transcript
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => `${t.role === "user" ? "Learner" : "NPC"}: ${t.content}`)
    .join("\n");

  const system = `You are a Dutch language coach maintaining a learner's spaced-repetition queue.
You will be shown the rubric scores, English feedback, error list and transcript from one roleplay session.
Decide which 1-3 high-level CONCEPTS the learner should promote or demote in their review queue.

A concept is a reusable language pattern (e.g. "modal-verbs", "past-tense-zijn-vs-hebben", "dat-clauses", "ordering-food-vocab", "polite-register"), NOT a single word or sentence.
Use stable kebab-case slugs. Reuse slugs across sessions where possible.

Call promoteOrDemoteSpacedRep ONCE per concept. Promote when the learner used the concept correctly and confidently. Demote when the learner misused it or avoided it. Only call the tool when you have a clear signal — a no-op is fine if the session was thin.
After your tool calls, output a one-sentence English summary of what you adjusted.`;

  const prompt = `Session: ${input.scenarioSlug} (id=${input.sessionId})

Rubric (1-5 each): grammar=${input.rubric.grammar}, vocabulary=${input.rubric.vocabulary}, taskCompletion=${input.rubric.taskCompletion}, fluency=${input.rubric.fluency}, politeness=${input.rubric.politeness}

Feedback to learner:
${input.feedbackEn}

Errors:
${errorLines}

Transcript:
${transcriptLines || "(empty)"}

Decide the 1-3 concepts to promote or demote. Call the tool once per concept.`;

  return { system, prompt };
}

/**
 * Core agentic loop. Pure dependency-injected for testability: callers pass
 * the language model, the drizzle handle and the input payload. Returns the
 * recorded tool calls plus the agent's final text.
 */
export async function promoteFromRoleplay(
  model: LanguageModel,
  drz: DB,
  input: PromoteFromRoleplayInput,
): Promise<PromoteFromRoleplayResult> {
  const { system, prompt } = buildPromotePrompt(input);
  const recorded: PromoteToolCall[] = [];

  const promoteTool = tool({
    description:
      "Promote or demote a single concept in the learner's spaced-repetition queue. Call once per concept; pass a stable kebab-case slug.",
    inputSchema: promoteOrDemoteSpacedRepInputSchema,
    execute: async (toolInput) => {
      const call: PromoteToolCall = {
        conceptSlug: toolInput.conceptSlug,
        action: toolInput.action,
      };
      try {
        const result = await applyPromoteOrDemote(
          drz,
          input.userId,
          call,
          input.sessionId,
        );
        recorded.push(call);
        log.info("spaced_rep.agent.tool_call", {
          userId: input.userId,
          sessionId: input.sessionId,
          conceptSlug: call.conceptSlug,
          action: call.action,
          easeFactor: result.easeFactor,
          intervalDays: result.intervalDays,
          created: result.created,
        });
        return {
          ok: true as const,
          conceptSlug: call.conceptSlug,
          action: call.action,
          easeFactor: result.easeFactor,
          intervalDays: result.intervalDays,
        };
      } catch (err) {
        log.error("spaced_rep.agent.tool_error", {
          userId: input.userId,
          sessionId: input.sessionId,
          conceptSlug: call.conceptSlug,
          action: call.action,
          error: String(err),
        });
        return { ok: false as const, error: String(err) };
      }
    },
  });

  const result = streamText({
    model,
    system,
    prompt,
    tools: { promoteOrDemoteSpacedRep: promoteTool },
    stopWhen: stepCountIs(5),
    experimental_telemetry: {
      isEnabled: true,
      functionId: "roleplay.promote-agent",
      metadata: {
        userId: String(input.userId),
        scenarioSlug: input.scenarioSlug,
        sessionId: input.sessionId,
      },
    },
  });

  // Drain the stream so onFinish (and our tool execute) all run before we
  // read the aggregated text. We do not need to emit deltas; this is a
  // server-side housekeeping pass triggered from gradeRoleplaySession.
  for await (const _ of result.fullStream) {
    // intentionally empty: we only care about side-effects (tool calls)
    // and the final text.
  }

  const text = await result.text;
  return { toolCalls: recorded, text };
}
