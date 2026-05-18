/**
 * Wiktionary-backed dictionary lookup, factored out of the /api/dictionary
 * route so server-side callers (e.g. Word of the Day loader) can invoke it
 * without an internal HTTP round-trip. The /api/dictionary route is a thin
 * wrapper over this function.
 *
 * Returns a normalised entry list with HTML stripped, or null if Wiktionary
 * has no Dutch entry for the word. Caches in the R2 TTS_CACHE bucket under
 * `dict/en/<word>.json`.
 */
import { requireWorkerContext } from "../../entry.server";

const WIKTIONARY_UA = "lekkertaal/0.1 (admin@simplicitylabs.io)";

export type DictionaryEntry = {
  partOfSpeech: string;
  definitions: Array<{ text: string; examples?: string[] }>;
};

export type DictionaryResult = {
  word: string;
  entries: DictionaryEntry[];
  source: "wiktionary";
  attribution: "CC-BY-SA, en.wiktionary.org";
};

export type DictionaryLookup =
  | { ok: true; data: DictionaryResult; cache: "hit" | "miss" }
  | { ok: false; reason: "invalid" | "not-found" | "upstream"; status: number };

export async function lookupDictionary(rawWord: string): Promise<DictionaryLookup> {
  const word = rawWord.trim().toLowerCase();
  if (!isValidWord(word)) {
    return { ok: false, reason: "invalid", status: 400 };
  }

  const { env } = requireWorkerContext();
  const key = `dict/en/${word}.json`;

  const cached = await env.TTS_CACHE.get(key);
  if (cached) {
    const data = JSON.parse(await cached.text()) as DictionaryResult;
    return { ok: true, data, cache: "hit" };
  }

  try {
    const r = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers: { "user-agent": WIKTIONARY_UA, accept: "application/json" } },
    );
    if (r.status === 404) {
      return { ok: false, reason: "not-found", status: 404 };
    }
    if (!r.ok) {
      return { ok: false, reason: "upstream", status: 502 };
    }
    const doc = (await r.json()) as Record<string, unknown>;
    const nl = Array.isArray(doc.nl)
      ? (doc.nl as Array<Record<string, unknown>>)
      : [];
    if (nl.length === 0) {
      return { ok: false, reason: "not-found", status: 404 };
    }

    const entries: DictionaryEntry[] = nl.map((e) => ({
      partOfSpeech: String(e.partOfSpeech ?? "Unknown"),
      definitions: Array.isArray(e.definitions)
        ? (e.definitions as Array<Record<string, unknown>>)
            .map((d) => ({
              text: stripHtml(String(d.definition ?? "")),
              examples: Array.isArray(d.examples)
                ? (d.examples as string[]).map(stripHtml).filter(Boolean)
                : undefined,
            }))
            .filter((d) => d.text.length > 0)
        : [],
    }));

    const data: DictionaryResult = {
      word,
      entries,
      source: "wiktionary",
      attribution: "CC-BY-SA, en.wiktionary.org",
    };

    try {
      await env.TTS_CACHE.put(key, JSON.stringify(data), {
        httpMetadata: { contentType: "application/json" },
      });
    } catch (err) {
      console.error("[dictionary] R2 put failed:", err);
    }

    return { ok: true, data, cache: "miss" };
  } catch (err) {
    console.error("[dictionary] fetch failed:", err);
    return { ok: false, reason: "upstream", status: 502 };
  }
}

export function isValidWord(word: string): boolean {
  return /^[a-zëïéèáàóòúù]{1,40}$/.test(word);
}

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
