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
          className="btn-3d btn-3d-green"
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
      <div data-testid="listening-spell-drill">
        <div className="input3d-speaker" data-testid="listening-spell-speaker">
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
          className={`input3d ${
            submitted ? (correct ? "input3d--good" : "input3d--bad") : ""
          }`}
        />

        <div className="input3d-actions input3d-actions--end">
          <button
            type="button"
            onClick={grade}
            disabled={submitted || value.trim().length === 0}
            data-testid="listening-spell-submit"
            className="btn-3d btn-3d-green"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div
            className={`input3d-reveal ${correct ? "input3d-reveal--good" : "input3d-reveal--bad"}`}
            data-testid="listening-spell-feedback"
          >
            <div className="input3d-reveal-label">
              {correct ? "Correct" : "You wrote"}
            </div>
            <div className={`input3d-reveal-value ${correct ? "input3d-reveal-value--good" : "input3d-reveal-value--bad"}`}>
              {value}
            </div>
            <div className="input3d-reveal-label" style={{ marginTop: "0.6rem" }}>
              Canonical
            </div>
            <div className="input3d-reveal-value" data-testid="listening-spell-canonical">
              <span>{pair.nl}</span>
              <Speaker text={pair.nl} size="sm" />
            </div>
            {correct && distanceAfterSubmit === 1 && (
              <div className="input3d-close-enough" data-testid="listening-spell-close-enough">
                Close enough — counted as correct.
              </div>
            )}
            <div className="input3d-reveal-gloss">{pair.en}</div>
          </div>
        )}
      </div>
    </DrillFrame>
  );
}
