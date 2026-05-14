import { useState } from "react";
import type { PathQuest } from "../lib/server/path";

/**
 * Daily quests ribbon (P2-CON-3).
 *
 * Shows up to 3 quests for today with progress bars. The claim button on a
 * row enables when `progress >= target` and is not yet claimed. Clicking
 * POSTs to /api/daily-quests/claim and optimistically marks the row claimed
 * so the user sees their bonus immediately; on server failure we revert.
 */

const KIND_EMOJI: Record<PathQuest["kind"], string> = {
  xp: "🌟",
  lessons: "📚",
  streak: "🔥",
  speak: "🎙️",
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
    // Optimistic update.
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
        // Revert on failure.
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

  return (
    <li
      data-testid="daily-quest"
      data-kind={quest.kind}
      data-claimed={quest.claimed ? "true" : "false"}
      className="rounded-lg bg-white p-3 ring-1 ring-orange-200"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {KIND_EMOJI[quest.kind]}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-800">
              {quest.titleEn}
            </div>
            <div className="truncate text-xs text-neutral-500">{quest.titleNl}</div>
          </div>
        </div>
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
