import { useMemo, useState } from "react";
import { DrillFrame, gradeText } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type Tile = { id: number; text: string };

/**
 * Word ordering drill (US-014).
 *
 * Data shape:
 *   drill.options : ["Ik", "ga", "vandaag", "naar", "school"]   // pool of tiles (shuffled)
 *   drill.answer  : "Ik ga vandaag naar school"                  // canonical, or array of accepted forms
 *
 * UX: tile pool at the bottom; tap a tile → moves to the sentence area in
 * tap-order; tap again → returns to the pool. Submit grades the assembled
 * sentence against the canonical with Levenshtein tolerance, which handles
 * equivalents like "vandaag" vs "op vandaag" naturally.
 */
export function WordOrderingDrill({ drill, onSubmit }: DrillProps) {
  const canonicals = useMemo<string[]>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }, [drill.answer]);
  const canonical = canonicals[0] ?? "";

  // Build initial pool from drill.options. Fallback: split canonical on spaces.
  const initialPool = useMemo<Tile[]>(() => {
    const opt = parseField<unknown>(drill.options);
    const words = Array.isArray(opt) ? opt.map(String) : canonical.split(/\s+/);
    return shuffle(words.map((text, i) => ({ id: i, text })));
  }, [drill.options, canonical]);

  const [pool, setPool] = useState<Tile[]>(initialPool);
  const [chosen, setChosen] = useState<Tile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [shaking, setShaking] = useState(false);

  const moveToChosen = (t: Tile) => {
    if (submitted) return;
    setPool((p) => p.filter((x) => x.id !== t.id));
    setChosen((c) => [...c, t]);
  };

  const moveToPool = (t: Tile) => {
    if (submitted) return;
    setChosen((c) => c.filter((x) => x.id !== t.id));
    setPool((p) => [...p, t]);
  };

  const submit = () => {
    if (submitted || chosen.length === 0) return;
    const assembled = chosen.map((t) => t.text).join(" ");
    const isCorrect = canonicals.some((c) => gradeText(assembled, c));
    setSubmitted(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
    }
    setTimeout(() => onSubmit(isCorrect, assembled), 800);
  };

  return (
    <DrillFrame
      promptLabel="Word ordering"
      prompt={drill.promptEn ?? "Build the sentence in the correct order"}
    >
      <div className="space-y-4">
        {/* Sentence build area */}
        <div
          className={`min-h-[5rem] rounded-2xl border-2 p-3 ${
            submitted
              ? correct
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
              : "border-dashed border-orange-300 bg-orange-50/30"
          } ${shaking ? "animate-[shake_0.2s_ease-in-out]" : ""}`}
        >
          {chosen.length === 0 ? (
            <p className="text-sm text-neutral-500">Tap words below to build the sentence.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chosen.map((t) => (
                <button
                  key={t.id}
                  onClick={() => moveToPool(t)}
                  disabled={submitted}
                  className="rounded-xl border-2 border-orange-400 bg-white px-3 py-2 text-base font-semibold text-neutral-800 shadow-sm hover:bg-orange-50 disabled:cursor-default"
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tile pool */}
        <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Pool</div>
          {pool.length === 0 ? (
            <p className="text-sm text-neutral-500">All tiles used.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pool.map((t) => (
                <button
                  key={t.id}
                  onClick={() => moveToChosen(t)}
                  disabled={submitted}
                  className="rounded-xl border-2 border-neutral-300 bg-white px-3 py-2 text-base font-semibold text-neutral-800 shadow-sm hover:border-orange-400 disabled:cursor-default disabled:opacity-50"
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (submitted) return;
              setPool((p) => [...p, ...chosen]);
              setChosen([]);
            }}
            disabled={submitted || chosen.length === 0}
            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitted || chosen.length === 0}
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Canonical</div>
            <div className="flex items-center gap-2 font-semibold text-neutral-800">
              <span>{canonical}</span>
              <Speaker text={canonical} size="sm" />
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
