import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

  return (
    <AppShell user={user}>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4">
        {/* Header */}
        <div className="border-b border-neutral-200 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-neutral-500">
                Roleplay · {scenario.npcName}
              </div>
              <h1 className="truncate text-lg font-semibold text-neutral-900">
                {scenario.titleNl}
              </h1>
            </div>
            <div className="text-xs text-neutral-500">
              Turn {Math.min(userTurnCount, MAX_USER_TURNS)} / {MAX_USER_TURNS}
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto py-4"
          aria-live="polite"
        >
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              role={m.role}
              text={extractText(m)}
              voiceId={scenario.npcVoiceId}
              onWordClick={(word) => {
                if (status === "submitted" || status === "streaming" || ended) return;
                void sendMessage({ text: `Wat betekent "${word}"?` });
              }}
            />
          ))}
          {(status === "submitted" || status === "streaming") && (
            <div className="text-xs text-neutral-400">{scenario.npcName} typt...</div>
          )}
        </div>

        {/* Composer + sticky end button */}
        <form
          onSubmit={onSubmit}
          className="sticky bottom-0 flex gap-2 border-t border-neutral-200 bg-white/95 py-3 backdrop-blur"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Typ in het Nederlands... (of "klaar" om te stoppen)'
            disabled={ended || status === "submitted" || status === "streaming"}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-neutral-100"
            autoFocus
          />
          <button
            type="submit"
            disabled={
              !draft.trim() || ended || status === "submitted" || status === "streaming"
            }
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Stuur
          </button>
          <button
            type="button"
            onClick={() => void endConversation()}
            disabled={ended}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Klaar
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function ChatBubble({
  role,
  text,
  voiceId,
  onWordClick,
}: {
  role: string;
  text: string;
  voiceId: string | null;
  onWordClick?: (word: string) => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-orange-600 text-white"
            : "bg-white text-neutral-900 ring-1 ring-neutral-200"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">
          {isUser || !onWordClick ? text : <ClickableDutchWords text={text} onWordClick={onWordClick} />}
        </p>
        {!isUser && text && (
          <SpeakButton text={text} voiceId={voiceId} />
        )}
      </div>
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

  async function speak() {
    if (playing) return;
    setPlaying(true);
    try {
      // The TTS proxy endpoint lives in US-029 (server-side ElevenLabs cache).
      // The route is server-side so it never leaks the ELEVENLABS_API_KEY.
      const url = `/api/tts?text=${encodeURIComponent(text)}${
        voiceId ? `&voice=${encodeURIComponent(voiceId)}` : ""
      }`;
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch (err) {
      console.error("[scenario] tts play failed:", err);
      setPlaying(false);
    }
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
