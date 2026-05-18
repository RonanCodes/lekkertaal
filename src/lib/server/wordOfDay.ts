/**
 * Word of the Day picker + dictionary lookup.
 *
 * Deterministic per UTC date: hash(YYYY-MM-DD) % WORDLIST.length, so every
 * user sees the same word on the same day. The dictionary call hits the
 * R2-cached Wiktionary lookup, so the second user of the day reads from
 * warm cache.
 *
 * Curated A1-A2 list (50 entries) covering nouns, verbs, adjectives, and
 * common conjugations a learner meets in the first month. All have audio
 * on Wikimedia Commons and definitions on en.wiktionary (verified 2026-05-19).
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
    const idx = djb2(isoDate) % WORDLIST.length;
    const word = WORDLIST[idx];

    const result = await lookupDictionary(word);
    return {
      word,
      isoDate,
      dictionary: result.ok ? result.data : null,
    };
  },
);

export function pickWord(isoDate: string, wordlist: ReadonlyArray<string> = WORDLIST): string {
  return wordlist[djb2(isoDate) % wordlist.length];
}

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(h | 0);
}
