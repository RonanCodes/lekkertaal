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

  const total = PLACEMENT_QUESTIONS.length;
  const q = PLACEMENT_QUESTIONS[step];

  async function chooseAnswer(value: string) {
    const next = [...answers, value];
    setAnswers(next);
    if (step + 1 < total) {
      setStep(step + 1);
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
    navigate({ to: "/onboarding/notifications" as never });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Quick placement check</h1>
        <p className="mt-2 text-neutral-600">
          Five questions, 60 seconds. We use this to drop you at the right starting point.
        </p>
        <p className="mt-2 text-sm">
          <a href="/onboarding/level-pick" className="underline">
            I know my level, let me pick
          </a>
        </p>
      </header>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full bg-orange-500 transition-all"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm uppercase tracking-wide text-neutral-500">
          Question {step + 1} of {total}
        </p>
        <h2 className="mb-1 text-2xl font-semibold">{q.promptEn}</h2>
        <p className="mb-6 text-neutral-500">{q.promptNl}</p>
        <div className="grid gap-3">
          {q.options.map((opt) => (
            <button
              key={opt.value}
              disabled={submitting}
              onClick={() => chooseAnswer(opt.value)}
              className="rounded-2xl border-2 border-neutral-200 px-4 py-3 text-left hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
