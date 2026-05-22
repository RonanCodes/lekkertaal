import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { DrillFrame, normaliseAnswer } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { levenshtein } from "../../lib/server/levenshtein";

/**
 * Translation typing drill (US-012). EN sentence → user types NL.
 *
 * Data shape:
 *   promptEn : "I am going to school"
 *   answer   : "Ik ga naar school"     // string OR ["Ik ga naar school", "Ik ga naar de school"]
 *
 * Grading (US-132): case-insensitive, punctuation-tolerant via `normaliseAnswer`,
 * Levenshtein distance ≤ 3 against the closest accepted canonical. Sentences
 * are longer than single words so we use a looser tolerance than the
 * single-word listening-spell drill (which sticks at ≤ 1). When the answer
 * is correct but not exact (distance 1–3), a "Close enough" hint surfaces
 * alongside the canonical so the learner sees the polished form.
 *
 * Hint (5 coins): reveals first 2 letters. Coin deduction is a stub until
 * US-021 lands the wallet.
 */
export function TranslationTypingDrill({ drill, onSubmit }: DrillProps) {
  const canonicals = useMemo<string[]>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }, [drill.answer]);
  const canonical = canonicals[0] ?? "";

  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [nearMiss, setNearMiss] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const submit = () => {
    if (submitted || value.trim().length === 0) return;
    const userNorm = normaliseAnswer(value);
    const distances = canonicals.map((c) => {
      const cNorm = normaliseAnswer(c);
      return userNorm === cNorm ? 0 : levenshtein(userNorm, cNorm);
    });
    const bestDistance = distances.length === 0 ? Infinity : Math.min(...distances);
    const isCorrect = bestDistance <= 3;
    const isNearMiss = isCorrect && bestDistance > 0;
    setSubmitted(true);
    setCorrect(isCorrect);
    setNearMiss(isNearMiss);
    if (!isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
    }
    setTimeout(() => onSubmit(isCorrect, value), 800);
  };

  const useHint = () => {
    if (submitted || hintUsed || canonical.length < 2) return;
    setHintUsed(true);
    if (value.length < 2) setValue(canonical.slice(0, 2));
    // TODO(US-021): deduct 5 coins via a server-fn
  };

  return (
    <DrillFrame
      promptLabel="Translate to Dutch"
      prompt={drill.promptEn ?? "Translate this sentence"}
    >
      {/*
        `data-canonical-answer` is an e2e-only hook. The translation_typing
        drill grades against multiple accepted canonicals (joined by `|`), but
        Playwright specs only need the first one to compute an exact-match
        path. Kept attribute-only — never rendered visually — so it has no
        runtime cost and no risk of leaking the answer to learners.
      */}
      <div
        className="space-y-3"
        data-testid="translation-typing-drill"
        data-canonical-answer={canonicals.join("|")}
      >
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
            if (e.key === "Enter") submit();
          }}
          placeholder="Type the Dutch translation..."
          disabled={submitted}
          data-testid="translation-typing-input"
          className={`input3d ${
            submitted ? (correct ? "input3d--good" : "input3d--bad") : ""
          } ${shaking ? "input3d--shake" : ""}`}
        />

        <div className="input3d-actions">
          <button
            type="button"
            onClick={useHint}
            disabled={submitted || hintUsed}
            className="input3d-hint"
          >
            💡 Hint (5 coins)
            {hintUsed && <span className="input3d-hint-used">used</span>}
          </button>
          <Button
            type="button"
            variant="green"
            onClick={submit}
            disabled={submitted || value.trim().length === 0}
            data-testid="translation-typing-submit"
          >
            Check
          </Button>
        </div>

        {submitted && (
          <div
            className={`input3d-reveal ${correct ? "input3d-reveal--good" : "input3d-reveal--bad"}`}
            data-testid="translation-typing-feedback"
          >
            <div className="input3d-reveal-label">
              {correct ? "Your answer" : "You wrote"}
            </div>
            <div className={`input3d-reveal-value ${correct ? "input3d-reveal-value--good" : "input3d-reveal-value--bad"}`}>
              {value}
            </div>
            {!correct && (
              <>
                <div className="input3d-reveal-label" style={{ marginTop: "0.6rem" }}>
                  Canonical
                </div>
                <div className="input3d-reveal-value" data-testid="translation-typing-canonical">
                  <span>{canonical}</span>
                  <Speaker text={canonical} size="sm" />
                </div>
              </>
            )}
            {correct && (
              <div
                className="input3d-reveal-gloss input3d-reveal-value"
                data-testid="translation-typing-canonical"
              >
                Canonical: <span>{canonical}</span>
                <Speaker text={canonical} size="sm" />
              </div>
            )}
            {nearMiss && (
              <div className="input3d-close-enough" data-testid="translation-typing-close-enough">
                Close enough — counted as correct.
              </div>
            )}
          </div>
        )}
      </div>
    </DrillFrame>
  );
}
