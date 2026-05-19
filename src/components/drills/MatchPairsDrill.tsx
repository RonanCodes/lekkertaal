import { useEffect, useMemo, useRef, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { recordVocabPairResult } from "../../lib/server/lesson";
import { VocabSourceAttribution } from "../VocabSourceAttribution";

type Pair = { nl: string; en: string };

const PAIRS_PER_ROUND = 4;

/**
 * Match Pairs drill.
 *
 * Resolution order for the 4 pairs shown:
 *  1. If a unit-wide `vocabPool` is passed and has more than the drill's own
 *     pair count, sample 4 random pairs from the pool. Re-sampled each mount
 *     so a replayed lesson shows different words.
 *  2. Otherwise, fall back to the drill's own `answer` JSON (legacy shape).
 *
 * Per-pair correctness is reported back via `recordVocabPairResult`. Wrong
 * pairs land in spaced_rep_queue under `itemType: "vocab_pair"` so they
 * come back as reviews. The whole-drill `onSubmit(true)` fires once at the
 * end so the lesson player advances.
 */
export function MatchPairsDrill({ drill, onSubmit, vocabPool, vocabEnrichedMap }: DrillProps) {
  const pairs = useMemo<Pair[]>(() => {
    const fromAnswer = parseField<Pair[]>(drill.answer);
    const fromOptions = parseField<Pair[]>(drill.options);
    const ownPairs: Pair[] =
      Array.isArray(fromAnswer) && fromAnswer.length > 0
        ? fromAnswer
        : Array.isArray(fromOptions)
          ? fromOptions
          : [];
    const ownClean = ownPairs.filter(
      (p) => p && typeof p.nl === "string" && typeof p.en === "string",
    );

    const poolClean = Array.isArray(vocabPool)
      ? vocabPool.filter(
          (p) => p && typeof p.nl === "string" && typeof p.en === "string",
        )
      : [];

    if (poolClean.length >= PAIRS_PER_ROUND) {
      return sampleN(poolClean, PAIRS_PER_ROUND);
    }
    if (ownClean.length > 0) return ownClean.slice(0, PAIRS_PER_ROUND);
    return [
      { nl: "huis", en: "house" },
      { nl: "boom", en: "tree" },
      { nl: "boek", en: "book" },
      { nl: "tafel", en: "table" },
    ];
    // We intentionally do NOT depend on `vocabPool` identity beyond the
    // initial render — re-sampling on every prop change would reset the user
    // mid-round. A page-level remount (via `key={drill.id}`) gives them a
    // fresh sample next time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.answer, drill.options]);

  // Stable tile lists with their indexes (so duplicates would still work).
  const initialNl = useMemo(
    () => shuffle(pairs.map((p, i) => ({ key: `nl-${i}`, text: p.nl, idx: i }))),
    [pairs],
  );
  const initialEn = useMemo(
    () => shuffle(pairs.map((p, i) => ({ key: `en-${i}`, text: p.en, idx: i }))),
    [pairs],
  );

  const [nlTiles] = useState(initialNl);
  const [enTiles] = useState(initialEn);
  const [selectedNl, setSelectedNl] = useState<number | null>(null); // pair idx
  const [flash, setFlash] = useState<
    { kind: "correct" | "wrong"; nlIdx?: number; enIdx?: number } | null
  >(null);
  const [matchedIdx, setMatchedIdx] = useState<Set<number>>(new Set());
  const submittedRef = useRef(false);

  // Keyboard nav: arrow keys cycle focus, Enter confirms. Desktop-only — on
  // touch devices the focus ring looks like a stuck selection and ArrowUp/Down
  // would steal page scroll without giving anything back.
  const [focusCol, setFocusCol] = useState<"nl" | "en">("nl");
  const [focusPos, setFocusPos] = useState(0);
  const [kbdEnabled, setKbdEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    const apply = () => setKbdEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (matchedIdx.size === pairs.length && !submittedRef.current) {
      submittedRef.current = true;
      // Tiny pause so the green flash is visible.
      const t = setTimeout(() => onSubmit(true), 350);
      return () => clearTimeout(t);
    }
  }, [matchedIdx, pairs.length, onSubmit]);

  const pickNl = (pairIdx: number) => {
    if (matchedIdx.has(pairIdx)) return;
    setSelectedNl(pairIdx);
  };

  const pickEn = (pairIdx: number) => {
    if (matchedIdx.has(pairIdx)) return;
    if (selectedNl == null) return;
    if (selectedNl === pairIdx) {
      setFlash({ kind: "correct", nlIdx: selectedNl, enIdx: pairIdx });
      const matched = pairs[pairIdx];
      if (matched) {
        void recordVocabPairResult({
          data: {
            nl: matched.nl,
            en: matched.en,
            correct: true,
            exerciseId: drill.id,
          },
        }).catch(() => {});
      }
      setTimeout(() => {
        setMatchedIdx((s) => new Set(s).add(pairIdx));
        setSelectedNl(null);
        setFlash(null);
      }, 250);
    } else {
      setFlash({ kind: "wrong", nlIdx: selectedNl, enIdx: pairIdx });
      const missed = pairs[selectedNl];
      if (missed) {
        void recordVocabPairResult({
          data: {
            nl: missed.nl,
            en: missed.en,
            correct: false,
            exerciseId: drill.id,
          },
        }).catch(() => {});
      }
      setTimeout(() => {
        setFlash(null);
        setSelectedNl(null);
      }, 350);
    }
  };

  useEffect(() => {
    if (!kbdEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusCol("nl");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusCol("en");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusPos((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusPos((p) => Math.min(pairs.length - 1, p + 1));
      } else if (e.key === "Enter") {
        const arr = focusCol === "nl" ? nlTiles : enTiles;
        const tile = arr[focusPos];
        if (!tile) return;
        e.preventDefault();
        if (focusCol === "nl") pickNl(tile.idx);
        else pickEn(tile.idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbdEnabled, focusCol, focusPos, nlTiles, enTiles, selectedNl]);

  // Sort tiles so matched ones drop out, unmatched stay visible.
  const visibleNl = nlTiles.filter((t) => !matchedIdx.has(t.idx));
  const visibleEn = enTiles.filter((t) => !matchedIdx.has(t.idx));

  return (
    <DrillFrame
      promptLabel="Match pairs"
      prompt={drill.promptEn ?? "Match the Dutch words to their English meanings"}
    >
      <div className="grid grid-cols-2 gap-3" data-testid="match-pairs-drill">
        <div className="space-y-2">
          {visibleNl.map((t, i) => {
            const isSelected = selectedNl === t.idx;
            const isWrong = flash?.kind === "wrong" && flash.nlIdx === t.idx;
            const isCorrect = flash?.kind === "correct" && flash.nlIdx === t.idx;
            const isFocused = kbdEnabled && focusCol === "nl" && focusPos === i;
            return (
              <button
                key={t.key}
                data-testid={`match-pairs-nl-${t.idx}`}
                onClick={() => pickNl(t.idx)}
                className={`flex w-full items-center justify-between rounded-2xl border-2 px-3 py-3 text-left text-base font-semibold transition-all ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-100"
                    : isWrong
                      ? "animate-[shake_0.2s_ease-in-out] border-rose-500 bg-rose-100"
                      : isSelected
                        ? "border-orange-500 bg-orange-100"
                        : isFocused
                          ? "border-orange-400 bg-white"
                          : "border-neutral-200 bg-white hover:border-orange-300"
                }`}
              >
                {(() => {
                  const enriched = vocabEnrichedMap?.[t.text.toLowerCase()];
                  return (
                    <>
                      <span className="flex flex-col gap-0">
                        <span>{t.text}</span>
                        {enriched?.ipa && (
                          <span className="font-mono text-xs font-normal text-neutral-400">
                            {enriched.ipa}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {enriched?.gender && (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0 text-xs font-normal text-neutral-500">
                            {enriched.gender}
                          </span>
                        )}
                        <Speaker text={t.text} size="sm" />
                        {enriched?.sources && (
                          <VocabSourceAttribution
                            word={t.text}
                            sources={enriched.sources}
                          />
                        )}
                      </span>
                    </>
                  );
                })()}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {visibleEn.map((t, i) => {
            const isWrong = flash?.kind === "wrong" && flash.enIdx === t.idx;
            const isCorrect = flash?.kind === "correct" && flash.enIdx === t.idx;
            const isFocused = kbdEnabled && focusCol === "en" && focusPos === i;
            return (
              <button
                key={t.key}
                data-testid={`match-pairs-en-${t.idx}`}
                onClick={() => pickEn(t.idx)}
                disabled={selectedNl == null}
                className={`w-full rounded-2xl border-2 px-3 py-3 text-base font-semibold transition-all disabled:opacity-50 ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-100"
                    : isWrong
                      ? "animate-[shake_0.2s_ease-in-out] border-rose-500 bg-rose-100"
                      : isFocused
                        ? "border-orange-400 bg-white"
                        : "border-neutral-200 bg-white hover:border-orange-300"
                }`}
              >
                {t.text}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Tap a Dutch word, then its English translation.
        {kbdEnabled && " Use ←/→ to switch columns, ↑/↓ to move, Enter to pick."}
      </p>
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

function sampleN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
