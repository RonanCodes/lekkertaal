import { useEffect, useMemo, useRef, useState } from "react";
import { DrillFrame } from "./DrillFrame";
import { Speaker } from "./Speaker";
import { parseField } from "./DrillRenderer";
import type { DrillProps } from "./DrillRenderer";

/**
 * Speak drill (P2-STT-3 #56).
 *
 * Flow:
 *   1. Render the canonical Dutch sentence with a Speaker button so the
 *      learner can hear it first.
 *   2. Tap the microphone to start MediaRecorder (webm/opus). Tap again to
 *      stop; the recorded blob is posted to /api/stt/transcribe.
 *   3. The returned transcript is sent to /api/stt/score for token-level
 *      diff scoring.
 *   4. Result is sent to /api/stt/speak-complete which records the attempt
 *      and awards XP on the first pass (>=80).
 *   5. UI renders a coloured token diff (green=match, red=wrong, grey=missing,
 *      amber=extra) and an XP-earned banner.
 *
 * Falls back to a file-upload button when MediaRecorder is unavailable (older
 * Safari, iOS PWAs in some configurations, headless test browsers without
 * fake media).
 *
 * The drill exposes a small set of data-testid hooks so Playwright can drive
 * the upload path without permission-granting a real microphone.
 */
export type SpeakTokenDiff = {
  word: string;
  status: "match" | "wrong" | "missing" | "extra";
  spoken?: string;
};

type ScoreResult = {
  score: number;
  tokens: SpeakTokenDiff[];
};

type TranscribeResult = {
  transcript: string;
  audioKey: string;
  durationMs: number;
};

type CompleteResult = {
  passed: boolean;
  xpAwarded: number;
  alreadyAwarded: boolean;
};

/** Score threshold above which a speak drill counts as a pass. */
export const SPEAK_PASS_THRESHOLD = 80;

function isRecordingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export function SpeakDrill({ drill, onSubmit }: DrillProps) {
  const canonical = useMemo<string>(() => {
    const raw = parseField<unknown>(drill.answer);
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return "";
  }, [drill.answer]);

  const prompt = drill.promptEn ?? "Say the sentence below in Dutch";

  const [phase, setPhase] = useState<
    "idle" | "recording" | "uploading" | "scoring" | "done" | "error"
  >("idle");
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [outcome, setOutcome] = useState<CompleteResult | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const recordingSupported = useMemo(isRecordingSupported, []);

  // Clean up any live stream + timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      timerRef.current && window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const reportSubmit = (result: ScoreResult) => {
    // Lesson player consumes this. Pass-threshold gates XP / progress.
    onSubmit(result.score >= SPEAK_PASS_THRESHOLD, drill.slug);
  };

  const scoreAndComplete = async (blob: Blob, durationMs: number) => {
    setPhase("uploading");
    setErrMsg(null);

    let transcribe: TranscribeResult;
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      form.append("durationMs", String(durationMs));
      form.append("drillId", String(drill.id));
      const r = await fetch("/api/stt/transcribe", { method: "POST", body: form });
      if (!r.ok) throw new Error(`transcribe ${r.status}`);
      transcribe = (await r.json()) as TranscribeResult;
    } catch (err) {
      setErrMsg("Could not transcribe the clip. Try again.");
      setPhase("error");
      return;
    }

    setPhase("scoring");
    let scoring: ScoreResult;
    try {
      const r = await fetch("/api/stt/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          drillId: drill.id,
          transcript: transcribe.transcript,
        }),
      });
      if (!r.ok) throw new Error(`score ${r.status}`);
      scoring = (await r.json()) as ScoreResult;
    } catch (err) {
      setErrMsg("Could not score the clip. Try again.");
      setPhase("error");
      return;
    }

    setScore(scoring);

    // Record + award XP (fire-and-forget for UI; show banner once it returns).
    try {
      const r = await fetch("/api/stt/speak-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          drillId: drill.id,
          score: scoring.score,
          transcript: transcribe.transcript,
          audioKey: transcribe.audioKey,
        }),
      });
      if (r.ok) {
        setOutcome((await r.json()) as CompleteResult);
      }
    } catch {
      // Non-fatal; the score still renders.
    }

    setPhase("done");
    reportSubmit(scoring);
  };

  const startRecording = async () => {
    if (phase !== "idle" && phase !== "error") return;
    setErrMsg(null);
    setScore(null);
    setOutcome(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = rec;

      rec.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      rec.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationMs = Date.now() - startedAtRef.current;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        void scoreAndComplete(blob, durationMs);
      });

      startedAtRef.current = Date.now();
      setRecordingMs(0);
      timerRef.current = window.setInterval(() => {
        setRecordingMs(Date.now() - startedAtRef.current);
      }, 200);

      rec.start();
      setPhase("recording");
    } catch (err) {
      setErrMsg("Microphone access denied. Use the upload button instead.");
      setPhase("error");
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // We can't reliably know duration of an uploaded clip without decoding;
    // pass a conservative non-zero placeholder so the server-side validation
    // (>0, <30s) passes. The score endpoint cares only about the transcript.
    const durationMs = Math.max(1000, Math.min(file.size / 16, 25_000));
    setPhase("uploading");
    void scoreAndComplete(file, durationMs);
  };

  const resetForRetry = () => {
    setPhase("idle");
    setScore(null);
    setOutcome(null);
    setErrMsg(null);
    setRecordingMs(0);
  };

  const recordingSeconds = (recordingMs / 1000).toFixed(1);
  const isPassed = score !== null && score.score >= SPEAK_PASS_THRESHOLD;

  return (
    <DrillFrame promptLabel="Speak in Dutch" prompt={prompt}>
      <div className="space-y-4" data-testid="speak-drill">
        <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
            Target sentence
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold" data-testid="speak-canonical">
              {canonical}
            </span>
            <Speaker text={canonical} size="sm" />
          </div>
        </div>

        {phase !== "done" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {recordingSupported ? (
              <button
                type="button"
                onClick={phase === "recording" ? stopRecording : startRecording}
                disabled={phase === "uploading" || phase === "scoring"}
                aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
                data-testid="speak-record-btn"
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                  phase === "recording"
                    ? "animate-pulse bg-rose-500 hover:bg-rose-600"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                <span aria-hidden="true">{phase === "recording" ? "■" : "●"}</span>
                {phase === "recording"
                  ? `Stop (${recordingSeconds}s)`
                  : phase === "uploading"
                    ? "Uploading…"
                    : phase === "scoring"
                      ? "Scoring…"
                      : "Record"}
              </button>
            ) : (
              <div className="text-xs text-neutral-500">
                Recording unavailable in this browser. Upload a clip instead.
              </div>
            )}

            <label
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              data-testid="speak-upload-label"
            >
              Upload clip
              <input
                type="file"
                accept="audio/*"
                onChange={onFilePicked}
                className="hidden"
                data-testid="speak-upload-input"
                disabled={phase === "uploading" || phase === "scoring" || phase === "recording"}
              />
            </label>
          </div>
        )}

        {errMsg && (
          <div
            className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"
            role="alert"
            data-testid="speak-error"
          >
            {errMsg}
          </div>
        )}

        {score && (
          <div
            className={`rounded-2xl border-2 p-3 text-sm ${
              isPassed
                ? "border-emerald-300 bg-emerald-50"
                : "border-amber-300 bg-amber-50"
            }`}
            data-testid="speak-result"
          >
            <div className="mb-2 flex items-baseline gap-3">
              <div
                className={`text-2xl font-bold ${
                  isPassed ? "text-emerald-700" : "text-amber-800"
                }`}
                data-testid="speak-score"
              >
                {score.score}
              </div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                {isPassed ? "Nice pronunciation!" : `Aim for ${SPEAK_PASS_THRESHOLD}+`}
              </div>
            </div>
            <TokenDiffRow tokens={score.tokens} />
            {outcome && outcome.xpAwarded > 0 && (
              <div
                className="mt-2 text-xs font-semibold text-emerald-700"
                data-testid="speak-xp"
              >
                +{outcome.xpAwarded} XP
              </div>
            )}
            {outcome && outcome.passed && outcome.alreadyAwarded && (
              <div
                className="mt-2 text-xs text-neutral-500"
                data-testid="speak-xp-already"
              >
                XP already awarded earlier; this counts as practice.
              </div>
            )}
          </div>
        )}

        {phase === "done" && !isPassed && (
          <button
            type="button"
            onClick={resetForRetry}
            data-testid="speak-retry"
            className="rounded-full border border-orange-300 bg-white px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50"
          >
            Try again
          </button>
        )}
      </div>
    </DrillFrame>
  );
}

function TokenDiffRow({ tokens }: { tokens: SpeakTokenDiff[] }) {
  if (tokens.length === 0) {
    return <div className="text-xs text-neutral-500">No tokens to compare.</div>;
  }
  return (
    <div
      className="flex flex-wrap gap-1 text-sm font-medium"
      data-testid="speak-tokens"
    >
      {tokens.map((t, i) => (
        <span
          key={`${t.word}-${i}`}
          data-status={t.status}
          title={t.spoken ? `you said: ${t.spoken}` : undefined}
          className={
            t.status === "match"
              ? "rounded-md bg-emerald-200 px-2 py-1 text-emerald-900"
              : t.status === "wrong"
                ? "rounded-md bg-rose-200 px-2 py-1 text-rose-900 line-through decoration-rose-500"
                : t.status === "missing"
                  ? "rounded-md bg-neutral-200 px-2 py-1 text-neutral-500"
                  : "rounded-md bg-amber-200 px-2 py-1 text-amber-900"
          }
        >
          {t.word}
        </span>
      ))}
    </div>
  );
}
