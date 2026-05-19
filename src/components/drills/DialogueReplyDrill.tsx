import { useEffect, useMemo, useRef, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type DialogueLine = { speaker: string; line: string };
type ReplyOption = { text: string; correct: boolean; explanation?: string };
type DialoguePayload = {
  dialogue: DialogueLine[];
  options: ReplyOption[];
};

/**
 * Dialogue pick-the-reply drill.
 *
 * Renders a short two-line NL dialogue with speaker labels, then three reply
 * tiles below. Shuffled at mount so order doesn't leak the answer. Tap-correct
 * → green flash + onSubmit(true). Tap-wrong → red flash + reveal correct
 * (with explanation if seeded) + onSubmit(false).
 *
 * Payload lives in `drill.answer` as JSON `{dialogue, options}` (same pattern
 * as match_pairs). If the payload is missing or malformed we fall through to
 * a skip frame so the lesson player can still advance.
 */
export function DialogueReplyDrill({ drill, onSubmit }: DrillProps) {
  const payload = parseField<DialoguePayload>(drill.answer);

  const valid =
    payload &&
    Array.isArray(payload.dialogue) &&
    payload.dialogue.length > 0 &&
    payload.dialogue.every(
      (l) => l && typeof l.speaker === "string" && typeof l.line === "string",
    ) &&
    Array.isArray(payload.options) &&
    payload.options.length >= 2 &&
    payload.options.every(
      (o) => o && typeof o.text === "string" && typeof o.correct === "boolean",
    ) &&
    payload.options.some((o) => o.correct);

  // Shuffle options once on mount so consecutive renders within the same
  // mount keep tile order stable (a fresh mount via `key={drill.id}` gives a
  // new shuffle).
  const shuffledOptions = useMemo(() => {
    if (!valid) return [] as ReplyOption[];
    return shuffle(payload.options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.id]);

  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (pickedIdx == null || submittedRef.current) return;
    const picked = shuffledOptions[pickedIdx];
    if (!picked) return;
    if (picked.correct) {
      submittedRef.current = true;
      const t = setTimeout(() => onSubmit(true), 350);
      return () => clearTimeout(t);
    }
    // Wrong path: reveal the correct tile + (optional) explanation, then fire
    // onSubmit(false) after a longer pause so the learner can read.
    setRevealed(true);
    submittedRef.current = true;
    const t = setTimeout(() => onSubmit(false), 1200);
    return () => clearTimeout(t);
  }, [pickedIdx, shuffledOptions, onSubmit]);

  if (!valid) {
    return (
      <DrillFrame promptLabel="Dialogue" prompt="Dialogue unavailable">
        <button
          type="button"
          onClick={() => onSubmit(true)}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Skip
        </button>
      </DrillFrame>
    );
  }

  const correctIdx = shuffledOptions.findIndex((o) => o.correct);
  const correctOpt = correctIdx >= 0 ? shuffledOptions[correctIdx] : null;

  return (
    <DrillFrame
      promptLabel="Pick the reply"
      prompt={drill.promptEn ?? "Pick the best reply"}
    >
      <div className="space-y-4" data-testid="dialogue-reply-drill">
        <div className="space-y-2 rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3">
          {payload.dialogue.map((l, i) => (
            <div key={i} className="text-base" data-testid={`dialogue-line-${i}`}>
              <span className="font-bold text-neutral-700">{l.speaker}:</span>{" "}
              <span>{l.line}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {shuffledOptions.map((opt, i) => {
            const isPicked = pickedIdx === i;
            const isWrongPick = isPicked && !opt.correct;
            const isCorrectFlash = isPicked && opt.correct;
            const isRevealedCorrect = revealed && i === correctIdx && !isPicked;
            return (
              <button
                key={i}
                type="button"
                disabled={pickedIdx != null}
                data-testid={`dialogue-reply-option-${i}`}
                onClick={() => setPickedIdx(i)}
                className={`w-full rounded-2xl border-2 px-3 py-3 text-left text-base font-semibold transition-all disabled:cursor-default ${
                  isCorrectFlash
                    ? "border-emerald-500 bg-emerald-100"
                    : isWrongPick
                      ? "animate-[shake_0.2s_ease-in-out] border-rose-500 bg-rose-100"
                      : isRevealedCorrect
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400"
                        : "border-neutral-200 bg-white hover:border-orange-300"
                }`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
        {revealed && correctOpt && correctOpt.explanation && (
          <div
            className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
            data-testid="dialogue-reply-explanation"
            role="status"
            aria-live="polite"
          >
            {correctOpt.explanation}
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
