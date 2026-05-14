/**
 * Integration test for the agentic spaced-rep promotion (AI-SDK-5 / issue #49).
 *
 * The production path is:
 *   gradeRoleplaySession
 *     -> promoteFromRoleplay(model, drz, input)
 *        -> streamText({ tools: { promoteOrDemoteSpacedRep }, stopWhen: stepCountIs(5) })
 *           -> tool.execute writes to spaced_rep_queue
 *
 * Here we exercise the middle layer (`promoteFromRoleplay`) directly against
 * an in-memory better-sqlite3 D1 stub and a hand-rolled LanguageModelV3 stub
 * that emits a single tool-call for `promoteOrDemoteSpacedRep` with the
 * arguments we want. The test asserts:
 *
 *   1. The tool fired (recorded in the function's return value).
 *   2. A spaced_rep_queue row exists for the chosen conceptSlug with
 *      itemType="concept".
 *   3. Promote bumps ease above the seed baseline; demote drops it.
 *
 * This validates the bridge from grading output to the user review queue
 * that issue #49 calls for.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3GenerateResult,
} from "@ai-sdk/provider";
import { eq, and } from "drizzle-orm";
import { makeTestDb, asD1, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { spacedRepQueue } from "../../../db/schema";
import {
  promoteFromRoleplay,
  applyPromoteOrDemote,
  promoteOrDemoteSpacedRepInputSchema,
} from "../spaced-rep-promote";

/**
 * Build a stub LanguageModelV3 that emits a fixed list of tool-call stream
 * parts. After all tool calls, it emits a text-delta with `finalText` and a
 * finish marker so streamText resolves cleanly.
 */
function makeToolCallingStubModel(opts: {
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  finalText?: string;
}): LanguageModelV3 {
  const finalText = opts.finalText ?? "Adjusted review queue for the session.";
  // streamText loops back to the model after every tool round. On the first
  // call we emit the tool calls; on every subsequent call we emit only a
  // text response and a stop, so the agent loop terminates cleanly without
  // re-firing the tools.
  let callCount = 0;

  return {
    specificationVersion: "v3",
    provider: "stub",
    modelId: "stub-tool-model",
    supportedUrls: {},
    async doGenerate(
      _options: LanguageModelV3CallOptions,
    ): Promise<LanguageModelV3GenerateResult> {
      return {
        content: [{ type: "text", text: finalText }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
        warnings: [],
      };
    },
    async doStream(
      _options: LanguageModelV3CallOptions,
    ): Promise<LanguageModelV3StreamResult> {
      const isFirstCall = callCount === 0;
      callCount += 1;
      const toolCallsThisStep =
        isFirstCall && opts.toolCalls.length > 0 ? opts.toolCalls : [];
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          for (const call of toolCallsThisStep) {
            controller.enqueue({
              type: "tool-call",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: JSON.stringify(call.input),
            });
          }
          controller.enqueue({ type: "text-start", id: `t${callCount}` });
          controller.enqueue({
            type: "text-delta",
            id: `t${callCount}`,
            delta: finalText,
          });
          controller.enqueue({ type: "text-end", id: `t${callCount}` });
          controller.enqueue({
            type: "finish",
            finishReason: { unified: toolCallsThisStep.length > 0 ? "tool-calls" : "stop", raw: undefined },
            usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } },
          });
          controller.close();
        },
      });
      return { stream };
    },
  };
}

describe("spaced-rep-promote: input schema", () => {
  it("validates a well-formed promote call", () => {
    const parsed = promoteOrDemoteSpacedRepInputSchema.parse({
      conceptSlug: "modal-verbs",
      action: "promote",
    });
    expect(parsed.conceptSlug).toBe("modal-verbs");
    expect(parsed.action).toBe("promote");
  });

  it("rejects an unknown action", () => {
    expect(() =>
      promoteOrDemoteSpacedRepInputSchema.parse({
        conceptSlug: "x",
        action: "delete",
      }),
    ).toThrow();
  });

  it("rejects an empty conceptSlug", () => {
    expect(() =>
      promoteOrDemoteSpacedRepInputSchema.parse({
        conceptSlug: "",
        action: "promote",
      }),
    ).toThrow();
  });
});

