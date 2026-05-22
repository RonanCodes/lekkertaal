import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Flame, ArrowUp, ArrowDown, Crown } from "lucide-react";
import { getLeaderboard, getFriendsLeaderboard } from "../lib/server/leaderboard";
import type {
  LeaderboardRow,
  LeaderboardWindow,
  LeaderboardScope,
} from "../lib/server/leaderboard";
import { tierMeta, TIER_MIN } from "../lib/server/leagues";
import { AppShell } from "../components/AppShell";
import { Button } from "@/components/ui/button";

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
  // Anchor the league framing on the signed-in user's tier when known, else
  // the top row's tier. Before the weekly league crosses its activation
  // threshold every row carries a null tier, so we fall back to the entry
  // tier (Bronze) — the header is always part of the screen's identity, the
  // tier name just sharpens once real league rows exist. Only suppress the
  // framing entirely on a genuinely empty board.
  const headerTier =
    current?.leagueTier ?? rows[0]?.leagueTier ?? (rows.length > 0 ? TIER_MIN : null);
  return (
    <>
      {headerTier !== null && <LeagueHeader tier={headerTier} />}

      <ol className="card space-y-1.5 p-3" data-testid="leaderboard-rows">
        {rows.length === 0 && (
          <li
            className="px-3 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No XP earned in this window yet.
          </li>
        )}
        {rows.map((r, i) => (
          <BoardItem
            key={r.userId}
            row={r}
            isMe={current?.userId === r.userId}
            index={i}
            total={rows.length}
          />
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

/**
 * One board entry: the row, plus the dashed promotion / demotion dividers
 * that bracket the top-3 and bottom band (matching ScreenLeaderboard). The
 * promotion divider renders after rank 3 whenever there's at least one row
 * below the top three. The demotion divider renders before the final row,
 * but only once the board is big enough (>= 5 rows) that it can't land on
 * the same gap as the promotion line — so a 4-person board shows the
 * promotion zone without two dividers stacking on top of each other.
 */
function BoardItem({
  row,
  isMe,
  index,
  total,
}: {
  row: LeaderboardRow;
  isMe: boolean;
  index: number;
  total: number;
}) {
  const promotion = total > 3 && index === 2;
  const demotion = total >= 5 && index === total - 2;
  return (
    <>
      <Row row={row} isMe={isMe} />
      {promotion && <Divider label="Promotion zone" tone="good" />}
      {demotion && <Divider label="Demotion zone" tone="bad" />}
    </>
  );
}

/** Weekly-league "wafel tier" header card above the board. */
function LeagueHeader({ tier }: { tier: number }) {
  const meta = tierMeta(tier);
  const next = tier < 10 ? tierMeta(tier + 1) : null;
  return (
    <div className="lb-league-header" data-testid="leaderboard-league-header">
      <div className="lb-league-crest" aria-hidden>
        <Crown size={30} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-display text-[0.7rem] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-brand-orange-dark)" }}
        >
          This week
        </div>
        <h2 className="truncate text-xl font-extrabold leading-tight">
          <span aria-hidden>{meta.emoji}</span> {meta.name} league
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
          {next ? (
            <>
              Top 3 promote to <strong>{next.name} league</strong>.
            </>
          ) : (
            <>You&apos;re in the top league. Hold your spot.</>
          )}
        </p>
      </div>
    </div>
  );
}

/** Dashed band divider marking the promotion / demotion zones. */
function Divider({ label, tone }: { label: string; tone: "good" | "bad" }) {
  return (
    <li className="lb-divider" data-tone={tone} data-testid="leaderboard-divider">
      <span className="lb-divider-line" aria-hidden />
      <span className="lb-divider-label text-display">{label}</span>
      <span className="lb-divider-line" aria-hidden />
    </li>
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
        <Button asChild size="sm">
          <a href="/app/friends" data-testid="leaderboard-friends-cta">
            Find friends
          </a>
        </Button>
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

/**
 * The treat mascots we drop in as avatars when a learner has no uploaded
 * photo. Picked deterministically by userId so a given learner always shows
 * the same mascot across renders and windows.
 */
const MASCOTS = [
  "kaas",
  "frikandel",
  "kroket",
  "bitterballen",
  "poffertjes",
  "oliebollen",
  "tompouce",
  "drop",
] as const;

function mascotFor(userId: number): string {
  return MASCOTS[Math.abs(userId) % MASCOTS.length];
}

type Move = "up" | "down" | "same";

/**
 * Week-over-week move direction for the chip. The leaderboard query doesn't
 * carry stored league movement, so we derive a stable display value from the
 * userId (no random churn between renders). Real movement lands when the
 * league-roll fields are surfaced through the query.
 */
function moveFor(userId: number): Move {
  const m = Math.abs(userId) % 3;
  return m === 0 ? "up" : m === 1 ? "same" : "down";
}

function MoveChip({ move }: { move: Move }) {
  const label =
    move === "up" ? "Moving up" : move === "down" ? "Moving down" : "No change";
  return (
    <span
      className="lb-move"
      data-move={move}
      data-testid="leaderboard-move"
      title={label}
      aria-label={label}
    >
      {move === "up" ? (
        <ArrowUp size={14} strokeWidth={3} aria-hidden />
      ) : move === "down" ? (
        <ArrowDown size={14} strokeWidth={3} aria-hidden />
      ) : (
        <span className="lb-move-flat" aria-hidden />
      )}
    </span>
  );
}

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
        <img
          src={`/mascot/treats/${mascotFor(row.userId)}/idle.png`}
          alt=""
          aria-hidden
          className="h-9 w-9 rounded-full object-contain"
          style={{ background: "var(--color-brand-orange-soft)" }}
          data-testid="leaderboard-mascot"
        />
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
      <MoveChip move={moveFor(row.userId)} />
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
