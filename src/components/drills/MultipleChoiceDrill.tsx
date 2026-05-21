import { useMemo, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type MCOption = {
  text: string;
  /** Optional inline explanation for "X is correct because Y" on wrong picks. */
  explanation?: string;
};

/**
 * Multiple-choice drill (US-011).
 *
 * Two modes:
 *  - "text"  : prompt rendered as text (Dutch sentence or English question)
 *  - "audio" : prompt rendered as a 🔊 button that plays the Dutch sentence via TTS
 *
 * Data shape:
 *   options: ["een appel", "een boek", "een huis", "een tafel"]
 *           OR [{ text: "...", explanation: "..." }, ...]
 *   answer : "een appel"   // the correct option text
 *
 * Selecting an option immediately styles it correct/wrong + reveals the
 * explanation. The lesson-player parent handles advancement.
 *
 * UI: redesigned as `.option-card` tappable cards (#210). Each card carries a
 * keyboard-hint chip (1-4) on pointer-capable screens; selected/correct/wrong
 * states route through the shared `--color-good-soft` / `--color-bad-soft`
 * feedback tokens so light + dark inherit automatically. Sits inside the #209
 * lesson-player shell; the frame + sticky feedback bar are owned upstream.
 */
export function MultipleChoiceDrill({
  drill,
  onSubmit,
  mode,
}: DrillProps & { mode: "text" | "audio" }) {
  const options = useMemo<MCOption[]>(() => {
    const raw = parseField<unknown>(drill.options);
    if (Array.isArray(raw)) {
      return raw.map((o) =>
        typeof o === "string"
          ? { text: o }
          : typeof o === "object" && o && "text" in o
            ? { text: String((o as { text: unknown }).text), explanation: (o as { explanation?: string }).explanation }
            : { text: String(o) },
      );
    }
    return [];
  }, [drill.options]);

  const canonical = useMemo(() => {
    const raw = parseField<unknown>(drill.answer);
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object" && "text" in raw)
      return String((raw).text);
    return null;
  }, [drill.answer]);

  const audioText = drill.promptNl ?? "";
  const promptText = mode === "audio" ? "Listen and pick the meaning" : (drill.promptNl ?? drill.promptEn ?? "");

  const [picked, setPicked] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const pick = (text: string) => {
    if (submitted) return;
    setPicked(text);
    setSubmitted(true);
    const correct = canonical != null && text === canonical;
    // Short delay so the user sees correct/wrong styling before parent advances.
    setTimeout(() => onSubmit(correct, text), 600);
  };

  return (
    <DrillFrame
      promptLabel={mode === "audio" ? "Listening" : "Multiple choice"}
      prompt={
        mode === "audio" ? (
          <div className="mc-audio-prompt">
            <Speaker text={audioText} size="lg" ariaLabel="Play Dutch sentence" />
            <span className="mc-audio-prompt__hint">Tap to play</span>
          </div>
        ) : (
          promptText
        )
      }
    >
      <div className="mc-options" data-testid="mc-options" role="listbox" aria-label="Answer options">
        {options.map((o, i) => {
          const isPicked = picked === o.text;
          const isCorrect = canonical != null && o.text === canonical;
          const showCorrect = submitted && isCorrect;
          const showWrong = submitted && isPicked && !isCorrect;
          const state = showCorrect ? "correct" : showWrong ? "wrong" : isPicked ? "selected" : "idle";
          return (
            <button
              key={o.text}
              type="button"
              onClick={() => pick(o.text)}
              disabled={submitted}
              data-state={state}
              data-correct={isCorrect}
              role="option"
              aria-selected={isPicked}
              className="option-card"
            >
              <kbd className="option-card__kbd" aria-hidden="true">
                {i + 1}
              </kbd>
              <span className="option-card__text">{o.text}</span>
              {showCorrect && (
                <span className="option-card__mark option-card__mark--good" aria-hidden="true">
                  ✓
                </span>
              )}
              {showWrong && (
                <span className="option-card__mark option-card__mark--bad" aria-hidden="true">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
      {submitted && picked && (
        <div className="mc-explanation">
          {(() => {
            const isCorrect = canonical != null && picked === canonical;
            if (isCorrect) {
              const explanation = options.find((o) => o.text === picked)?.explanation;
              return explanation ? <>{explanation}</> : <>Goed zo. {canonical} is right.</>;
            }
            const pickedExp = options.find((o) => o.text === picked)?.explanation;
            return (
              <>
                <span className="mc-explanation__answer">{canonical}</span> is correct
                {pickedExp ? <> because {pickedExp}</> : null}.
              </>
            );
          })()}
        </div>
      )}
    </DrillFrame>
  );
}
