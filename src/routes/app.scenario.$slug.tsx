import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport  } from "ai";
import type {UIMessage} from "ai";
import {
  getScenario,
  getRoleplayHistory,
  finishRoleplaySession,
  gradeRoleplaySession

} from "../lib/server/roleplay";
import type {RoleplayTranscriptEntry} from "../lib/server/roleplay";
import { AppShell } from "../components/AppShell";
import { Info, Mic, Square } from "lucide-react";
import { Button } from "../components/ui/button";
import { log } from "../lib/logger";
import { UNAVAILABLE_TOOLTIP } from "../components/drills/Speaker";

const MAX_USER_TURNS = 8;
const END_KEYWORDS = ["klaar", "done", "einde"];

export const Route = createFileRoute("/app/scenario/$slug")({
  loader: async ({ params }) => {
    try {
      const scenarioPayload = await getScenario({ data: { slug: params.slug } });
      // AI-SDK-2: hydrate the chat from the server-persisted message history
      // so a page refresh mid-conversation puts the learner back on the turn
      // they left.
      const history = await getRoleplayHistory({
        data: { scenarioId: scenarioPayload.scenario.id },
      });
      return { ...scenarioPayload, history };
    } catch (err) {
      if (err instanceof Error && err.message === "Scenario not found") throw notFound();
      throw err;
    }
  },
  component: ScenarioChatPage,
});

