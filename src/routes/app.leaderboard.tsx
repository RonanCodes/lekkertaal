import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { getLeaderboard, getFriendsLeaderboard } from "../lib/server/leaderboard";
import type {
  LeaderboardRow,
  LeaderboardWindow,
  LeaderboardScope,
} from "../lib/server/leaderboard";
import { tierMeta } from "../lib/server/leagues";
import { AppShell } from "../components/AppShell";

const searchSchema = z.object({
  window: z.enum(["today", "week", "all-time"]).catch("today"),
  scope: z.enum(["global", "friends"]).catch("global"),
});

export const Route = createFileRoute("/app/leaderboard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ window: search.window, scope: search.scope }),
  loader: async ({ deps }) => {
    if (deps.scope === "friends") {
      const friends = await getFriendsLeaderboard({ data: { window: deps.window } });
      return { kind: "friends" as const, ...friends };
    }
    const global = await getLeaderboard({ data: { window: deps.window } });
    return { kind: "global" as const, ...global };
  },
  component: LeaderboardPage,
});

const WINDOW_TABS: Array<{ id: LeaderboardWindow; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all-time", label: "All time" },
];

const SCOPE_TABS: Array<{ id: LeaderboardScope; label: string }> = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Friends" },
];

function LeaderboardPage() {
  const data = Route.useLoaderData();
  const { window: activeWindow, scope: activeScope } = Route.useSearch();
  const { user } = data;

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-neutral-500">
            {activeScope === "friends"
              ? "You and your friends, ranked by XP."
              : "Top 50 by XP. Your rank is shown even if you're outside the top."}
          </p>
        </header>

        {/* Scope tabs (Global / Friends) */}
        <div
          className="flex gap-1 rounded-lg bg-neutral-100 p-1"
          role="tablist"
          aria-label="Leaderboard scope"
        >
          {SCOPE_TABS.map((t) => (
            <Link
              key={t.id}
              to="/app/leaderboard"
              search={{ window: activeWindow, scope: t.id }}
              role="tab"
              aria-selected={activeScope === t.id}
              data-testid={`leaderboard-scope-${t.id}`}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-semibold ${
                activeScope === t.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Window tabs */}
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {WINDOW_TABS.map((t) => (
            <Link
              key={t.id}
              to="/app/leaderboard"
              search={{ window: t.id, scope: activeScope }}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium ${
                activeWindow === t.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {data.kind === "global" ? (
          <GlobalView rows={data.rows} current={data.current} />
        ) : (
          <FriendsView rows={data.rows} />
        )}
      </div>
    </AppShell>
  );
}

function GlobalView({
  rows,
  current,
}: {
  rows: LeaderboardRow[];
  current: LeaderboardRow | null;
}) {
  const meIsInTop = current && rows.some((r) => r.userId === current.userId);
  return (
    <>
      <ol
        className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-2"
        data-testid="leaderboard-rows"
      >
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-neutral-500">
            No XP earned in this window yet.
          </li>
        )}
        {rows.map((r) => (
          <Row key={r.userId} row={r} isMe={current?.userId === r.userId} />
        ))}
      </ol>

      {current && !meIsInTop && (
        <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-2">
          <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
            You
          </div>
          <Row row={current} isMe={true} />
        </div>
      )}
    </>
  );
}

function FriendsView({ rows }: { rows: Array<LeaderboardRow & { isMe: boolean }> }) {
  // Empty when the user has zero accepted friends. The CTA points to the
  // friends page so the path from empty-state to first-friend is one click.
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center"
        data-testid="leaderboard-friends-empty"
      >
        <p className="text-sm text-neutral-600">
          Add friends to see your circle ranked here.
        </p>
        {/* /app/friends UI is a forward-looking destination (P2-SOC-1 shipped
            only the API layer; the dedicated page lands with P2-SOC-3 / a
            future ticket). Plain anchor so we don't break TanStack's typed
            route table; the empty-state CTA still surfaces user intent. */}
        <a
          href="/app/friends"
          className="mt-3 inline-block rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          data-testid="leaderboard-friends-cta"
        >
          Find friends
        </a>
      </div>
    );
  }

  return (
    <ol
      className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-2"
      data-testid="leaderboard-rows"
    >
      {rows.map((r) => (
        <Row key={r.userId} row={r} isMe={r.isMe} />
      ))}
    </ol>
  );
}

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        isMe ? "bg-orange-100 ring-1 ring-orange-300" : ""
      }`}
      data-testid="leaderboard-row"
    >
      <span className="w-8 text-right font-semibold tabular-nums text-neutral-500">
        #{row.rank}
      </span>
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
          {row.displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <Link
        to="/app/profile/$displayName"
        params={{ displayName: row.displayName }}
        className="min-w-0 flex-1 truncate font-medium hover:text-orange-600"
      >
        {row.displayName}
      </Link>
      <span
        className={`hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${levelClass(row.level)}`}
      >
        {row.level}
      </span>
      {row.leagueTier && (
        <span
          data-testid="leaderboard-league-badge"
          className="hidden rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800 sm:inline"
          title={`${tierMeta(row.leagueTier).name} league`}
        >
          <span aria-hidden>{tierMeta(row.leagueTier).emoji}</span>{" "}
          {tierMeta(row.leagueTier).name}
        </span>
      )}
      <span className="hidden text-xs text-neutral-500 sm:inline">
        🔥 {row.streakDays}
      </span>
      <span className="w-16 text-right font-bold tabular-nums text-orange-600">
        {row.windowXp.toLocaleString()} XP
      </span>
    </li>
  );
}

function levelClass(level: LeaderboardRow["level"]): string {
  switch (level) {
    case "Platinum":
      return "bg-cyan-100 text-cyan-800";
    case "Gold":
      return "bg-amber-100 text-amber-800";
    case "Silver":
      return "bg-neutral-200 text-neutral-700";
    default:
      return "bg-orange-100 text-orange-700";
  }
}
