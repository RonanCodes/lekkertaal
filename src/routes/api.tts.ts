import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { requireWorkerContext } from "../entry.server";
import { eq } from "drizzle-orm";
import { vocab } from "../db/schema";
import { db } from "../db/client";

/**
 * Text-to-speech proxy with R2 cache.
 *
 *   GET /api/tts?text=...&voice=<elevenlabs_voice_id>
 *
 * Cache key: tts/<voice_id>/<sha256(text)>.mp3
 *
 * Resolution order:
 *  1. R2 cache hit → stream cached audio.
 *  2. Single-word lookup → check vocab.audioUrl (pre-enriched Wikimedia URL).
 *     Saves a round-trip for words already enriched by the enrich-vocab script.
 *  3. Single-word lookup → try Wikimedia Commons (`Nl-<word>.ogg` auto-
 *     transcoded MP3 sibling at a deterministic md5 URL). Free, CC-BY-SA,
 *     human-recorded native speakers. 100% A1-B1 single-word coverage in
 *     practice (verified 2026-05-19, see research/dutch-tts-and-dictionary-apis).
 *  4. ElevenLabs (`eleven_multilingual_v2`) — DEPRECATED, only invoked when
 *     `ELEVENLABS_ENABLED="true"` is set in wrangler vars. The free Commons
 *     + OpenAI stack covers the curriculum and avoids the per-character spend.
 *     Kept in code so it can be flipped back on if sentence-level
 *     expressiveness becomes a priority again.
 *  5. OpenAI (`gpt-4o-mini-tts` / alloy) — the active synth fallback.
 *
 * The Commons step is skipped (and we go straight to synth) for any text
 * that contains whitespace, digits, or punctuation — Wiktionary entries
 * are per-word, so multi-word strings don't have a stable Commons URL.
 *
 * Whatever upstream answers gets stored under the same cache key, so the
 * next call for the same text is a CDN-fast R2 hit regardless of source.
 */
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel (the seed default)
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const OPENAI_MODEL = "gpt-4o-mini-tts";
const OPENAI_FALLBACK_VOICE = "alloy";
const COMMONS_UA = "lekkertaal/0.1 (admin@simplicitylabs.io)";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = requireWorkerContext();
        const url = new URL(request.url);
        const text = url.searchParams.get("text")?.trim();
        const voice = (url.searchParams.get("voice") || DEFAULT_VOICE).slice(0, 64);

        if (!text) return new Response("Missing ?text", { status: 400 });
        if (text.length > 600) return new Response("Text too long", { status: 400 });

        const hash = await sha256Hex(`${voice}::${text}`);
        const key = `tts/${voice}/${hash}.mp3`;

        const cached = await env.TTS_CACHE.get(key);
        if (cached) {
          return new Response(cached.body as unknown as BodyInit, {
            status: 200,
            headers: {
              "content-type": "audio/mpeg",
              "cache-control": "public, max-age=31536000, immutable",
              "x-tts-cache": "hit",
            },
          });
        }

        let audio: ArrayBuffer | null = null;
        let provider: "wikimedia" | "elevenlabs" | "openai" = "openai";
        const elevenlabsEnabled = env.ELEVENLABS_ENABLED === "true";

        // 1. vocab.audioUrl — pre-enriched Wikimedia URL (single word only).
        //    Avoids a HEAD probe when we already know the Commons URL.
        if (isSingleDutchWord(text)) {
          const drz = db(env.DB);
          const row = await drz
            .select({ audioUrl: vocab.audioUrl })
            .from(vocab)
            .where(eq(vocab.nl, text.toLowerCase()))
            .limit(1)
            .then((rows) => rows[0] ?? null);
          if (row?.audioUrl) {
            const r = await fetch(row.audioUrl, { headers: { "user-agent": COMMONS_UA } });
            if (r.ok) {
              audio = await r.arrayBuffer();
              provider = "wikimedia";
            }
          }
        }

        // 2. Wikimedia Commons (single Dutch word only, falls through if no pre-enriched URL)
        if (!audio && isSingleDutchWord(text)) {
          const commonsAudio = await fetchCommons(text);
          if (commonsAudio) {
            audio = commonsAudio;
            provider = "wikimedia";
          }
        }

        // 3. ElevenLabs (deprecated, opt-in via ELEVENLABS_ENABLED="true")
        if (!audio && elevenlabsEnabled && env.ELEVENLABS_API_KEY) {
          try {
            const r = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,
              {
                method: "POST",
                headers: {
                  "xi-api-key": env.ELEVENLABS_API_KEY,
                  "content-type": "application/json",
                  accept: "audio/mpeg",
                },
                body: JSON.stringify({
                  text,
                  model_id: ELEVENLABS_MODEL,
                  voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
              },
            );
            if (r.ok) {
              audio = await r.arrayBuffer();
              provider = "elevenlabs";
            } else if (r.status < 500) {
              const body = await r.text();
              return new Response(`ElevenLabs error: ${body.slice(0, 500)}`, {
                status: r.status,
              });
            }
          } catch (err) {
            console.error("[tts] elevenlabs fetch failed:", err);
          }
        }

        // 4. OpenAI
        if (!audio && env.OPENAI_API_KEY) {
          provider = "openai";
          try {
            const r = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: OPENAI_MODEL,
                voice: OPENAI_FALLBACK_VOICE,
                input: text,
                response_format: "mp3",
              }),
            });
            if (r.ok) {
              audio = await r.arrayBuffer();
            } else {
              const body = await r.text();
              return new Response(`OpenAI TTS error: ${body.slice(0, 500)}`, {
                status: r.status,
              });
            }
          } catch (err) {
            console.error("[tts] openai fallback failed:", err);
          }
        }

        if (!audio) {
          return new Response("No TTS provider available", { status: 502 });
        }

        try {
          await env.TTS_CACHE.put(key, audio, {
            httpMetadata: { contentType: "audio/mpeg" },
            customMetadata: { provider, voice, len: String(text.length) },
          });
        } catch (err) {
          console.error("[tts] R2 put failed:", err);
        }

        return new Response(audio, {
          status: 200,
          headers: {
            "content-type": "audio/mpeg",
            "cache-control": "public, max-age=31536000, immutable",
            "x-tts-cache": "miss",
            "x-tts-provider": provider,
          },
        });
      },
    },
  },
});

/**
 * Wiktionary's Dutch audio uploads to Wikimedia Commons follow the convention
 * `Nl-<word>.ogg`. The hosting URL is computable from md5 of the filename, and
 * a transcoded MP3 sibling exists at a deterministic path — so we can fetch
 * without a single MediaWiki API call. Returns null on 404 (no recording for
 * this word) or any error so the caller can fall through to synth.
 */
async function fetchCommons(word: string): Promise<ArrayBuffer | null> {
  const filename = `Nl-${word.toLowerCase()}.ogg`;
  const hash = md5Hex(filename);
  const mp3Url = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${hash[0]}/${hash.slice(0, 2)}/${filename}/${filename}.mp3`;
  try {
    const r = await fetch(mp3Url, { headers: { "user-agent": COMMONS_UA } });
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch (err) {
    console.error("[tts] wikimedia fetch failed:", err);
    return null;
  }
}

function isSingleDutchWord(text: string): boolean {
  return /^[a-zëïéèáàóòúù]{1,40}$/i.test(text);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}
