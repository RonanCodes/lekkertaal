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
 *
 * Redesign (#214 / parent #203): visual reskin onto the shared foundation. The
 * mic becomes a chunky 3D affordance (`.speak-mic`, mirroring the `.btn-3d`
 * recipe), the target sentence sits in a tinted card, and the score / token
 * diff route through the `--color-good/-bad/-streak` feedback tokens so light
 * and dark inherit automatically. NONE of the STT pipeline, MediaRecorder
 * wiring, fetch calls, or scoring/XP logic changed — markup + classes only.
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
  const isBusy = phase === "uploading" || phase === "scoring";
  const micLabel =
    phase === "recording"
      ? `Stop (${recordingSeconds}s)`
      : phase === "uploading"
        ? "Uploading…"
        : phase === "scoring"
          ? "Scoring…"
          : "Record";

  return (
    <DrillFrame promptLabel="Speak in Dutch" prompt={prompt}>
      <div className="speak" data-testid="speak-drill">
        <div className="speak-target">
          <div className="speak-target__label">Target sentence</div>
          <div className="speak-target__row">
            <span className="speak-target__text" data-testid="speak-canonical">
              {canonical}
            </span>
            <Speaker text={canonical} size="sm" />
          </div>
        </div>

        {phase !== "done" && (
          <div className="speak-controls">
            {recordingSupported ? (
              <button
                type="button"
                onClick={phase === "recording" ? stopRecording : startRecording}
                disabled={isBusy}
                aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
                aria-pressed={phase === "recording"}
                data-testid="speak-record-btn"
                className={`speak-mic${phase === "recording" ? " speak-mic--recording" : ""}${
                  isBusy ? " speak-mic--busy" : ""
                }`}
              >
                <span className="speak-mic__icon" aria-hidden="true">
                  {phase === "recording" ? "■" : isBusy ? "…" : "🎤"}
                </span>
                <span className="speak-mic__label">{micLabel}</span>
              </button>
            ) : (
              <div className="speak-controls__unsupported">
                Recording unavailable in this browser. Upload a clip instead.
              </div>
            )}

            <label className="speak-upload" data-testid="speak-upload-label">
              Upload clip
              <input
                type="file"
                accept="audio/*"
                onChange={onFilePicked}
                className="speak-upload__input"
                data-testid="speak-upload-input"
                disabled={isBusy || phase === "recording"}
              />
            </label>
          </div>
        )}

        {errMsg && (
          <div
            className="speak-error"
            role="alert"
            data-testid="speak-error"
          >
            {errMsg}
          </div>
        )}

        {score && (
          <div
            className={`speak-result ${isPassed ? "speak-result--good" : "speak-result--near"}`}
            data-testid="speak-result"
          >
            <div className="speak-result__head">
              <div
                className={`speak-score ${isPassed ? "speak-score--good" : "speak-score--near"}`}
                data-testid="speak-score"
              >
                {score.score}
              </div>
              <div className="speak-result__caption">
                {isPassed ? "Nice pronunciation!" : `Aim for ${SPEAK_PASS_THRESHOLD}+`}
              </div>
            </div>
            <TokenDiffRow tokens={score.tokens} />
            {outcome && outcome.xpAwarded > 0 && (
              <div className="speak-xp" data-testid="speak-xp">
                +{outcome.xpAwarded} XP
              </div>
            )}
            {outcome && outcome.passed && outcome.alreadyAwarded && (
              <div className="speak-xp-already" data-testid="speak-xp-already">
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
            className="btn-3d btn-3d-ghost btn-3d-sm"
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
    return <div className="speak-tokens__empty">No tokens to compare.</div>;
  }
  return (
    <div className="speak-tokens" data-testid="speak-tokens">
      {tokens.map((t, i) => (
        <span
          key={`${t.word}-${i}`}
          data-status={t.status}
          title={t.spoken ? `you said: ${t.spoken}` : undefined}
          className={`speak-token speak-token--${t.status}`}
        >
          {t.word}
        </span>
      ))}
    </div>
  );
}
