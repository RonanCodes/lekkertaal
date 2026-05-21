import { Coins, Flame, Heart, Snowflake } from "lucide-react";

/**
 * Path screen status strip (issue #207). A screen-scoped, chunky chip row
 * that surfaces the daily-return signals right above the path: streak,
 * an XP / level ring, coins, and a hearts/freezes chip.
 *
 * This is distinct from the global AppShell header (which is a compact
 * always-on strip). Here the chips are larger and the XP shows as a ring
 * so the learner reads progress at a glance on their home screen.
 */
export function PathStatusStrip({
  streakDays,
  xpTotal,
  coinsBalance,
  freezes,
}: {
  streakDays: number;
  xpTotal: number;
  coinsBalance: number;
  freezes: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="path-chip" aria-label={`${streakDays}-day streak`}>
        <Flame size={16} className="text-orange-500" aria-hidden />
        {streakDays}
      </span>

      <XpRing xpTotal={xpTotal} />

      <a
        href="/app/shop"
        className="path-chip hover:border-orange-400"
        aria-label={`${coinsBalance} coins (tap to open shop)`}
      >
        <Coins size={16} className="text-amber-500" aria-hidden />
        {coinsBalance}
      </a>

      <span
        className="path-chip"
        aria-label={
          freezes > 0
            ? `${freezes} streak freeze${freezes === 1 ? "" : "s"} in reserve`
            : "Hearts full"
        }
      >
        {freezes > 0 ? (
          <Snowflake size={16} className="text-sky-500" aria-hidden />
        ) : (
          <Heart size={16} className="text-red-500" aria-hidden />
        )}
        {freezes > 0 ? freezes : 5}
      </span>
    </div>
  );
}

/**
 * XP / level ring. Level is a simple 100-XP-per-level curve; the ring fills
 * with progress toward the next level. Pure SVG so it renders identically
 * server- and client-side with no layout shift.
 */
function XpRing({ xpTotal }: { xpTotal: number }) {
  const level = Math.floor(xpTotal / 100) + 1;
  const intoLevel = xpTotal % 100;
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const dash = (intoLevel / 100) * circumference;

  return (
    <span
      className="path-chip"
      aria-label={`Level ${level}, ${intoLevel} of 100 XP to next level`}
      title={`${xpTotal} XP total`}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle
          cx="13"
          cy="13"
          r={radius}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth="3"
        />
        <circle
          cx="13"
          cy="13"
          r={radius}
          fill="none"
          stroke="var(--color-brand-orange)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 13 13)"
        />
      </svg>
      Lv {level}
    </span>
  );
}
