/**
 * Integration tests for the enrich-vocab pipeline.
 *
 * Validates:
 *   - enrichWord populates correct sources from fixture responses.
 *   - Idempotency: a second run with `enrichedAt` set skips unless --force.
 *   - The `sources` map matches what was actually populated.
 *
 * Uses a small in-memory fixture rather than hitting real APIs.
 */
import { describe, it, expect } from "vitest";
import { enrichWord } from "../enrich-vocab";
import type { EnrichResult } from "../enrich-vocab";

// ---------------------------------------------------------------------------
// Fixtures: 5 seed entries
// ---------------------------------------------------------------------------

type SeedEntry = {
  nl: string;
  en: string;
  example_sentence_nl?: string | null;
  enriched_at?: number | null;
};

const SEED_ENTRIES: SeedEntry[] = [
  { nl: "brood", en: "bread" },
  { nl: "boom", en: "tree" },
  { nl: "fiets", en: "bicycle" },
  { nl: "kat", en: "cat" },
  { nl: "huis", en: "house" },
];

// ---------------------------------------------------------------------------
// Fake HTTP responses
// ---------------------------------------------------------------------------

const WIKTIONARY_NOUN = (word: string, article: "de" | "het") => ({
  nl: [
    {
      partOfSpeech: "Noun",
      definitions: [
        {
          definition: `${article} ${word} — a common Dutch noun.`,
        },
      ],
    },
  ],
});

const TATOEBA_PAIR = (nl: string, en: string, id: number) => ({
  results: [
    {
      id,
      text: nl,
      translations: [[{ id: id + 1, text: en, lang: "eng" }]],
    },
  ],
});

function makeFixtureFetch(
  word: string,
  opts: { article?: "de" | "het"; sentenceNl?: string; sentenceEn?: string } = {},
): typeof fetch {
  return async (input: string | URL | Request) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;
    if (url.includes("wiktionary.org")) {
      return {
        ok: true,
        json: async () => WIKTIONARY_NOUN(word, opts.article ?? "de"),
      } as unknown as Response;
    }
    if (url.includes("upload.wikimedia.org")) {
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }
    if (url.includes("tatoeba.org")) {
      const nl = opts.sentenceNl ?? `Ik heb een ${word}.`;
      const en = opts.sentenceEn ?? `I have a ${word}.`;
      return {
        ok: true,
        json: async () => TATOEBA_PAIR(nl, en, 10000 + word.charCodeAt(0)),
      } as unknown as Response;
    }
    return { ok: false, status: 404 } as unknown as Response;
  };
}

// ---------------------------------------------------------------------------
// Simulated enrichment loop (mirrors the script logic)
// ---------------------------------------------------------------------------

async function runEnrichmentPass(
  entries: SeedEntry[],
  force: boolean,
): Promise<Array<SeedEntry & { _result: EnrichResult }>> {
  const out = [];
  for (const entry of entries) {
    if (!force && entry.enriched_at) {
      out.push({ ...entry, _result: { sources: {} } });
      continue;
    }
    const fetchFn = makeFixtureFetch(entry.nl);
    const result = await enrichWord(entry.nl, entry.example_sentence_nl, fetchFn, 0);
    out.push({
      ...entry,
      example_sentence_nl: result.exampleSentenceNl ?? entry.example_sentence_nl,
      enriched_at: Date.now(),
      _result: result,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("enrich-vocab integration", () => {
  it("enriches all 5 seed entries with wiktionary + wikimedia + tatoeba sources", async () => {
    const results = await runEnrichmentPass(SEED_ENTRIES, false);
    for (const r of results) {
      expect(r._result.wordType).toBe("noun");
      expect(r._result.audioUrl).toBeTruthy();
      expect(r._result.exampleSentenceNl).toBeTruthy();
      expect(r._result.sources.wordType).toBe("wiktionary");
      expect(r._result.sources.audioUrl).toBe("wikimedia");
      expect(r._result.sources.exampleSentenceNl).toBe("tatoeba");
    }
  });

  it("sources map contains exactly the fields that were populated", async () => {
    const fetchOnlyWikt: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("wiktionary.org")) {
        return { ok: true, json: async () => WIKTIONARY_NOUN("boom", "de") } as unknown as Response;
      }
      // Wikimedia and Tatoeba fail.
      return { ok: false, status: 404 } as unknown as Response;
    };

    const result = await enrichWord("boom", null, fetchOnlyWikt, 0);
    expect(result.sources.wordType).toBe("wiktionary");
    expect(result.sources.audioUrl).toBeUndefined();
    expect(result.sources.exampleSentenceNl).toBeUndefined();
  });

  it("is idempotent: second pass skips already-enriched entries", async () => {
    // First pass — enriches everything.
    const firstPass = await runEnrichmentPass(SEED_ENTRIES, false);
    // Verify enriched_at is set.
    for (const r of firstPass) {
      expect(r.enriched_at).toBeTruthy();
    }

    // Second pass without --force — all should be skipped.
    const secondPass = await runEnrichmentPass(firstPass, false);
    for (const r of secondPass) {
      // Skipped entries get an empty sources map from the loop (no API call).
      expect(Object.keys(r._result.sources)).toHaveLength(0);
    }
  });

  it("re-enriches everything when force=true", async () => {
    const firstPass = await runEnrichmentPass(SEED_ENTRIES, false);
    const forcedPass = await runEnrichmentPass(firstPass, true);
    for (const r of forcedPass) {
      // All fields should have been populated again.
      expect(r._result.sources.wordType).toBe("wiktionary");
    }
  });

  it("does not overwrite an existing example sentence from Tatoeba", async () => {
    const entriesWithSentences: SeedEntry[] = SEED_ENTRIES.map((e) => ({
      ...e,
      example_sentence_nl: "Hand-authored sentence.",
    }));
    const results = await runEnrichmentPass(entriesWithSentences, false);
    for (const r of results) {
      // exampleSentenceNl should NOT have been replaced.
      expect(r.example_sentence_nl).toBe("Hand-authored sentence.");
      // Tatoeba source entry should be absent.
      expect(r._result.sources.exampleSentenceNl).toBeUndefined();
    }
  });
});
