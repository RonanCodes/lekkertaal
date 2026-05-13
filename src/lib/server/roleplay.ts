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
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import { users, scenarios, roleplaySessions } from "../../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

export type RoleplayTranscriptEntry = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
};

export const getScenario = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
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
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
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

export const finishRoleplaySession = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { sessionId: number; transcript: RoleplayTranscriptEntry[] }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
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

    await drz
      .update(roleplaySessions)
      .set({
        transcript: data.transcript,
        completedAt: new Date().toISOString(),
      })
      .where(eq(roleplaySessions.id, data.sessionId));

    // TODO(refinement US-018): trigger Claude rubric scoring + write rubric_*, feedback_md,
    // xp_awarded, passed; for now just persist the transcript and route to scorecard.
    return { ok: true as const, sessionId: data.sessionId };
  });
