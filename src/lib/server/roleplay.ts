/**
 * Server-side helpers for roleplay scenarios.
 *
 * - getScenario(slug) — load a scenario + the current user row (loader for /app/scenario/:slug)
 * - startRoleplaySession(scenarioId) — insert a roleplay_sessions row, return id
 * - finishRoleplaySession({ sessionId, transcript }) — write transcript_json, mark completedAt
 *
 * The streaming endpoint itself lives in src/routes/api.roleplay.$slug.stream.ts
 * and uses the AI SDK's streamText directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { users, scenarios, roleplaySessions, roleplayErrors } from "../../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { enqueueRoleplayErrors } from "./spaced-rep";
import { promoteFromRoleplay } from "./spaced-rep-promote";
import { models } from "../models";
import { awardRoleplayComplete } from "./gamification";
import { awardBadgesIfEligible } from "./badges";
import { log } from "../logger";
import { requireUserClerkId } from "./auth-helper";
import { emitAiCall, buildAiCallPayload } from "../ai-telemetry";
import { redactText, summariseMatches } from "./redaction-middleware";
import { loadChatMessages } from "./chat-messages";

export type RoleplayTranscriptEntry = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
};

export const getScenario = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const scenarioRow = await drz
      .select()
      .from(scenarios)
      .where(eq(scenarios.slug, data.slug))
      .limit(1);
    if (!scenarioRow[0]) throw new Error("Scenario not found");
    const s = scenarioRow[0];

    return {
      user: {
        displayName: me[0].displayName,
        cefrLevel: me[0].cefrLevel,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      scenario: {
        id: s.id,
        slug: s.slug,
        titleNl: s.titleNl,
        titleEn: s.titleEn,
        difficulty: s.difficulty,
        npcName: s.npcName,
        npcPersona: s.npcPersona,
        npcVoiceId: s.npcVoiceId,
        openingNl: s.openingNl,
        mustUseVocab: s.mustUseVocab ?? [],
        mustUseGrammar: s.mustUseGrammar ?? [],
        successCriteria: s.successCriteria ?? [],
        failureModes: s.failureModes ?? [],
        estimatedMinutes: s.estimatedMinutes,
        xpReward: s.xpReward,
      },
    };
  });

export const startRoleplaySession = createServerFn({ method: "POST" })
  .inputValidator((input: { scenarioId: number }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    // Re-use an open session if one exists for this user+scenario (incomplete).
    const open = await drz
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.userId, me[0].id),
          eq(roleplaySessions.scenarioId, data.scenarioId),
          isNull(roleplaySessions.completedAt),
        ),
      )
      .orderBy(desc(roleplaySessions.startedAt))
      .limit(1);
    if (open[0]) return { sessionId: open[0].id };

    const inserted = await drz
      .insert(roleplaySessions)
      .values({
        userId: me[0].id,
        scenarioId: data.scenarioId,
        transcript: [],
      })
      .returning({ id: roleplaySessions.id });
    return { sessionId: inserted[0].id };
  });

/**
 * Server-side hydration for the resume-mid-conversation flow.
 *
 * Returns:
 *  - `sessionId` (creates / reuses an open session for the user+scenario)
 *  - `messages` (`UIMessage[]` ready to feed into `useChat({ messages })`)
 *
 * The route loader calls this and the React side passes the result into
 * `useChat`'s `messages` option so a page refresh mid-conversation puts
 * the learner back on the same turn they left.
 */
export const getRoleplayHistory = createServerFn({ method: "GET" })
  .inputValidator((input: { scenarioId: number }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    // Reuse the open session for this user+scenario, or insert a fresh one.
    // Mirrors startRoleplaySession but rolled into a single round-trip so
    // the loader does not need a second call.
    const open = await drz
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.userId, me[0].id),
          eq(roleplaySessions.scenarioId, data.scenarioId),
          isNull(roleplaySessions.completedAt),
        ),
      )
      .orderBy(desc(roleplaySessions.startedAt))
      .limit(1);

    let sessionId: number;
    if (open[0]) {
      sessionId = open[0].id;
    } else {
      const inserted = await drz
        .insert(roleplaySessions)
        .values({
          userId: me[0].id,
          scenarioId: data.scenarioId,
          transcript: [],
        })
        .returning({ id: roleplaySessions.id });
      sessionId = inserted[0].id;
    }

    const messages = await loadChatMessages(drz, sessionId);
    return { sessionId, messages };
  });

