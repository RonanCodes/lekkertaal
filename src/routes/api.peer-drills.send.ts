/**
 * POST /api/peer-drills/send
 *
 * Body: { toUserId: number, prompt: string, expectedAnswerHint?: string }
 *
 * Send a Dutch sentence to a friend for translation. Both ends must already
 * be on an `accepted` friendships row (either direction).
 *
 * Responses:
 *   - 401 not signed in.
 *   - 400 malformed body, missing/empty prompt, missing toUserId, or self-send.
 *   - 403 not_friends — caller and recipient are not accepted friends.
 *   - 404 user_not_found — recipient id has no users row.
 *   - 200 { id } — drill row created, status=pending.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { PeerDrillError, sendPeerDrill } from "../lib/server/peer-drills";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/peer-drills/send")({
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

        let body: { toUserId?: unknown; prompt?: unknown; expectedAnswerHint?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }

        const toUserId =
          typeof body.toUserId === "number" && Number.isFinite(body.toUserId)
            ? body.toUserId
            : null;
        if (toUserId === null) {
          return jsonResponse({ error: "missing_to_user_id" }, 400);
        }
        const prompt = typeof body.prompt === "string" ? body.prompt : "";
        if (!prompt.trim()) {
          return jsonResponse({ error: "missing_prompt" }, 400);
        }
        const hint =
          typeof body.expectedAnswerHint === "string" ? body.expectedAnswerHint : null;

        const fromUserId = await getUserIdByClerkId(drz, clerkId);
        if (!fromUserId) return jsonResponse({ error: "user_row_missing" }, 500);

        try {
          const result = await sendPeerDrill(drz, fromUserId, toUserId, prompt, hint);
          return jsonResponse({ id: result.id });
        } catch (err) {
          if (err instanceof PeerDrillError) {
            switch (err.code) {
              case "self_drill":
                return jsonResponse({ error: "self_drill" }, 400);
              case "empty_prompt":
                return jsonResponse({ error: "empty_prompt" }, 400);
              case "user_not_found":
                return jsonResponse({ error: "user_not_found" }, 404);
              case "not_friends":
                return jsonResponse({ error: "not_friends" }, 403);
              default:
                return jsonResponse({ error: err.code }, 400);
            }
          }
          throw err;
        }
      },
    },
  },
});
