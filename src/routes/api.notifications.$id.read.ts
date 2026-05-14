/**
 * POST /api/notifications/:id/read
 *
 * Mark a single in-app notification as read. Idempotent — a second call on an
 * already-read row returns 200 with `{ updated: false }`. Authorisation is
 * enforced by matching on the row's `user_id`; trying to dismiss someone
 * else's notification returns the same shape (no leakage), just `updated:
 * false`.
 *
 * Responses:
 *   - 401 not signed in.
 *   - 400 :id is not a positive integer.
 *   - 200 { updated: boolean }
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { markRead } from "../lib/server/notifications";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/notifications/$id/read")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        let clerkId: string;
        try {
          clerkId = await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        const notificationId = Number.parseInt(params.id, 10);
        if (!Number.isFinite(notificationId) || notificationId <= 0) {
          return jsonResponse({ error: "invalid_id" }, 400);
        }

        const { env } = requireWorkerContext();
        const drz = db(env.DB);

        const userId = await getUserIdByClerkId(drz, clerkId);
        if (!userId) return jsonResponse({ error: "user_row_missing" }, 500);

        const updated = await markRead(drz, notificationId, userId);
        return jsonResponse({ updated });
      },
    },
  },
});
