import { useRef, useState } from "react";
import { Loader2, Turtle, Volume2, VolumeX } from "lucide-react";

/**
 * Long-press threshold (ms) for the mobile slow-playback gesture. Held this
 * long before pointerup → fire slow playback and suppress the normal tap.
 */
const LONG_PRESS_MS = 500;

/**
 * Speaker icon button. Plays Dutch text via /api/tts (ElevenLabs primary,
 * OpenAI fallback). The TTS route picks its own default voice when none is
 * passed — don't send a literal "default" string here, ElevenLabs treats it
 * as a voice id and 400s.
 *
 * Slow-replay: a second small Turtle button sits next to the main control on
 * desktop (visible at `sm:` breakpoint and up). On touch devices the second
 * button is hidden; long-pressing the main button for `LONG_PRESS_MS` plays
 * the same cached audio at 0.5×. The same `<audio>` element is reused so the
 * R2 cache hit isn't re-issued.
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
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef<boolean>(false);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  // Last playback rate that was applied to the underlying <audio> element.
  // Surfaced on the wrapper as `data-last-playback-rate` so e2e tests can
  // assert the Turtle button actually set 0.5x without having to stub the
  // Audio constructor. Stored in React state so the DOM attribute survives
  // re-renders.
  const [lastRate, setLastRate] = useState<number | null>(null);

  const sizeClass =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;
  // Slow button is always one step smaller so it doesn't compete visually.
  const slowSizeClass = size === "lg" ? "h-9 w-9" : size === "md" ? "h-7 w-7" : "h-6 w-6";
  const slowIconSize = size === "lg" ? 16 : size === "md" ? 12 : 11;

  const play = async (rate = 1) => {
    if (state === "playing" || state === "loading") return;
    setState("loading");
    try {
      const params = new URLSearchParams({ text });
      if (voice) params.set("voice", voice);
      const url = `/api/tts?${params.toString()}`;
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      // Reset to last-played src only if it changed; setting src refetches in
      // some browsers, but the R2 cache + browser cache make this cheap and
      // the only way to reliably reset event handlers on retry.
      audio.src = url;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("error");
      audio.onplay = () => setState("playing");
      // playbackRate must be set BEFORE play() to take effect on the first
      // frame, otherwise Safari briefly plays full-speed and then snaps.
      audio.playbackRate = rate;
      setLastRate(rate);
      await audio.play();
    } catch {
      setState("error");
    }
  };

  const handlePointerDown = () => {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      longPressTimer.current = null;
      void play(0.5);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    // If long-press fired we already played slow; swallow the synthesised
    // click so the same press doesn't trigger normal playback too.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    void play(1);
  };

  const Icon = state === "loading" ? Loader2 : state === "error" ? VolumeX : Volume2;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className ?? ""}`}
      data-testid="speaker"
      data-state={state}
      data-last-playback-rate={lastRate === null ? undefined : String(lastRate)}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        disabled={state === "loading" || !text}
        aria-label={ariaLabel ?? `Play audio for: ${text}`}
        data-testid="speaker-play"
        data-state={state}
        className={`inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 transition-colors hover:bg-orange-200 disabled:opacity-50 ${sizeClass}`}
      >
        <Icon
          size={iconSize}
          className={state === "loading" ? "animate-spin" : undefined}
          aria-hidden
        />
      </button>
      <button
        type="button"
        onClick={() => void play(0.5)}
        disabled={state === "loading" || !text}
        aria-label="Play slowly"
        // Hidden on touch-only devices via `(pointer: coarse)`; touch users
        // get the long-press gesture on the main button instead. Tailwind
        // doesn't ship a coarse-pointer variant by default, so use `hidden`
        // + a media query escape hatch via arbitrary variant.
        className={`hidden items-center justify-center rounded-full bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50 [@media(pointer:fine)]:inline-flex ${slowSizeClass}`}
        data-testid="speaker-play-slow"
      >
        <Turtle size={slowIconSize} aria-hidden />
      </button>
    </span>
  );
}
