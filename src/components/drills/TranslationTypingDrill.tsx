import { useMemo, useState } from "react";
import { DrillFrame, gradeText } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

/**
 * Translation typing drill (US-012). EN sentence → user types NL.
 *
 * Data shape:
 *   promptEn : "I am going to school"
 *   answer   : "Ik ga naar school"     // string OR ["Ik ga naar school", "Ik ga naar de school"]
 *
 * Grading: case-insensitive, punctuation-tolerant, Levenshtein distance ≤ 1.
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
      <div className="space-y-3">
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
          className={`w-full rounded-2xl border-2 px-4 py-3 text-lg font-semibold outline-none transition-all ${
            submitted
              ? correct
                ? "border-emerald-400 bg-emerald-50"
                : "border-rose-400 bg-rose-50"
              : "border-neutral-300 bg-white focus:border-orange-400"
          } ${shaking ? "animate-[shake_0.2s_ease-in-out]" : ""}`}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={useHint}
            disabled={submitted || hintUsed}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            💡 Hint (5 coins)
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

        {submitted && (
          <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              {correct ? "Your answer" : "You wrote"}
            </div>
            <div className={`font-semibold ${correct ? "text-emerald-700" : "text-rose-700"}`}>
              {value}
            </div>
            {!correct && (
              <>
                <div className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
                  Canonical
                </div>
                <div className="flex items-center gap-2 font-semibold text-neutral-800">
                  <span>{canonical}</span>
                  <Speaker text={canonical} size="sm" />
                </div>
              </>
            )}
            {correct && (
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                Canonical: <span>{canonical}</span>
                <Speaker text={canonical} size="sm" />
              </div>
            )}
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
