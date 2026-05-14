import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../db/client";
import { users, scenarios, roleplaySessions } from "../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { emitAiCall, buildAiCallPayload } from "../lib/ai-telemetry";
import { buildRoleplaySystem } from "../lib/server/roleplay-system-prompt";
import { buildRoleplayTools } from "../lib/server/roleplay-tools";
import { log } from "../lib/logger";

/**
 * Roleplay streaming endpoint.
 *
 * POST /api/roleplay/:slug/stream
 *
 * Wire-compatible with the AI SDK v6 `useChat()` UI message protocol: the
 * client sends `{ messages, id, trigger }`, we reply with a UI message stream.
 *
 * We hydrate the NPC system prompt from the scenarios row keyed on :slug, so
 * the persona, opening line, must-use vocab/grammar, and success criteria all
 * shape the model's behaviour.
 *
 * Prompt caching: the system prompt is built via `buildRoleplaySystem` which
 * attaches Anthropic ephemeral cache_control. From turn 2 onward of a given
 * scenario session the system block reads from cache at ~10% of normal input
 * cost. Cache hit metrics land in `ai.call` telemetry (cachedTokens) and in a
 * dedicated `roleplay stream finish` log line with the raw cache_creation /
 * cache_read counts pulled off providerMetadata.
 */
export const Route = createFileRoute("/api/roleplay/$slug/stream")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await auth();
        if (!a.userId) {
          return new Response("Not signed in", { status: 401 });
        }

        const { env, ctx } = requireWorkerContext();
        if (!env.ANTHROPIC_API_KEY) {
          return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
        }

        const drz = db(env.DB);
        const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
        if (!me[0]) return new Response("User row missing", { status: 500 });

        const scenarioRow = await drz
          .select()
          .from(scenarios)
          .where(eq(scenarios.slug, params.slug))
          .limit(1);
        if (!scenarioRow[0]) return new Response("Scenario not found", { status: 404 });
        const s = scenarioRow[0];

        const body = (await request.json()) as { messages: UIMessage[] };

        // Find the in-flight session for this user+scenario so tool calls
        // (flagSuspectedError) can attribute rows to the right session row.
        // Falls back to `null` if the client never called startRoleplaySession
        // (e.g. dev-time curl), in which case flagSuspectedError no-ops.
        const openSession = await drz
          .select({ id: roleplaySessions.id })
          .from(roleplaySessions)
          .where(
            and(
              eq(roleplaySessions.userId, me[0].id),
              eq(roleplaySessions.scenarioId, s.id),
              isNull(roleplaySessions.completedAt),
            ),
          )
          .orderBy(desc(roleplaySessions.startedAt))
          .limit(1);
        const activeSessionId = openSession[0]?.id ?? null;

        const tools = buildRoleplayTools({
          drz,
          userId: me[0].id,
          sessionId: activeSessionId,
        });

        const systemMessages = buildRoleplaySystem({
          npcName: s.npcName,
          npcPersona: s.npcPersona,
          titleNl: s.titleNl,
          openingNl: s.openingNl,
          mustUseVocab: s.mustUseVocab ?? [],
          mustUseGrammar: s.mustUseGrammar ?? [],
          successCriteria: s.successCriteria ?? [],
          difficulty: s.difficulty,
        });

        // Bind the Anthropic key from the Worker env. The static import from
        // @ai-sdk/anthropic relies on process.env which doesn't exist in CF
        // Workers; createAnthropic({ apiKey }) is the explicit form.
        const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

        const modelId = "claude-haiku-4-5";
        const functionId = "roleplay.stream";
        const startedAt = Date.now();

        const result = streamText({
          model: anthropic(modelId),
          system: systemMessages,
          messages: await convertToModelMessages(body.messages),
          temperature: 0.7,
          abortSignal: request.signal,
          tools,
          // Allow at most two model steps (one tool round-trip) per turn so
          // a stuck tool-call loop cannot run away. lookupVocab → narrate, or
          // flagSuspectedError → continue in character.
          stopWhen: stepCountIs(2),
          experimental_telemetry: {
            isEnabled: true,
            functionId,
            metadata: {
              userId: a.userId,
              scenarioSlug: params.slug,
            },
          },
          onFinish: ({ usage, finishReason, providerMetadata }) => {
            // Anthropic returns cache_creation / cache_read counts in the
            // provider-metadata bag. Turn 1 of a scenario: cache_creation > 0,
            // cache_read == 0. Turn 2+: cache_creation == 0, cache_read > 0.
            const anth = providerMetadata?.anthropic as
              | { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
              | undefined;
            const cacheCreationInputTokens = anth?.cacheCreationInputTokens ?? 0;
            const cacheReadInputTokens = anth?.cacheReadInputTokens ?? 0;

            log.info("roleplay stream finish", {
              scenarioSlug: params.slug,
              userId: me[0].id,
              turnUserMessages: body.messages.length,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              cacheCreationInputTokens,
              cacheReadInputTokens,
            });

            const payload = buildAiCallPayload({
              functionId,
              model: modelId,
              startedAt,
              usage,
              finishReason,
              userId: a.userId,
              scenarioSlug: params.slug,
              extra: {
                cacheCreationInputTokens,
                cacheReadInputTokens,
              },
            });
            emitAiCall(payload, env, ctx);
          },
          onError: ({ error }) => {
            const payload = buildAiCallPayload({
              functionId,
              model: modelId,
              startedAt,
              finishReason: "error",
              userId: a.userId,
              scenarioSlug: params.slug,
              extra: { error: String(error) },
            });
            emitAiCall(payload, env, ctx);
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
