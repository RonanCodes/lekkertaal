import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { LearningGoal } from "../lib/server/user";
import { setLearningGoal } from "../lib/server/user";

export const Route = createFileRoute("/onboarding/goal")({ component: GoalPickPage });

const GOALS: { value: LearningGoal; icon: string; label: string; sub: string }[] = [
  { value: "moving", icon: "✈️", label: "Moving to NL", sub: "Living, working, paperwork" },
  { value: "dating", icon: "❤️", label: "Dating a Dutchie", sub: "Family, friends, in-laws" },
  { value: "study", icon: "🎓", label: "Study / school", sub: "Inburgering, exam prep" },
  { value: "fun", icon: "🧠", label: "Brain food", sub: "Just for fun" },
];

/**
 * First onboarding step from the redesign's `ScreenOnbWelcome`: capture *why*
 * the learner is here so lessons can be planned around it. Stroop introduces
 * the question in a speech bubble; four `GoalRow` choices follow, then the
 * Continue button persists the pick and routes into the placement check.
 */
function GoalPickPage() {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<LearningGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onContinue() {
    if (!picked) return;
    setSubmitting(true);
    await setLearningGoal({ data: { goal: picked } });
    navigate({ to: "/onboarding" });
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col px-6 py-12">
      {/* 3-step progress: goal · level · notifications */}
      <div className="mb-8 flex gap-2" aria-hidden>
        <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--color-brand-orange)" }} />
        <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--line-soft)" }} />
        <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--line-soft)" }} />
      </div>

      <div className="flex flex-col items-center text-center">
        <img
          src="/mascot/stroop-512.png"
          alt="Stroop the stroopwafel"
          className="anim-idle-bob h-32 w-32"
        />
        <div
          className="mt-4 max-w-sm rounded-3xl border-2 px-5 py-4"
          style={{
            background: "var(--surface-card)",
            borderColor: "var(--line-soft)",
            color: "var(--text-strong)",
          }}
        >
          <p className="text-display font-bold">Hoi! I&apos;m Stroop.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>
            First, why are you learning Dutch? I&apos;ll plan the lessons around it.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {GOALS.map((g) => (
          <GoalRow
            key={g.value}
            icon={g.icon}
            label={g.label}
            sub={g.sub}
            selected={picked === g.value}
            disabled={submitting}
            onSelect={() => setPicked(g.value)}
          />
        ))}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        disabled={!picked || submitting}
        onClick={onContinue}
        className="text-display mt-8 w-full rounded-2xl py-4 text-lg font-bold text-white transition-opacity disabled:opacity-50"
        style={{ background: "var(--color-brand-orange)" }}
      >
        {submitting ? "…" : "Continue →"}
      </button>
    </main>
  );
}

/**
 * Goal option row from `ScreenOnbWelcome`: a coloured icon tile, a label +
 * sub-line, and a check when selected. Reads the shared semantic tokens so
 * light + dark both render correctly; selecting lifts it into the brand-orange
 * soft fill.
 */
function GoalRow({
  icon,
  label,
  sub,
  selected,
  disabled,
  onSelect,
}: {
  icon: string;
  label: string;
  sub: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-50"
      style={{
        borderColor: selected ? "var(--color-brand-orange)" : "var(--line-soft)",
        background: selected ? "var(--color-brand-orange-soft)" : "var(--surface-card)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
        style={{ background: "var(--surface-card-alt)" }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="text-display block font-bold" style={{ color: "var(--text-strong)" }}>
          {label}
        </span>
        <span className="block text-xs" style={{ color: "var(--text-soft)" }}>
          {sub}
        </span>
      </span>
      {selected && (
        <span style={{ color: "var(--color-brand-blue-dark)" }} aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}
