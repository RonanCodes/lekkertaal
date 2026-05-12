import { DrillFrame } from "./DrillFrame";
import type { DrillProps } from "./DrillRenderer";

/**
 * Stub: replaced by US-011 (handles both text MC and listening MC via `mode`).
 */
export function MultipleChoiceDrill({
  drill,
  onSubmit,
  mode,
}: DrillProps & { mode: "text" | "audio" }) {
  return (
    <DrillFrame
      promptLabel={mode === "audio" ? "Listening (preview)" : "Multiple choice (preview)"}
      prompt={drill.promptEn ?? drill.promptNl ?? "Pick the best answer"}
    >
      <p className="mb-3 text-sm text-neutral-500">Drill UI lands in US-011.</p>
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
