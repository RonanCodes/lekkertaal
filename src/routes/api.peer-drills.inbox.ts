/**
 * GET /api/peer-drills/inbox
 *
 * List pending peer-drills addressed to the signed-in user, newest first.
 * Each row carries the sender's denormalised display-name and avatar so the
 * UI does not need a second round-trip.
 *
 * Responses:
 *   - 401 not signed in.
 *   - 200 { drills: InboxEntry[] }
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { listInbox } from "../lib/server/peer-drills";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/peer-drills/inbox")({
  server: {
    handlers: {
      GET: async () => {
        let clerkId: string;
        try {
          clerkId = await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        const { env } = requireWorkerContext();
        const drz = db(env.DB);

        const userId = await getUserIdByClerkId(drz, clerkId);
        if (!userId) return jsonResponse({ error: "user_row_missing" }, 500);

        const drills = await listInbox(drz, userId);
        return jsonResponse({ drills });
      },
    },
  },
});
