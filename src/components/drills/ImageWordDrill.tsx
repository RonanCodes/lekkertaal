import { useMemo, useState } from "react";
import { DrillFrame, gradeText } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

/**
 * Image-input vocab drill (AI-SDK-7).
 *
 * Learner sees an image (R2-hosted, seeded via `/ro:generate-image`) and types
 * the Dutch noun for the object shown. Reuses the `gradeText` helper from
 * `DrillFrame` (case-insensitive, punctuation-tolerant, Levenshtein <= 1).
 *
 * Redesign (#214 / parent #203): mapped onto the shared foundation. Reuses the
 * `.input3d*` field + hint pill + reveal panel classes the input-drill screen
 * (#211) introduced, plus a screen-scoped `.imageword-*` block for the picture
 * frame. The frame carries an explicit loading shimmer and a graceful
 * fallback for the images that are not yet in R2 (issue #164 is blocked), so a
 * 404 or a missing `imageUrl` never leaves a broken-image glyph on screen.
 *
 * STT/audio is not involved here; only the picture loads remotely. The
 * loading/error logic below is the only behavioural change — grading, hint,
 * and submit timing are preserved exactly.
 *
 * Data shape on `DrillPayload`:
 *   imageUrl : "https://images.lekkertaal.dev/vocab/kat.png"
 *   answer   : "kat"               OR ["kat", "de kat"]
 *   promptEn : "Type the Dutch word for what you see"  // optional
 */
export function ImageWordDrill({ drill, onSubmit }: DrillProps) {
  const canonicals = useMemo<string[]>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }, [drill.answer]);
  const canonical = canonicals[0] ?? "";

  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  // Image load state: until `loaded` flips we show a shimmer; on `error` we
  // show a friendly fallback card instead of a broken-image glyph.
  const [imgState, setImgState] = useState<"loading" | "loaded" | "error">(
    drill.imageUrl ? "loading" : "error",
  );

  const submit = () => {
    if (submitted || value.trim().length === 0) return;
    const isCorrect = canonicals.some((c) => gradeText(value, c));
    setSubmitted(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
    }
    setTimeout(() => onSubmit(isCorrect, value), 800);
  };

  const useHint = () => {
    if (submitted || hintUsed || canonical.length < 2) return;
    setHintUsed(true);
    if (value.length < 2) setValue(canonical.slice(0, 2));
  };

  return (
    <DrillFrame
      promptLabel="What is this in Dutch?"
      prompt={drill.promptEn ?? "Type the Dutch word for what you see"}
    >
      <div className="imageword">
        <div
          className={`imageword-frame${imgState === "error" ? " imageword-frame--missing" : ""}`}
        >
          {drill.imageUrl && imgState !== "error" && (
            <img
              src={drill.imageUrl}
              alt="Vocabulary item to name in Dutch"
              data-testid="image-word-drill-image"
              loading="lazy"
              onLoad={() => setImgState("loaded")}
              onError={() => setImgState("error")}
              className={`imageword-img${imgState === "loading" ? " imageword-img--hidden" : ""}`}
            />
          )}
          {imgState === "loading" && (
            <div
              className="imageword-shimmer"
              data-testid="image-word-drill-loading"
              aria-hidden="true"
            />
          )}
          {imgState === "error" && (
            <div
              className="imageword-fallback"
              data-testid="image-word-drill-fallback"
            >
              <span className="imageword-fallback__glyph" aria-hidden="true">
                🖼️
              </span>
              <span className="imageword-fallback__text">
                Picture coming soon — the Dutch word still works.
              </span>
            </div>
          )}
        </div>

        <input
          type="text"
          autoFocus
          inputMode="text"
          lang="nl"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Type the Dutch word..."
          disabled={submitted}
          data-testid="image-word-drill-input"
          className={`input3d ${
            submitted ? (correct ? "input3d--good" : "input3d--bad") : ""
          } ${shaking ? "input3d--shake" : ""}`}
        />

        <div className="input3d-actions">
          <button
            type="button"
            onClick={useHint}
            disabled={submitted || hintUsed}
            className="input3d-hint"
          >
            💡 Hint (5 coins)
            {hintUsed && <span className="input3d-hint-used">used</span>}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitted || value.trim().length === 0}
            data-testid="image-word-drill-check"
            className="btn-3d btn-3d-green"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div
            className={`input3d-reveal ${correct ? "input3d-reveal--good" : "input3d-reveal--bad"}`}
            data-testid="image-word-drill-feedback"
          >
            <div className="input3d-reveal-label">
              {correct ? "Your answer" : "You wrote"}
            </div>
            <div
              className={`input3d-reveal-value ${correct ? "input3d-reveal-value--good" : "input3d-reveal-value--bad"}`}
            >
              {value}
            </div>
            {!correct && (
              <>
                <div className="input3d-reveal-label" style={{ marginTop: "0.6rem" }}>
                  Canonical
                </div>
                <div className="input3d-reveal-value">
                  <span>{canonical}</span>
                  <Speaker text={canonical} size="sm" />
                </div>
              </>
            )}
            {correct && (
              <div className="input3d-reveal-gloss input3d-reveal-value">
                Canonical: <span>{canonical}</span>
                <Speaker text={canonical} size="sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </DrillFrame>
  );
}
