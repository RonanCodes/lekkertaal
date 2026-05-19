import { useMemo, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";
import { recordVocabPairResult } from "../../lib/server/lesson";

/**
 * The six present-tense persons in Dutch. Keys are storage-safe (underscore
 * `hij_zij`); the display label is rendered via `PERSON_LABELS`. The order is
 * the standard table order learners see in any A2 textbook: 1sg → 2sg → 3sg →
 * 1pl → 2pl → 3pl.
 */
const PERSON_KEYS = ["ik", "jij", "hij_zij", "wij", "jullie", "zij"] as const;
type PersonKey = (typeof PERSON_KEYS)[number];

const PERSON_LABELS: Record<PersonKey, string> = {
  ik: "ik",
  jij: "jij / je",
  hij_zij: "hij / zij / het",
  wij: "wij",
  jullie: "jullie",
  zij: "zij (plural)",
};

type ConjugationPayload = {
  infinitive: string;
  tense: string;
  forms: Record<PersonKey, string>;
};

type GradedCell = { correct: boolean; canonical: string };

/**
 * Conjugation table drill.
 *
 * Renders an infinitive + tense header and six text inputs for each Dutch
 * person. Each cell grades independently (literal equality on
 * trim+lowercase — verb forms are short so Levenshtein would over-forgive).
 *
 * Per-cell tracking via `recordVocabPairResult` keyed on
 * `<infinitive>_<personKey>` so misses land in the spaced-rep queue at
 * person-level granularity. The whole-drill `onSubmit(allCorrect)` fires once
 * the learner taps Continue after submit.
 *
 * Payload shape (drill.answer, JSON-encoded):
 *   { infinitive: "hebben", tense: "present",
 *     forms: { ik:"heb", jij:"hebt", hij_zij:"heeft",
 *              wij:"hebben", jullie:"hebben", zij:"hebben" } }
 */
export function ConjugationDrill({ drill, onSubmit }: DrillProps) {
  const payload = useMemo(() => parseField<ConjugationPayload>(drill.answer), [drill.answer]);

  const valid =
    payload &&
    typeof payload.infinitive === "string" &&
    payload.infinitive.length > 0 &&
    typeof payload.tense === "string" &&
    payload.forms &&
    typeof payload.forms === "object" &&
    PERSON_KEYS.every(
      (k) => typeof payload.forms[k] === "string" && payload.forms[k].length > 0,
    );

  const [values, setValues] = useState<Record<PersonKey, string>>(() => ({
    ik: "",
    jij: "",
    hij_zij: "",
    wij: "",
    jullie: "",
    zij: "",
  }));
  const [graded, setGraded] = useState<Record<PersonKey, GradedCell> | null>(null);

  if (!valid) {
    return (
      <DrillFrame promptLabel="Conjugation" prompt="Conjugation unavailable">
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

  const allFilled = PERSON_KEYS.every((k) => values[k].trim().length > 0);

  const handleSubmit = () => {
    const next: Record<PersonKey, GradedCell> = {} as Record<PersonKey, GradedCell>;
    for (const key of PERSON_KEYS) {
      const canonical = payload.forms[key];
      const user = values[key];
      const cellCorrect = user.trim().toLowerCase() === canonical.trim().toLowerCase();
      next[key] = { correct: cellCorrect, canonical };
      // Per-cell async dispatch. Fire-and-forget — failures must not block the
      // learner from advancing. Key shape mirrors match-pairs' `<nl>|<en>` but
      // uses `<infinitive>_<personKey>` so misses fan out per-person.
      void recordVocabPairResult({
        data: {
          nl: `${payload.infinitive}_${key}`,
          en: canonical,
          correct: cellCorrect,
          exerciseId: drill.id,
        },
      }).catch(() => {});
    }
    setGraded(next);
  };

  const handleContinue = () => {
    if (!graded) return;
    const allCorrect = PERSON_KEYS.every((k) => graded[k].correct);
    onSubmit(allCorrect);
  };

  return (
    <DrillFrame
      promptLabel="Conjugation"
      prompt={
        drill.promptEn ?? `Conjugate ${payload.infinitive} in ${payload.tense} tense`
      }
    >
      <div className="space-y-4" data-testid="conjugation-drill">
        <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3 text-center">
          <div className="text-lg font-bold">
            {payload.infinitive} <span className="text-neutral-500">— {payload.tense}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERSON_KEYS.map((key) => {
            const cell = graded?.[key];
            const borderClass = cell
              ? cell.correct
                ? "border-emerald-500"
                : "border-rose-500"
              : "border-neutral-200 focus-within:border-orange-400";
            return (
              <label
                key={key}
                data-testid={`conjugation-cell-${key}`}
                className={`flex flex-col gap-1 rounded-2xl border-2 bg-white p-3 transition-colors ${borderClass}`}
              >
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {PERSON_LABELS[key]}
                </span>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  data-testid={`conjugation-input-${key}`}
                  value={values[key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                  disabled={graded != null}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-base font-semibold outline-none focus:border-orange-400 disabled:bg-neutral-50"
                />
                {cell && !cell.correct && (
                  <span
                    className="text-xs text-rose-700"
                    data-testid={`conjugation-canonical-${key}`}
                  >
                    {cell.canonical}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {graded == null ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allFilled}
            data-testid="conjugation-submit"
            className="w-full rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={handleContinue}
            data-testid="conjugation-continue"
            className="w-full rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Continue
          </button>
        )}
      </div>
    </DrillFrame>
  );
}
