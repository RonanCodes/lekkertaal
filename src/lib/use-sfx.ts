/**
 * Tiny SFX hook that plays short hero audio cues with a per-user mute toggle.
 *
 * Asset files live at public/sfx/{name}.mp3 and are generated externally
 * (operator runs /ro:sfx-elevenlabs once and commits the files). If a file
 * is missing the hook silently no-ops so the UI doesn't break.
 *
 * Defaults: enabled on desktop, disabled on mobile (data + autoplay-policy
 * friendliness). The user's persisted preference overrides the default.
 */
import { useCallback, useMemo, useRef } from "react";

export type SfxName = "correct" | "wrong" | "lesson-complete" | "streak-fire";

const SFX_PATHS: Record<SfxName, string> = {
  correct: "/sfx/correct-ding.mp3",
  wrong: "/sfx/wrong-buzz.mp3",
  "lesson-complete": "/sfx/lesson-complete-fanfare.mp3",
  "streak-fire": "/sfx/streak-fire-whoosh.mp3",
};

function isMobileLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent ?? "");
}

export function useSfx(userPref?: boolean | null) {
  const cache = useRef<Partial<Record<SfxName, HTMLAudioElement>>>({});

  // userPref takes precedence; else fall back to "on desktop, off mobile".
  const enabled = useMemo(() => {
    if (userPref === false) return false;
    if (userPref === true) return true;
    return !isMobileLike();
  }, [userPref]);

  const play = useCallback(
    (name: SfxName) => {
      if (!enabled || typeof Audio === "undefined") return;
      try {
        let a = cache.current[name];
        if (!a) {
          a = new Audio(SFX_PATHS[name]);
          a.preload = "auto";
          cache.current[name] = a;
        }
        a.currentTime = 0;
        // play() returns a promise that can reject due to autoplay-policy or
        // missing-file errors; we just swallow those.
        void a.play().catch(() => {});
      } catch {
        // Swallow — missing asset shouldn't break the UI.
      }
    },
    [enabled],
  );

  return { play, enabled };
}
