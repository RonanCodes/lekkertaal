import { createFileRoute } from "@tanstack/react-router";
import { requireWorkerContext } from "../entry.server";

/**
 * Text-to-speech proxy with R2 cache.
 *
 *   GET /api/tts?text=...&voice=<elevenlabs_voice_id>
 *
 * Cache key: tts/<voice_id>/<sha256(text)>.mp3
 *
 * Hit: stream the cached audio/mpeg from R2 (no upstream cost).
 * Miss: call ElevenLabs, store the response in R2, then stream it.
 *
 * Fallback: if ELEVENLABS_API_KEY is unset OR ElevenLabs returns 5xx, fall
 * back to OpenAI TTS (alloy voice by default) so the UI never silently
 * fails. The fallback still gets cached by the same key.
 */
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel (the seed default)
const ELEVENLABS_MODEL = "eleven_multilingual_v2";
const OPENAI_MODEL = "gpt-4o-mini-tts";
const OPENAI_FALLBACK_VOICE = "alloy";

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

        // Cache hit?
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

        // Miss → call ElevenLabs, then OpenAI as a fallback.
        let audio: ArrayBuffer | null = null;
        let provider = "elevenlabs";

        if (env.ELEVENLABS_API_KEY) {
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
                  voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                  },
                }),
              },
            );
            if (r.ok) {
              audio = await r.arrayBuffer();
            } else if (r.status < 500) {
              // 4xx is our fault (bad voice id, malformed body, etc.) — surface it.
              const body = await r.text();
              return new Response(`ElevenLabs error: ${body.slice(0, 500)}`, {
                status: r.status,
              });
            }
          } catch (err) {
            console.error("[tts] elevenlabs fetch failed:", err);
          }
        }

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

        // Store the result for next time. Best-effort: even if R2 write fails
        // we still return the audio to the caller.
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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
