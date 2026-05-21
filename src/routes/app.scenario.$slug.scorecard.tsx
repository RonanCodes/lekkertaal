import { createFileRoute, notFound, useNavigate, Link } from "@tanstack/react-router";
import { getScorecard } from "../lib/server/roleplay";
import { AppShell } from "../components/AppShell";
import { useState } from "react";
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
  const avg =
    ((r.grammar ?? 0) +
      (r.vocabulary ?? 0) +
      (r.taskCompletion ?? 0) +
      (r.fluency ?? 0) +
      (r.politeness ?? 0)) /
    5;
  const stars = Math.round(avg);
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

          <div className="scorecard-stars" aria-label={`${stars} out of 5 stars`}>
            {"★".repeat(stars)}
            <span className="scorecard-stars-empty">{"★".repeat(5 - stars)}</span>
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

        {/* Rubric breakdown */}
        <div className="card scorecard-card">
          <h2 className="scorecard-section-title">Rubriek</h2>
          <div className="space-y-2.5">
            <RubricRow label="Grammar" score={r.grammar ?? 0} />
            <RubricRow label="Vocabulary" score={r.vocabulary ?? 0} />
            <RubricRow label="Task completion" score={r.taskCompletion ?? 0} />
            <RubricRow label="Fluency" score={r.fluency ?? 0} />
            <RubricRow label="Politeness" score={r.politeness ?? 0} />
          </div>
        </div>

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

function RubricRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="scorecard-rubric-row">
      <span className="text-sm text-neutral-700">{label}</span>
      <span className="scorecard-rubric-stars" aria-label={`${score} out of 5`}>
        <span className="scorecard-rubric-stars-on">{"★".repeat(score)}</span>
        <span className="scorecard-stars-empty">{"★".repeat(5 - score)}</span>
      </span>
    </div>
  );
}
