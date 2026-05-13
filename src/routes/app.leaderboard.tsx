import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  getLeaderboard,
  type LeaderboardRow,
  type LeaderboardWindow,
} from "../lib/server/leaderboard";
import { AppShell } from "../components/AppShell";

const searchSchema = z.object({
  window: z.enum(["today", "week", "all-time"]).catch("today"),
});

export const Route = createFileRoute("/app/leaderboard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ window: search.window }),
  loader: async ({ deps }) => await getLeaderboard({ data: { window: deps.window } }),
  component: LeaderboardPage,
});

const TABS: Array<{ id: LeaderboardWindow; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all-time", label: "All time" },
];

function LeaderboardPage() {
  const data = Route.useLoaderData();
  const { window: activeWindow } = Route.useSearch();
  const { user, rows, current } = data;
  const meIsInTop = current && rows.some((r) => r.userId === current.userId);

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-neutral-500">
            Top 50 by XP. Your rank is shown even if you're outside the top.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              to="/app/leaderboard"
              search={{ window: t.id }}
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

        {/* Rows */}
        <ol className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-2">
          {rows.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-neutral-500">
              No XP earned in this window yet.
            </li>
          )}
          {rows.map((r) => (
            <Row key={r.userId} row={r} isMe={current?.userId === r.userId} />
          ))}
        </ol>

        {/* Current user — if not in top N, show separately. */}
        {current && !meIsInTop && (
          <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-2">
            <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
              You
            </div>
            <Row row={current} isMe={true} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        isMe ? "bg-orange-100 ring-1 ring-orange-300" : ""
      }`}
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