export const finishRoleplaySession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: number; transcript: RoleplayTranscriptEntry[] }) => input,
  )
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    // Ownership check
    const sess = await drz
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.id, data.sessionId),
          eq(roleplaySessions.userId, me[0].id),
        ),
      )
      .limit(1);
    if (!sess[0]) throw new Error("Session not found");

    // Belt-and-suspenders: scrub PII out of the persisted transcript even
    // though the model-side redaction middleware already saw the prompt.
    // The transcript is built client-side and round-trips back here, so we
    // re-run the same regex pass over each entry's content. Any matches
    // produce a single `ai.redacted` log entry per session — counts only,
    // never the raw token.
    const redactedTranscript: RoleplayTranscriptEntry[] = [];
    const matchSummary: ReturnType<typeof summariseMatches> = {
      email: 0,
      bsn: 0,
      phone: 0,
      iban: 0,
    };
    let totalMatches = 0;
    for (const entry of data.transcript) {
      const r = redactText(entry.content);
      if (r.matches.length > 0) {
        totalMatches += r.matches.length;
        const counts = summariseMatches(r.matches);
        matchSummary.email += counts.email;
        matchSummary.bsn += counts.bsn;
        matchSummary.phone += counts.phone;
        matchSummary.iban += counts.iban;
      }
      redactedTranscript.push({ ...entry, content: r.text });
    }
    if (totalMatches > 0) {
      log.info("ai.redacted", {
        direction: "transcript",
        sessionId: data.sessionId,
        total: totalMatches,
        counts: matchSummary,
      });
    }

    await drz
      .update(roleplaySessions)
      .set({
        transcript: redactedTranscript,
        completedAt: new Date().toISOString(),
      })
      .where(eq(roleplaySessions.id, data.sessionId));

    return { ok: true as const, sessionId: data.sessionId };
  });

// ============================================================================
// US-018: grading + scorecard
// ============================================================================

const RubricSchema = z.object({
  grammar: z.number().int().min(1).max(5),
  vocabulary: z.number().int().min(1).max(5),
  taskCompletion: z.number().int().min(1).max(5),
  fluency: z.number().int().min(1).max(5),
  politeness: z.number().int().min(1).max(5),
  feedbackEn: z.string().min(1),
  errors: z
    .array(
      z.object({
        category: z.enum(["grammar", "vocab", "spelling", "register"]),
        incorrect: z.string(),
        correction: z.string(),
        explanationEn: z.string().optional(),
        conceptSlug: z.string().optional(),
      }),
    )
    .default([]),
});

export type RoleplayRubric = z.infer<typeof RubricSchema>;

