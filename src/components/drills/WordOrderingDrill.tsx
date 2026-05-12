import { DrillFrame } from "./DrillFrame";
import type { DrillProps } from "./DrillRenderer";

/** Stub: replaced by US-014. */
export function WordOrderingDrill({ drill, onSubmit }: DrillProps) {
  return (
    <DrillFrame
      promptLabel="Word ordering (preview)"
      prompt={drill.promptEn ?? "Order the words to build the sentence"}
    >
      <p className="mb-3 text-sm text-neutral-500">Drill UI lands in US-014.</p>
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
