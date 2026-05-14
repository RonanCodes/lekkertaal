import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, stepCountIs, createIdGenerator } from "ai";
import type { UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../db/client";
import { scenarios, roleplaySessions } from "../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { emitAiCall, buildAiCallPayload } from "../lib/ai-telemetry";
import { buildRoleplaySystem } from "../lib/server/roleplay-system-prompt";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { buildRoleplayTools } from "../lib/server/roleplay-tools";
import { log } from "../lib/logger";
import {
  loadChatMessages,
  appendUserMessage,
  appendAssistantMessage,
  syncTranscriptColumn,
  pickLatestUserMessage,
  uiMessageTextParts,
} from "../lib/server/chat-messages";

/**
 * Roleplay streaming endpoint.
 *
 * POST /api/roleplay/:slug/stream
 *
 * Wire-compatible with the AI SDK v6 `useChat()` UI message protocol.
 *
 * AI-SDK-2 — server-side persistence + resume:
 *  - Client ships `{ id: sessionId, messages: [latestUserMessage] }` via
 *    `prepareSendMessagesRequest` on its `DefaultChatTransport`.
 *  - Server reloads the conversation from the `chat_messages` table using
 *    `id` as the session key.
 *  - Server appends the new user turn (idempotent on `clientMessageId`)
 *    and feeds the FULL history to `streamText`.
 *  - On stream finish (`toUIMessageStreamResponse({ onFinish })`) the
 *    assistant turn is persisted with its server-generated stable id.
 *  - `roleplay_sessions.transcript` (JSON) is rewritten each turn so the
 *    grader keeps reading whole transcripts from one column.
 *
 * Prompt caching (AI-SDK-1): the system prompt is built via
 * `buildRoleplaySystem` which attaches Anthropic ephemeral cache_control.
 * Cache hit metrics land in `ai.call` telemetry and in `roleplay stream
 * finish` log lines.
 */

// Stable assistant-message ids so the persisted store and client agree.
const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 });

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
        const me = [await ensureUserRow(a.userId, drz, env)];

        const scenarioRow = await drz
          .select()
          .from(scenarios)
          .where(eq(scenarios.slug, params.slug))
          .limit(1);
        if (!scenarioRow[0]) return new Response("Scenario not found", { status: 404 });
        const s = scenarioRow[0];

        // The client ships the chat id (== sessionId for this scenario) plus
        // either a single new user message or the full list (depending on
        // whether `prepareSendMessagesRequest` is wired). We handle both.
        const body = (await request.json()) as {
          id?: string | number;
          messages: UIMessage[];
        };

        // Resolve the sessionId. Prefer the explicit `id` from the client,
        // fall back to the most-recent open session for this user+scenario.
        let sessionId: number | null =
          typeof body.id === "number"
            ? body.id
            : typeof body.id === "string" && /^\d+$/.test(body.id)
              ? Number(body.id)
              : null;

        if (sessionId !== null) {
          // Ownership + existence check.
          const ownRow = await drz
            .select({ id: roleplaySessions.id })
            .from(roleplaySessions)
            .where(
              and(
                eq(roleplaySessions.id, sessionId),
                eq(roleplaySessions.userId, me[0].id),
              ),
            )
            .limit(1);
          if (!ownRow[0]) {
            return new Response("Session not found", { status: 404 });
          }
        } else {
          // No id supplied — pick or create an open session for this scenario.
          const openRow = await drz
            .select({ id: roleplaySessions.id })
            .from(roleplaySessions)
            .where(
              and(
                eq(roleplaySessions.userId, me[0].id),
                eq(roleplaySessions.scenarioId, s.id),
              ),
            )
            .limit(1);
          if (openRow[0]) {
            sessionId = openRow[0].id;
          } else {
            const inserted = await drz
              .insert(roleplaySessions)
              .values({
                userId: me[0].id,
                scenarioId: s.id,
                transcript: [],
              })
              .returning({ id: roleplaySessions.id });
            sessionId = inserted[0].id;
          }
        }

        // Persist the new user turn (the LAST user message in the shipped
        // payload, ignoring any older history the client also sent — server
        // is the source of truth).
        const latestUser = pickLatestUserMessage(body.messages);
        if (latestUser) {
          await appendUserMessage(drz, {
            sessionId,
            userId: me[0].id,
            clientMessageId: latestUser.id,
            parts: latestUser.parts,
          });
        }

        // Reload full history server-side and feed the model.
        const persistedMessages = await loadChatMessages(drz, sessionId);
        // Keep the transcript JSON column in sync for the grader.
        await syncTranscriptColumn(drz, sessionId);

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
          messages: await convertToModelMessages(persistedMessages),
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
              sessionId,
            },
          },
          onFinish: ({ usage, finishReason, providerMetadata }) => {
            const anth = providerMetadata?.anthropic as
              | { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
              | undefined;
            const cacheCreationInputTokens = anth?.cacheCreationInputTokens ?? 0;
            const cacheReadInputTokens = anth?.cacheReadInputTokens ?? 0;

            log.info("roleplay stream finish", {
              scenarioSlug: params.slug,
              userId: me[0].id,
              sessionId,
              turnUserMessages: persistedMessages.length,
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
                sessionId,
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
              extra: { sessionId, error: String(error) },
            });
            emitAiCall(payload, env, ctx);
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: persistedMessages,
          generateMessageId,
          onFinish: async ({ responseMessage }) => {
            // Persist the assistant turn now that the full message is built.
            // Wrap in try/catch so a write failure does not crash the stream
            // for the client — the user already received the tokens.
            try {
              await appendAssistantMessage(drz, {
                sessionId: sessionId,
                userId: me[0].id,
                clientMessageId: responseMessage.id,
                parts: uiMessageTextParts(responseMessage),
              });
              await syncTranscriptColumn(drz, sessionId);
            } catch (err) {
              log.error("roleplay persist assistant failed", {
                sessionId,
                err: String(err),
              });
            }
          },
        });
      },
    },
  },
});
