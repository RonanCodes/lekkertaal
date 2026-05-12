import { useMemo, useState } from "react";
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
      <div className="space-y-3">
        <div
          className={`flex flex-wrap items-center gap-2 rounded-2xl border-2 px-4 py-4 text-xl ${
            submitted
              ? correct
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
              : "border-neutral-200 bg-white"
          } ${shaking ? "animate-[shake_0.2s_ease-in-out]" : ""}`}
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
            className={`inline-block rounded-lg border-b-2 bg-transparent px-1 text-center text-xl font-bold outline-none ${
              submitted
                ? correct
                  ? "border-emerald-500 text-emerald-700"
                  : "border-rose-500 text-rose-700"
                : "border-orange-400 text-orange-700 focus:border-orange-600"
            }`}
          />
          {after && <span>{after}</span>}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={useHint}
            disabled={submitted || hintUsed}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            💡 Hint (10 coins)
            {hintUsed && <span className="ml-1 text-amber-600">used</span>}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitted || value.trim().length === 0}
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Check
          </button>
        </div>

        {submitted && !correct && (
          <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Correct answer
            </div>
            <div className="flex items-center gap-2 font-semibold text-neutral-800">
              <span>
                {before}
                <span className="text-emerald-700">{canonical}</span>
                {after}
              </span>
              <Speaker text={`${before}${canonical}${after}`} size="sm" />
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </DrillFrame>
  );
}
