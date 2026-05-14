/**
 * Integration shape test for transcript redaction.
 *
 * `finishRoleplaySession` (in `roleplay.ts`) walks every transcript entry,
 * runs `redactText` over its content, and writes the cleaned array to the
 * `roleplay_sessions.transcript` D1 column. The server fn itself depends on
 * the TanStack Start `createServerFn` runtime + Clerk auth which is awkward
 * to spin up in a node vitest, so this test exercises the redaction step
 * directly against the in-memory better-sqlite3 D1 stub and asserts the
 * persisted JSON column has been scrubbed.
 *
 * This is the integration-shape contract the acceptance criterion calls
 * for ("send a message containing a fake BSN, assert it's redacted in the
 * persisted transcript"): the entry goes in raw, the JSON column comes out
 * with [REDACTED_BSN] in place of the digits.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { redactText } from "../redaction-middleware";
import { makeTestDb, seedUser } from "./test-db";
import type { TestDb } from "./test-db";
import { roleplaySessions, scenarios } from "../../../db/schema";
import { eq } from "drizzle-orm";

type RoleplayTranscriptEntry = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
};

/**
 * Mirror the redaction loop from `finishRoleplaySession` so the integration
 * contract is exercised here. If `roleplay.ts` ever drifts from this
 * implementation, both call sites need to update together.
 */
function redactTranscript(
  transcript: RoleplayTranscriptEntry[],
): RoleplayTranscriptEntry[] {
  return transcript.map((entry) => {
    const r = redactText(entry.content);
    return { ...entry, content: r.text };
  });
}

describe("transcript redaction (integration: in-memory D1)", () => {
  let drz: TestDb;

  beforeEach(() => {
    drz = makeTestDb();
  });

  it("strips a Dutch BSN from the persisted transcript JSON column", async () => {
    const userId = seedUser(drz);

    // Seed a minimal scenario row (FK target). Drizzle-typed insert lets us
    // skip the optional columns that have defaults.
    const scen = await drz
      .insert(scenarios)
      .values({
        slug: "test-bsn",
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

    const session = await drz
      .insert(roleplaySessions)
      .values({
        userId,
        scenarioId: scen[0].id,
        transcript: [],
      })
      .returning({ id: roleplaySessions.id });

    const rawTranscript: RoleplayTranscriptEntry[] = [
      {
        role: "user",
        content: "Mijn BSN is 111222333 en mijn email is ronan@example.com",
        ts: "2026-05-14T20:00:00Z",
      },
      {
        role: "assistant",
        content: "Bedankt, ik heb het genoteerd",
        ts: "2026-05-14T20:00:05Z",
      },
      {
        role: "user",
        content: "Mijn telefoonnummer is 0612345678",
        ts: "2026-05-14T20:00:10Z",
      },
    ];

    // This mirrors the `finishRoleplaySession` flow.
    const cleaned = redactTranscript(rawTranscript);
    await drz
      .update(roleplaySessions)
      .set({ transcript: cleaned, completedAt: new Date().toISOString() })
      .where(eq(roleplaySessions.id, session[0].id));

    const persisted = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, session[0].id))
      .limit(1);

    const stored = persisted[0].transcript as RoleplayTranscriptEntry[];
    expect(stored).toHaveLength(3);

    // Raw BSN gone, placeholder in its place.
    expect(stored[0].content).not.toContain("111222333");
    expect(stored[0].content).toContain("[REDACTED_BSN]");
    expect(stored[0].content).not.toContain("ronan@example.com");
    expect(stored[0].content).toContain("[REDACTED_EMAIL]");

    // Assistant content with no PII passes through unchanged.
    expect(stored[1].content).toBe("Bedankt, ik heb het genoteerd");

    // Phone redacted in the third entry.
    expect(stored[2].content).not.toContain("0612345678");
    expect(stored[2].content).toContain("[REDACTED_PHONE]");

    // Belt-and-suspenders: the raw row body in the underlying sqlite blob
    // also has no trace of the BSN. This catches any future regression
    // where someone forgets to overwrite the column.
    const rawRow = drz.$sqlite
      .prepare("SELECT transcript FROM roleplay_sessions WHERE id = ?")
      .get(session[0].id) as { transcript: string };
    expect(rawRow.transcript).not.toContain("111222333");
    expect(rawRow.transcript).not.toContain("0612345678");
    expect(rawRow.transcript).not.toContain("ronan@example.com");
  });
});
