import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Flame } from "lucide-react";
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
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="text-center">
          <div
            className="text-display text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-brand-blue-dark)" }}
          >
            <span aria-hidden>🏆</span> League
          </div>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">Leaderboard</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
            {activeScope === "friends"
              ? "You and your friends, ranked by XP."
              : "Top 50 by XP. Your rank shows even if you're outside the top."}
          </p>
        </header>

        {/* Scope tabs (Global / Friends) — chunky segmented control. */}
        <div
          className="lb-segment"
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
              className="lb-segment-item text-display"
              data-active={activeScope === t.id}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* Window tabs */}
        <div className="lb-segment lb-segment--sub">
          {WINDOW_TABS.map((t) => (
            <Link
              key={t.id}
              to="/app/leaderboard"
              search={{ window: t.id, scope: activeScope }}
              className="lb-segment-item text-display"
              data-active={activeWindow === t.id}
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
      <ol className="card space-y-1.5 p-3" data-testid="leaderboard-rows">
        {rows.length === 0 && (
          <li
            className="px-3 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No XP earned in this window yet.
          </li>
        )}
        {rows.map((r) => (
          <Row key={r.userId} row={r} isMe={current?.userId === r.userId} />
        ))}
      </ol>

      {current && !meIsInTop && (
        <div className="lb-you-card">
          <div
            className="text-display px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-brand-orange-dark)" }}
          >
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
        className="card flex flex-col items-center gap-3 py-8 text-center"
        data-testid="leaderboard-friends-empty"
      >
        <img
          src="/mascot/treats/kaas/idle.png"
          alt=""
          aria-hidden
          className="anim-idle-bob h-20 w-20"
        />
        <p className="text-base font-semibold" style={{ color: "var(--text-body)" }}>
          Add friends to see your circle ranked here.
        </p>
        {/* /app/friends UI is a forward-looking destination (P2-SOC-1 shipped
            only the API layer; the dedicated page lands with P2-SOC-3 / a
            future ticket). Plain anchor so we don't break TanStack's typed
            route table; the empty-state CTA still surfaces user intent. */}
        <a
          href="/app/friends"
          className="btn-3d btn-3d-sm"
          data-testid="leaderboard-friends-cta"
        >
          Find friends
        </a>
      </div>
    );
  }

  return (
    <ol className="card space-y-1.5 p-3" data-testid="leaderboard-rows">
      {rows.map((r) => (
        <Row key={r.userId} row={r} isMe={r.isMe} />
      ))}
    </ol>
  );
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Row({ row, isMe }: { row: LeaderboardRow; isMe: boolean }) {
  const medal = MEDALS[row.rank];
  return (
    <li
      className="lb-row"
      data-me={isMe ? "true" : undefined}
      data-podium={medal ? "true" : undefined}
      data-testid="leaderboard-row"
    >
      <span className="lb-rank text-display" aria-hidden={Boolean(medal)}>
        {medal ?? `#${row.rank}`}
      </span>
      {row.avatarUrl ? (
        <img src={row.avatarUrl} alt="" className="h-9 w-9 rounded-full" />
      ) : (
        <div
          className="text-display flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: "var(--color-brand-orange-soft)",
            color: "var(--color-brand-orange-dark)",
          }}
        >
          {row.displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <Link
        to="/app/profile/$displayName"
        params={{ displayName: row.displayName }}
        className="text-display min-w-0 flex-1 truncate font-semibold hover:text-orange-600"
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
      <span
        className="hidden items-center gap-1 text-xs sm:inline-flex"
        style={{ color: "var(--color-streak)" }}
      >
        <Flame size={13} aria-hidden />
        {row.streakDays}
      </span>
      <span
        className="text-display w-16 text-right font-extrabold tabular-nums"
        style={{ color: "var(--color-brand-orange)" }}
      >
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
