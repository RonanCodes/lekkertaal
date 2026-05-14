/**
 * Integration test for the AI-SDK-2 per-message persistence layer.
 *
 * `appendUserMessage` / `appendAssistantMessage` write into the
 * `chat_messages` table; `loadChatMessages` reads them back as `UIMessage[]`;
 * `syncTranscriptColumn` rewrites the denormalised JSON on
 * `roleplay_sessions.transcript` for the grader.
 *
 * Acceptance criterion this exercises: enqueue 5 messages across both
 * roles, reload, assert all 5 hydrate in order. Plus the resume hot path
 * a second time (duplicate clientMessageId is a no-op, not an error).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  appendUserMessage,
  appendAssistantMessage,
  loadChatMessages,
  syncTranscriptColumn,
} from "../chat-messages";
import { makeTestDb, seedUser, asD1 } from "./test-db";
import type { TestDb } from "./test-db";
import { roleplaySessions, scenarios } from "../../../db/schema";

describe("chat-messages persistence (integration: in-memory D1)", () => {
  let drz: TestDb;
  let userId: number;
  let sessionId: number;

  beforeEach(async () => {
    drz = makeTestDb();
    userId = seedUser(drz);

    const scen = await drz
      .insert(scenarios)
      .values({
        slug: "test-chat",
        titleNl: "Test",
        titleEn: "Test",
        difficulty: "A2",
        npcName: "Bot",
        npcPersona: "tester",
        openingNl: "Hallo",
        estimatedMinutes: 5,
        xpReward: 10,
      })
      .returning({ id: scenarios.id });

    const sess = await drz
      .insert(roleplaySessions)
      .values({
        userId,
        scenarioId: scen[0].id,
        transcript: [],
      })
      .returning({ id: roleplaySessions.id });

    sessionId = sess[0].id;
  });

  it("round-trips a 5-message conversation in order", async () => {
    const turns: Array<{ role: "user" | "assistant"; id: string; text: string }> = [
      { role: "user", id: "msg-u1", text: "Hoi Bot" },
      { role: "assistant", id: "msg-a1", text: "Hallo, hoe gaat het?" },
      { role: "user", id: "msg-u2", text: "Goed, en met jou?" },
      { role: "assistant", id: "msg-a2", text: "Ook prima!" },
      { role: "user", id: "msg-u3", text: "Klaar" },
    ];

    for (const t of turns) {
      const args = {
        sessionId,
        userId,
        clientMessageId: t.id,
        parts: [{ type: "text", text: t.text }],
      };
      if (t.role === "user") {
        await appendUserMessage(asD1(drz), args);
      } else {
        await appendAssistantMessage(asD1(drz), args);
      }
    }

    const loaded = await loadChatMessages(asD1(drz), sessionId);
    expect(loaded).toHaveLength(5);
    expect(loaded.map((m) => m.id)).toEqual([
      "msg-u1",
      "msg-a1",
      "msg-u2",
      "msg-a2",
      "msg-u3",
    ]);
    expect(loaded.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    // Text parts intact.
    const textOf = (i: number) =>
      (loaded[i].parts[0] as { text: string }).text;
    expect(textOf(0)).toBe("Hoi Bot");
    expect(textOf(2)).toBe("Goed, en met jou?");
    expect(textOf(4)).toBe("Klaar");
  });

  it("is idempotent on duplicate clientMessageId (network retry safe)", async () => {
    const args = {
      sessionId,
      userId,
      clientMessageId: "msg-u1",
      parts: [{ type: "text", text: "Hoi Bot" }],
    };
    await appendUserMessage(asD1(drz), args);
    await appendUserMessage(asD1(drz), args);
    await appendUserMessage(asD1(drz), args);

    const loaded = await loadChatMessages(asD1(drz), sessionId);
    expect(loaded).toHaveLength(1);
  });

  it("syncs the denormalised transcript JSON column", async () => {
    await appendUserMessage(asD1(drz), {
      sessionId,
      userId,
      clientMessageId: "msg-u1",
      parts: [{ type: "text", text: "Hoi" }],
    });
    await appendAssistantMessage(asD1(drz), {
      sessionId,
      userId,
      clientMessageId: "msg-a1",
      parts: [{ type: "text", text: "Hallo!" }],
    });
    await syncTranscriptColumn(asD1(drz), sessionId);

    const row = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, sessionId))
      .limit(1);
    const transcript = row[0].transcript as Array<{
      role: string;
      content: string;
    }>;
    expect(transcript).toHaveLength(2);
    expect(transcript[0]).toMatchObject({ role: "user", content: "Hoi" });
    expect(transcript[1]).toMatchObject({ role: "assistant", content: "Hallo!" });
  });

  it("redacts PII at write time so chat_messages never holds raw secrets", async () => {
    await appendUserMessage(asD1(drz), {
      sessionId,
      userId,
      clientMessageId: "msg-u1",
      parts: [
        {
          type: "text",
          text: "Mijn BSN is 111222333 en email ronan@example.com",
        },
      ],
    });

    const loaded = await loadChatMessages(asD1(drz), sessionId);
    const text = (loaded[0].parts[0] as { text: string }).text;
    expect(text).not.toContain("111222333");
    expect(text).not.toContain("ronan@example.com");
    expect(text).toContain("[REDACTED_BSN]");
    expect(text).toContain("[REDACTED_EMAIL]");
  });

  it("hydrates an empty session as an empty array (cold start)", async () => {
    const loaded = await loadChatMessages(asD1(drz), sessionId);
    expect(loaded).toEqual([]);
  });
});
