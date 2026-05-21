import type { ReactNode } from "react";
import { levenshtein } from "../../lib/server/levenshtein";

/**
 * Re-export the shared Levenshtein helper so existing call-sites in this
 * module (and tests importing from `DrillFrame`) keep working. The single
 * source of truth lives at `src/lib/server/levenshtein.ts` so the
 * listening-spell drill and any future server-side grading can share it.
 */
export { levenshtein };

/**
 * Shared shell for every drill type. Holds the prompt header, the body slot
 * (filled by the per-type component), and the post-answer feedback strip.
 *
 * The per-type component owns answer state + UI; it calls `onSubmit(correct)`
 * which the parent (lesson player) handles for queue + progress bookkeeping.
 */
export function DrillFrame({
  promptLabel,
  prompt,
  children,
  feedback,
  footer,
}: {
  promptLabel?: string;
  prompt?: ReactNode;
  children: ReactNode;
  feedback?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-orange-200 bg-white p-5 shadow-sm sm:p-6">
      {promptLabel && (
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
          {promptLabel}
        </div>
      )}
      {prompt && <div className="mb-4 text-xl font-semibold sm:text-2xl">{prompt}</div>}
      <div>{children}</div>
      {feedback && <div className="mt-4">{feedback}</div>}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

/**
 * Inline post-answer banner. Kept for drill components that surface their own
 * feedback (e.g. listening-spell showing the correct spelling) inside the
 * drill body. The lesson player itself now renders the sticky `.feedback-bar`
 * footer (see `app.lesson.$lessonId.tsx`); this banner reads the same shared
 * `--color-good-soft` / `--color-bad-soft` tokens so the two stay in sync.
 *
 * Props are intentionally stable: drill screens call this with
 * `{ correct, message }`.
 */
export function FeedbackBanner({
  correct,
  message,
}: {
  correct: boolean;
  message?: ReactNode;
}) {
  return (
    <div
      className={`feedback-banner rounded-2xl p-3 text-sm font-medium ${
        correct ? "feedback-banner--good" : "feedback-banner--bad"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="font-bold">{correct ? "Correct!" : "Not quite"}</div>
      {message && <div className="mt-1 text-xs">{message}</div>}
    </div>
  );
}


/**
 * Normalise an answer for tolerant grading: lowercase, trim, strip terminal
 * punctuation, collapse internal whitespace.
 */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:"'()]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Compare user input to canonical, allowing distance <= 1 (one typo).
 */
export function gradeText(user: string, canonical: string): boolean {
  const u = normaliseAnswer(user);
  const c = normaliseAnswer(canonical);
  if (u === c) return true;
  return levenshtein(u, c) <= 1;
}
