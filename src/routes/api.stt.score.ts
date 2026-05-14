/**
 * POST /api/stt/score
 *
 * Body: `{ drillId: number; transcript: string }`
 *
 * Resolves the drill's canonical Dutch string from `exercises.answer` and
 * scores the transcript against it via `scorePronunciation`. Returns a
 * 0-100 score plus a per-token diff that the speak-drill UI uses to render
 * "you said X, expected Y" feedback.
 *
 * Responses:
 *   - 401 not_signed_in
 *   - 400 invalid_json | missing_drill_id | missing_transcript
 *   - 404 drill_not_found
 *   - 422 drill_missing_canonical (drill exists but has no canonical Dutch)
 *   - 500 user_row_missing
 *   - 200 `{ score, tokens: [{ word, status, spoken? }] }`
 *
 * Auth-gated via `requireUserClerkId()`. We don't persist the score here;
 * P2-STT-3 will wire scoring into the lesson flow and decide where to
 * record speak-drill outcomes. This endpoint is read-only against the
 * exercises table.
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { exercises, users } from "../db/schema";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { scorePronunciation } from "../lib/server/pronunciation";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Pull the canonical Dutch string off an exercise row. Seed-load writes
 * the speak drill's `canonical_dutch` directly into `answer` as a plain
 * string (see scripts/seed-load.ts), so the common case is a string.
 * Translation-style drills store an object/array; we ignore those here
 * because /api/stt/score is only meaningful for speak drills.
 */
function pickCanonical(answer: unknown): string | null {
  if (typeof answer === "string" && answer.trim().length > 0) return answer;
  return null;
}

export const Route = createFileRoute("/api/stt/score")({
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

        let body: { drillId?: unknown; transcript?: unknown };
        try {
          body = (await request.json()) as { drillId?: unknown; transcript?: unknown };
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

        if (typeof body.transcript !== "string") {
          return jsonResponse({ error: "missing_transcript" }, 400);
        }
        const transcript = body.transcript;

        const me = await drz
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, clerkId))
          .limit(1);
        if (!me[0]) return jsonResponse({ error: "user_row_missing" }, 500);

        const drill = await drz
          .select({ answer: exercises.answer, promptNl: exercises.promptNl })
          .from(exercises)
          .where(eq(exercises.id, drillId))
          .limit(1);
        if (!drill[0]) return jsonResponse({ error: "drill_not_found" }, 404);

        // Prefer `answer` (seed-load convention for speak drills); fall back
        // to `prompt_nl` for legacy speak drills that put the canonical in
        // the prompt rather than the answer. If neither is a plain string
        // we cannot score, so 422.
        const canonical = pickCanonical(drill[0].answer) ?? pickCanonical(drill[0].promptNl);
        if (canonical === null) {
          return jsonResponse({ error: "drill_missing_canonical" }, 422);
        }

        const result = scorePronunciation(canonical, transcript);
        return jsonResponse(result);
      },
    },
  },
});
