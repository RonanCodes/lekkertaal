/**
 * Live-streaming rubric scorecard.
 *
 * Pairs with `streamObject` at /api/roleplay/:sessionId/grade-stream. The
 * server emits a streamed JSON object matching `RubricSchema`; this component
 * uses `experimental_useObject` to expose the partial value as it fills in,
 * and renders five progress bars that animate up to their final score.
 *
 * Why this exists: the previous flow called `gradeRoleplaySession`
 * (generateObject) and the scorecard sat on a blank "Grading..." spinner for
 * 4-8 seconds. With streaming, the first scores show inside ~1s and the rest
 * fill in over the streaming window, which makes the perceived latency feel
 * much lower even though the total tokens are unchanged.
 *
 * Lifecycle: the component auto-submits once on mount (the sessionId is
 * fixed for the page, and the server is idempotent so a duplicate submit is
 * cheap). When the stream completes, the parent page reloads loader data
 * via the `onFinish` callback so the persisted scorecard (errors, badges,
 * XP delta) takes over from the live partial.
 */
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useEffect } from "react";
import { RubricSchema } from "../lib/server/roleplay";

const ROW_LABELS: Array<{
  key: "grammar" | "vocabulary" | "taskCompletion" | "fluency" | "politeness";
  label: string;
}> = [
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "taskCompletion", label: "Task completion" },
  { key: "fluency", label: "Fluency" },
  { key: "politeness", label: "Politeness" },
];

export type LiveRubricProps = {
  sessionId: number;
  /** Called once the stream completes successfully. Parent reloads loader. */
  onFinish?: () => void;
};

export function LiveRubric({ sessionId, onFinish }: LiveRubricProps) {
  const { object, submit, isLoading, error } = useObject({
    api: `/api/roleplay/${sessionId}/grade-stream`,
    schema: RubricSchema,
    onFinish: () => {
      onFinish?.();
    },
  });

  // Auto-submit once on mount. The server is idempotent (best-attempt
  // semantics; reading a session that's already graded just returns).
  useEffect(() => {
    submit({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (error) {
    return (
      <div
        data-testid="live-rubric-error"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        Grading failed. Please refresh to try again.
      </div>
    );
  }

  return (
    <div
      data-testid="live-rubric"
      data-loading={isLoading ? "true" : "false"}
      className="rounded-2xl border border-neutral-200 bg-white p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Rubric (live)
        </h2>
        {isLoading && (
          <span className="text-xs text-neutral-400" aria-label="loading">
            scoring...
          </span>
        )}
      </div>
      <div className="space-y-3">
        {ROW_LABELS.map(({ key, label }) => {
          const score = typeof object?.[key] === "number" ? object[key] : null;
          return (
            <LiveRubricRow
              key={key}
              label={label}
              score={score}
              testid={`live-rubric-row-${key}`}
            />
          );
        })}
      </div>
      {object?.feedbackEn && (
        <div
          data-testid="live-rubric-feedback"
          className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700"
        >
          {object.feedbackEn}
        </div>
      )}
    </div>
  );
}

function LiveRubricRow({
  label,
  score,
  testid,
}: {
  label: string;
  score: number | null;
  testid: string;
}) {
  const pct = score !== null ? (Math.max(0, Math.min(5, score)) / 5) * 100 : 0;
  const filled = score !== null;
  return (
    <div data-testid={testid} className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-700">{label}</span>
        <span
          data-testid={`${testid}-score`}
          className={filled ? "font-semibold text-neutral-900" : "text-neutral-300"}
        >
          {filled ? `${score}/5` : "..."}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuenow={score ?? 0}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-label={label}
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${
            filled ? "bg-orange-500" : "bg-neutral-200"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
