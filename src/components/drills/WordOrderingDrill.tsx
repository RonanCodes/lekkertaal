import { useMemo, useState } from "react";
import { DrillFrame, gradeText } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

type Tile = { id: number; text: string };

/**
 * Word ordering drill (US-014) — chip-tray redesign (issue #212).
 *
 * Data shape:
 *   drill.options : ["Ik", "ga", "vandaag", "naar", "school"]   // pool of chips (shuffled)
 *   drill.answer  : "Ik ga vandaag naar school"                  // canonical, or array of accepted forms
 *
 * UX: an answer tray (ruled lines) at the top; a chip pool below. Tap a pool
 * chip → it flies into the tray in tap-order; tap a tray chip → it returns to
 * the pool, leaving its slot empty. Submit grades the assembled sentence
 * against the canonical with Levenshtein tolerance, which handles equivalents
 * like "vandaag" vs "op vandaag" naturally.
 *
 * Visual layer routes entirely through the #205 foundation (3D chip buttons,
 * --color-good/-bad tokens) + the screen-scoped `.word-order-*` block at the
 * tail of styles.css, so light/dark both flip for free. Tap-reordering
 * behaviour is preserved exactly from the pre-redesign version.
 */
export function WordOrderingDrill({ drill, onSubmit }: DrillProps) {
  const canonicals = useMemo<string[]>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") return [raw];
    return [];
  }, [drill.answer]);
  const canonical = canonicals[0] ?? "";

  // Build initial pool from drill.options. Fallback: split canonical on spaces.
  const initialPool = useMemo<Tile[]>(() => {
    const opt = parseField<unknown>(drill.options);
    const words = Array.isArray(opt) ? opt.map(String) : canonical.split(/\s+/);
    return shuffle(words.map((text, i) => ({ id: i, text })));
  }, [drill.options, canonical]);

  const [pool, setPool] = useState<Tile[]>(initialPool);
  const [chosen, setChosen] = useState<Tile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [shaking, setShaking] = useState(false);

  const moveToChosen = (t: Tile) => {
    if (submitted) return;
    setPool((p) => p.filter((x) => x.id !== t.id));
    setChosen((c) => [...c, t]);
  };

  const moveToPool = (t: Tile) => {
    if (submitted) return;
    setChosen((c) => c.filter((x) => x.id !== t.id));
    setPool((p) => [...p, t]);
  };

  const submit = () => {
    if (submitted || chosen.length === 0) return;
    const assembled = chosen.map((t) => t.text).join(" ");
    const isCorrect = canonicals.some((c) => gradeText(assembled, c));
    setSubmitted(true);
    setCorrect(isCorrect);
    if (!isCorrect) {
      setShaking(true);
      setTimeout(() => setShaking(false), 250);
    }
    setTimeout(() => onSubmit(isCorrect, assembled), 800);
  };

  const trayState = submitted ? (correct ? "good" : "bad") : "idle";

  return (
    <DrillFrame
      promptLabel="Word ordering"
      prompt={drill.promptEn ?? "Build the sentence in the correct order"}
    >
      <div className="word-order" data-testid="word-ordering-drill">
        {/* Answer tray — ruled lines the chips land on. */}
        <div
          className={`word-order-tray word-order-tray--${trayState} ${
            shaking ? "word-order-tray--shake" : ""
          }`}
          data-testid="word-ordering-tray"
        >
          {chosen.length === 0 ? (
            <p className="word-order-tray__hint">
              Tap the chips below to build the sentence.
            </p>
          ) : (
            <div className="word-order-chips">
              {chosen.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moveToPool(t)}
                  disabled={submitted}
                  data-testid={`word-ordering-tray-chip-${t.id}`}
                  className="word-order-chip word-order-chip--placed"
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chip pool — the remaining unplaced words. */}
        <div className="word-order-pool" data-testid="word-ordering-pool">
          {pool.length === 0 ? (
            <p className="word-order-pool__empty">All chips placed.</p>
          ) : (
            <div className="word-order-chips">
              {pool.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => moveToChosen(t)}
                  disabled={submitted}
                  data-testid={`word-ordering-pool-chip-${t.id}`}
                  className="word-order-chip"
                >
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="word-order-actions">
          <button
            type="button"
            onClick={() => {
              if (submitted) return;
              setPool((p) => [...p, ...chosen]);
              setChosen([]);
            }}
            disabled={submitted || chosen.length === 0}
            data-testid="word-ordering-reset"
            className="btn-3d btn-3d-ghost btn-3d-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitted || chosen.length === 0}
            data-testid="word-ordering-submit"
            className="btn-3d btn-3d-green btn-3d-sm"
          >
            Check
          </button>
        </div>

        {submitted && (
          <div
            className="word-order-canonical"
            data-testid="word-ordering-canonical"
          >
            <div className="word-order-canonical__label">Answer</div>
            <div className="word-order-canonical__row">
              <span>{canonical}</span>
              <Speaker text={canonical} size="sm" />
            </div>
          </div>
        )}
      </div>
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
