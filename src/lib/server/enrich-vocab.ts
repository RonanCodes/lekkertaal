/**
 * Vocab enrichment helpers.
 *
 * Pure async functions that call public dictionary APIs and return enriched
 * fields. All are side-effect free (no DB writes, no file I/O) so they are
 * easy to unit-test with fixture HTTP responses. The enrichment script
 * (`scripts/enrich-vocab.ts`) calls these in sequence and persists the results.
 *
 * API sources:
 *   Wiktionary  — CC-BY-SA  — IPA, word type, gender
 *   Wikimedia Commons — CC-BY-SA — native-speaker audio URL
 *   Tatoeba     — CC-BY    — example sentence pairs
 *
 * None of these APIs are called at request time. This module is only imported
 * by the offline enrichment script.
 */

import type { VocabField, VocabSource } from "../../db/schema";

export type SourceMap = Partial<Record<VocabField, VocabSource>>;

// ============================================================================
// Shared types
// ============================================================================

export type EnrichResult = {
  ipa?: string;
  gender?: "de" | "het";
  audioUrl?: string;
  wordType?: "noun" | "verb" | "adjective" | "adverb" | "other";
  exampleSentenceNl?: string;
  exampleSentenceEn?: string;
  sources: SourceMap;
};

// ============================================================================
// Wiktionary REST API
// ============================================================================

const WIKTIONARY_UA = "lekkertaal/0.1 (admin@simplicitylabs.io)";
const WIKTIONARY_BASE = "https://en.wiktionary.org/api/rest_v1/page/definition";

type WiktDef = {
  definition?: string;
  examples?: Array<string | { example?: string }>;
};

type WiktEntry = {
  partOfSpeech?: string;
  language?: string;
  definitions?: WiktDef[];
};

export type WiktionaryResult = {
  ipa?: string;
  gender?: "de" | "het";
  wordType?: "noun" | "verb" | "adjective" | "adverb" | "other";
};

/**
 * Look up a Dutch word on Wiktionary and extract IPA, grammatical gender, and
 * word type. Returns `null` if the word has no Dutch entry or the request fails.
 */