describe("applyPromoteOrDemote (pure D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  it("creates a fresh row on first promote with ease above the 2.5 baseline", async () => {
    const userId = seedUser(drz);
    const result = await applyPromoteOrDemote(
      asD1(drz),
      userId,
      { conceptSlug: "dat-clauses", action: "promote" },
      42,
    );
    expect(result.created).toBe(true);
    expect(result.easeFactor).toBeGreaterThan(2.5);

    const rows = drz.$sqlite
      .prepare(
        "SELECT item_type, item_key, ease_factor, interval_days, repetitions FROM spaced_rep_queue WHERE user_id = ?",
      )
      .all(userId) as Array<{
      item_type: string;
      item_key: string;
      ease_factor: number;
      interval_days: number;
      repetitions: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].item_type).toBe("concept");
    expect(rows[0].item_key).toBe("dat-clauses");
    expect(rows[0].repetitions).toBe(1);
  });

  it("demotes an existing row: ease drops, interval resets", async () => {
    const userId = seedUser(drz);
    // Seed by promoting twice so ease > baseline + interval > 1.
    await applyPromoteOrDemote(
      asD1(drz),
      userId,
      { conceptSlug: "modal-verbs", action: "promote" },
      1,
    );
    await applyPromoteOrDemote(
      asD1(drz),
      userId,
      { conceptSlug: "modal-verbs", action: "promote" },
      2,
    );
    const before = drz.$sqlite
      .prepare(
        "SELECT ease_factor, interval_days, repetitions FROM spaced_rep_queue WHERE user_id = ? AND item_key = ?",
      )
      .get(userId, "modal-verbs") as {
      ease_factor: number;
      interval_days: number;
      repetitions: number;
    };
    expect(before.repetitions).toBe(2);

    const demoteResult = await applyPromoteOrDemote(
      asD1(drz),
      userId,
      { conceptSlug: "modal-verbs", action: "demote" },
      3,
    );
    expect(demoteResult.created).toBe(false);
    expect(demoteResult.easeFactor).toBeLessThan(before.ease_factor);
    expect(demoteResult.intervalDays).toBe(1);

    const after = drz.$sqlite
      .prepare(
        "SELECT repetitions FROM spaced_rep_queue WHERE user_id = ? AND item_key = ?",
      )
      .get(userId, "modal-verbs") as { repetitions: number };
    expect(after.repetitions).toBe(0);
  });

  it("never lets ease fall below the 1.3 floor", async () => {
    const userId = seedUser(drz);
    for (let i = 0; i < 20; i++) {
      await applyPromoteOrDemote(
        asD1(drz),
        userId,
        { conceptSlug: "tricky-grammar", action: "demote" },
        i,
      );
    }
    const row = drz.$sqlite
      .prepare(
        "SELECT ease_factor FROM spaced_rep_queue WHERE user_id = ? AND item_key = ?",
      )
      .get(userId, "tricky-grammar") as { ease_factor: number };
    expect(row.ease_factor).toBeGreaterThanOrEqual(1.3);
  });
});

