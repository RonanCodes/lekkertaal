/**
 * GET /api/friends/list
 *
 * Returns the signed-in user's accepted friends, sorted by display name.
 * Symmetric: a friend is anyone connected via an `accepted` row in either
 * direction. Each entry includes the friendship row id (for an eventual
 * unfriend endpoint), the friend's public profile fields, and the
 * `respondedAt` timestamp as `since`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId, listFriends } from "../lib/server/friends";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/friends/list")({
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

        const friends = await listFriends(drz, userId);
        return jsonResponse({ friends });
      },
    },
  },
});
