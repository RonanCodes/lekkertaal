import { MatchPairsDrill } from "./MatchPairsDrill";
import { MultipleChoiceDrill } from "./MultipleChoiceDrill";
import { TranslationTypingDrill } from "./TranslationTypingDrill";
import { FillBlankDrill } from "./FillBlankDrill";
import { WordOrderingDrill } from "./WordOrderingDrill";
import { SpeakDrill } from "./SpeakDrill";
import { ImageWordDrill } from "./ImageWordDrill";
import { DrillFrame } from "./DrillFrame";
import type { DrillPayload } from "../../lib/server/lesson";

export type DrillProps = {
  drill: DrillPayload;
  onSubmit: (correct: boolean, userAnswer?: string) => void;
};

/**
 * Parse a JSON-serialised drill option/answer field back to a typed value.
 * Server-fn transport requires plain-serializable types, so options/answers
 * are shipped as JSON strings (or null).
 */
export function parseField<T>(raw: string | null): T | null {
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Dispatch a drill to the per-type component. US-010..US-014 implement each
 * type; until they land the fallback "coming soon" panel auto-marks correct
 * and advances so the player itself is testable.
 */
export function DrillRenderer({ drill, onSubmit }: DrillProps) {
  switch (drill.type) {
    case "match_pairs":
      return <MatchPairsDrill drill={drill} onSubmit={onSubmit} />;
    case "multiple_choice":
      return <MultipleChoiceDrill drill={drill} onSubmit={onSubmit} mode="text" />;
    case "listening_mc":
      return <MultipleChoiceDrill drill={drill} onSubmit={onSubmit} mode="audio" />;
    case "translation_typing":
      return <TranslationTypingDrill drill={drill} onSubmit={onSubmit} />;
    case "fill_blank":
      return <FillBlankDrill drill={drill} onSubmit={onSubmit} />;
    case "word_ordering":
      return <WordOrderingDrill drill={drill} onSubmit={onSubmit} />;
    case "speak":
      return <SpeakDrill drill={drill} onSubmit={onSubmit} />;
    case "image_word":
      return <ImageWordDrill drill={drill} onSubmit={onSubmit} />;
    default:
      return (
        <DrillFrame promptLabel="Unsupported drill" prompt={`Type: ${drill.type}`}>
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
}
