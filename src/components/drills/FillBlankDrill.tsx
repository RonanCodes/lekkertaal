import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { DrillFrame, gradeText } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

/**
 * Fill-in-the-blank drill (US-013).
 *
 * Data shape:
 *   promptNl : "Ik ___ gegaan."        // ___ marks the blank
 *   answer   : "ben"                    // or ["ben"]
 *
 * Same grading as US-012 (Levenshtein ≤ 1). Hint reveals first letter (10 coins).
 */
export function FillBlankDrill({ drill, onSubmit }: DrillProps) {
  const canonicals = useMemo<string[]>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }, [drill.answer]);
  const canonical = canonicals[0] ?? "";

  const sentence = drill.promptNl ?? "___";
  const parts = useMemo(() => sentence.split(/_{2,}/), [sentence]);
  const before = parts[0] ?? "";
  const after = parts[1] ?? "";

  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const submit = () => {
    if (submitted || value.trim().length === 0) return;
    const isCorrect = canonicals.some((c) => gradeText(value, c));
    setSubmitted(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
    }
    setTimeout(() => onSubmit(isCorrect, value), 800);
  };

  const useHint = () => {
    if (submitted || hintUsed || canonical.length < 1) return;
    setHintUsed(true);
    if (value.length < 1) setValue(canonical.slice(0, 1));
    // TODO(US-021): deduct 10 coins via wallet server-fn
  };

  // Width hint for the input — roughly the canonical length.
  const widthCh = Math.max(4, canonical.length + 2);

  return (
    <DrillFrame
      promptLabel="Fill in the blank"
      prompt={drill.promptEn ?? "Complete the sentence"}
    >
      <div>
        <div
          className={`input3d-cloze ${
            submitted ? (correct ? "input3d-cloze--good" : "input3d-cloze--bad") : ""
          } ${shaking ? "input3d--shake" : ""}`}
        >
          {before && <span>{before}</span>}
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
            placeholder="___"
            disabled={submitted}
            style={{ width: `${widthCh}ch` }}
            className="input3d-slot"
          />
          {after && <span>{after}</span>}
        </div>

        <div className="input3d-actions">
          <button
            type="button"
            onClick={useHint}
            disabled={submitted || hintUsed}
            className="input3d-hint"
          >
            💡 Hint (10 coins)
            {hintUsed && <span className="input3d-hint-used">used</span>}
          </button>
          <Button
            type="button"
            variant="green"
            onClick={submit}
            disabled={submitted || value.trim().length === 0}
          >
            Check
          </Button>
        </div>

        {submitted && !correct && (
          <div className="input3d-reveal input3d-reveal--bad">
            <div className="input3d-reveal-label">Correct answer</div>
            <div className="input3d-reveal-value">
              <span>
                {before}
                <span className="input3d-reveal-value--good">{canonical}</span>
                {after}
              </span>
              <Speaker text={`${before}${canonical}${after}`} size="sm" />
            </div>
          </div>
        )}
      </div>
    </DrillFrame>
  );
}
