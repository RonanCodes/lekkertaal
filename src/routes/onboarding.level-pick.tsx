import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { setCefrLevel, unlockStartingUnit } from "../lib/server/user";

export const Route = createFileRoute("/onboarding/level-pick")({ component: LevelPickPage });

type Level = "A1" | "A2" | "B1";

const LEVELS: { level: Level; title: string; blurb: string; color: "orange" | "blue" | "pink" }[] =
  [
    { level: "A1", title: "Beginner", blurb: "Brand new to Dutch.", color: "orange" },
    { level: "A2", title: "Elementary", blurb: "Basic conversations and verbs.", color: "blue" },
    {
      level: "B1",
      title: "Intermediate",
      blurb: "Subordinate clauses, idioms, real talk.",
      color: "pink",
    },
  ];

function LevelPickPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState<Level | null>(null);

  async function pick(level: Level) {
    setSubmitting(level);
    await setCefrLevel({ data: { level } });
    await unlockStartingUnit();
    navigate({ to: "/onboarding/notifications" });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="text-center">
        <p
          className="text-display text-sm font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-brand-blue-dark)" }}
        >
          Your starting point
        </p>
        <h1
          className="text-display mt-2 text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--text-strong)" }}
        >
          Pick your level
        </h1>
        <p className="mx-auto mt-2 max-w-md" style={{ color: "var(--text-soft)" }}>
          You can change this later from your profile.
        </p>
      </header>

      <div className="mt-8 grid gap-4">
        {LEVELS.map(({ level, title, blurb, color }) => (
          <LevelCard
            key={level}
            level={level}
            title={title}
            blurb={blurb}
            color={color}
            loading={submitting === level}
            disabled={!!submitting}
            onSelect={() => pick(level)}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-sm">
        <a
          href="/onboarding"
          className="font-semibold underline"
          style={{ color: "var(--color-brand-orange-dark)" }}
        >
          Or take the 5-question check instead
        </a>
      </p>
    </main>
  );
}

const BADGE_COLORS = {
  orange: { bg: "var(--color-brand-orange-soft)", fg: "var(--color-brand-orange-dark)" },
  blue: { bg: "var(--color-brand-blue-soft)", fg: "var(--color-brand-blue-dark)" },
  pink: { bg: "var(--color-brand-pink-soft)", fg: "#B83A6E" },
} as const;

/**
 * Level option card from the redesign. The CEFR code sits in a coloured
 * badge; the whole card is the tap target. Selecting it shows a loading
 * beat while the level persists server-side.
 */
function LevelCard({
  level,
  title,
  blurb,
  color,
  loading,
  disabled,
  onSelect,
}: {
  level: Level;
  title: string;
  blurb: string;
  color: keyof typeof BADGE_COLORS;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const badge = BADGE_COLORS[color];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex items-center gap-4 rounded-3xl border-2 p-5 text-left transition-colors disabled:opacity-60"
      style={{
        borderColor: loading ? "var(--color-brand-orange)" : "var(--line-soft)",
        background: loading ? "var(--color-brand-orange-soft)" : "var(--surface-card)",
      }}
    >
      <span
        className="text-display flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold"
        style={{ background: badge.bg, color: badge.fg }}
      >
        {level}
      </span>
      <span className="flex-1">
        <span
          className="text-display block text-lg font-bold"
          style={{ color: "var(--text-strong)" }}
        >
          {title}
        </span>
        <span className="block text-sm" style={{ color: "var(--text-soft)" }}>
          {blurb}
        </span>
      </span>
      {loading && (
        <span className="text-sm" style={{ color: "var(--text-muted)" }} aria-hidden>
          …
        </span>
      )}
    </button>
  );
}
