import { useState } from "react";
import { Speaker } from "./drills/Speaker";
import type { WordOfTheDay as WordOfTheDayData } from "../lib/server/wordOfDay";

/**
 * Word of the Day card on /app/path.
 *
 * Deterministic per UTC date — every learner sees the same word today, a
 * different one tomorrow. The Dutch headword + audio show by default; the
 * English meaning hides behind a "Reveal meaning" button so the user has a
 * beat to guess before the answer is shown. Tiny game-mechanic that gets
 * users tapping the audio first.
 *
 * Definitions come from en.wiktionary (CC-BY-SA); audio comes from
 * Wikimedia Commons via /api/tts. Attribution lives at the foot of the
 * card.
 */
export function WordOfTheDay({ data }: { data: WordOfTheDayData }) {
  const [revealed, setRevealed] = useState(false);
  const { word, dictionary } = data;
  const hasDef = dictionary && dictionary.entries.length > 0;

  return (
    <section
      className="my-4 rounded-3xl border-2 border-orange-200 bg-white p-5 shadow-sm"
      aria-labelledby="word-of-day-heading"
    >
      <div className="flex items-center justify-between">
        <h2
          id="word-of-day-heading"
          className="text-xs font-bold uppercase tracking-wide text-orange-700"
        >
          Word of the day
        </h2>
        <span className="text-xs text-neutral-400">{data.isoDate}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="text-3xl font-bold text-neutral-900">{word}</div>
        <Speaker text={word} size="md" ariaLabel={`Play pronunciation of ${word}`} />
      </div>

      {!revealed && hasDef && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 inline-flex items-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600"
        >
          Reveal meaning
        </button>
      )}

      {revealed && hasDef && (
        <div className="mt-4 space-y-2">
          {dictionary.entries.map((e, i) => (
            <div key={i}>
              <div className="text-xs uppercase text-neutral-500">{e.partOfSpeech}</div>
              <ul className="ml-4 list-disc text-sm text-neutral-800">
                {e.definitions.slice(0, 3).map((d, j) => (
                  <li key={j}>{d.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!hasDef && (
        <p className="mt-4 text-sm text-neutral-500">
          No definition available right now. The audio above is still the right pronunciation.
        </p>
      )}

      <p className="mt-4 text-[10px] text-neutral-400">
        Audio: Wikimedia Commons (CC-BY-SA). Definitions: en.wiktionary.org (CC-BY-SA).
      </p>
    </section>
  );
}
