/**
 * GET /api/notifications/inbox
 *
 * List unread in-app notifications addressed to the signed-in user, newest
 * first. Hard-capped at 20 rows. Each row carries a best-effort `link` (a
 * relative app path) and `fromDisplayName` so the dropdown does not need a
 * second round-trip per item.
 *
 * Friend-only filter: producers (e.g. `submitPeerDrill`) verify the
 * friendship before inserting an in_app row. The reader trusts the
 * `user_id` on the row.
 *
 * Responses:
 *   - 401 not signed in.
 *   - 200 { notifications: InboxNotification[] }
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { listInbox } from "../lib/server/notifications";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/notifications/inbox")({
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

        const notifications = await listInbox(drz, userId);
        return jsonResponse({ notifications });
      },
    },
  },
});
