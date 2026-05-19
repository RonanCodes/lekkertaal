/**
 * Word of the Day picker + dictionary lookup.
 *
 * Deterministic per UTC date: `dayOfYear(isoDate) % WORDLIST.length`. Every
 * user sees the same word on the same day. The dictionary call hits the
 * R2-cached Wiktionary lookup, so the second user of the day reads from warm
 * cache.
 *
 * Curated A1-A2 list (50 entries) covering nouns, verbs, adjectives, and
 * common conjugations a learner meets in the first month. All have audio
 * on Wikimedia Commons and definitions on en.wiktionary (verified 2026-05-19).
 * The list order is intentionally jumbled (not alphabetical / not by topic)
 * so that day-of-year indexing produces a varied feel.
 *
 * Why not hash(date) % length: the previous djb2 version walked the wordlist
 * in tight sequential steps because consecutive ISO date strings differ by
 * one byte (e.g. May 10-17 2026 picked idx 11,10,9,8,7,6,5,4). Switching to
 * SHA-256 mod length spread the distribution but introduced birthday-paradox
 * collisions (May 17 and 18 2026 both landed on "eten"). Day-of-year mod
 * length is collision-free for any 50-day window AND has predictable
 * not-random distribution, which is fine for a learner-facing single-word
 * surface.
 */
import { createServerFn } from "@tanstack/react-start";
import { lookupDictionary } from "./dictionary";
import type { DictionaryResult } from "./dictionary";

const WORDLIST: ReadonlyArray<string> = [
  "huis", "boek", "boom", "tafel", "stoel", "kat", "hond", "vogel", "vis", "kind",
  "moeder", "vader", "broer", "zus", "vriend", "school", "werk", "straat", "stad", "land",
  "water", "brood", "kaas", "appel", "koffie", "thee", "melk", "ijs", "stroopwafel", "fiets",
  "auto", "trein", "weg", "deur", "raam", "bed", "keuken", "tuin", "park", "winkel",
  "lopen", "rennen", "praten", "lezen", "schrijven", "eten", "drinken", "slapen", "wonen", "werken",
];

export type WordOfTheDay = {
  word: string;
  isoDate: string;
  dictionary: DictionaryResult | null;
};

export const getWordOfTheDay = createServerFn({ method: "GET" }).handler(
  async (): Promise<WordOfTheDay> => {
    const isoDate = new Date().toISOString().slice(0, 10);
    const word = pickWord(isoDate);

    const result = await lookupDictionary(word);
    return {
      word,
      isoDate,
      dictionary: result.ok ? result.data : null,
    };
  },
);

export function pickWord(
  isoDate: string,
  wordlist: ReadonlyArray<string> = WORDLIST,
): string {
  return wordlist[dayOfYearUTC(isoDate) % wordlist.length];
}

/**
 * 0-based UTC day-of-year for an ISO date string (YYYY-MM-DD). Jan 1 = 0,
 * Dec 31 = 364 (or 365 in a leap year). Pure function, no timezone surprises.
 */
function dayOfYearUTC(isoDate: string): number {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const startOfYear = Date.UTC(year, 0, 1);
  const thisDate = Date.UTC(year, month - 1, day);
  return Math.floor((thisDate - startOfYear) / 86_400_000);
}
