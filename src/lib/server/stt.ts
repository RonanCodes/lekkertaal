/**
 * Speech-to-text helpers.
 *
 * Thin wrapper around OpenAI Whisper (`whisper-1`). The wrapper exists for
 * three reasons:
 *
 *   1. A single retry on 5xx so transient upstream blips don't kill a clip.
 *   2. A swap-in seam for integration tests — pass `fetchImpl` to short-circuit
 *      the real network call.
 *   3. Centralised request shape (multipart body, model name) so the route
 *      handler stays readable.
 *
 * Whisper accepts audio/webm; we forward the raw bytes the client uploaded.
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transcripts } from "../../db/schema";
import { log } from "../logger";

export const WHISPER_MODEL = "whisper-1";
export const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

/** Hard cap from the issue: clips longer than 30s are rejected. */
export const MAX_CLIP_DURATION_MS = 30_000;
/** Hard cap on raw bytes — 10MB is well past a 30s opus clip. */
export const MAX_CLIP_BYTES = 10 * 1024 * 1024;

export type WhisperResponse = { text: string };

export type TranscribeArgs = {
  audio: Blob;
  apiKey: string;
  /** Optional fetch impl override for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * Call OpenAI Whisper with one retry on 5xx. Throws on persistent failure.
 *
 * Returns the parsed JSON body, which for `response_format` defaulting to
 * `json` is just `{ text }`.
 */
export async function whisperTranscribe(args: TranscribeArgs): Promise<WhisperResponse> {
  const { audio, apiKey } = args;
  const fetchFn = args.fetchImpl ?? fetch;

  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new FormData();
    // Whisper requires a filename hint to pick the decoder.
    form.append("file", audio, "clip.webm");
    form.append("model", WHISPER_MODEL);
    form.append("response_format", "json");

    let response: Response;
    try {
      response = await fetchFn(WHISPER_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch (err) {
      // Network error: retry once.
      if (attempt === 0) continue;
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (response.ok) {
      return (await response.json()) as WhisperResponse;
    }

    if (response.status >= 500 && attempt === 0) {
      // 5xx: retry once.
      continue;
    }

    const body = await response.text();
    throw new Error(`Whisper ${response.status}: ${body.slice(0, 500)}`);
  }
  // Unreachable, but TypeScript can't see that.
  throw new Error("Whisper transcribe: unreachable");
}

export type InsertTranscriptArgs = {
  userId: number;
  drillId: number | null;
  audioKey: string;
  transcript: string;
  durationMs: number;
};

/**
 * Persist a transcript row. Returns the inserted row id.
 */
export async function insertTranscript(
  drz: DrizzleD1Database,
  args: InsertTranscriptArgs,
): Promise<number> {
  const rows = await drz
    .insert(transcripts)
    .values({
      userId: args.userId,
      drillId: args.drillId,
      audioKey: args.audioKey,
      transcript: args.transcript,
      durationMs: args.durationMs,
    })
    .returning({ id: transcripts.id });
  const id = rows[0]?.id;
  if (!id) throw new Error("insertTranscript: no row returned");
  log.info("stt transcribed", {
    audioKey: args.audioKey,
    durationMs: args.durationMs,
    charCount: args.transcript.length,
  });
  return id;
}
