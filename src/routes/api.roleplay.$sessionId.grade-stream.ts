import { createFileRoute } from "@tanstack/react-router";
import { streamObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/tanstack-react-start/server";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { scenarios, roleplaySessions } from "../db/schema";
import { requireWorkerContext } from "../entry.server";
import {
  RubricSchema,
  buildGradingPrompt,
  persistRubric
  
} from "../lib/server/roleplay";
import type {RoleplayRubric} from "../lib/server/roleplay";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { awardBadgesIfEligible } from "./../lib/server/badges";
import { emitAiCall, buildAiCallPayload } from "../lib/ai-telemetry";
import { log } from "../lib/logger";

/**
 * Live grading endpoint.
 *
 * POST /api/roleplay/:sessionId/grade-stream
 *
 * Uses `streamObject` server-side + `useObject` client-side so the 5 rubric
 * scores fill in live as Claude emits the JSON, rather than a 4-8s blank wait
 * followed by a single drop. The body of the request is empty: the session id
 * is in the URL, and the transcript + scenario context is loaded server-side
 * from D1 (the client already wrote the transcript via finishRoleplaySession
 * before navigating to the scorecard).
 *
 * Persistence happens in onFinish: when the model finishes streaming the
 * object, we run the same persistRubric path the non-streaming server fn
 * uses, so the final D1 row matches what the user saw fill in live. Awarding
 * XP, enqueueing spaced-rep cards, and badge eligibility all run there too.
 *
 * Idempotency: if the session already has a graded rubric we short-circuit
 * by streaming nothing and the client falls back to the loader data.
 */
export const Route = createFileRoute("/api/roleplay/$sessionId/grade-stream")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await auth();
        if (!a.userId) {
          return new Response("Not signed in", { status: 401 });
        }

        const sessionId = Number.parseInt(params.sessionId, 10);
        if (!Number.isFinite(sessionId) || sessionId <= 0) {
          return new Response("Invalid sessionId", { status: 400 });
        }

        const { env, ctx } = requireWorkerContext();
        if (!env.ANTHROPIC_API_KEY) {
          return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
        }

        const drz = db(env.DB);
        const me = [await ensureUserRow(a.userId, drz, env)];

        const sessRow = await drz
          .select()
          .from(roleplaySessions)
          .where(
            and(
              eq(roleplaySessions.id, sessionId),
              eq(roleplaySessions.userId, me[0].id),
            ),
          )
          .limit(1);
        if (!sessRow[0]) return new Response("Session not found", { status: 404 });
        const sess = sessRow[0];

        const scenarioRow = await drz
          .select()
          .from(scenarios)
          .where(eq(scenarios.id, sess.scenarioId))
          .limit(1);
        if (!scenarioRow[0]) {
          return new Response("Scenario not found", { status: 404 });
        }
        const s = scenarioRow[0];

        const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

        const { system, prompt } = buildGradingPrompt({
          scenario: s,
          transcript: sess.transcript ?? [],
        });

        const modelId = "claude-sonnet-4-5";
        const functionId = "roleplay.grade-stream";
        const startedAt = Date.now();

        const result = streamObject({
          model: anthropic(modelId),
          schema: RubricSchema,
          system,
          prompt,
          abortSignal: request.signal,
          experimental_telemetry: {
            isEnabled: true,
            functionId,
            metadata: {
              userId: a.userId,
              scenarioSlug: s.slug,
              sessionId,
            },
          },
          onFinish: async ({ object, usage, error }) => {
            // Telemetry first, regardless of whether the object validates.
            emitAiCall(
              buildAiCallPayload({
                functionId,
                model: modelId,
                startedAt,
                usage,
                finishReason: error ? "error" : "stop",
                userId: a.userId,
                scenarioSlug: s.slug,
                extra: {
                  sessionId,
                  error: error ? String(error) : undefined,
                },
              }),
              env,
              ctx,
            );

            if (error || !object) {
              log.error("roleplay.grade-stream: no final object", {
                sessionId,
                error: error ? String(error) : "missing",
              });
              return;
            }

            // `object` here is the fully validated final RubricSchema instance.
            const finalRubric: RoleplayRubric = object;

            try {
              await persistRubric({
                drz,
                sess,
                scenario: s,
                meId: me[0].id,
                meXpTotal: me[0].xpTotal ?? 0,
                rubric: finalRubric,
                // AI-SDK-5 agentic promotion runs inside persistRubric too,
                // so the streaming path stays feature-parity with the
                // non-streaming gradeRoleplaySession server fn.
              });
              await awardBadgesIfEligible(drz, me[0].id);
              log.info("roleplay.grade-stream finish", {
                sessionId,
                scenarioSlug: s.slug,
                grammar: finalRubric.grammar,
                vocabulary: finalRubric.vocabulary,
                taskCompletion: finalRubric.taskCompletion,
                fluency: finalRubric.fluency,
                politeness: finalRubric.politeness,
              });
            } catch (persistErr) {
              log.error("roleplay.grade-stream: persist failed", {
                sessionId,
                error: String(persistErr),
              });
            }
          },
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
