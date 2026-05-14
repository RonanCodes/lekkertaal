/**
 * POST /api/stt/transcribe
 *
 * Accepts `multipart/form-data` with:
 *   - `audio`   (required) — the recorded clip, typically webm/opus from
 *                MediaRecorder. Max 10MB / 30s.
 *   - `durationMs` (required) — client-claimed duration in milliseconds.
 *                Rejected up-front if it exceeds 30s; we can't cheaply decode
 *                webm in a worker to verify, but the cap blocks obvious abuse.
 *   - `drillId` (optional) — integer id of the exercise being spoken; null
 *                when used outside a drill (free speak mode, etc.).
 *
 * Flow:
 *   1. Auth via `requireUserClerkId()` → resolve numeric user id.
 *   2. Validate the multipart payload.
 *   3. Upload the raw clip to R2 at `stt/<userId>/<uuid>.webm`.
 *   4. Call OpenAI Whisper (one retry on 5xx).
 *   5. Insert a `transcripts` row.
 *   6. Return `{ transcript, audioKey, durationMs }`.
 *
 * On any pre-Whisper validation failure we return 4xx without touching R2.
 * On R2 / Whisper / DB failure we surface 5xx and the row is never inserted.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId } from "../lib/server/friends";
import {
  MAX_CLIP_BYTES,
  MAX_CLIP_DURATION_MS,
  insertTranscript,
  whisperTranscribe,
} from "../lib/server/stt";
import { log } from "../lib/logger";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function newUuid(): string {
  // crypto.randomUUID is available in workers + node 19+.
  return crypto.randomUUID();
}

export const Route = createFileRoute("/api/stt/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let clerkId: string;
        try {
          clerkId = await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        const { env } = requireWorkerContext();
        if (!env.OPENAI_API_KEY) {
          return jsonResponse({ error: "openai_not_configured" }, 503);
        }

        const drz = db(env.DB);
        const userId = await getUserIdByClerkId(drz, clerkId);
        if (!userId) return jsonResponse({ error: "user_row_missing" }, 500);

        // Parse multipart body. We accept exactly the fields above.
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonResponse({ error: "invalid_multipart" }, 400);
        }

        const audio = form.get("audio");
        if (!(audio instanceof Blob)) {
          return jsonResponse({ error: "missing_audio" }, 400);
        }
        if (audio.size === 0) {
          return jsonResponse({ error: "empty_audio" }, 400);
        }
        if (audio.size > MAX_CLIP_BYTES) {
          return jsonResponse({ error: "audio_too_large" }, 413);
        }

        const durationRaw = form.get("durationMs");
        const durationMs =
          typeof durationRaw === "string" ? Number.parseInt(durationRaw, 10) : NaN;
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
          return jsonResponse({ error: "invalid_duration" }, 400);
        }
        if (durationMs > MAX_CLIP_DURATION_MS) {
          return jsonResponse(
            { error: "clip_too_long", maxMs: MAX_CLIP_DURATION_MS },
            413,
          );
        }

        const drillRaw = form.get("drillId");
        let drillId: number | null = null;
        if (typeof drillRaw === "string" && drillRaw.length > 0) {
          const parsed = Number.parseInt(drillRaw, 10);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            return jsonResponse({ error: "invalid_drill_id" }, 400);
          }
          drillId = parsed;
        }

        const audioKey = `stt/${userId}/${newUuid()}.webm`;

        // Read the clip once into an ArrayBuffer; both R2 put and Whisper
        // forwarding need the bytes. A 30-second opus clip is well under
        // 10MB so the single-pass buffer is fine and lets the route stay
        // synchronous-ish without a second R2 round-trip.
        let audioBytes: ArrayBuffer;
        try {
          audioBytes = await audio.arrayBuffer();
        } catch (err) {
          log.error("stt audio read failed", { err });
          return jsonResponse({ error: "audio_read_failed" }, 400);
        }
        const contentType = audio.type || "audio/webm";

        try {
          await env.TTS_CACHE.put(audioKey, audioBytes, {
            httpMetadata: { contentType },
            customMetadata: {
              userId: String(userId),
              durationMs: String(durationMs),
            },
          });
        } catch (err) {
          log.error("stt R2 put failed", { audioKey, err });
          return jsonResponse({ error: "storage_failed" }, 502);
        }

        let transcript: string;
        try {
          const result = await whisperTranscribe({
            audio: new Blob([audioBytes], { type: contentType }),
            apiKey: env.OPENAI_API_KEY,
          });
          transcript = result.text;
        } catch (err) {
          log.error("stt whisper failed", { audioKey, err });
          return jsonResponse({ error: "transcription_failed" }, 502);
        }

        try {
          await insertTranscript(drz, {
            userId,
            drillId,
            audioKey,
            transcript,
            durationMs,
          });
        } catch (err) {
          log.error("stt db insert failed", { audioKey, err });
          return jsonResponse({ error: "persist_failed" }, 500);
        }

        return jsonResponse({ transcript, audioKey, durationMs });
      },
    },
  },
});
