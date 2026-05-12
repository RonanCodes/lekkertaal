import { useRef, useState } from "react";

/**
 * Speaker icon button. Plays Dutch text via the TTS API (US-029). For now the
 * endpoint may return 501 until US-029 lands — we degrade silently and just
 * show a brief disabled state instead of throwing.
 */
export function Speaker({
  text,
  voice = "default",
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

  const sizeClass = size === "sm" ? "h-7 w-7 text-sm" : size === "lg" ? "h-12 w-12 text-xl" : "h-9 w-9 text-base";

  const play = async () => {
    if (state === "playing") return;
    setState("loading");
    try {
      const url = `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
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

  return (
    <button
      type="button"
      onClick={play}
      disabled={state === "loading"}
      aria-label={ariaLabel ?? `Play audio for: ${text}`}
      className={`inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 transition-colors hover:bg-orange-200 disabled:opacity-50 ${sizeClass} ${className ?? ""}`}
    >
      {state === "playing" ? "▶" : state === "loading" ? "…" : "🔊"}
    </button>
  );
}
