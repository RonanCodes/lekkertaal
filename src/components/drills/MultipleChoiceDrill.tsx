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
          <div className="flex items-center gap-3">
            <Speaker text={audioText} size="lg" ariaLabel="Play Dutch sentence" />
            <span className="text-base text-neutral-500">Tap to play</span>
          </div>
        ) : (
          promptText
        )
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const isPicked = picked === o.text;
          const isCorrect = canonical != null && o.text === canonical;
          const showCorrect = submitted && isCorrect;
          const showWrong = submitted && isPicked && !isCorrect;
          return (
            <button
              key={o.text}
              onClick={() => pick(o.text)}
              disabled={submitted}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-all disabled:cursor-default ${
                showCorrect
                  ? "border-emerald-500 bg-emerald-100"
                  : showWrong
                    ? "border-rose-500 bg-rose-100"
                    : "border-neutral-200 bg-white hover:border-orange-300"
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>
      {submitted && picked && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          {(() => {
            const isCorrect = canonical != null && picked === canonical;
            if (isCorrect) {
              const explanation = options.find((o) => o.text === picked)?.explanation;
              return explanation ? <>{explanation}</> : <>Nice. {canonical} is right.</>;
            }
            const pickedExp = options.find((o) => o.text === picked)?.explanation;
            return (
              <>
                <span className="font-semibold">{canonical}</span> is correct
                {pickedExp ? <> because {pickedExp}</> : null}.
              </>
            );
          })()}
        </div>
      )}
    </DrillFrame>
  );
}
