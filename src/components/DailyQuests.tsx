import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Check, Coins, Flame, Mic, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PathQuest } from "../lib/server/path";

/**
 * Daily quests ribbon (P2-CON-3).
 *
 * Three quests for today with progress bars. Each row links to an activity
 * that advances the quest (lessons → /app/path, speak → /app/peer, etc.) so
 * the tap-to-do flow is obvious. The claim button enables when
 * progress >= target and is not yet claimed; clicking POSTs to
 * /api/daily-quests/claim and optimistically marks the row claimed.
 *
 * Fidelity (#244): the card mirrors the `DailyQuests` / `QuestRow` design in
 * `docs/design/screens-path.jsx` — an oliebollen mascot header with a
 * "Reset in 6u 14m" countdown to local midnight, a total-coin badge, and a
 * coin-reward badge on every row.
 */

const KIND_ICON: Record<PathQuest["kind"], LucideIcon> = {
  xp: Sparkles,
  lessons: BookOpen,
  streak: Flame,
  speak: Mic,
};

/**
 * Map each quest kind to the activity that advances it. Lessons / xp / streak
 * all funnel into the path page where the user picks a lesson; speak quests
 * route to peer drills (the only surface that records speak attempts today).
 */
const KIND_HREF: Record<PathQuest["kind"], string> = {
  xp: "/app/path",
  lessons: "/app/path",
  streak: "/app/path",
  speak: "/app/peer",
};

/** Milliseconds until the next local midnight (when quests reset). */
function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Format a duration as the design's "6u 14m" (Dutch uur / minuut) shorthand. */
function formatReset(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Reset in ${hours}u ${minutes}m`;
  return `Reset in ${minutes}m`;
}

/** Live "Reset in Xu Ym" countdown to local midnight, ticking each minute. */
function useResetCountdown(): string {
  const [ms, setMs] = useState(() => msUntilMidnight(new Date()));

  useEffect(() => {
    const tick = () => setMs(msUntilMidnight(new Date()));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return formatReset(ms);
}

/** Small coin chip — used for the header total and per-row rewards. */
function CoinBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      <Coins size={12} aria-hidden />
      {amount}
    </span>
  );
}

export function DailyQuests({ initial }: { initial: PathQuest[] }) {
  const [quests, setQuests] = useState<PathQuest[]>(initial);
  const [claiming, setClaiming] = useState<number | null>(null);
  const resetLabel = useResetCountdown();

  if (quests.length === 0) return null;

  const totalCoins = quests.reduce((sum, q) => sum + q.bonusCoins, 0);

  async function claim(quest: PathQuest) {
    if (claiming !== null) return;
    if (quest.claimed) return;
    if (quest.progress < quest.target) return;

    setClaiming(quest.id);
    setQuests((prev) =>
      prev.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q)),
    );

    try {
      const res = await fetch("/api/daily-quests/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questId: quest.id }),
      });
      if (!res.ok) {
        setQuests((prev) =>
          prev.map((q) => (q.id === quest.id ? { ...q, claimed: false } : q)),
        );
      }
    } catch {
      setQuests((prev) =>
        prev.map((q) => (q.id === quest.id ? { ...q, claimed: false } : q)),
      );
    } finally {
      setClaiming(null);
    }
  }

  return (
    <section
      aria-label="daily quests"
      className="mb-6 rounded-2xl border-2 border-orange-200 bg-orange-50 p-4"
    >
      <header className="mb-3 flex items-center gap-3">
        <img
          src="/mascot/treats/oliebollen/happy.png"
          alt=""
          aria-hidden
          className="anim-idle-bob h-11 w-11 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-900">
            Daily quests
          </h2>
          <p className="text-xs text-orange-800/70">{resetLabel}</p>
        </div>
        {totalCoins > 0 && <CoinBadge amount={totalCoins} />}
      </header>
      <ul className="space-y-2">
        {quests.map((q) => (
          <QuestRow
            key={q.id}
            quest={q}
            disabled={claiming !== null}
            onClaim={() => claim(q)}
          />
        ))}
      </ul>
    </section>
  );
}

function QuestRow({
  quest,
  disabled,
  onClaim,
}: {
  quest: PathQuest;
  disabled: boolean;
  onClaim: () => void;
}) {
  const pct =
    quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
  const canClaim = !quest.claimed && quest.progress >= quest.target;
  const done = quest.progress >= quest.target;
  const buttonLabel = quest.claimed
    ? "Claimed"
    : canClaim
      ? `Claim +${quest.bonusXp} XP`
      : `${quest.progress} / ${quest.target}`;
  const Icon = done ? Check : KIND_ICON[quest.kind];
  const href = KIND_HREF[quest.kind];

  return (
    <li
      data-testid="daily-quest"
      data-kind={quest.kind}
      data-claimed={quest.claimed ? "true" : "false"}
      className="rounded-lg bg-white p-3 ring-1 ring-orange-200"
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          to={href}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 -m-1 transition-colors hover:bg-orange-50"
          aria-label={`Open activity for ${quest.titleEn}`}
        >
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              done
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-800 group-hover:text-orange-700">
              {quest.titleEn}
            </div>
            <div className="truncate text-xs text-neutral-500">{quest.titleNl}</div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {quest.bonusCoins > 0 && <CoinBadge amount={quest.bonusCoins} />}
          <button
            type="button"
            aria-label={`claim quest ${quest.kind}`}
            disabled={!canClaim || disabled}
            onClick={onClaim}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              quest.claimed
                ? "bg-emerald-100 text-emerald-700"
                : canClaim
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-neutral-100 text-neutral-500"
            } ${!canClaim && !quest.claimed ? "cursor-not-allowed" : ""}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full transition-all ${quest.claimed ? "bg-emerald-400" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
