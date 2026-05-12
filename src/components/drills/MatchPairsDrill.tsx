import { useEffect, useMemo, useRef, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type Pair = { nl: string; en: string };

/**
 * Match Pairs drill (US-010).
 *
 * Data shape (drill.options):
 *   [{ nl: "huis", en: "house" }, { nl: "boom", en: "tree" }, ...]
 *
 * UI: 4 NL tiles + 4 EN tiles in shuffled positions. Tap NL → highlight, tap
 * EN → confirm match (green flash + remove pair) or reject (red flash + shake).
 * Drill completes when all 4 pairs are matched, then onSubmit(true) fires.
 */
export function MatchPairsDrill({ drill, onSubmit }: DrillProps) {
  // Parse pairs from drill.options. Fall back to a sample if data is malformed
  // so the player never crashes.
  const pairs = useMemo<Pair[]>(() => {
    const parsed = parseField<Pair[]>(drill.options);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 4);
    return [
      { nl: "huis", en: "house" },
      { nl: "boom", en: "tree" },
      { nl: "boek", en: "book" },
      { nl: "tafel", en: "table" },
    ];
  }, [drill.options]);

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

  // Keyboard nav: arrow keys cycle focus, Enter confirms.
  const [focusCol, setFocusCol] = useState<"nl" | "en">("nl");
  const [focusPos, setFocusPos] = useState(0);

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
      setTimeout(() => {
        setMatchedIdx((s) => new Set(s).add(pairIdx));
        setSelectedNl(null);
        setFlash(null);
      }, 250);
    } else {
      setFlash({ kind: "wrong", nlIdx: selectedNl, enIdx: pairIdx });
      setTimeout(() => {
        setFlash(null);
        setSelectedNl(null);
      }, 350);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setFocusCol("nl");
      else if (e.key === "ArrowRight") setFocusCol("en");
      else if (e.key === "ArrowUp")
        setFocusPos((p) => Math.max(0, p - 1));
      else if (e.key === "ArrowDown")
        setFocusPos((p) => Math.min(pairs.length - 1, p + 1));
      else if (e.key === "Enter") {
        const arr = focusCol === "nl" ? nlTiles : enTiles;
        const tile = arr[focusPos];
        if (!tile) return;
        if (focusCol === "nl") pickNl(tile.idx);
        else pickEn(tile.idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCol, focusPos, nlTiles, enTiles, selectedNl]);

  // Sort tiles so matched ones drop out, unmatched stay visible.
  const visibleNl = nlTiles.filter((t) => !matchedIdx.has(t.idx));
  const visibleEn = enTiles.filter((t) => !matchedIdx.has(t.idx));

  return (
    <DrillFrame
      promptLabel="Match pairs"
      prompt={drill.promptEn ?? "Match the Dutch words to their English meanings"}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {visibleNl.map((t, i) => {
            const isSelected = selectedNl === t.idx;
            const isWrong = flash?.kind === "wrong" && flash.nlIdx === t.idx;
            const isCorrect = flash?.kind === "correct" && flash.nlIdx === t.idx;
            const isFocused = focusCol === "nl" && focusPos === i;
            return (
              <button
                key={t.key}
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
                <span>{t.text}</span>
                <Speaker text={t.text} size="sm" />
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {visibleEn.map((t, i) => {
            const isWrong = flash?.kind === "wrong" && flash.enIdx === t.idx;
            const isCorrect = flash?.kind === "correct" && flash.enIdx === t.idx;
            const isFocused = focusCol === "en" && focusPos === i;
            return (
              <button
                key={t.key}
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
        Tap a Dutch word, then its English translation. Use ←/→ to switch columns, ↑/↓ to move, Enter to pick.
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
