import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLesson, recordDrillResult, completeLesson } from "../lib/server/lesson";
import { AppShell } from "../components/AppShell";
import { DrillRenderer } from "../components/drills/DrillRenderer";
import { FeedbackBanner } from "../components/drills/DrillFrame";

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
  const { lesson, drills, user } = data;

  const [drillIdx, setDrillIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const total = drills.length;
  const drill = drills[drillIdx];
  const progressPct = total > 0 ? Math.round(((drillIdx + (feedback ? 1 : 0)) / total) * 100) : 0;

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
    if (correct) setCorrectCount((c) => c + 1);
    else setIncorrectCount((c) => c + 1);

    // Fire-and-forget — wrong answers get queued for spaced repetition.
    void recordDrillResult({
      data: { exerciseId: drill.id, correct, userAnswer },
    }).catch(() => {});
  };

  const next = async () => {
    setFeedback(null);
    if (drillIdx + 1 >= total) {
      setFinishing(true);
      try {
        await completeLesson({
          data: {
            lessonId: lesson.id,
            correctCount: correctCount + (feedback?.correct ? 1 : 0),
            incorrectCount: incorrectCount + (feedback && !feedback.correct ? 1 : 0),
          },
        });
      } catch {
        // Best-effort; don't block the user from seeing the completion screen.
      }
      navigate({ to: `/app/lesson/${lesson.id}/complete` });
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
      {/* Progress + skip */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={confirmSkip}
          aria-label="Exit lesson"
          className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
        >
          ✕
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-xs font-semibold text-neutral-500">
          {Math.min(drillIdx + 1, total)} / {total}
        </div>
      </div>

      <h1 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {lesson.titleNl}
      </h1>

      <DrillRenderer key={drill.id} drill={drill} onSubmit={handleSubmit} />

      {feedback && (
        <div className="mt-4 space-y-3">
          <FeedbackBanner correct={feedback.correct} />
          <button
            type="button"
            onClick={next}
            disabled={finishing}
            className="w-full rounded-full bg-orange-500 px-5 py-3 text-base font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {finishing ? "Saving…" : drillIdx + 1 >= total ? "Finish lesson" : "Continue (Enter)"}
          </button>
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
