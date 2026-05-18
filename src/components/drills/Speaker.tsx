import { useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

/**
 * Speaker icon button. Plays Dutch text via /api/tts (ElevenLabs primary,
 * OpenAI fallback). The TTS route picks its own default voice when none is
 * passed — don't send a literal "default" string here, ElevenLabs treats it
 * as a voice id and 400s.
 */
export function Speaker({
  text,
  voice,
  className,
  size = "md",
  ariaLabel,
}: {
  text: string;
  voice?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  const sizeClass =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  const play = async () => {
    if (state === "playing" || state === "loading") return;
    setState("loading");
    try {
      const params = new URLSearchParams({ text });
      if (voice) params.set("voice", voice);
      const url = `/api/tts?${params.toString()}`;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      audioRef.current.onended = () => setState("idle");
      audioRef.current.onerror = () => setState("error");
      audioRef.current.onplay = () => setState("playing");
      await audioRef.current.play();
    } catch {
      setState("error");
    }
  };

  const Icon = state === "loading" ? Loader2 : state === "error" ? VolumeX : Volume2;

  return (
    <button
      type="button"
      onClick={play}
      disabled={state === "loading" || !text}
      aria-label={ariaLabel ?? `Play audio for: ${text}`}
      className={`inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 transition-colors hover:bg-orange-200 disabled:opacity-50 ${sizeClass} ${className ?? ""}`}
    >
      <Icon
        size={iconSize}
        className={state === "loading" ? "animate-spin" : undefined}
        aria-hidden
      />
    </button>
  );
}
