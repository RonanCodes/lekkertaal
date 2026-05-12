import { DrillFrame } from "./DrillFrame";
import type { DrillProps } from "./DrillRenderer";

/**
 * Stub: replaced by US-010.
 * Auto-correct passthrough so the lesson player flow is testable end-to-end.
 */
export function MatchPairsDrill({ drill, onSubmit }: DrillProps) {
  return (
    <DrillFrame promptLabel="Match pairs (preview)" prompt={drill.promptEn ?? drill.promptNl ?? "Match the Dutch words to their English meanings"}>
      <p className="mb-3 text-sm text-neutral-500">Drill UI lands in US-010.</p>
      <button
        type="button"
        onClick={() => onSubmit(true)}
        className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Continue
      </button>
    </DrillFrame>
  );
}
