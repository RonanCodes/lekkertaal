/**
 * POST /api/daily-quests/claim
 *
 * Body: { questId: number }
 *
 * Claims a completed-but-not-yet-claimed daily quest belonging to the
 * authenticated user. Awards bonus XP + coins and marks the row claimed.
 *
 * Responses:
 *   - 401 if not signed in.
 *   - 400 on malformed body.
 *   - 404 when the quest doesn't exist or isn't owned by the caller.
 *   - 409 when the quest isn't completed yet, or is already claimed.
 *   - 200 with `{ bonusXp, bonusCoins }` on success.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { claimQuest } from "../lib/server/daily-quests";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/daily-quests/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let clerkId: string;
        try {
          clerkId = await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        const { env } = requireWorkerContext();
        const drz = db(env.DB);

        let body: { questId?: unknown };
        try {
          body = (await request.json()) as { questId?: unknown };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }

        const questId =
          typeof body.questId === "number" && Number.isFinite(body.questId)
            ? body.questId
            : null;
        if (questId === null) {
          return jsonResponse({ error: "missing_quest_id" }, 400);
        }

        const me = await drz
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, clerkId))
          .limit(1);
        if (!me[0]) return jsonResponse({ error: "user_row_missing" }, 500);

        try {
          const result = await claimQuest(drz, me[0].id, questId);
          return jsonResponse(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === "Quest not found") return jsonResponse({ error: "not_found" }, 404);
          if (msg === "Quest already claimed") {
            return jsonResponse({ error: "already_claimed" }, 409);
          }
          if (msg === "Quest not yet completed") {
            return jsonResponse({ error: "not_completed" }, 409);
          }
          throw err;
        }
      },
    },
  },
});
