/**
 * POST /api/friends/request
 *
 * Body: { addresseeUsername: string }
 *
 * Sends a friend request from the signed-in user to the named user.
 *
 * Behaviour:
 *   - 401 if not signed in.
 *   - 400 if the body is malformed or addresseeUsername is empty.
 *   - 404 if no user matches that display name (case-insensitive).
 *   - 400 with `{ error: "self_friend" }` if the addressee is the caller.
 *   - 409 with `{ error: "already_friends" }` if an accepted friendship
 *     already exists between the pair.
 *   - 200 with `{ friendshipId, status: "pending", idempotent: true }`
 *     when a pending request already exists between the pair (in either
 *     direction). Re-requesting is a no-op.
 *   - 200 with `{ friendshipId, status: "pending", idempotent: false }`
 *     on a fresh row (including re-invite after a previous decline).
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import {
  FriendshipError,
  getUserIdByClerkId,
  requestFriendship,
} from "../lib/server/friends";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/friends/request")({
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

        let body: { addresseeUsername?: unknown };
        try {
          body = (await request.json()) as { addresseeUsername?: unknown };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }
        const addresseeUsername =
          typeof body.addresseeUsername === "string"
            ? body.addresseeUsername.trim()
            : "";
        if (!addresseeUsername) {
          return jsonResponse({ error: "missing_addressee_username" }, 400);
        }

        const requesterId = await getUserIdByClerkId(drz, clerkId);
        if (!requesterId) return jsonResponse({ error: "user_row_missing" }, 500);

        try {
          const result = await requestFriendship(drz, requesterId, addresseeUsername);
          return jsonResponse({
            friendshipId: result.friendshipId,
            status: result.status,
            idempotent: !result.createdFresh,
          });
        } catch (err) {
          if (err instanceof FriendshipError) {
            switch (err.code) {
              case "user_not_found":
                return jsonResponse({ error: "user_not_found" }, 404);
              case "self_friend":
                return jsonResponse({ error: "self_friend" }, 400);
              case "already_friends":
                return jsonResponse({ error: "already_friends" }, 409);
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
