import type { ReactNode } from "react";

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

export function FeedbackBanner({
  correct,
  message,
}: {
  correct: boolean;
  message?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-3 text-sm font-medium ${
        correct
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-rose-300 bg-rose-50 text-rose-800"
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
 * Levenshtein distance — small, no deps. Used by translation/fitb/word-order
 * grading per US-012/US-013/US-014.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1).fill(0);
  const curr = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
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
