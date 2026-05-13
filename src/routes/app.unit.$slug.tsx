import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { getUnitDetail } from "../lib/server/unit";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/app/unit/$slug")({
  loader: async ({ params }) => {
    try {
      return await getUnitDetail({ data: { slug: params.slug } });
    } catch (err) {
      if (err instanceof Error && err.message === "Unit not found") throw notFound();
      throw err;
    }
  },
  component: UnitDetailPage,
});

function UnitDetailPage() {
  const data = Route.useLoaderData();
  const { unit, lessons, vocab, grammar, bossFight, user } = data;

  const allLessonsDone = lessons.length > 0 && lessons.every((l) => l.progress?.status === "completed");
  const nextLesson = lessons.find((l) => l.progress?.status !== "completed") ?? lessons[0];

  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const vocabPreview = vocab.slice(0, 10);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <a href="/app/path" className="text-sm text-orange-600 hover:underline">
          &larr; Back to path
        </a>
      </div>

      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Unit {unit.order} &middot; {unit.cefrLevel}
        </div>
        <h1 className="mt-1 text-3xl font-bold">{unit.titleNl}</h1>
        <p className="text-lg text-neutral-600">{unit.titleEn}</p>
        {unit.description && (
          <p className="mt-3 text-sm text-neutral-700">{unit.description}</p>
        )}
      </div>

      {/* Lessons list */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Lessons</h2>
        <ol className="space-y-2">
          {lessons.map((l, i) => {
            const status = l.progress?.status ?? "not_started";
            const isDone = status === "completed";
            const xpEarned = l.progress?.xpEarned ?? 0;
            const total = (l.progress?.correctCount ?? 0) + (l.progress?.incorrectCount ?? 0);
            const score = total > 0 ? Math.round(((l.progress?.correctCount ?? 0) / total) * 100) : null;
            return (
              <li key={l.id}>
                <a
                  href={`/app/lesson/${l.id}`}
                  className={`flex items-center justify-between rounded-2xl border-2 p-4 transition-all ${
                    isDone
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-orange-200 bg-white hover:border-orange-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        isDone ? "bg-emerald-500 text-white" : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    <div>
                      <div className="font-semibold">{l.titleNl}</div>
                      <div className="text-xs text-neutral-500">{l.titleEn}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    {isDone ? (
                      <>
                        <div>+{xpEarned} XP</div>
                        {score !== null && <div>Best: {score}%</div>}
                      </>
                    ) : (
                      <div>+{l.xpReward} XP</div>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
          {lessons.length === 0 && (
            <li className="rounded-2xl border-2 border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
              No lessons in this unit yet.
            </li>
          )}
        </ol>
      </section>

      {/* Vocab grid */}
      {vocab.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vocab in this unit</h2>
            {vocab.length > vocabPreview.length && (
              <button
                onClick={() => setVocabModalOpen(true)}
                className="text-sm font-medium text-orange-600 hover:underline"
              >
                Show all ({vocab.length})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {vocabPreview.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
              >
                <div className="font-semibold">{v.nl}</div>
                <div className="text-xs text-neutral-500">{v.en}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {vocabModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setVocabModalOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">All vocab</h3>
              <button
                onClick={() => setVocabModalOpen(false)}
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {vocab.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-neutral-200 bg-white p-3"
                >
                  <div className="font-semibold">{v.nl}</div>
                  <div className="text-xs text-neutral-500">{v.en}</div>
                  {v.exampleSentenceNl && (
                    <div className="mt-1 text-xs italic text-neutral-600">
                      &ldquo;{v.exampleSentenceNl}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grammar concept */}
      {grammar && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Grammar concept</h2>
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
            <button
              onClick={() => setGrammarOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="font-semibold">{grammar.titleNl}</div>
                <div className="text-sm text-neutral-600">{grammar.titleEn}</div>
              </div>
              <span className="text-xl text-blue-600">{grammarOpen ? "−" : "+"}</span>
            </button>
            {grammarOpen && grammar.explanationMd && (
              <div className="mt-3 whitespace-pre-line border-t border-blue-200 pt-3 text-sm text-neutral-800">
                {grammar.explanationMd}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Boss fight CTA */}
      {bossFight && (
        <section className="mb-24">
          <h2 className="mb-3 text-lg font-semibold">Boss fight</h2>
          <div
            className={`rounded-2xl border-2 p-5 transition-all ${
              bossFight.unlocked
                ? "animate-pulse border-amber-400 bg-gradient-to-br from-amber-50 to-orange-100 shadow-lg shadow-amber-200"
                : "border-neutral-300 bg-neutral-100 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  Roleplay challenge
                </div>
                <div className="text-xl font-bold">{bossFight.titleNl}</div>
                <div className="text-sm text-neutral-600">{bossFight.titleEn}</div>
              </div>
              {bossFight.unlocked ? (
                <a
                  href={`/app/roleplay/${bossFight.slug}`}
                  className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Start
                </a>
              ) : (
                <div className="text-2xl">🔒</div>
              )}
            </div>
            {!bossFight.unlocked && (
              <p className="mt-3 text-xs text-neutral-500">
                Finish all lessons in this unit to unlock the boss fight.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Sticky bottom: Start next lesson */}
      {nextLesson && !allLessonsDone && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm">
              <span className="text-neutral-500">Next lesson: </span>
              <span className="font-semibold">{nextLesson.titleNl}</span>
            </div>
            <a
              href={`/app/lesson/${nextLesson.id}`}
              className="shrink-0 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Start next lesson
            </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
