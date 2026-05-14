/**
 * POST /api/friends/respond
 *
 * Body: { friendshipId: number, action: "accept" | "decline" }
 *
 * Only the addressee of the row may accept or decline. The row's status
 * must be `pending`.
 *
 * Responses:
 *   - 401 if not signed in.
 *   - 400 on malformed body / unknown action.
 *   - 404 if the row does not exist.
 *   - 403 if the caller is not the addressee.
 *   - 409 if the row is not in `pending` status (already accepted/declined).
 *   - 200 with `{ friendshipId, status: "accepted" | "declined" }`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import {
  FriendshipError,
  getUserIdByClerkId,
  respondToFriendship,
} from "../lib/server/friends";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/friends/respond")({
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

        let body: { friendshipId?: unknown; action?: unknown };
        try {
          body = (await request.json()) as {
            friendshipId?: unknown;
            action?: unknown;
          };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }

        const friendshipId =
          typeof body.friendshipId === "number" && Number.isFinite(body.friendshipId)
            ? body.friendshipId
            : null;
        const action =
          body.action === "accept" || body.action === "decline" ? body.action : null;

        if (friendshipId === null) {
          return jsonResponse({ error: "missing_friendship_id" }, 400);
        }
        if (action === null) {
          return jsonResponse({ error: "invalid_action" }, 400);
        }

        const responderId = await getUserIdByClerkId(drz, clerkId);
        if (!responderId) return jsonResponse({ error: "user_row_missing" }, 500);

        try {
          const result = await respondToFriendship(
            drz,
            responderId,
            friendshipId,
            action,
          );
          return jsonResponse(result);
        } catch (err) {
          if (err instanceof FriendshipError) {
            switch (err.code) {
              case "friendship_not_found":
                return jsonResponse({ error: "friendship_not_found" }, 404);
              case "not_addressee":
                return jsonResponse({ error: "not_addressee" }, 403);
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
