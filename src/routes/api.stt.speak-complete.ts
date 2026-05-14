/**
 * POST /api/stt/speak-complete  (P2-STT-3 #56)
 *
 * Records the outcome of a scored speak-drill attempt and, on the first
 * passing attempt for a given (userId, drillId) pair, awards XP plus bumps
 * the daily-quest `speak` progress.
 *
 * The companion `/api/stt/score` endpoint is read-only and just runs the
 * pronunciation diff; this one owns the side effects so retries do not
 * inflate XP.
 *
 * Body: `{ drillId: number; score: number; transcript: string; audioKey?: string }`
 *
 * Responses:
 *   - 401 not_signed_in
 *   - 400 invalid_json | missing_drill_id | invalid_score | missing_transcript
 *   - 500 user_row_missing
 *   - 200 `{ passed, xpAwarded, alreadyAwarded }`
 *
 * "Passed" means score >= SPEAK_PASS_THRESHOLD. The award-once + bump-quests
 * logic lives in `lib/server/speak-drill.ts` so it can be unit-tested without
 * a Cloudflare runtime.
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { recordSpeakAttempt } from "../lib/server/speak-drill";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/stt/speak-complete")({
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

        let body: {
          drillId?: unknown;
          score?: unknown;
          transcript?: unknown;
          audioKey?: unknown;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }

        const drillId =
          typeof body.drillId === "number" && Number.isFinite(body.drillId) && body.drillId > 0
            ? body.drillId
            : null;
        if (drillId === null) {
          return jsonResponse({ error: "missing_drill_id" }, 400);
        }

        if (typeof body.score !== "number" || !Number.isFinite(body.score)) {
          return jsonResponse({ error: "invalid_score" }, 400);
        }
        const score = body.score;

        if (typeof body.transcript !== "string") {
          return jsonResponse({ error: "missing_transcript" }, 400);
        }
        const transcript = body.transcript;

        const audioKey =
          typeof body.audioKey === "string" && body.audioKey.length > 0
            ? body.audioKey
            : null;

        const me = await drz
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, clerkId))
          .limit(1);
        if (!me[0]) return jsonResponse({ error: "user_row_missing" }, 500);

        const result = await recordSpeakAttempt(drz, {
          userId: me[0].id,
          drillId,
          score,
          transcript,
          audioKey,
        });

        return jsonResponse(result);
      },
    },
  },
});