describe("promoteFromRoleplay (agentic loop, stubbed model)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  it("fires the promote/demote tool with the right conceptSlug and writes the queue row", async () => {
    const userId = seedUser(drz);

    const model = makeToolCallingStubModel({
      toolCalls: [
        {
          toolCallId: "call-1",
          toolName: "promoteOrDemoteSpacedRep",
          input: { conceptSlug: "past-tense-zijn-vs-hebben", action: "demote" },
        },
        {
          toolCallId: "call-2",
          toolName: "promoteOrDemoteSpacedRep",
          input: { conceptSlug: "ordering-food-vocab", action: "promote" },
        },
      ],
      finalText: "Demoted past-tense, promoted ordering vocab.",
    });

    const result = await promoteFromRoleplay(model, asD1(drz), {
      userId,
      sessionId: 99,
      scenarioSlug: "cafe-order",
      rubric: {
        grammar: 2,
        vocabulary: 4,
        taskCompletion: 3,
        fluency: 3,
        politeness: 4,
      },
      feedbackEn:
        "Ordering vocab was on point, but past-tense auxiliary choice slipped on a couple of verbs.",
      errors: [
        {
          category: "grammar",
          incorrect: "ik heb gegaan",
          correction: "ik ben gegaan",
          explanationEn: "Movement verbs take zijn",
          conceptSlug: "past-tense-zijn-vs-hebben",
        },
      ],
      transcript: [
        { role: "user", content: "Ik wil een koffie alsjeblieft" },
        { role: "assistant", content: "Natuurlijk, anders nog iets?" },
        { role: "user", content: "Ik heb naar huis gegaan vanmorgen" },
      ],
    });

    // The tool fired for both concepts.
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.map((c) => c.conceptSlug)).toEqual([
      "past-tense-zijn-vs-hebben",
      "ordering-food-vocab",
    ]);
    expect(result.toolCalls.map((c) => c.action)).toEqual([
      "demote",
      "promote",
    ]);

    // Both rows persisted with itemType "concept".
    const rows = await asD1(drz)
      .select()
      .from(spacedRepQueue)
      .where(
        and(
          eq(spacedRepQueue.userId, userId),
          eq(spacedRepQueue.itemType, "concept"),
        ),
      );
    expect(rows).toHaveLength(2);
    const byKey = Object.fromEntries(rows.map((r) => [r.itemKey, r]));
    expect(byKey["past-tense-zijn-vs-hebben"]).toBeDefined();
    expect(byKey["ordering-food-vocab"]).toBeDefined();

    // Demote on a fresh row drops ease below the 2.5 seed; promote raises it.
    expect(byKey["past-tense-zijn-vs-hebben"].easeFactor).toBeLessThan(2.5);
    expect(byKey["ordering-food-vocab"].easeFactor).toBeGreaterThan(2.5);

    // Payload tagged so we can trace the source.
    const payload = byKey["past-tense-zijn-vs-hebben"].payload as {
      source: string;
      lastAction: string;
      lastSessionId: number;
    } | null;
    expect(payload?.source).toBe("roleplay-agent");
    expect(payload?.lastAction).toBe("demote");
    expect(payload?.lastSessionId).toBe(99);

    // Agent text is surfaced for logging.
    expect(result.text).toContain("Demoted past-tense");
  });

  it("is a clean no-op when the model emits zero tool calls", async () => {
    const userId = seedUser(drz);
    const model = makeToolCallingStubModel({
      toolCalls: [],
      finalText: "Nothing to adjust this session.",
    });

    const result = await promoteFromRoleplay(model, asD1(drz), {
      userId,
      sessionId: 100,
      scenarioSlug: "thin-session",
      rubric: {
        grammar: 3,
        vocabulary: 3,
        taskCompletion: 3,
        fluency: 3,
        politeness: 3,
      },
      feedbackEn: "Solid baseline run, nothing remarkable either way.",
      errors: [],
      transcript: [
        { role: "user", content: "Hoi" },
        { role: "assistant", content: "Hallo!" },
      ],
    });

    expect(result.toolCalls).toHaveLength(0);
    const rows = drz.$sqlite
      .prepare("SELECT COUNT(*) AS c FROM spaced_rep_queue WHERE user_id = ?")
      .get(userId) as { c: number };
    expect(rows.c).toBe(0);
    expect(result.text).toContain("Nothing to adjust");
  });
});