export async function fetchWiktionary(
  word: string,
  fetchFn: typeof fetch = fetch,
): Promise<WiktionaryResult | null> {
  const url = `${WIKTIONARY_BASE}/${encodeURIComponent(word.toLowerCase())}`;
  let doc: Record<string, unknown>;
  try {
    const r = await fetchFn(url, {
      headers: { "user-agent": WIKTIONARY_UA, accept: "application/json" },
    });
    if (!r.ok) return null;
    doc = (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Wiktionary returns sections keyed by language code. Dutch is "nl".
  const nlEntries = Array.isArray(doc.nl)
    ? (doc.nl as WiktEntry[])
    : [];
  if (nlEntries.length === 0) return null;

  const result: WiktionaryResult = {};

  // Extract IPA from the raw definition text (Wiktionary embeds IPA in the
  // definition HTML as `{{IPA|nl|/ˈbroːt/}}` or as a Unicode IPA string inside
  // slashes in the text). The REST endpoint strips templates but sometimes
  // leaves IPA in the definition text surrounded by slashes.
  for (const entry of nlEntries) {
    const defs = Array.isArray(entry.definitions) ? entry.definitions : [];
    for (const d of defs) {
      const text = stripHtml(String(d.definition ?? ""));
      const ipaMatch = text.match(/\/([ˈˌa-zɑɔøʏʃʒŋɪɛəɜæɐɑʁχɣβðθvzɾʔⁿʷ:ːˑ·˦˧˨˩ʰ'ˀ-]+)\//);

      if (ipaMatch && !result.ipa) {
        result.ipa = `/${ipaMatch[1]}/`;
      }
    }
  }

  // Word type — map Wiktionary part-of-speech labels to our enum.
  const firstPos = nlEntries[0]?.partOfSpeech?.toLowerCase() ?? "";
  result.wordType = mapPartOfSpeech(firstPos);

  // Gender — only meaningful for nouns. The Dutch Wiktionary entries encode
  // grammatical gender in the definition text as "de" or "het" at the start
  // (from the {{nl-noun}} template that the REST API partially renders).
  if (result.wordType === "noun") {
    for (const entry of nlEntries) {
      const defs = Array.isArray(entry.definitions) ? entry.definitions : [];
      for (const d of defs) {
        const text = stripHtml(String(d.definition ?? "")).toLowerCase();
        // Common patterns: "het brood", "de boom", or a definition starting
        // with the article. Also check for (de) / (het) annotation.
        if (/\bhet\b/.test(text) && !result.gender) result.gender = "het";
        if (/\bde\b/.test(text) && !result.gender) result.gender = "de";
      }
    }
  }

  return result;
}

function mapPartOfSpeech(pos: string): "noun" | "verb" | "adjective" | "adverb" | "other" {
  if (pos.includes("noun")) return "noun";
  if (pos.includes("verb")) return "verb";
  if (pos.includes("adjective") || pos.includes("adj")) return "adjective";
  if (pos.includes("adverb") || pos.includes("adv")) return "adverb";
  return "other";
}

// ============================================================================
// Wikimedia Commons audio
// ============================================================================

const COMMONS_UA = "lekkertaal/0.1 (admin@simplicitylabs.io)";

export type WikimediaResult = {
  audioUrl: string;
} | null;

/**
 * Check whether Wikimedia Commons has a native-speaker recording for the word
 * and return the transcoded MP3 URL. The filename convention is `Nl-<word>.ogg`;
 * the MP3 URL is computed from the md5 of the filename (same pattern as
 * `api.tts.ts`). Returns `null` on 404 or any error.
 */
export async function fetchWikimediaAudio(
  word: string,
  fetchFn: typeof fetch = fetch,
): Promise<WikimediaResult> {
  const filename = `Nl-${word.toLowerCase()}.ogg`;
  const hash = md5Hex(filename);
  const mp3Url = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${hash[0]}/${hash.slice(0, 2)}/${filename}/${filename}.mp3`;
  try {
    const r = await fetchFn(mp3Url, {
      method: "HEAD",
      headers: { "user-agent": COMMONS_UA },
    });
    if (!r.ok) return null;
    return { audioUrl: mp3Url };
  } catch {
    return null;
  }
}

// ============================================================================
// Tatoeba sentence pairs
// ============================================================================

const TATOEBA_UA = "lekkertaal/0.1 (admin@simplicitylabs.io)";
const TATOEBA_MAX_WORDS = 12;

type TatoebaSentence = {
  id?: number;
  text?: string;
  translations?: Array<Array<{ id?: number; text?: string; lang?: string }>>;
};

type TatoebaResponse = {
  results?: TatoebaSentence[];
};

export type TatoebaResult = {
  nl: string;
  en: string;
  sentenceId: number;
} | null;

/**
 * Fetch a short example sentence pair from Tatoeba for the given Dutch word.
 * Picks the shortest Dutch sentence (under 12 words) that has at least one
 * English translation. Returns `null` if no suitable pair is found or the
 * request fails.
 */
export async function fetchTatoeba(
  word: string,
  fetchFn: typeof fetch = fetch,
): Promise<TatoebaResult> {
  const url = `https://tatoeba.org/en/api_v0/search?from=nld&to=eng&query=${encodeURIComponent(word)}&limit=20`;
  let data: TatoebaResponse;
  try {
    const r = await fetchFn(url, {
      headers: { "user-agent": TATOEBA_UA, accept: "application/json" },
    });
    if (!r.ok) return null;
    data = (await r.json()) as TatoebaResponse;
  } catch {
    return null;
  }

  const results = data.results ?? [];
  let best: TatoebaResult = null;
  let bestWordCount = Infinity;

  for (const s of results) {
    const nlText = (s.text ?? "").trim();
    if (!nlText) continue;
    const wordCount = nlText.split(/\s+/).length;
    if (wordCount > TATOEBA_MAX_WORDS) continue;

    // Find first English translation.
    let enText: string | null = null;
    const translations = s.translations ?? [];
    for (const group of translations) {
      if (!Array.isArray(group)) continue;
      for (const t of group) {
        if (t.lang === "eng" && t.text?.trim()) {
          enText = t.text.trim();
          break;
        }
      }
      if (enText) break;
    }
    if (!enText) continue;

    if (wordCount < bestWordCount) {
      bestWordCount = wordCount;
      best = { nl: nlText, en: enText, sentenceId: s.id ?? 0 };
    }
  }

  return best;
}

// ============================================================================
// Orchestration
// ============================================================================

/**
 * Enrich a single Dutch word by calling Wiktionary, Wikimedia, and Tatoeba in
 * sequence. Returns a partial `EnrichResult`; empty fields are omitted. The
 * `sources` map records which API provided each populated field.
 *
 * @param word           The Dutch word to enrich.
 * @param existingNl     The current `exampleSentenceNl` from the vocab entry
 *                       (skip Tatoeba if already populated).
 * @param fetchFn        Injectable fetch for testing.
 * @param rateLimitDelay ms to sleep between API calls (default 0; script sets 1000).
 */
export async function enrichWord(
  word: string,
  existingNl?: string | null,
  fetchFn: typeof fetch = fetch,
  rateLimitDelay = 0,
): Promise<EnrichResult> {
  const sources: SourceMap = {};
  const result: EnrichResult = { sources };

  // --- Wiktionary ---
  const wikt = await fetchWiktionary(word, fetchFn);
  if (wikt) {
    if (wikt.ipa) { result.ipa = wikt.ipa; sources.ipa = "wiktionary"; }
    if (wikt.gender) { result.gender = wikt.gender; sources.gender = "wiktionary"; }
    if (wikt.wordType) { result.wordType = wikt.wordType; sources.wordType = "wiktionary"; }
  }

  if (rateLimitDelay > 0) await sleep(rateLimitDelay);

  // --- Wikimedia Commons ---
  const wikimedia = await fetchWikimediaAudio(word, fetchFn);
  if (wikimedia) {
    result.audioUrl = wikimedia.audioUrl;
    sources.audioUrl = "wikimedia";
  }

  if (rateLimitDelay > 0) await sleep(rateLimitDelay);

  // --- Tatoeba (only if exampleSentenceNl is empty) ---
  if (!existingNl) {
    const tatoeba = await fetchTatoeba(word, fetchFn);
    if (tatoeba) {
      result.exampleSentenceNl = tatoeba.nl;
      result.exampleSentenceEn = tatoeba.en;
      sources.exampleSentenceNl = "tatoeba";
      sources.exampleSentenceEn = "tatoeba";
    }
  }

  return result;
}

// ============================================================================
// Utilities (re-exported for tests)
// ============================================================================

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NodeCrypto = { createHash: (algorithm: string) => { update: (data: string) => { digest: (encoding: string) => string } } };

function md5Hex(input: string): string {
  // Node.js built-in — only used in the offline script (not in CF Workers).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as NodeCrypto;
  return createHash("md5").update(input).digest("hex");
}
