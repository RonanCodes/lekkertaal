import { useEffect, useMemo, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { recordVocabPairResult } from "../../lib/server/lesson";

type PictureAnswer = { nl: string; en?: string; imageUrl: string };
type ImagePoolEntry = { nl: string; en: string; imageUrl: string };

const TILES_PER_ROUND = 4;
const CORRECT_ADVANCE_MS = 350;
const WRONG_REVEAL_MS = 700;
const WRONG_ADVANCE_MS = 1200;

/**
 * Picture-from-word 4-up grid (`picture_choice`).
 *
 * Shows a Dutch word + Speaker at the top and a 2x2 grid of image tiles. The
 * learner taps the tile that matches the word. Distractors come from the
 * unit-wide `imagePool` (every other `image-word` exercise in the same unit),
 * filtered to drop the correct entry, shuffled, and trimmed to 3.
 *
 * Render contract:
 * - drill.answer is JSON-encoded `{nl, en?, imageUrl}` — the correct tile.
 * - imagePool comes via DrillRenderer and is the unit's full image bank.
 * - When the pool can't yield 3 unique distractors, render a skip-frame that
 *   auto-advances after 200ms via `onSubmit(true)` so the lesson still flows.
 *
 * Per-tile feedback uses the same flash-then-advance pattern as MatchPairsDrill:
 * green ring + ~350ms pause on correct, red ring + 700ms before revealing the
 * correct tile + 1200ms before advancing on wrong. Per-pair correctness is
 * reported via `recordVocabPairResult` so the spaced-rep queue picks misses up.
 */
export function PictureChoiceDrill({ drill, onSubmit, imagePool }: DrillProps) {
  const correct = useMemo<PictureAnswer | null>(() => {
    const parsed = parseField<PictureAnswer>(drill.answer);
    if (!parsed || typeof parsed.nl !== "string" || typeof parsed.imageUrl !== "string") {
      return null;
    }
    return parsed;
  }, [drill.answer]);

  const tiles = useMemo<ImagePoolEntry[]>(() => {
    if (!correct) return [];
    const pool: ImagePoolEntry[] = Array.isArray(imagePool)
      ? imagePool.filter(
          (p) =>
            typeof p.nl === "string" &&
            typeof p.imageUrl === "string" &&
            p.imageUrl !== correct.imageUrl &&
            p.nl.toLowerCase() !== correct.nl.toLowerCase(),
        )
      : [];
    if (pool.length < TILES_PER_ROUND - 1) return [];
    const distractors = sampleN(pool, TILES_PER_ROUND - 1);
    const correctEntry: ImagePoolEntry = {
      nl: correct.nl,
      en: correct.en ?? "",
      imageUrl: correct.imageUrl,
    };
    return shuffle([correctEntry, ...distractors]);
  }, [correct, imagePool]);

  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  // Skip-frame: not enough images in the pool. Auto-advance after a tiny
  // delay so the player keeps flowing. We score it as correct (true) — the
  // learner isn't being graded; they just don't have content to grade against.
  const isSkip = correct === null || tiles.length === 0;

  useEffect(() => {
    if (!isSkip || advanced) return;
    const t = setTimeout(() => {
      setAdvanced(true);
      onSubmit(true);
    }, 200);
    return () => clearTimeout(t);
  }, [isSkip, advanced, onSubmit]);

  if (isSkip) {
    return (
      <DrillFrame
        promptLabel="Picture choice"
        prompt="Skipping (not enough images in this unit yet)"
      >
        <div className="py-6 text-center text-sm text-neutral-500">
          Loading the next drill...
        </div>
      </DrillFrame>
    );
  }

  // Safe to dereference: isSkip = (correct === null || ...), so a falsy
  // `correct` would have taken the early-return branch above.
  const correctTile = correct;

  const handlePick = (idx: number) => {
    if (picked !== null || advanced) return;
    const tile = tiles[idx];
    setPicked(idx);
    const isCorrect = tile.imageUrl === correctTile.imageUrl;
    void recordVocabPairResult({
      data: {
        nl: correctTile.nl,
        en: correctTile.en ?? "",
        correct: isCorrect,
        exerciseId: drill.id,
      },
    }).catch(() => {});

    if (isCorrect) {
      setTimeout(() => {
        setAdvanced(true);
        onSubmit(true);
      }, CORRECT_ADVANCE_MS);
    } else {
      setTimeout(() => setRevealed(true), WRONG_REVEAL_MS);
      setTimeout(() => {
        setAdvanced(true);
        onSubmit(false);
      }, WRONG_ADVANCE_MS);
    }
  };

  return (
    <DrillFrame
      promptLabel="Which picture?"
      prompt={drill.promptEn ?? "Tap the picture that matches the word."}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {correctTile.nl}
          </div>
          <Speaker text={correctTile.nl} size="md" />
        </div>

        <div
          className="grid grid-cols-2 gap-3"
          data-testid="picture-choice-grid"
        >
          {tiles.map((tile, i) => {
            const isPicked = picked === i;
            const isCorrectTile = tile.imageUrl === correctTile.imageUrl;
            const showCorrect =
              isCorrectTile && (revealed || (isPicked && isCorrectTile));
            const showWrong = isPicked && !isCorrectTile;
            return (
              <button
                key={`${tile.imageUrl}-${i}`}
                type="button"
                onClick={() => handlePick(i)}
                disabled={picked !== null}
                data-testid={`picture-choice-tile-${i}`}
                data-correct={isCorrectTile ? "true" : "false"}
                className={`aspect-square overflow-hidden rounded-2xl border-4 bg-neutral-50 transition-all disabled:cursor-not-allowed ${
                  showCorrect
                    ? "border-emerald-500 ring-4 ring-emerald-200"
                    : showWrong
                      ? "animate-[shake_0.2s_ease-in-out] border-rose-500 ring-4 ring-rose-200"
                      : "border-neutral-200 hover:border-orange-300"
                }`}
              >
                <img
                  src={tile.imageUrl}
                  alt={tile.nl}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
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
