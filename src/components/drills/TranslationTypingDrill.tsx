import { DrillFrame } from "./DrillFrame";
import type { DrillProps } from "./DrillRenderer";

/** Stub: replaced by US-012. */
export function TranslationTypingDrill({ drill, onSubmit }: DrillProps) {
  return (
    <DrillFrame
      promptLabel="Translation (preview)"
      prompt={drill.promptEn ?? "Translate this sentence into Dutch"}
    >
      <p className="mb-3 text-sm text-neutral-500">Drill UI lands in US-012.</p>
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
