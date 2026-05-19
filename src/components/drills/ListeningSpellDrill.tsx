import { useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { levenshtein } from "../../lib/server/levenshtein";
import { recordVocabPairResult } from "../../lib/server/lesson";

type Pair = { nl: string; en: string };

/**
 * Listening-spell drill (US-001 from the drill-catalogue-parity work).
 *
 * Plays a Dutch headword via the Speaker (Wikimedia → OpenAI TTS chain) and
 * asks the learner to type what they heard. The word itself is hidden until
 * after the answer is submitted. Grading is Levenshtein-≤1 client-side
 * (one typo tolerance), normalised by trim + lowercase only — we don't strip
 * punctuation here because the source is a single Dutch word with no
 * punctuation to begin with.
 *
 * Data shape (matches buildListeningSpellTail in lesson.ts):
 *   answer: JSON.stringify({ nl, en })
 *
 * On grade, calls `recordVocabPairResult({ nl, en, correct })` so misses feed
 * the `spaced_rep_queue` under `itemType: "vocab_pair"` (same path as
 * FlashcardDrill). Synthetic drill so the lesson player skips
 * `recordDrillResult` based on the `isSynthetic` flag.
 */
export function ListeningSpellDrill({ drill, onSubmit }: DrillProps) {
  const pair = parseField<Pair>(drill.answer);
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  if (!pair || typeof pair.nl !== "string" || typeof pair.en !== "string") {
    return (
      <DrillFrame promptLabel="Listening" prompt="Card unavailable">
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

  const grade = () => {
    if (submitted || value.trim().length === 0) return;
    const u = value.trim().toLowerCase();
    const c = pair.nl.trim().toLowerCase();
    const distance = u === c ? 0 : levenshtein(u, c);
    const isCorrect = distance <= 1;
    setSubmitted(true);
    setCorrect(isCorrect);
    void recordVocabPairResult({
      data: { nl: pair.nl, en: pair.en, correct: isCorrect },
    }).catch(() => {});
    setTimeout(() => onSubmit(isCorrect, value), 800);
  };

  const distanceAfterSubmit =
    submitted
      ? levenshtein(value.trim().toLowerCase(), pair.nl.trim().toLowerCase())
      : 0;

  return (
    <DrillFrame
      promptLabel="Listening"
      prompt={drill.promptEn ?? "Listen and type what you hear"}
    >
      <div className="space-y-4" data-testid="listening-spell-drill">
        <div
          className="flex justify-center py-2"
          data-testid="listening-spell-speaker"
        >
          <Speaker text={pair.nl} size="lg" ariaLabel="Play the Dutch word" />
        </div>

        <input
          type="text"
          autoFocus
          inputMode="text"
          lang="nl"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") grade();
          }}
          placeholder="Type the Dutch word you heard"
          disabled={submitted}
          aria-label="Type the Dutch word you heard"
          data-testid="listening-spell-input"
          className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-semibold outline-none transition-all ${
            submitted
              ? correct
                ? "border-emerald-400 bg-emerald-50"
                : "border-rose-400 bg-rose-50"
              : "border-neutral-300 bg-white focus:border-orange-400"
          }`}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={grade}
            disabled={submitted || value.trim().length === 0}
            data-testid="listening-spell-submit"
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div
            className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-sm"
            data-testid="listening-spell-feedback"
          >
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              {correct ? "Correct" : "You wrote"}
            </div>
            <div className={`font-semibold ${correct ? "text-emerald-700" : "text-rose-700"}`}>
              {value}
            </div>
            <div className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
              Canonical
            </div>
            <div
              className="flex items-center gap-2 font-semibold text-neutral-800"
              data-testid="listening-spell-canonical"
            >
              <span>{pair.nl}</span>
              <Speaker text={pair.nl} size="sm" />
            </div>
            {correct && distanceAfterSubmit === 1 && (
              <div
                className="mt-2 text-xs italic text-emerald-700"
                data-testid="listening-spell-close-enough"
              >
                Close enough — counted as correct.
              </div>
            )}
            <div className="mt-2 text-xs text-neutral-500">{pair.en}</div>
          </div>
        )}
      </div>
    </DrillFrame>
  );
}
