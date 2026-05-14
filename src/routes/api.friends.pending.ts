/**
 * GET /api/friends/pending
 *
 * Returns incoming pending friend requests for the signed-in user (rows
 * where the caller is the addressee and status = 'pending'). Sorted newest
 * first. Outgoing requests are not surfaced here — the UI for "who I asked"
 * is a future endpoint if needed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId, listPendingRequests } from "../lib/server/friends";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/friends/pending")({
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

        const pending = await listPendingRequests(drz, userId);
        return jsonResponse({ pending });
      },
    },
  },
});
