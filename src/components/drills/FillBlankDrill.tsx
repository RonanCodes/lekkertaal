import { DrillFrame } from "./DrillFrame";
import type { DrillProps } from "./DrillRenderer";

/** Stub: replaced by US-013. */
export function FillBlankDrill({ drill, onSubmit }: DrillProps) {
  return (
    <DrillFrame
      promptLabel="Fill in the blank (preview)"
      prompt={drill.promptNl ?? "Fill in the missing word"}
    >
      <p className="mb-3 text-sm text-neutral-500">Drill UI lands in US-013.</p>
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
