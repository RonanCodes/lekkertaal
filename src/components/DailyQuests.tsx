import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Flame, Mic, Sparkles } from "lucide-react";
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

export function DailyQuests({ initial }: { initial: PathQuest[] }) {
  const [quests, setQuests] = useState<PathQuest[]>(initial);
  const [claiming, setClaiming] = useState<number | null>(null);

  if (quests.length === 0) return null;

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
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-900">
          Daily quests
        </h2>
        <span className="text-xs text-orange-800/70">resets at midnight</span>
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
  const buttonLabel = quest.claimed
    ? "Claimed"
    : canClaim
      ? `Claim +${quest.bonusXp} XP`
      : `${quest.progress} / ${quest.target}`;
  const Icon = KIND_ICON[quest.kind];
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
          <Icon size={20} aria-hidden className="shrink-0 text-orange-700" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-800 group-hover:text-orange-700">
              {quest.titleEn}
            </div>
            <div className="truncate text-xs text-neutral-500">{quest.titleNl}</div>
          </div>
        </Link>
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
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full transition-all ${quest.claimed ? "bg-emerald-400" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
