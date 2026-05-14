/**
 * GET /api/leaderboard/friends?window=today|week|all-time
 *
 * Returns the signed-in user plus their accepted friends, ranked by window
 * XP descending. `rows` is empty when the caller has no friends — the UI
 * uses that to render the "add friends" empty state with a CTA into the
 * friends page.
 *
 * Default window is `week` (the leaderboard page defaults to "This week"
 * for the Friends tab; Global keeps its existing default).
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import { getFriendsLeaderboardForUser } from "../lib/server/leaderboard";
import type { LeaderboardWindow } from "../lib/server/leaderboard";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseWindow(v: string | null): LeaderboardWindow {
  if (v === "today" || v === "week" || v === "all-time") return v;
  return "week";
}

export const Route = createFileRoute("/api/leaderboard/friends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const url = new URL(request.url);
        const windowName = parseWindow(url.searchParams.get("window"));

        const result = await getFriendsLeaderboardForUser(drz, userId, windowName);
        return jsonResponse(result);
      },
    },
  },
});