export const gradeRoleplaySession = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: number }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env, ctx } = requireWorkerContext();
    if (!env.ANTHROPIC_API_KEY) {
      log.error("gradeRoleplaySession: ANTHROPIC_API_KEY missing", { sessionId: data.sessionId });
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) {
      log.error("gradeRoleplaySession: user row missing", { clerkId: userId });
      throw new Error("User row missing");
    }
    log.debug("gradeRoleplaySession: start", { sessionId: data.sessionId, userId: me[0].id });

    const sessRow = await drz
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.id, data.sessionId),
          eq(roleplaySessions.userId, me[0].id),
        ),
      )
      .limit(1);
    if (!sessRow[0]) throw new Error("Session not found");
    const sess = sessRow[0];

    const scenarioRow = await drz
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, sess.scenarioId))
      .limit(1);
    if (!scenarioRow[0]) throw new Error("Scenario not found");
    const s = scenarioRow[0];

    // Idempotent: if this session has already been graded, return existing.
    if (sess.rubricGrammar !== null && sess.rubricGrammar !== undefined) {
      return {
        sessionId: sess.id,
        scenarioSlug: s.slug,
        rubric: {
          grammar: sess.rubricGrammar,
          vocabulary: sess.rubricVocab,
          taskCompletion: sess.rubricTask,
          fluency: sess.rubricFluency,
          politeness: sess.rubricPoliteness,
        },
        feedbackMd: sess.feedbackMd ?? "",
        xpAwarded: sess.xpAwarded,
        passed: sess.passed,
        cached: true,
      };
    }

    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const transcriptLines = (sess.transcript ?? [])
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => `${t.role === "user" ? "Learner" : s.npcName}: ${t.content}`)
      .join("\n");

    const gradeModelId = "claude-sonnet-4-5";
    const gradeFunctionId = "roleplay.grade";
    const gradeStartedAt = Date.now();

    let gradeResult: Awaited<ReturnType<typeof generateObject<typeof RubricSchema>>>;
    try {
      gradeResult = await generateObject({
        model: anthropic(gradeModelId),
        schema: RubricSchema,
        system: `You are a Dutch language teacher grading a CEFR ${s.difficulty} roleplay conversation.
The learner had to: ${(s.successCriteria ?? []).join("; ") || "complete a natural conversation"}.
Score on five rubrics (1-5 each), give actionable feedback in English, and list specific Dutch errors with corrections.
Be encouraging. A 3 is a passing CEFR ${s.difficulty} performance, 4 is strong, 5 is exceptional.`,
        prompt: `Scenario: ${s.titleNl} (${s.titleEn})
NPC: ${s.npcName} — ${s.npcPersona}
Must-use vocab: ${(s.mustUseVocab ?? []).join(", ") || "(none)"}
Must-use grammar: ${(s.mustUseGrammar ?? []).join(", ") || "(none)"}

Transcript:
${transcriptLines}

Grade the learner's Dutch. Return the rubric scores, a short English feedback paragraph (2-4 sentences), and a list of specific errors with corrections.`,
        experimental_telemetry: {
          isEnabled: true,
          functionId: gradeFunctionId,
          metadata: {
            userId,
            scenarioSlug: s.slug,
            sessionId: data.sessionId,
          },
        },
      });
    } catch (err) {
      emitAiCall(
        buildAiCallPayload({
          functionId: gradeFunctionId,
          model: gradeModelId,
          startedAt: gradeStartedAt,
          finishReason: "error",
          userId,
          scenarioSlug: s.slug,
          extra: { sessionId: data.sessionId, error: String(err) },
        }),
        env,
        ctx,
      );
      throw err;
    }

    emitAiCall(
      buildAiCallPayload({
        functionId: gradeFunctionId,
        model: gradeModelId,
        startedAt: gradeStartedAt,
        usage: gradeResult.usage,
        finishReason: gradeResult.finishReason,
        userId,
        scenarioSlug: s.slug,
        extra: { sessionId: data.sessionId },
      }),
      env,
      ctx,
    );

    const rubric = gradeResult.object;

    const avg =
      (rubric.grammar +
        rubric.vocabulary +
        rubric.taskCompletion +
        rubric.fluency +
        rubric.politeness) /
      5;
    const stars = Math.round(avg);
    const passed = stars >= 3;
    // XP scaled by stars: 0-2 -> 25%, 3 -> 60%, 4 -> 85%, 5 -> 100%.
    const xpScale = stars >= 5 ? 1.0 : stars === 4 ? 0.85 : stars === 3 ? 0.6 : 0.25;
    const xpAwarded = Math.round((s.xpReward ?? 0) * xpScale);

    // Best-attempt: only overwrite if this attempt is strictly higher.
    // Score the previous best by stars-equivalent (sum of 5 rubrics).
    const previousSum =
      (sess.rubricGrammar ?? 0) +
      (sess.rubricVocab ?? 0) +
      (sess.rubricTask ?? 0) +
      (sess.rubricFluency ?? 0) +
      (sess.rubricPoliteness ?? 0);
    const currentSum =
      rubric.grammar +
      rubric.vocabulary +
      rubric.taskCompletion +
      rubric.fluency +
      rubric.politeness;
    const shouldReplace = currentSum > previousSum;

    if (shouldReplace) {
      await drz
        .update(roleplaySessions)
        .set({
          rubricGrammar: rubric.grammar,
          rubricVocab: rubric.vocabulary,
          rubricTask: rubric.taskCompletion,
          rubricFluency: rubric.fluency,
          rubricPoliteness: rubric.politeness,
          feedbackMd: rubric.feedbackEn,
          xpAwarded,
          passed,
        })
        .where(eq(roleplaySessions.id, sess.id));

      // Replace error rows for this session.
      await drz.delete(roleplayErrors).where(eq(roleplayErrors.sessionId, sess.id));
      let insertedErrors: Array<{ id: number }> = [];
      if (rubric.errors.length > 0) {
        insertedErrors = await drz
          .insert(roleplayErrors)
          .values(
            rubric.errors.map((e) => ({
              sessionId: sess.id,
              userId: me[0].id,
              category: e.category,
              incorrect: e.incorrect,
              correction: e.correction,
              explanationEn: e.explanationEn ?? null,
            })),
          )
          .returning({ id: roleplayErrors.id });

        // US-019: enqueue each error as a review card.
        await enqueueRoleplayErrors(
          drz,
          me[0].id,
          rubric.errors.map((e, i) => ({
            sessionId: sess.id,
            errorId: insertedErrors[i]?.id ?? 0,
            category: e.category,
            incorrect: e.incorrect,
            correction: e.correction,
            explanationEn: e.explanationEn,
          })),
        );
      }

      // US-049 / AI-SDK-5: agentic spaced-rep promotion. Ask the model to
      // look at the rubric + transcript and pick 1-3 concepts to promote
      // or demote in the learner's queue (separate row family from the
      // per-error rows enqueued above; itemType = "concept"). Best-effort:
      // failure here must not block grading, so we swallow + log.
      try {
        const promoteResult = await promoteFromRoleplay(models.primary, drz, {
          userId: me[0].id,
          sessionId: sess.id,
          scenarioSlug: s.slug,
          rubric: {
            grammar: rubric.grammar,
            vocabulary: rubric.vocabulary,
            taskCompletion: rubric.taskCompletion,
            fluency: rubric.fluency,
            politeness: rubric.politeness,
          },
          feedbackEn: rubric.feedbackEn,
          errors: rubric.errors,
          transcript: (sess.transcript ?? []).map((t) => ({
            role: t.role,
            content: t.content,
          })),
        });
        log.info("roleplay.promote.done", {
          sessionId: sess.id,
          userId: me[0].id,
          toolCalls: promoteResult.toolCalls.length,
        });
      } catch (err) {
        log.warn("roleplay.promote.failed", {
          sessionId: sess.id,
          userId: me[0].id,
          error: String(err),
        });
      }

      // Award XP at the user level on best-attempt improvement only.
      const xpDelta = xpAwarded - (sess.xpAwarded ?? 0);
      if (xpDelta > 0) {
        await drz
          .update(users)
          .set({ xpTotal: (me[0].xpTotal ?? 0) + xpDelta })
          .where(eq(users.id, me[0].id));
      }

      // US-020: roleplay coins + streak + daily_completions. Only the XP delta
      // (not the full xpAwarded) gets logged to xp_events so re-do attempts
      // don't double-credit the leaderboard.
      await awardRoleplayComplete(
        drz,
        me[0].id,
        sess.id,
        passed,
        true,
        xpDelta > 0 ? xpDelta : 0,
      );
    }

    const newBadges = await awardBadgesIfEligible(drz, me[0].id);

    return {
      sessionId: sess.id,
      scenarioSlug: s.slug,
      rubric: {
        grammar: rubric.grammar,
        vocabulary: rubric.vocabulary,
        taskCompletion: rubric.taskCompletion,
        fluency: rubric.fluency,
        politeness: rubric.politeness,
      },
      feedbackMd: rubric.feedbackEn,
      xpAwarded,
      passed,
      cached: false,
      replacedPrevious: shouldReplace,
      newBadges,
    };
  });

