/**
 * Per-message persistence helpers for the AI SDK v6 `useChat` resume pattern.
 *
 * The streaming endpoint (`/api/roleplay/:slug/stream`) calls these to:
 *
 * 1. `loadChatMessages(drz, sessionId)` — pull the full message history for
 *    a roleplay session, returned as `UIMessage[]` ready to feed into
 *    `convertToModelMessages` and then `streamText`.
 * 2. `appendUserMessage(drz, ...)` — write the user turn the client just
 *    sent. Idempotent on `(session_id, client_message_id)` so a retried
 *    request after a flaky network doesn't double-insert.
 * 3. `appendAssistantMessage(drz, ...)` — write the assistant turn at
 *    stream finish. Same idempotency contract.
 * 4. `syncTranscriptColumn(drz, sessionId)` — rewrite the denormalised
 *    `roleplay_sessions.transcript` JSON so the grading code (which reads
 *    that column) sees the latest history without changing.
 *
 * The shape stored in `chat_messages.parts` is the raw `UIMessage.parts[]`
 * blob. We always store as `{ type: "text", text: ... }` array entries for
 * now; future multimodal/tool parts round-trip without schema change.
 *
 * Redaction: PII redaction on the persisted text happens in this layer too,
 * so the chat_messages table never holds raw emails/BSNs/IBANs/phone
 * numbers. The redaction-middleware module remains the single regex source
 * of truth.
 */
import { asc, eq } from "drizzle-orm";
import type { DB } from "../../db/client";
import { chatMessages, roleplaySessions } from "../../db/schema";
import { redactText, summariseMatches } from "./redaction-middleware";
import { log } from "../logger";
import type { UIMessage } from "ai";

type Drz = DB;

export type PersistedMessage = {
  id: string; // client_message_id
  role: "user" | "assistant" | "system";
  parts: Array<{ type: string; text?: string; [k: string]: unknown }>;
};

/**
 * Load the full message history for a session in chronological order.
 * The result is shaped as `UIMessage[]` so the streaming endpoint can hand
 * it straight to `convertToModelMessages` without any reshaping.
 */
export async function loadChatMessages(
  drz: Drz,
  sessionId: number,
): Promise<UIMessage[]> {
  const rows = await drz
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

  return rows.map((r) => ({
    id: r.clientMessageId,
    role: r.role as UIMessage["role"],
    parts: (r.parts ?? []) as UIMessage["parts"],
  })) as UIMessage[];
}

/**
 * Append a user message. Idempotent on `(sessionId, clientMessageId)`:
 * a retried fetch after a network blip resolves to the same row, not a
 * duplicate one. Redacts PII in any text parts before write so the
 * persisted store never holds raw email/BSN/etc.
 */
export async function appendUserMessage(
  drz: Drz,
  args: {
    sessionId: number;
    userId: number;
    clientMessageId: string;
    parts: Array<{ type: string; text?: string; [k: string]: unknown }>;
  },
): Promise<void> {
  const cleanedParts = args.parts.map((p) => {
    if (p.type === "text" && typeof p.text === "string") {
      const r = redactText(p.text);
      if (r.matches.length > 0) {
        log.info("ai.redacted", {
          direction: "chat_message",
          sessionId: args.sessionId,
          role: "user",
          counts: summariseMatches(r.matches),
        });
      }
      return { ...p, text: r.text };
    }
    return p;
  });

  // INSERT OR IGNORE on the unique (session_id, client_message_id) index.
  // Drizzle exposes this as `.onConflictDoNothing()`.
  await drz
    .insert(chatMessages)
    .values({
      sessionId: args.sessionId,
      userId: args.userId,
      clientMessageId: args.clientMessageId,
      role: "user",
      parts: cleanedParts,
    })
    .onConflictDoNothing();
}

/**
 * Append (or replace) an assistant message at stream finish. We write at
 * the very end of `toUIMessageStreamResponse({ onFinish })` so partial
 * tokens from a mid-stream drop never land in the persisted store; the
 * client will simply re-request and get a fresh assistant turn.
 */
export async function appendAssistantMessage(
  drz: Drz,
  args: {
    sessionId: number;
    userId: number;
    clientMessageId: string;
    parts: Array<{ type: string; text?: string; [k: string]: unknown }>;
  },
): Promise<void> {
  const cleanedParts = args.parts.map((p) => {
    if (p.type === "text" && typeof p.text === "string") {
      const r = redactText(p.text);
      if (r.matches.length > 0) {
        log.info("ai.redacted", {
          direction: "chat_message",
          sessionId: args.sessionId,
          role: "assistant",
          counts: summariseMatches(r.matches),
        });
      }
      return { ...p, text: r.text };
    }
    return p;
  });

  await drz
    .insert(chatMessages)
    .values({
      sessionId: args.sessionId,
      userId: args.userId,
      clientMessageId: args.clientMessageId,
      role: "assistant",
      parts: cleanedParts,
    })
    .onConflictDoNothing();
}

/**
 * Mirror the chat_messages rows back into the legacy
 * `roleplay_sessions.transcript` JSON column. The grading code in
 * `roleplay.ts` reads that column directly, so we keep it in sync on
 * every turn rather than reshaping the grader.
 *
 * The denormalised shape stays compatible with `RoleplayTranscriptEntry`:
 * `{ role, content, ts }`. `content` is the flat text join of all text
 * parts; tool/file parts are skipped because the grader only scores text.
 */
export async function syncTranscriptColumn(
  drz: Drz,
  sessionId: number,
): Promise<void> {
  const rows = await drz
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

  const transcript = rows.map((r) => {
    const parts = (r.parts ?? []) as Array<{ type: string; text?: string }>;
    const content = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    return {
      role: r.role as "user" | "assistant" | "system",
      content,
      ts: r.createdAt,
    };
  });

  await drz
    .update(roleplaySessions)
    .set({ transcript })
    .where(eq(roleplaySessions.id, sessionId));
}

/**
 * Extract the single newest user message id from a `UIMessage[]` payload
 * the client just sent. The v6 persistence pattern has the client ship
 * only the last user turn (via `prepareSendMessagesRequest`), but during
 * a refresh-then-resume case the client may also legitimately re-send
 * an older list. Either way we pick the LAST user message and treat its
 * id as the deduplication key.
 */
export function pickLatestUserMessage(messages: UIMessage[]):
  | { id: string; parts: UIMessage["parts"] }
  | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") {
      return { id: m.id, parts: m.parts };
    }
  }
  return null;
}

/**
 * Find the assistant message id from an `originalMessages` + `responseMessage`
 * pair as supplied to `toUIMessageStreamResponse({ originalMessages, onFinish })`.
 * The SDK guarantees `responseMessage.id` is set when `originalMessages` is
 * passed in, but we wrap it for null-safety.
 */
export function pickResponseMessageId(responseMessage: UIMessage): string {
  return responseMessage.id;
}

/**
 * Extract just the text parts from a UIMessage as a plain array.
 */
export function uiMessageTextParts(
  m: UIMessage,
): Array<{ type: string; text?: string; [k: string]: unknown }> {
  return (m.parts ?? []) as Array<{ type: string; text?: string; [k: string]: unknown }>;
}
