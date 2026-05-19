import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { recordVocabPairResult } from "../../lib/server/lesson";
import { VocabSourceAttribution } from "../VocabSourceAttribution";

type Pair = { nl: string; en: string };

/**
 * Flashcard reveal drill.
 *
 * Synthesized at the end of each lesson from the unit vocab pool (see
 * `buildFlashcardTail` in lesson.ts). Shows the Dutch headword + audio,
 * hides the English translation behind a "Reveal" button. The learner then
 * self-grades binary: "Knew it" or "Didn't know".
 *
 * - Knew it → `recordVocabPairResult({ correct: true })` (no-op in the queue),
 *   then `onSubmit(true)` advances the lesson player.
 * - Didn't know → `recordVocabPairResult({ correct: false })` upserts the pair
 *   into spaced_rep_queue under `itemType: "vocab_pair"`, then `onSubmit(false)`
 *   so the lesson scorecard reflects the miss.
 *
 * The component never calls `recordDrillResult` because the synthetic drill
 * has no row in the `exercises` table — the lesson player skips that call
 * via the `drill.isSynthetic` flag.
 */
export function FlashcardDrill({ drill, onSubmit, vocabEnrichedMap }: DrillProps) {
  const pair = parseField<Pair>(drill.answer);
  const [revealed, setRevealed] = useState(false);

  if (!pair || typeof pair.nl !== "string" || typeof pair.en !== "string") {
    return (
      <DrillFrame promptLabel="Flashcard" prompt="Card unavailable">
        <button
          type="button"
          onClick={() => onSubmit(true)}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Skip
        </button>
      </DrillFrame>
    );
  }

  const enriched = vocabEnrichedMap?.[pair.nl.toLowerCase()];

  const grade = (knewIt: boolean) => {
    void recordVocabPairResult({
      data: { nl: pair.nl, en: pair.en, correct: knewIt },
    }).catch(() => {});
    onSubmit(knewIt);
  };

  return (
    <DrillFrame
      promptLabel="Flashcard"
      prompt={drill.promptEn ?? "Do you remember this word?"}
    >
      <div
        className="flex flex-col items-center gap-4 py-4"
        data-testid="flashcard-drill"
      >
        <div className="relative flex items-center gap-3">
          <div className="flex flex-col items-center gap-0.5">
            <div
              data-testid="flashcard-headword"
              className="text-4xl font-bold text-neutral-900 dark:text-neutral-100"
            >
              {pair.nl}
            </div>
            {enriched?.ipa && (
              <div
                data-testid="flashcard-ipa"
                className="font-mono text-sm text-neutral-500"
              >
                {enriched.ipa}
              </div>
            )}
          </div>
          <Speaker text={pair.nl} size="md" />
          {enriched?.gender && (
            <span
              data-testid="flashcard-gender"
              className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600"
            >
              {enriched.gender}
            </span>
          )}
          {enriched?.sources && (
            <span className="absolute -top-2 -right-4">
              <VocabSourceAttribution
                word={pair.nl}
                sources={enriched.sources}
              />
            </span>
          )}
        </div>

        {revealed ? (
          <>
            <div
              data-testid="flashcard-answer"
              className="rounded-2xl border-2 border-orange-200 bg-orange-50 px-6 py-3 text-xl font-semibold text-orange-900"
            >
              {pair.en}
            </div>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => grade(false)}
                data-testid="flashcard-grade-didnt"
                className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-5 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-200"
              >
                <X size={16} aria-hidden /> Didn&rsquo;t know
              </button>
              <button
                type="button"
                onClick={() => grade(true)}
                data-testid="flashcard-grade-knew"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <Check size={16} aria-hidden /> Knew it
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            data-testid="flashcard-reveal"
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <RotateCcw size={16} aria-hidden /> Reveal meaning
          </button>
        )}
      </div>
    </DrillFrame>
  );
}