function ScenarioChatPage() {
  const { user, scenario, history } = Route.useLoaderData();
  const navigate = useNavigate();
  // sessionId is supplied by the loader; the streaming endpoint also
  // accepts it via the chat `id` so the server never has to guess.
  const [sessionId] = useState<number>(history.sessionId);
  const [ended, setEnded] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Seed messages. If the server has any persisted turns, use those (so a
  // refresh mid-conversation resumes the transcript intact). Otherwise
  // fall back to the NPC's scripted opening line.
  const initialMessages = useMemo<UIMessage[]>(() => {
    if (history.messages.length > 0) return history.messages;
    return [
      {
        id: "opening",
        role: "assistant",
        parts: [{ type: "text", text: scenario.openingNl }],
      },
    ];
  }, [history.messages, scenario.openingNl]);

  const { messages, sendMessage, status } = useChat({
    id: String(sessionId),
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/roleplay/${scenario.slug}/stream`,
      // v6 persistence pattern: send only the latest user turn + the
      // chat id; server owns the full history and reloads from D1.
      prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
        body: {
          id: Number(id),
          messages: [messages[messages.length - 1]],
          trigger,
          messageId,
        },
      }),
    }),
  });

  // Count of user turns sent — drives auto-end at 8.
  const userTurnCount = messages.filter((m) => m.role === "user").length;

  // Mid-conversation corrections keyed by the learner message they tweak.
  const correctionMap = useMemo(() => buildCorrectionMap(messages), [messages]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, status]);

  async function endConversation() {
    if (!sessionId || ended) return;
    setEnded(true);
    const transcript: RoleplayTranscriptEntry[] = messages.map((m) => ({
      role: m.role,
      content: extractText(m),
      ts: new Date().toISOString(),
    }));
    try {
      await finishRoleplaySession({ data: { sessionId, transcript } });
      // Fire-and-await grading so the scorecard is ready by the time we land.
      // gradeRoleplaySession is idempotent on already-graded sessions.
      await gradeRoleplaySession({ data: { sessionId } });
    } catch (err) {
      console.error("[scenario] finish/grade failed:", err);
    }
    navigate({ to: "/app/scenario/$slug/scorecard", params: { slug: scenario.slug } });
  }

  // Trigger auto-end once the user crosses the turn budget.
  useEffect(() => {
    if (!ended && sessionId && userTurnCount >= MAX_USER_TURNS) {
      void endConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTurnCount, sessionId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || status === "submitted" || status === "streaming" || ended) return;
    setDraft("");

    if (END_KEYWORDS.includes(trimmed.toLowerCase())) {
      void endConversation();
      return;
    }
    void sendMessage({ text: trimmed });
  }

  const busy = status === "submitted" || status === "streaming";
  // Kroket-frame state: surprised while a turn streams in, idle otherwise.
  const kroketFrame = busy ? "surprised" : "idle";
  const objectives = scenario.successCriteria;
  const mustUse = scenario.mustUseVocab;

  // ---- Mic → STT → input draft -------------------------------------------
  // Reuses SpeakDrill's MediaRecorder + /api/stt/transcribe pattern, but the
  // transcript drops into the composer draft (no scoring) so the learner can
  // review or tweak the words before sending. drillId is omitted on transcribe
  // (the endpoint accepts a null drillId for free-speak contexts like this).
  const [micPhase, setMicPhase] = useState<
    "idle" | "recording" | "transcribing" | "error"
  >("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const micSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function",
    [],
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const transcribeClip = useCallback(async (blob: Blob, durationMs: number) => {
    setMicPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      form.append("durationMs", String(durationMs));
      const r = await fetch("/api/stt/transcribe", { method: "POST", body: form });
      if (!r.ok) throw new Error(`transcribe ${r.status}`);
      const { transcript } = (await r.json()) as { transcript: string };
      const clean = transcript.trim();
      if (clean) {
        // Append to whatever the learner has already typed.
        setDraft((d) => (d.trim() ? `${d.trim()} ${clean}` : clean));
      }
      setMicPhase("idle");
    } catch (err) {
      log.warn("scenario stt transcribe failed", { err: String(err) });
      setMicPhase("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (micPhase === "recording" || micPhase === "transcribing") return;
    setMicPhase("idle");
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
        const recordedBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationMs = Math.max(1, Date.now() - startedAtRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void transcribeClip(recordedBlob, durationMs);
      });
      startedAtRef.current = Date.now();
      rec.start();
      setMicPhase("recording");
    } catch (err) {
      log.warn("scenario mic getUserMedia denied", { err: String(err) });
      setMicPhase("error");
    }
  }, [micPhase, transcribeClip]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const onMicClick = useCallback(() => {
    if (micPhase === "recording") stopRecording();
    else void startRecording();
  }, [micPhase, startRecording, stopRecording]);

  return (
    <AppShell user={user}>
      <div className="roleplay-scene mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4">
        {/* Scene header: dark bakkerij gradient with Kroket companion + NPC
            + objectives + turn meter (matches ScreenRoleplay's dark scene). */}
        <header className="roleplay-header roleplay-header--dark">
          <div className="flex items-center gap-3">
            <img
              src={`/mascot/treats/kroket/${kroketFrame}.png`}
              alt=""
              aria-hidden
              className={`roleplay-companion h-12 w-12 shrink-0 ${
                busy ? "anim-surprised-pop" : "anim-idle-bob"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="roleplay-header-eyebrow truncate text-xs font-semibold uppercase tracking-wide">
                Roleplay met {scenario.npcName}
              </div>
              <h1 className="roleplay-header-title truncate text-lg font-bold">
                {scenario.titleNl}
              </h1>
            </div>
            <div className="roleplay-turn-meter" aria-label={`Turn ${Math.min(userTurnCount, MAX_USER_TURNS)} of ${MAX_USER_TURNS}`}>
              <span className="roleplay-turn-count">
                {Math.min(userTurnCount, MAX_USER_TURNS)}
              </span>
              <span className="roleplay-turn-total">/ {MAX_USER_TURNS}</span>
            </div>
          </div>

          {(objectives.length > 0 || mustUse.length > 0) && (
            <div className="roleplay-objectives" aria-label="Scene objectives">
              {objectives.slice(0, 3).map((o, i) => (
                <span key={`obj-${i}`} className="roleplay-objective-chip">
                  🎯 {o}
                </span>
              ))}
              {mustUse.slice(0, 4).map((w, i) => (
                <span key={`vocab-${i}`} className="roleplay-vocab-chip">
                  {w}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="roleplay-transcript flex-1 space-y-3 overflow-y-auto py-4"
          aria-live="polite"
        >
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role}
              text={extractText(m)}
              npcName={scenario.npcName}
              voiceId={scenario.npcVoiceId}
              corrections={correctionMap.get(m.id)}
              onWordClick={(word) => {
                if (busy || ended) return;
                void sendMessage({ text: `Wat betekent "${word}"?` });
              }}
            />
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="roleplay-typing" aria-label={`${scenario.npcName} typt`}>
                <span className="roleplay-typing-name">{scenario.npcName}</span>
                <span className="roleplay-typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Composer + sticky end button */}
        <form
          onSubmit={onSubmit}
          className="roleplay-composer sticky bottom-0 flex items-center gap-2 bg-white/95 py-3 backdrop-blur"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Typ in het Nederlands... (of "klaar" om te stoppen)'
            disabled={ended || busy}
            className="roleplay-input flex-1 disabled:opacity-60"
            autoFocus
          />
          {micSupported && (
            <button
              type="button"
              onClick={onMicClick}
              disabled={ended || busy || micPhase === "transcribing"}
              aria-label={
                micPhase === "recording" ? "Stop opname" : "Spreek je antwoord in"
              }
              aria-pressed={micPhase === "recording"}
              data-testid="roleplay-mic"
              className={`roleplay-mic${
                micPhase === "recording" ? " roleplay-mic--recording" : ""
              }${micPhase === "transcribing" ? " roleplay-mic--busy" : ""}`}
            >
              {micPhase === "recording" ? (
                <Square size={18} fill="currentColor" aria-hidden />
              ) : micPhase === "transcribing" ? (
                <span className="roleplay-mic-spinner" aria-hidden />
              ) : (
                <Mic size={20} aria-hidden />
              )}
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!draft.trim() || ended || busy}
          >
            Stuur
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void endConversation()}
            disabled={ended}
          >
            Klaar
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

function ChatBubble({
  role,
  text,
  npcName,
  voiceId,
  corrections,
  onWordClick,
}: {
  role: string;
  text: string;
  npcName: string;
  voiceId: string | null;
  corrections?: InlineCorrection[];
  onWordClick?: (word: string) => void;
}) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="roleplay-bubble roleplay-bubble--user max-w-[80%]">
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
        {corrections?.map((c, i) => (
          <CorrectionCard key={`${c.incorrect}-${i}`} correction={c} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2">
      <img
        src="/mascot/treats/kroket/idle.png"
        alt={`${npcName} avatar`}
        className="roleplay-bubble-avatar"
      />
      <div className="roleplay-bubble roleplay-bubble--npc max-w-[80%]">
        <p className="whitespace-pre-wrap leading-relaxed">
          {onWordClick ? <ClickableDutchWords text={text} onWordClick={onWordClick} /> : text}
        </p>
        {text && <SpeakButton text={text} voiceId={voiceId} />}
      </div>
    </div>
  );
}

/**
 * Inline "Tiny tweak" correction card, rendered under the learner bubble it
 * tweaks. Mirrors `ScreenRoleplay`'s `MsgMe` correction: strike the original,
 * show the fix in display weight, then a short English note. Colours come from
 * the amber-banner tokens so light + dark inherit automatically.
 */
function CorrectionCard({ correction }: { correction: InlineCorrection }) {
  return (
    <div className="roleplay-correction max-w-[80%]" data-testid="roleplay-correction">
      <div className="roleplay-correction-eyebrow">Tiny tweak</div>
      <div className="roleplay-correction-body">
        <s className="roleplay-correction-original">{correction.incorrect}</s>
        <div className="roleplay-correction-fixed">{correction.correction}</div>
      </div>
      {correction.explanationEn && (
        <div className="roleplay-correction-note">{correction.explanationEn}</div>
      )}
    </div>
  );
}

/**
 * Render an assistant message with each Dutch word as a click affordance.
 * Clicking a word fires a user message that asks the NPC for the meaning,
 * which Claude resolves by calling the `lookupVocab` tool server-side.
 *
 * Splitting strategy: walk a regex over the text and rebuild as a mix of
 * <span> and <button> nodes. Whitespace and punctuation pass through as
 * plain text so the original spacing stays intact.
 */
function ClickableDutchWords({
  text,
  onWordClick,
}: {
  text: string;
  onWordClick: (word: string) => void;
}) {
  // Words: any run of letters (incl. Dutch diacritics) plus optional inner
  // apostrophes. Everything else is treated as a separator.
  const tokens = text.split(/([A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)?)/);
  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok) return null;
        const isWord = /^[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)?$/.test(tok);
        if (!isWord) return <span key={i}>{tok}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onWordClick(tok)}
            className="cursor-pointer underline decoration-dotted decoration-neutral-300 underline-offset-2 hover:bg-orange-50 hover:decoration-orange-400 focus:bg-orange-50 focus:outline-none focus:ring-1 focus:ring-orange-300"
            aria-label={`Look up "${tok}"`}
          >
            {tok}
          </button>
        );
      })}
    </>
  );
}

function SpeakButton({ text, voiceId }: { text: string; voiceId: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(!voiceId);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  async function speak() {
    if (playing || unavailable) return;
    setPlaying(true);
    try {
      // The TTS proxy endpoint lives in US-029 (server-side ElevenLabs cache).
      // The route is server-side so it never leaks the ELEVENLABS_API_KEY.
      const url = `/api/tts?text=${encodeURIComponent(text)}${
        voiceId ? `&voice=${encodeURIComponent(voiceId)}` : ""
      }`;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        log.warn("scenario tts audio load failed", { text, voiceId });
        setPlaying(false);
        setUnavailable(true);
      };
      await audio.play();
    } catch (err) {
      log.warn("scenario tts play() threw", { text, voiceId, err: String(err) });
      setPlaying(false);
      setUnavailable(true);
    }
  }

  if (unavailable) {
    return (
      <span className="relative mt-1 inline-flex items-center">
        <button
          type="button"
          onClick={() => setTooltipOpen((v) => !v)}
          aria-label={UNAVAILABLE_TOOLTIP}
          aria-describedby="scenario-speaker-unavailable-tooltip"
          data-testid="scenario-speaker-unavailable"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-500"
        >
          <Info size={13} aria-hidden />
          <span>geen audio</span>
        </button>
        <span
          id="scenario-speaker-unavailable-tooltip"
          role="tooltip"
          data-testid="scenario-speaker-unavailable-tooltip"
          className={`pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-1 text-xs text-white transition-opacity ${
            tooltipOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          {UNAVAILABLE_TOOLTIP}
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={speak}
      className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-orange-600"
      aria-label="Hoor uitspraak"
    >
      <span>{playing ? "🔈" : "🔊"}</span>
      <span className="underline-offset-2 hover:underline">hoor</span>
    </button>
  );
}

/**
 * An inline "Tiny tweak" correction surfaced mid-conversation. The roleplay
 * model emits these silently via the `flagSuspectedError` tool — the tool part
 * rides along on the assistant message that answers a learner turn. We pull
 * them out here so the transcript can render a correction card under the
 * learner's own bubble, matching `ScreenRoleplay`'s `MsgMe` correction shape.
 */
export type InlineCorrection = {
  category: string;
  incorrect: string;
  correction: string;
  explanationEn?: string;
};

/**
 * Pull `flagSuspectedError` tool inputs out of an assistant message's parts.
 * AI SDK v6 names the part `tool-<toolName>` and carries the model's args on
 * `input`. We read defensively because the part is also persisted to D1 and
 * round-tripped through JSON, so the runtime shape is `unknown`-ish.
 */
export function extractCorrections(m: UIMessage): InlineCorrection[] {
  const parts = (m.parts ?? []) as Array<{ type?: string; input?: unknown }>;
  const out: InlineCorrection[] = [];
  for (const p of parts) {
    if (p?.type !== "tool-flagSuspectedError") continue;
    const input = p.input as Partial<InlineCorrection> | undefined;
    if (!input?.incorrect || !input?.correction) continue;
    out.push({
      category: String(input.category ?? "grammar"),
      incorrect: String(input.incorrect),
      correction: String(input.correction),
      explanationEn: input.explanationEn ? String(input.explanationEn) : undefined,
    });
  }
  return out;
}

/**
 * Map each user message id to the corrections the model flagged in response.
 * A learner turn is corrected by the assistant turn that immediately follows
 * it, so we attach any corrections on assistant message N+1 to user message N.
 */
export function buildCorrectionMap(
  messages: UIMessage[],
): Map<string, InlineCorrection[]> {
  const map = new Map<string, InlineCorrection[]>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const next = messages[i + 1];
    if (next && next.role === "assistant") {
      const corrections = extractCorrections(next);
      if (corrections.length > 0) map.set(m.id, corrections);
    }
  }
  return map;
}

function extractText(m: UIMessage): string {
  // UIMessage in AI SDK v6 has a parts[] array of typed entries.
  // We only render text parts; other parts (tool, file) get filtered out.
  return (
    m.parts
      ?.filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("") ?? ""
  );
}
