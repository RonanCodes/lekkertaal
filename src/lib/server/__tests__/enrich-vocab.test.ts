/**
 * Unit tests for vocab enrichment helpers.
 *
 * Covers each API integration with a fixture HTTP response so the tests run
 * offline and never hit real network endpoints.
 */
import { describe, it, expect } from "vitest";
import { fetchWiktionary, fetchWikimediaAudio, fetchTatoeba, enrichWord } from "../enrich-vocab";

// ---------------------------------------------------------------------------
// Wiktionary fixture
// ---------------------------------------------------------------------------

const WIKTIONARY_BROOD: unknown = {
  nl: [
    {
      partOfSpeech: "Noun",
      definitions: [
        {
          definition: "het brood — bread; a staple food made by baking dough.",
          examples: ["Ik eet brood met kaas."],
        },
      ],
    },
  ],
};

const WIKTIONARY_LOPEN: unknown = {
  nl: [
    {
      partOfSpeech: "Verb",
      definitions: [
        {
          definition: "to walk; to move by foot.",
          examples: [],
        },
      ],
    },
  ],
};

const WIKTIONARY_MOOI: unknown = {
  nl: [
    {
      partOfSpeech: "Adjective",
      definitions: [
        {
          definition: "beautiful; aesthetically pleasing.",
        },
      ],
    },
  ],
};

function makeFetch(
  responses: Record<string, { ok: boolean; status?: number; json?: () => Promise<unknown> }>,
): typeof fetch {
  return async (input: string | URL | Request) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) {
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }
    const mock = responses[key];
    if (!mock) return { ok: false, status: 404 } as unknown as Response;
    return {
      ok: mock.ok,
      status: mock.status ?? (mock.ok ? 200 : 404),
      json: mock.json ?? (async () => ({})),
    } as unknown as Response;
  };
}

// ---------------------------------------------------------------------------
// fetchWiktionary
// ---------------------------------------------------------------------------

describe("fetchWiktionary", () => {
  it("extracts word type for a noun", async () => {
    const result = await fetchWiktionary(
      "brood",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => WIKTIONARY_BROOD } }),
    );
    expect(result).not.toBeNull();
    expect(result!.wordType).toBe("noun");
  });

  it("extracts word type for a verb", async () => {
    const result = await fetchWiktionary(
      "lopen",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => WIKTIONARY_LOPEN } }),
    );
    expect(result!.wordType).toBe("verb");
  });

  it("extracts word type for an adjective", async () => {
    const result = await fetchWiktionary(
      "mooi",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => WIKTIONARY_MOOI } }),
    );
    expect(result!.wordType).toBe("adjective");
  });

  it("returns null when the word has no Dutch section", async () => {
    const result = await fetchWiktionary(
      "cat",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => ({ en: [] }) } }),
    );
    expect(result).toBeNull();
  });

  it("returns null on a 404", async () => {
    const result = await fetchWiktionary(
      "xyzzy",
      makeFetch({ "wiktionary.org": { ok: false, status: 404 } }),
    );
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    const throwingFetch: typeof fetch = async () => { throw new Error("network"); };
    const result = await fetchWiktionary("brood", throwingFetch);
    expect(result).toBeNull();
  });

  it("detects het gender from definition text", async () => {
    const fixture = {
      nl: [
        {
          partOfSpeech: "Noun",
          definitions: [{ definition: "het brood (plural broden) — a loaf of bread." }],
        },
      ],
    };
    const result = await fetchWiktionary(
      "brood",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => fixture } }),
    );
    expect(result!.gender).toBe("het");
  });

  it("detects de gender from definition text", async () => {
    const fixture = {
      nl: [
        {
          partOfSpeech: "Noun",
          definitions: [{ definition: "de boom (plural bomen) — a tree." }],
        },
      ],
    };
    const result = await fetchWiktionary(
      "boom",
      makeFetch({ "wiktionary.org": { ok: true, json: async () => fixture } }),
    );
    expect(result!.gender).toBe("de");
  });
});

// ---------------------------------------------------------------------------
// fetchWikimediaAudio
// ---------------------------------------------------------------------------