export const getScorecard = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const scenarioRow = await drz
      .select()
      .from(scenarios)
      .where(eq(scenarios.slug, data.slug))
      .limit(1);
    if (!scenarioRow[0]) throw new Error("Scenario not found");
    const s = scenarioRow[0];

    // Most-recent graded session for this user + scenario.
    const sessRow = await drz
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.userId, me[0].id),
          eq(roleplaySessions.scenarioId, s.id),
        ),
      )
      .orderBy(desc(roleplaySessions.startedAt))
      .limit(1);
    const sess = sessRow[0];

    const errors = sess
      ? await drz
          .select()
          .from(roleplayErrors)
          .where(eq(roleplayErrors.sessionId, sess.id))
      : [];

    return {
      user: {
        displayName: me[0].displayName,
        cefrLevel: me[0].cefrLevel,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      scenario: {
        slug: s.slug,
        titleNl: s.titleNl,
        titleEn: s.titleEn,
        npcName: s.npcName,
        xpReward: s.xpReward,
        badgeUnlock: s.badgeUnlock,
      },
      session: sess
        ? {
            id: sess.id,
            rubric: {
              grammar: sess.rubricGrammar,
              vocabulary: sess.rubricVocab,
              taskCompletion: sess.rubricTask,
              fluency: sess.rubricFluency,
              politeness: sess.rubricPoliteness,
            },
            feedbackMd: sess.feedbackMd,
            xpAwarded: sess.xpAwarded,
            passed: sess.passed,
            completedAt: sess.completedAt,
            graded:
              sess.rubricGrammar !== null && sess.rubricGrammar !== undefined,
          }
        : null,
      errors: errors.map((e) => ({
        id: e.id,
        category: e.category,
        incorrect: e.incorrect,
        correction: e.correction,
        explanationEn: e.explanationEn,
      })),
    };
  });
