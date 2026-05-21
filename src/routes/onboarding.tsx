import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PLACEMENT_QUESTIONS, scoreToLevel } from "../data/placement-test";
import { setCefrLevel, unlockStartingUnit } from "../lib/server/user";

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const total = PLACEMENT_QUESTIONS.length;
  const q = PLACEMENT_QUESTIONS[step];

  async function chooseAnswer(value: string) {
    setPicked(value);
    const next = [...answers, value];
    setAnswers(next);
    if (step + 1 < total) {
      // Brief selected-state beat before advancing.
      setStep(step + 1);
      setPicked(null);
      return;
    }
    setSubmitting(true);
    const score = next.reduce(
      (acc, ans, i) => acc + (ans === PLACEMENT_QUESTIONS[i].answer ? 1 : 0),
      0,
    );
    const level = scoreToLevel(score);
    await setCefrLevel({ data: { level, placementScore: score } });
    await unlockStartingUnit();
    navigate({ to: "/onboarding/notifications" });
  }

  const progress = (step / total) * 100;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 text-center">
        <p
          className="text-display text-sm font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-brand-blue-dark)" }}
        >
          Even kijken
        </p>
        <img
          src="/mascot/stroop-512.png"
          alt="Stroop the stroopwafel"
          className="anim-idle-bob mx-auto mt-3 mb-1 h-24 w-24"
        />
        <h1
          className="text-display mt-1 text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--text-strong)" }}
        >
          Quick placement check
        </h1>
        <p className="mx-auto mt-2 max-w-md" style={{ color: "var(--text-soft)" }}>
          Five questions, 60 seconds. We use this to drop you at the right starting point.
        </p>
        <p className="mt-2 text-sm">
          <a
            href="/onboarding/level-pick"
            className="font-semibold underline"
            style={{ color: "var(--color-brand-orange-dark)" }}
          >
            I know my level, let me pick
          </a>
        </p>
      </header>

      <div
        className="mb-5 h-3 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        style={{ background: "var(--surface-card-alt)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progress}%`, background: "var(--color-brand-orange)" }}
        />
      </div>

      <section className="card">
        <p
          className="text-display mb-1 text-xs font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--text-muted)" }}
        >
          Question {step + 1} of {total}
        </p>
        <h2 className="text-display text-2xl font-bold" style={{ color: "var(--text-strong)" }}>
          {q.promptEn}
        </h2>
        <p className="mb-5 mt-1" style={{ color: "var(--text-soft)" }}>
          {q.promptNl}
        </p>
        <div className="grid gap-3">
          {q.options.map((opt) => (
            <OptionRow
              key={opt.value}
              label={opt.label}
              selected={picked === opt.value}
              disabled={submitting}
              onSelect={() => chooseAnswer(opt.value)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

/**
 * Tappable answer row from the redesign's onboarding screens. Reads the
 * shared semantic tokens so light + dark both render correctly; selecting
 * one lifts it into the brand-orange soft fill.
 */
function OptionRow({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
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
      className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left font-medium transition-colors disabled:opacity-50"
      style={{
        borderColor: selected ? "var(--color-brand-orange)" : "var(--line-soft)",
        background: selected ? "var(--color-brand-orange-soft)" : "var(--surface-card)",
        color: "var(--text-strong)",
      }}
    >
      <span>{label}</span>
      {selected && (
        <span style={{ color: "var(--color-brand-orange-dark)" }} aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}
