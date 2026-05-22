import { createFileRoute, notFound, useNavigate, Link } from "@tanstack/react-router";
import { getScorecard } from "../lib/server/roleplay";
import { AppShell } from "../components/AppShell";
import { useState } from "react";
import type { CSSProperties } from "react";
import { Stroop } from "../components/Stroop";
import { LiveRubric } from "../components/LiveRubric";

export const Route = createFileRoute("/app/scenario/$slug/scorecard")({
  loader: async ({ params }) => {
    try {
      return await getScorecard({ data: { slug: params.slug } });
    } catch (err) {
      if (err instanceof Error && err.message === "Scenario not found") throw notFound();
      throw err;
    }
  },
  component: ScorecardPage,
});

function ScorecardPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const { user, scenario, session, errors } = data;
  const [streamSettled, setStreamSettled] = useState(false);

  if (!session) {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-xl py-10 text-center">
          <h1 className="text-xl font-semibold">No attempt yet</h1>
          <p className="mt-2 text-neutral-600">
            Start the scenario to get a scorecard.
          </p>
          <Link
            to="/app/scenario/$slug"
            params={{ slug: scenario.slug }}
            className="mt-6 inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Start {scenario.titleNl}
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!session.graded) {
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-xl space-y-6 py-8">
          <div className="text-center">
            <Stroop state="idle" size="lg" className="mx-auto" />
            <h1 className="mt-3 text-xl font-semibold">Grading your conversation</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Claude is scoring grammar, vocab, task completion, fluency, and politeness.
              The scores fill in as the model thinks.
            </p>
          </div>
          <LiveRubric
            sessionId={session.id}
            onFinish={() => {
              if (streamSettled) return;
              setStreamSettled(true);
              // Reload loader so the persisted scorecard (errors, badges,
              // XP, full feedback) replaces the live partial view.
              void navigate({
                to: "/app/scenario/$slug/scorecard",
                params: { slug: scenario.slug },
                replace: true,
              });
            }}
          />
        </div>
      </AppShell>
    );
  }

  const r = session.rubric;
  // Rubric scores are stored 1–5; the redesign shows them as 0–100. Map each
  // criterion to a percentage and round the average to the displayed ring score.
  const to100 = (n: number | null | undefined) => Math.round(((n ?? 0) / 5) * 100);
  const criteria = [
    { label: "Grammar", score: to100(r.grammar) },
    { label: "Vocabulary", score: to100(r.vocabulary) },
    { label: "Task completion", score: to100(r.taskCompletion) },
    { label: "Fluency", score: to100(r.fluency) },
    { label: "Politeness", score: to100(r.politeness) },
  ];
  const ringScore = Math.round(
    criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length,
  );
  const ringColor =
    ringScore >= 85
      ? "var(--color-good)"
      : ringScore >= 70
        ? "var(--color-warn)"
        : "var(--color-bad)";
  // The best line is the learner's strongest criterion — surface it as the
  // highlight without needing a new AI field on the grading schema.
  const best = criteria.reduce((a, b) => (b.score > a.score ? b : a));
  // "Try these next time" tips reuse the persisted error corrections, the most
  // actionable per-turn guidance the grader already produces.
  const tips = errors
    .map((e) => e.explanationEn?.trim() || `Use "${e.correction}" instead of "${e.incorrect}".`)
    .filter(Boolean)
    .slice(0, 3);
  const badgeUnlocked = session.passed && scenario.badgeUnlock;

  return (
    <AppShell user={user}>
      <div className="scorecard-screen mx-auto max-w-xl space-y-5 py-8">
        {/* Hero: Kroket reaction + Stroop mascot + result banner */}
        <div className={`scorecard-hero ${session.passed ? "scorecard-hero--pass" : "scorecard-hero--fail"}`}>
          <div className="flex items-center justify-center gap-3">
            <img
              src={`/mascot/treats/kroket/${session.passed ? "happy" : "idle"}.png`}
              alt=""
              aria-hidden
              className={`h-16 w-16 ${session.passed ? "anim-happy-bounce" : "anim-idle-bob"}`}
            />
            <Stroop state={session.passed ? "proud" : "concerned"} size="lg" />
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Scorecard
          </div>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">{scenario.titleNl}</h1>
          <div className="mt-1 text-sm text-neutral-500">met {scenario.npcName}</div>

          <div
            className="scorecard-ring"
            style={
              {
                "--ring-pct": `${ringScore}%`,
                "--ring-color": ringColor,
              } as CSSProperties
            }
            role="img"
            aria-label={`Score ${ringScore} out of 100`}
          >
            <div className="scorecard-ring-inner">
              <span className="scorecard-ring-num">{ringScore}</span>
              <span className="scorecard-ring-label">score</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="chip">+{session.xpAwarded} XP</span>
            <span className="text-xs text-neutral-500">of {scenario.xpReward}</span>
            <span
              className={`scorecard-result-pill ${
                session.passed ? "scorecard-result-pill--pass" : "scorecard-result-pill--fail"
              }`}
            >
              {session.passed ? "Geslaagd" : "Blijf oefenen"}
            </span>
          </div>

          {badgeUnlocked && (
            <div className="scorecard-badge">
              <span>🏅</span>
              <span>Badge ontgrendeld: {scenario.badgeUnlock}</span>
            </div>
          )}
        </div>

        {/* Rubric breakdown: numeric 0–100 bars + notes */}
        <div className="card scorecard-card">
          <h2 className="scorecard-section-title">Rubriek</h2>
          <div className="space-y-3">
            {criteria.map((c) => (
              <RubricRow key={c.label} label={c.label} score={c.score} />
            ))}
          </div>
        </div>

        {/* Highlights: best criterion */}
        <div className="scorecard-highlight">
          <div className="scorecard-highlight-head">
            <span aria-hidden>✓</span> Sterkste punt
          </div>
          <div className="scorecard-highlight-line">{best.label}</div>
          <div className="scorecard-highlight-note">
            {best.score} / 100 — je beste rubriek deze ronde.
          </div>
        </div>

        {/* Try these next time */}
        {tips.length > 0 && (
          <div className="card scorecard-card">
            <h2 className="scorecard-section-title">Probeer dit volgende keer</h2>
            <ul className="space-y-2.5">
              {tips.map((tip, i) => (
                <li key={i} className="scorecard-tip-row">
                  <span className="scorecard-tip-icon" aria-hidden>✦</span>
                  <span className="text-sm text-neutral-700">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Feedback */}
        {session.feedbackMd && (
          <div className="card scorecard-card">
            <h2 className="scorecard-section-title">Feedback</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {session.feedbackMd}
            </p>
          </div>
        )}

        {/* Errors / corrections */}
        {errors.length > 0 && (
          <div className="card scorecard-card">
            <h2 className="scorecard-section-title">Om aan te werken</h2>
            <ul className="space-y-3">
              {errors.map((e) => (
                <li key={e.id} className="scorecard-correction">
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {e.category}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="scorecard-chip-bad line-through">{e.incorrect}</span>
                    <span className="text-neutral-400" aria-hidden>→</span>
                    <span className="scorecard-chip-good font-medium">{e.correction}</span>
                  </div>
                  {e.explanationEn && (
                    <p className="mt-2 text-xs text-neutral-600">{e.explanationEn}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/app/scenario/$slug"
            params={{ slug: scenario.slug }}
            className="btn-3d btn-3d-ghost btn-3d-full flex-1"
          >
            Opnieuw
          </Link>
          <Link to="/app/path" className="btn-3d btn-3d-green btn-3d-full flex-1">
            Verder
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function critNote(score: number): string {
  if (score >= 90) return "Uitstekend — bijna foutloos.";
  if (score >= 75) return "Sterk, met kleine slordigheden.";
  if (score >= 60) return "Voldoende, blijf oefenen.";
  return "Hier valt de meeste winst te halen.";
}

function RubricRow({ label, score }: { label: string; score: number }) {
  const tone = score >= 85 ? "good" : score >= 70 ? "warn" : "bad";
  return (
    <div className="scorecard-crit" data-tone={tone}>
      <div className="scorecard-crit-head">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        <span className="scorecard-crit-score" aria-label={`${score} out of 100`}>
          {score}
        </span>
      </div>
      <div
        className="scorecard-crit-bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="scorecard-crit-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="scorecard-crit-note">{critNote(score)}</div>
    </div>
  );
}
