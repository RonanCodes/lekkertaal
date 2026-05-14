/**
 * POST /api/peer-drills/:id/submit
 *
 * Body: { answer: string }
 *
 * Recipient submits their translation attempt. Marks the row `completed`,
 * stamps `completed_at`, and writes an in-app `notification_log` row back to
 * the sender (channel="in_app", kind="peer_drill_completed").
 *
 * Responses:
 *   - 401 not signed in.
 *   - 400 invalid body, missing answer, bad :id.
 *   - 403 not_recipient — caller didn't receive this drill.
 *   - 403 not_friends — friendship was revoked between send and submit.
 *   - 404 drill_not_found — :id has no peer_drills row.
 *   - 409 not_pending — drill already completed or skipped.
 *   - 200 { id, fromUserId }
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { PeerDrillError, submitPeerDrill } from "../lib/server/peer-drills";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/peer-drills/$id/submit")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let clerkId: string;
        try {
          clerkId = await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        const drillId = Number.parseInt(params.id, 10);
        if (!Number.isFinite(drillId) || drillId <= 0) {
          return jsonResponse({ error: "invalid_id" }, 400);
        }

        const { env } = requireWorkerContext();
        const drz = db(env.DB);

        let body: { answer?: unknown };
        try {
          body = (await request.json()) as { answer?: unknown };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }
        const answer = typeof body.answer === "string" ? body.answer : "";
        if (!answer.trim()) {
          return jsonResponse({ error: "missing_answer" }, 400);
        }

        const recipientId = await getUserIdByClerkId(drz, clerkId);
        if (!recipientId) return jsonResponse({ error: "user_row_missing" }, 500);

        try {
          const result = await submitPeerDrill(drz, drillId, recipientId, answer);
          return jsonResponse({ id: result.id, fromUserId: result.fromUserId });
        } catch (err) {
          if (err instanceof PeerDrillError) {
            switch (err.code) {
              case "empty_answer":
                return jsonResponse({ error: "empty_answer" }, 400);
              case "drill_not_found":
                return jsonResponse({ error: "drill_not_found" }, 404);
              case "not_recipient":
                return jsonResponse({ error: "not_recipient" }, 403);
              case "not_friends":
                return jsonResponse({ error: "not_friends" }, 403);
              case "not_pending":
                return jsonResponse({ error: "not_pending" }, 409);
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
