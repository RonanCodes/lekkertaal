import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Lock, Sparkles, Swords } from "lucide-react";
import { getUnitDetail } from "../lib/server/unit";
import { AppShell } from "../components/AppShell";
import { Speaker } from "../components/drills/Speaker";

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

/**
 * The Dutch-treat mascot family doubles as unit characters (per the redesign
 * brief). Units don't carry a mascot field in the schema, so pick one
 * deterministically from the unit order: same unit always shows the same
 * treat, and consecutive units cycle through the family. Each treat has
 * idle / happy / surprised frames under public/mascot/treats/<treat>/.
 */
const UNIT_TREATS = [
  "kroket",
  "bitterballen",
  "oliebollen",
  "drop",
  "poffertjes",
  "frikandel",
  "tompouce",
  "kaas",
] as const;

function treatFor(order: number): (typeof UNIT_TREATS)[number] {
  const i = ((order - 1) % UNIT_TREATS.length + UNIT_TREATS.length) % UNIT_TREATS.length;
  return UNIT_TREATS[i];
}

function UnitDetailPage() {
  const data = Route.useLoaderData();
  const { unit, lessons, vocab, grammar, bossFight, user } = data;

  const completedCount = lessons.filter((l) => l.progress?.status === "completed").length;
  const allLessonsDone = lessons.length > 0 && completedCount === lessons.length;
  const nextLesson = lessons.find((l) => l.progress?.status !== "completed") ?? lessons[0];
  const pct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const vocabPreview = vocab.slice(0, 10);

  const treat = treatFor(unit.order);

  return (
    <AppShell user={user}>
      <div className="mb-5">
        <a
          href="/app/path"
          className="text-display text-sm font-semibold"
          style={{ color: "var(--color-brand-orange-dark)" }}
        >
          &larr; Back to path
        </a>
      </div>

      {/* Unit hero — chunky card with the unit's treat mascot, progress ring,
          and the unit title set in the display face. */}
      <section className="card mb-8 overflow-hidden">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <img
            src={`/mascot/treats/${treat}/${allLessonsDone ? "happy" : "idle"}.png`}
            alt={`${treat} mascot for this unit`}
            className={`h-28 w-28 shrink-0 ${allLessonsDone ? "anim-happy-bounce" : "anim-idle-bob"}`}
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div
              className="text-display text-xs font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-brand-blue-dark)" }}
            >
              Unit {unit.order} &middot; {unit.cefrLevel}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">{unit.titleNl}</h1>
            <p className="text-lg" style={{ color: "var(--text-soft)" }}>
              {unit.titleEn}
            </p>
            {unit.description && (
              <p className="mt-2 text-sm" style={{ color: "var(--text-body)" }}>
                {unit.description}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar across the whole unit */}
        {lessons.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-display font-semibold" style={{ color: "var(--text-soft)" }}>
                {allLessonsDone ? "Unit complete! Goed zo." : `${completedCount} / ${lessons.length} lessons`}
              </span>
              <span className="text-display font-bold" style={{ color: "var(--color-brand-orange)" }}>
                {pct}%
              </span>
            </div>
            <div
              className="h-3 w-full overflow-hidden rounded-full"
              style={{ background: "var(--line-soft)" }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: allLessonsDone
                    ? "var(--color-good)"
                    : "var(--color-brand-orange)",
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Lessons list — depth-layered nodes with a connecting rail down the
          left edge, echoing the path's stepping-stone language. */}
      <section className="mb-8">
        <h2 className="text-display mb-3 text-lg font-bold">Lessons</h2>
        <ol className="relative space-y-3">
          {lessons.map((l, i) => {
            const status = l.progress?.status ?? "not_started";
            const isDone = status === "completed";
            const isNext = !isDone && l.id === nextLesson?.id;
            const xpEarned = l.progress?.xpEarned ?? 0;
            const total = (l.progress?.correctCount ?? 0) + (l.progress?.incorrectCount ?? 0);
            const score = total > 0 ? Math.round(((l.progress?.correctCount ?? 0) / total) * 100) : null;
            return (
              <li key={l.id}>
                <a
                  href={`/app/lesson/${l.id}`}
                  className={`flex items-center justify-between gap-3 rounded-3xl border-2 p-4 transition-all hover:-translate-y-0.5 ${
                    isDone
                      ? "border-emerald-300 bg-emerald-50"
                      : isNext
                        ? "border-orange-200 bg-white ring-2 ring-orange-200"
                        : "border-neutral-200 bg-white hover:border-orange-200"
                  }`}
                  style={
                    isNext
                      ? { boxShadow: "0 6px 0 0 var(--color-brand-orange-soft)" }
                      : { boxShadow: "0 4px 0 0 var(--line-soft)" }
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="text-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                      style={{
                        background: isDone ? "var(--color-good)" : "var(--color-brand-orange)",
                        boxShadow: isDone
                          ? "0 3px 0 0 #2D6638"
                          : "0 3px 0 0 var(--color-brand-orange-dark)",
                      }}
                    >
                      {isDone ? <Check size={18} strokeWidth={3} /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-display truncate font-bold">{l.titleNl}</div>
                      <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {l.titleEn}
                      </div>
                    </div>
                  </div>
                  <div className="text-display shrink-0 text-right text-xs font-semibold">
                    {isDone ? (
                      <>
                        <div style={{ color: "var(--color-good)" }}>+{xpEarned} XP</div>
                        {score !== null && (
                          <div style={{ color: "var(--text-muted)" }}>Best {score}%</div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: "var(--color-brand-orange-dark)" }}>+{l.xpReward} XP</div>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
          {lessons.length === 0 && (
            <li className="rounded-3xl border-2 border-dashed border-neutral-200 p-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No lessons in this unit yet. Kom snel terug!
            </li>
          )}
        </ol>
      </section>

      {/* Vocab grid */}
      {vocab.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-display text-lg font-bold">Vocab in this unit</h2>
            {vocab.length > vocabPreview.length && (
              <button
                onClick={() => setVocabModalOpen(true)}
                className="text-display text-sm font-semibold"
                style={{ color: "var(--color-brand-orange-dark)" }}
              >
                Show all ({vocab.length})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {vocabPreview.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-2xl border-2 border-neutral-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-display truncate font-bold">{v.nl}</div>
                  <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {v.en}
                  </div>
                </div>
                <Speaker text={v.nl} size="sm" />
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
            className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-display text-lg font-bold">All vocab</h3>
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
                  className="rounded-2xl border-2 border-neutral-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-display truncate font-bold">{v.nl}</div>
                      <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {v.en}
                      </div>
                    </div>
                    <Speaker text={v.nl} size="sm" />
                  </div>
                  {v.exampleSentenceNl && (
                    <div className="mt-1 text-xs italic" style={{ color: "var(--text-soft)" }}>
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
          <h2 className="text-display mb-3 text-lg font-bold">Grammar concept</h2>
          <div className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-4">
            <button
              onClick={() => setGrammarOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={grammarOpen}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={20} style={{ color: "var(--color-brand-blue)" }} />
                <div>
                  <div className="text-display font-bold">{grammar.titleNl}</div>
                  <div className="text-sm" style={{ color: "var(--text-soft)" }}>
                    {grammar.titleEn}
                  </div>
                </div>
              </div>
              <span className="text-2xl font-bold" style={{ color: "var(--color-brand-blue)" }}>
                {grammarOpen ? "−" : "+"}
              </span>
            </button>
            {grammarOpen && grammar.explanationMd && (
              <div
                className="mt-3 whitespace-pre-line border-t border-blue-200 pt-3 text-sm"
                style={{ color: "var(--text-body)" }}
              >
                {grammar.explanationMd}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Boss fight CTA — the unit's capstone roleplay. Unlocked once every
          lesson is done; glows and offers the mascot a happy frame. */}
      {bossFight && (
        <section className="mb-28">
          <h2 className="text-display mb-3 text-lg font-bold">Boss fight</h2>
          <div
            className={`rounded-3xl border-2 p-5 transition-all ${
              bossFight.unlocked
                ? "border-amber-400 bg-gradient-to-br from-amber-50 to-orange-100 shadow-lg shadow-amber-200"
                : "border-neutral-300 bg-neutral-100 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                  style={{
                    background: bossFight.unlocked
                      ? "var(--color-brand-orange)"
                      : "var(--text-faint)",
                  }}
                >
                  <Swords size={24} strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <div
                    className="text-display text-xs font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Roleplay challenge
                  </div>
                  <div className="text-display truncate text-xl font-extrabold">
                    {bossFight.titleNl}
                  </div>
                  <div className="truncate text-sm" style={{ color: "var(--text-soft)" }}>
                    {bossFight.titleEn}
                  </div>
                </div>
              </div>
              {bossFight.unlocked ? (
                <a href={`/app/roleplay/${bossFight.slug}`} className="btn-3d btn-3d-sm shrink-0">
                  Start
                </a>
              ) : (
                <Lock size={28} style={{ color: "var(--text-faint)" }} aria-label="Locked" />
              )}
            </div>
            {!bossFight.unlocked && (
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Finish all lessons in this unit to unlock the boss fight.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Sticky bottom: Start next lesson */}
      {nextLesson && !allLessonsDone && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 px-4 py-3 backdrop-blur"
          style={{ borderColor: "var(--line-soft)" }}
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="min-w-0 truncate text-sm">
              <span style={{ color: "var(--text-muted)" }}>Next lesson: </span>
              <span className="text-display font-bold">{nextLesson.titleNl}</span>
            </div>
            <a href={`/app/lesson/${nextLesson.id}`} className="btn-3d btn-3d-sm shrink-0">
              Start next lesson
            </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
