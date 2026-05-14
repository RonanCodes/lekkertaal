import { useState } from "react";
import { recordReviewResult } from "../lib/server/spaced-rep";
import type { ReviewCardPayload } from "../lib/server/lesson";

/**
 * Surfaces up to 3 due review cards before the main lesson content.
 *
 * For roleplay errors we show "this is wrong → this is right"; the user
 * self-rates "Got it" / "Forgot" which feeds back into SM-2 via
 * recordReviewResult.
 *
 * For drill-mistake reviews we currently show only the metadata payload (a
 * full drill-rerender is a US-019 follow-up; keeping this scoped).
 */
export function ReviewRibbon({ reviews }: { reviews: ReviewCardPayload[] }) {
  const [pending, setPending] = useState<ReviewCardPayload[]>(reviews);

  if (pending.length === 0) return null;

  async function mark(card: ReviewCardPayload, correct: boolean) {
    setPending((p) => p.filter((c) => c.id !== card.id));
    try {
      await recordReviewResult({ data: { queueId: card.id, correct } });
    } catch (err) {
      console.error("[ReviewRibbon] record failed:", err);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          Review · {pending.length} due
        </h2>
        <span className="text-xs text-amber-800/70">SM-2 spaced repetition</span>
      </header>
      <ul className="space-y-2">
        {pending.map((c) => (
          <ReviewCard key={c.id} card={c} onMark={mark} />
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({
  card,
  onMark,
}: {
  card: ReviewCardPayload;
  onMark: (c: ReviewCardPayload, correct: boolean) => void;
}) {
  const p = (card.payload ?? {});
  const incorrect = typeof p.incorrect === "string" ? p.incorrect : null;
  const correction = typeof p.correction === "string" ? p.correction : null;
  const explanation =
    typeof p.explanationEn === "string" ? p.explanationEn : null;
  const isRoleplayError = card.itemType === "roleplay_error" && correction;

  return (
    <li className="rounded-lg bg-white p-3 text-sm ring-1 ring-amber-200">
      {isRoleplayError ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {incorrect && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-red-700 line-through">
                {incorrect}
              </span>
            )}
            <span className="text-neutral-400">→</span>
            <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-800">
              {correction}
            </span>
          </div>
          {explanation && (
            <p className="mt-2 text-xs text-neutral-600">{explanation}</p>
          )}
        </>
      ) : (
        <div className="text-neutral-700">
          Review: <code className="text-xs">{card.itemKey}</code>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onMark(card, true)}
          className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          Got it
        </button>
        <button
          type="button"
          onClick={() => onMark(card, false)}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Forgot
        </button>
      </div>
    </li>
  );
}