describe("fetchWikimediaAudio", () => {
  it("returns audio URL on HEAD 200", async () => {
    const result = await fetchWikimediaAudio(
      "brood",
      makeFetch({ "upload.wikimedia.org": { ok: true } }),
    );
    expect(result).not.toBeNull();
    expect(result!.audioUrl).toContain("Nl-brood.ogg.mp3");
  });

  it("returns null on HEAD 404", async () => {
    const result = await fetchWikimediaAudio(
      "xyzzy",
      makeFetch({ "upload.wikimedia.org": { ok: false, status: 404 } }),
    );
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    const throwingFetch: typeof fetch = async () => { throw new Error("network"); };
    const result = await fetchWikimediaAudio("brood", throwingFetch);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchTatoeba
// ---------------------------------------------------------------------------

const TATOEBA_RESPONSE = {
  results: [
    {
      id: 12345,
      text: "Ik eet brood met kaas.",
      translations: [[{ id: 99001, text: "I eat bread with cheese.", lang: "eng" }]],
    },
    {
      id: 12346,
      text: "Dit is een heel lang zinnetje met wel heel veel woorden die echt te lang zijn om te gebruiken in een flashcard context want het heeft meer dan twaalf woorden.",
      translations: [[{ id: 99002, text: "This is too long.", lang: "eng" }]],
    },
  ],
};

describe("fetchTatoeba", () => {
  it("returns the shortest matching sentence pair under 12 words", async () => {
    const result = await fetchTatoeba(
      "brood",
      makeFetch({ "tatoeba.org": { ok: true, json: async () => TATOEBA_RESPONSE } }),
    );
    expect(result).not.toBeNull();
    expect(result!.nl).toBe("Ik eet brood met kaas.");
    expect(result!.en).toBe("I eat bread with cheese.");
    expect(result!.sentenceId).toBe(12345);
  });

  it("skips sentences longer than 12 words", async () => {
    const onlyLong = {
      results: [
        {
          id: 1,
          text: "Dit is een heel lang zinnetje met wel heel veel woorden die echt te lang zijn.",
          translations: [[{ id: 2, text: "Way too long.", lang: "eng" }]],
        },
      ],
    };
    const result = await fetchTatoeba(
      "zinnetje",
      makeFetch({ "tatoeba.org": { ok: true, json: async () => onlyLong } }),
    );
    expect(result).toBeNull();
  });

  it("returns null on 404", async () => {
    const result = await fetchTatoeba(
      "xyzzy",
      makeFetch({ "tatoeba.org": { ok: false, status: 404 } }),
    );
    expect(result).toBeNull();
  });

  it("returns null when no English translation exists", async () => {
    const noEn = {
      results: [
        {
          id: 1,
          text: "Ik eet brood.",
          translations: [[{ id: 2, text: "Je mange du pain.", lang: "fra" }]],
        },
      ],
    };
    const result = await fetchTatoeba(
      "brood",
      makeFetch({ "tatoeba.org": { ok: true, json: async () => noEn } }),
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// enrichWord orchestration
// ---------------------------------------------------------------------------

describe("enrichWord", () => {
  it("populates sources map with correct provider labels", async () => {
    const mockFetch = makeFetch({
      "wiktionary.org": { ok: true, json: async () => WIKTIONARY_BROOD },
      "upload.wikimedia.org": { ok: true },
      "tatoeba.org": { ok: true, json: async () => TATOEBA_RESPONSE },
    });
    const result = await enrichWord("brood", null, mockFetch, 0);
    expect(result.wordType).toBe("noun");
    expect(result.audioUrl).toBeTruthy();
    expect(result.exampleSentenceNl).toBe("Ik eet brood met kaas.");
    expect(result.sources.wordType).toBe("wiktionary");
    expect(result.sources.audioUrl).toBe("wikimedia");
    expect(result.sources.exampleSentenceNl).toBe("tatoeba");
  });

  it("skips Tatoeba when exampleSentenceNl is already populated", async () => {
    const tatoebaCalls: string[] = [];
    const trackingFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("tatoeba")) tatoebaCalls.push(url);
      return makeFetch({
        "wiktionary.org": { ok: true, json: async () => WIKTIONARY_BROOD },
        "upload.wikimedia.org": { ok: true },
      })(input);
    };
    await enrichWord("brood", "Existing sentence", trackingFetch, 0);
    expect(tatoebaCalls).toHaveLength(0);
  });

  it("returns empty sources when all APIs fail", async () => {
    const failFetch = async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response;
    const result = await enrichWord("brood", null, failFetch, 0);
    expect(Object.keys(result.sources)).toHaveLength(0);
  });
});
