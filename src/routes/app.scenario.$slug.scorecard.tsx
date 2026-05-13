import { createFileRoute, notFound, useNavigate, Link } from "@tanstack/react-router";
import { getScorecard, gradeRoleplaySession } from "../lib/server/roleplay";
import { AppShell } from "../components/AppShell";
import { useEffect, useState } from "react";

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
  const [grading, setGrading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // If a session exists but isn't graded yet (race between finish + grade),
  // kick off grading once on mount and reload the loader.
  useEffect(() => {
    if (session && !session.graded && !grading) {
      setGrading(true);
      gradeRoleplaySession({ data: { sessionId: session.id } })
        .catch((err) => console.error("[scorecard] grade failed:", err))
        .finally(() => {
          setRefreshKey((k) => k + 1);
          // Reload route data so the loader re-fetches with the now-graded row.
          void navigate({
            to: "/app/scenario/$slug/scorecard",
            params: { slug: scenario.slug },
            replace: true,
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, refreshKey]);

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
        <div className="mx-auto max-w-xl py-20 text-center">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-4 text-xl font-semibold">Grading your conversation...</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Claude is scoring grammar, vocab, task completion, fluency, and politeness.
          </p>
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
      <div className="mx-auto max-w-xl space-y-6 py-8">
        <div className="text-center">
          <div className="text-sm uppercase tracking-wide text-neutral-500">
            Scorecard
          </div>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">
            {scenario.titleNl}
          </h1>
          <div className="mt-2 text-sm text-neutral-500">with {scenario.npcName}</div>
        </div>

        {/* Overall stars + XP */}
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-center shadow-sm">
          <div className="text-4xl" aria-label={`${stars} out of 5 stars`}>
            {"★".repeat(stars)}
            <span className="text-neutral-300">{"★".repeat(5 - stars)}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-sm">
            <div>
              <div className="font-semibold text-orange-600">
                +{session.xpAwarded} XP
              </div>
              <div className="text-xs text-neutral-500">
                of {scenario.xpReward} possible
              </div>
            </div>
            <div>
              <div
                className={`font-semibold ${
                  session.passed ? "text-green-600" : "text-neutral-500"
                }`}
              >
                {session.passed ? "Passed" : "Keep practising"}
              </div>
              <div className="text-xs text-neutral-500">3★ to pass</div>
            </div>
          </div>
          {badgeUnlocked && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              <span>🏅</span>
              <span>Badge unlocked: {scenario.badgeUnlock}</span>
            </div>
          )}
        </div>

        {/* Rubric breakdown */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Rubric
          </h2>
          <div className="space-y-2">
            <RubricRow label="Grammar" score={r.grammar ?? 0} />
            <RubricRow label="Vocabulary" score={r.vocabulary ?? 0} />
            <RubricRow label="Task completion" score={r.taskCompletion ?? 0} />
            <RubricRow label="Fluency" score={r.fluency ?? 0} />
            <RubricRow label="Politeness" score={r.politeness ?? 0} />
          </div>
        </div>

        {/* Feedback */}
        {session.feedbackMd && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Feedback
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {session.feedbackMd}
            </p>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Things to work on
            </h2>
            <ul className="space-y-3">
              {errors.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg bg-neutral-50 p-3 text-sm"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {e.category}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-red-100 px-2 py-0.5 text-red-700 line-through">
                      {e.incorrect}
                    </span>
                    <span className="text-neutral-400">→</span>
                    <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
                      {e.correction}
                    </span>
                  </div>
                  {e.explanationEn && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {e.explanationEn}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/app/scenario/$slug"
            params={{ slug: scenario.slug }}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Retry
          </Link>
          <Link
            to="/app/path"
            className="flex-1 rounded-lg bg-orange-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-700"
          >
            Continue
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function RubricRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-700">{label}</span>
      <span className="text-sm">
        <span className="text-orange-500">{"★".repeat(score)}</span>
        <span className="text-neutral-300">{"★".repeat(5 - score)}</span>
      </span>
    </div>
  );
}
