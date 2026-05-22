import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLesson, recordDrillResult, completeLesson } from "../lib/server/lesson";
import { AppShell } from "../components/AppShell";
import { DrillRenderer } from "../components/drills/DrillRenderer";
import { ReviewRibbon } from "../components/ReviewRibbon";
import { useSfx } from "../lib/use-sfx";

/**
 * Hearts shown in the top bar. We have no fail-out / out-of-hearts mechanic,
 * so hearts read as a soft tally of mistakes this session: each wrong answer
 * dims one heart, and the count is floored at zero (the lesson never ends
 * early). Five matches the chunky Duolingo-style chrome from the redesign.
 */
const HEART_COUNT = 5;

export const Route = createFileRoute("/app/lesson/$lessonId")({
  loader: async ({ params }) => {
    const id = Number(params.lessonId);
    if (!Number.isFinite(id)) throw notFound();
    try {
      return await getLesson({ data: { lessonId: id } });
    } catch (err) {
      if (err instanceof Error && err.message === "Lesson not found") throw notFound();
      throw err;
    }
  },
  component: LessonPlayerPage,
});

function LessonPlayerPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const { lesson, drills, user, reviews, vocabPool, imagePool, vocabEnrichedMap } = data;
  const sfx = useSfx(user.sfxEnabled);

  const [drillIdx, setDrillIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const total = drills.length;
  const drill = drills[drillIdx];
  const progressPct = total > 0 ? Math.round(((drillIdx + (feedback ? 1 : 0)) / total) * 100) : 0;
  const heartsLeft = Math.max(0, HEART_COUNT - incorrectCount);

  // Keyboard: Enter to advance after feedback.
  useEffect(() => {
    if (!feedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, drillIdx]);

  const handleSubmit = async (correct: boolean, userAnswer?: string) => {
    if (feedback) return; // ignore duplicate submits
    setFeedback({ correct });
    sfx.play(correct ? "correct" : "wrong");
    if (correct) setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);

    // Fire-and-forget — wrong answers get queued for spaced repetition.
    // Synthetic drills (flashcards sampled from the vocab pool) have no row
    // in the `exercises` table; they call `recordVocabPairResult` themselves
    // for per-pair tracking, so skip the per-exercise enqueue here.
    if (!drill.isSynthetic) {
      void recordDrillResult({
        data: { exerciseId: drill.id, correct, userAnswer },
      }).catch(() => {});
    }
  };

  const next = async () => {
    setFeedback(null);
    if (drillIdx + 1 >= total) {
      setFinishing(true);
      // Fold the final drill's just-shown feedback into the running tally so the
      // completion screen sees the true end-of-lesson counts (state setters from
      // handleSubmit haven't flushed by the time we navigate).
      const finalCorrect = correctCount + (feedback?.correct ? 1 : 0);
      const finalIncorrect = incorrectCount + (feedback && !feedback.correct ? 1 : 0);
      try {
        await completeLesson({
          data: {
            lessonId: lesson.id,
            correctCount: finalCorrect,
            incorrectCount: finalIncorrect,
          },
        });
      } catch {
        // Best-effort; don't block the user from seeing the completion screen.
      }
      // Pass per-lesson results so the complete screen can unlock its
      // perfect-lesson state (correct >= total > 0). Milestone is derived there
      // from streakDays, so we don't pass it from here.
      navigate({
        to: `/app/lesson/${lesson.id}/complete`,
        search: { correct: finalCorrect, total: finalCorrect + finalIncorrect },
      });
      return;
    }
    setDrillIdx((i) => i + 1);
  };

  const confirmSkip = () => setSkipConfirmOpen(true);
  const doSkip = () => {
    navigate({ to: lesson.unitSlug ? `/app/unit/${lesson.unitSlug}` : "/app/path" });
  };

  if (total === 0) {
    return (
      <AppShell user={user}>
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="mb-2 text-xl font-bold">No drills in this lesson yet</h1>
          <p className="mb-4 text-sm text-neutral-600">Come back once content is loaded.</p>
          <a
            href={lesson.unitSlug ? `/app/unit/${lesson.unitSlug}` : "/app/path"}
            className="inline-block rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Back
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      {/* US-019: due review cards shown before new content. */}
      {reviews && reviews.length > 0 && <ReviewRibbon reviews={reviews} />}

      {/* Top bar: close · progress track · hearts (#209 shared shell) */}
      <div className="lesson-topbar mb-5">
        <button
          type="button"
          onClick={confirmSkip}
          aria-label="Exit lesson"
          className="lesson-close"
        >
          ✕
        </button>
        <div
          className="lesson-progress"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div className="lesson-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div
          className="lesson-hearts"
          aria-label={`${heartsLeft} of ${HEART_COUNT} hearts left`}
        >
          {Array.from({ length: HEART_COUNT }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`lesson-heart${i >= heartsLeft ? " lesson-heart--spent" : ""}`}
            >
              ♥
            </span>
          ))}
        </div>
      </div>

      <h1 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {lesson.titleNl}
      </h1>

      <DrillRenderer key={drill.id} drill={drill} onSubmit={handleSubmit} vocabPool={vocabPool} imagePool={imagePool} vocabEnrichedMap={vocabEnrichedMap} />

      {feedback && (
        <div
          className={`feedback-bar ${feedback.correct ? "feedback-bar--good" : "feedback-bar--bad"}`}
        >
          <div className="feedback-bar__inner">
            <span className="feedback-bar__icon" aria-hidden="true">
              {feedback.correct ? "✓" : "✕"}
            </span>
            <div className="min-w-0 flex-1" role="status" aria-live="polite">
              <div className="feedback-bar__title">
                {feedback.correct ? "Correct!" : "Not quite"}
              </div>
              <div className="feedback-bar__detail">
                {feedback.correct
                  ? "Nice one. Keep the streak going."
                  : "No worries, this one comes back for review."}
              </div>
            </div>
            <button
              type="button"
              onClick={next}
              disabled={finishing}
              className={`btn-3d btn-3d-lg feedback-bar__cta ${feedback.correct ? "btn-3d-green" : "btn-3d-red"}`}
            >
              {finishing ? "Saving…" : drillIdx + 1 >= total ? "Finish lesson" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {skipConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-lg font-bold">Skip this lesson?</h3>
            <p className="mb-4 text-sm text-neutral-600">
              Your progress in this lesson won&rsquo;t be saved.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSkipConfirmOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={doSkip}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
