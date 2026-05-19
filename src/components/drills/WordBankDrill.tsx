import { useMemo, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type Tile = { id: number; text: string };

const DISTRACTOR_COUNT = 3;

/**
 * Word Bank typing drill (US-002).
 *
 * Data shape:
 *   drill.answer  : "ik wil een koffie"      // canonical sentence (JSON-string)
 *   drill.options : { distractors?: string[] } | null
 *
 * UX: an empty answer slot at the top, a shuffled tile bank below. Tap a bank
 * tile → moves into the slot (appended). Tap a slotted tile → returns to bank.
 * Mobile-first: every tile button is at least 44x44px (`min-h-[44px]
 * min-w-[44px]` + `px-4 py-3`). Submit grades on whitespace-normalised exact
 * match (lowercased, single-spaced) against the canonical sentence.
 *
 * Distractor sourcing (in priority order):
 *   1. `drill.options.distractors` if the seed supplies them.
 *   2. `vocabPool` filtered to single-word tokens not already in the canonical
 *      sentence, sampled up to DISTRACTOR_COUNT.
 *   3. None — the learner just orders the canonical tokens.
 *
 * Grading is intentionally strict (exact whitespace-normalised match) because
 * the bank only shows whole words the learner can choose from — there is no
 * typo surface to be tolerant of. Records via the existing `recordDrillResult`
 * server fn (per-exercise, not per-pair: the unit is the sentence).
 */
export function WordBankDrill({ drill, onSubmit, vocabPool }: DrillProps) {
  const canonical = useMemo<string>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return "";
  }, [drill.answer]);

  const canonicalTokens = useMemo<string[]>(
    () => canonical.split(/\s+/).filter((t) => t.length > 0),
    [canonical],
  );

  const distractorTokens = useMemo<string[]>(() => {
    // Priority 1: explicit `distractors` in drill.options.
    const opt = parseField<unknown>(drill.options);
    if (opt && typeof opt === "object" && !Array.isArray(opt)) {
      const fromOpts = (opt as Record<string, unknown>).distractors;
      if (Array.isArray(fromOpts)) {
        const clean = fromOpts.filter((x): x is string => typeof x === "string");
        if (clean.length > 0) return clean.slice(0, DISTRACTOR_COUNT);
      }
    }
    // Priority 2: vocabPool — single-word Dutch tokens not already in canonical.
    const canonicalSet = new Set(canonicalTokens.map((t) => t.toLowerCase()));
    const candidates = (vocabPool ?? [])
      .map((p) => p?.nl)
      .filter((nl): nl is string => typeof nl === "string")
      .map((nl) => nl.trim())
      .filter((nl) => nl.length > 0 && !nl.includes(" "))
      .filter((nl) => !canonicalSet.has(nl.toLowerCase()));
    // De-dup while preserving first-seen order.
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const c of candidates) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(c);
    }
    return shuffle(uniq).slice(0, DISTRACTOR_COUNT);
  }, [drill.options, canonicalTokens, vocabPool]);

  const initialBank = useMemo<Tile[]>(() => {
    const all = [...canonicalTokens, ...distractorTokens];
    return shuffle(all.map((text, i) => ({ id: i, text })));
  }, [canonicalTokens, distractorTokens]);

  const [bank, setBank] = useState<Tile[]>(initialBank);
  const [slot, setSlot] = useState<Tile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [shaking, setShaking] = useState(false);

  const moveToSlot = (t: Tile) => {
    if (submitted) return;
    setBank((b) => b.filter((x) => x.id !== t.id));
    setSlot((s) => [...s, t]);
  };

  const moveToBank = (t: Tile) => {
    if (submitted) return;
    setSlot((s) => s.filter((x) => x.id !== t.id));
    setBank((b) => [...b, t]);
  };

  const submit = () => {
    if (submitted || slot.length === 0) return;
    const assembled = slot.map((t) => t.text).join(" ");
    const isCorrect = normalise(assembled) === normalise(canonical);
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
      promptLabel="Word bank"
      prompt={drill.promptEn ?? "Build the sentence by tapping the tiles"}
    >
      <div className="space-y-4" data-testid="word-bank-drill">
        {/* Answer slot */}
        <div
          className={`min-h-[5rem] rounded-2xl border-2 p-3 ${
            submitted
              ? correct
                ? "border-emerald-300 bg-emerald-50"
                : "border-rose-300 bg-rose-50"
              : "border-dashed border-orange-300 bg-orange-50/30"
          } ${shaking ? "animate-[shake_0.2s_ease-in-out]" : ""}`}
          data-testid="word-bank-slot"
        >
          {slot.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Tap tiles below to build the sentence.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slot.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moveToBank(t)}
                  disabled={submitted}
                  data-testid={`word-bank-slot-tile-${t.id}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-orange-400 bg-white px-4 py-3 text-base font-semibold text-neutral-800 shadow-sm hover:bg-orange-50 disabled:cursor-default"
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tile bank */}
        <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Bank
          </div>
          {bank.length === 0 ? (
            <p className="text-sm text-neutral-500">All tiles used.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bank.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moveToSlot(t)}
                  disabled={submitted}
                  data-testid={`word-bank-bank-tile-${t.id}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 text-base font-semibold text-neutral-800 shadow-sm hover:border-orange-400 disabled:cursor-default disabled:opacity-50"
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
              setBank((b) => [...b, ...slot]);
              setSlot([]);
            }}
            disabled={submitted || slot.length === 0}
            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitted || slot.length === 0}
            data-testid="word-bank-submit"
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Answer
            </div>
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

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
