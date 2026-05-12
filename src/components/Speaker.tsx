import { useRef, useState } from "react";

/**
 * Tap-to-play speaker icon for any Dutch text in the UI.
 *
 *   <Speaker text="Hoi! Welkom." voiceId="21m00Tcm4TlvDq8ikWAM" />
 *
 * Calls /api/tts behind the scenes — that route handles R2 caching and the
 * ElevenLabs→OpenAI fallback. We prefetch on hover so the audio is warm by
 * the time the user taps.
 */
export function Speaker({
  text,
  voiceId,
  size = "md",
  className = "",
}: {
  text: string;
  voiceId?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const url = buildTtsUrl(text, voiceId);

  function prefetch() {
    if (audioRef.current) return;
    // Trigger a HEAD-ish warm-up by loading metadata only.
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    audioRef.current = a;
  }

  async function play() {
    if (state === "loading" || state === "playing") return;
    setState("loading");
    try {
      const a = audioRef.current ?? new Audio(url);
      audioRef.current = a;
      a.onended = () => setState("idle");
      a.onerror = () => setState("error");
      a.onplaying = () => setState("playing");
      await a.play();
    } catch (err) {
      console.error("[Speaker] play failed:", err);
      setState("error");
    }
  }

  const sizeCls = size === "sm" ? "text-xs" : "text-sm";
  const emoji =
    state === "playing"
      ? "🔈"
      : state === "loading"
        ? "⏳"
        : state === "error"
          ? "🔇"
          : "🔊";

  return (
    <button
      type="button"
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      onClick={play}
      disabled={!text}
      className={`inline-flex items-center gap-1 text-neutral-500 hover:text-orange-600 ${sizeCls} ${className}`}
      aria-label="Hoor uitspraak"
    >
      <span aria-hidden>{emoji}</span>
    </button>
  );
}

function buildTtsUrl(text: string, voiceId?: string | null): string {
  const params = new URLSearchParams({ text });
  if (voiceId) params.set("voice", voiceId);
  return `/api/tts?${params.toString()}`;
}
