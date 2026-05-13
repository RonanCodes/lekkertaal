/**
 * Stroop — the Lekkertaal stroopwafel mascot.
 *
 * v0 ships an animated SVG mascot per the design-doc fallback ("If Rive
 * authoring is too slow tonight, fall back to a static SVG Stroop per
 * state"). Rive integration lands once the .riv asset is authored.
 *
 * States drive both the face and a subtle motion animation:
 *  - idle:      gentle bob
 *  - happy:     grin + spin
 *  - proud:     puffed-up scale pulse
 *  - concerned: side-tilt with worried brow
 *  - sleeping:  z-z-z snore drift
 */
import { motion } from "motion/react";

export type StroopState = "idle" | "happy" | "proud" | "concerned" | "sleeping";

const SIZE_PX: Record<NonNullable<StroopProps["size"]>, number> = {
  sm: 48,
  md: 96,
  lg: 160,
  xl: 240,
};

export type StroopProps = {
  state?: StroopState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

export function Stroop({ state = "idle", size = "md", className = "" }: StroopProps) {
  const px = SIZE_PX[size];
  const motionProps = stateMotion(state);

  return (
    <motion.div
      style={{ width: px, height: px }}
      className={`inline-block ${className}`}
      {...motionProps}
    >
      <StroopSvg state={state} />
    </motion.div>
  );
}

function stateMotion(state: StroopState) {
  switch (state) {
    case "happy":
      return {
        initial: { rotate: -10, scale: 0.85 },
        animate: { rotate: [0, 8, -8, 0], scale: 1 },
        transition: { duration: 0.6, repeat: Infinity, repeatType: "loop" as const },
      };
    case "proud":
      return {
        initial: { scale: 0.95 },
        animate: { scale: [1, 1.08, 1] },
        transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
      };
    case "concerned":
      return {
        initial: { rotate: 0 },
        animate: { rotate: [-4, 4, -4] },
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
      };
    case "sleeping":
      return {
        initial: { y: 0 },
        animate: { y: [0, -3, 0] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
      };
    case "idle":
    default:
      return {
        initial: { y: 0 },
        animate: { y: [0, -4, 0] },
        transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
      };
  }
}

function StroopSvg({ state }: { state: StroopState }) {
  // Stroopwafel base: two concentric circles with a waffle grid + caramel
  // ring. Face overlays per state.
  const browTransform =
    state === "concerned" ? "rotate(-12deg)" : state === "proud" ? "rotate(0)" : "rotate(0)";
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stroop mascot">
      <defs>
        <radialGradient id="stroopBody" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f8d49a" />
          <stop offset="1" stopColor="#b87333" />
        </radialGradient>
        <linearGradient id="stroopCaramel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a05a18" />
          <stop offset="1" stopColor="#6b3d10" />
        </linearGradient>
        <pattern
          id="waffleGrid"
          x="0"
          y="0"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <rect width="14" height="14" fill="transparent" />
          <path d="M0 0 L14 0 M0 0 L0 14" stroke="#8b5a2b" strokeWidth="1.2" opacity="0.55" />
        </pattern>
      </defs>

      {/* Outer waffle (top) */}
      <circle cx="100" cy="100" r="88" fill="url(#stroopBody)" />
      <circle cx="100" cy="100" r="86" fill="url(#waffleGrid)" />

      {/* Caramel center band */}
      <ellipse cx="100" cy="100" rx="78" ry="10" fill="url(#stroopCaramel)" opacity="0.85" />

      {/* Eyes */}
      <g>
        {state === "sleeping" ? (
          <>
            <path d="M62 86 Q72 80 82 86" stroke="#3a1f0a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M118 86 Q128 80 138 86" stroke="#3a1f0a" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* z's */}
            <text x="140" y="60" fill="#3a1f0a" fontSize="22" fontFamily="system-ui">z</text>
            <text x="150" y="45" fill="#3a1f0a" fontSize="18" fontFamily="system-ui">z</text>
          </>
        ) : (
          <>
            <circle cx="72" cy="86" r={state === "happy" ? 4 : 6} fill="#3a1f0a" />
            <circle cx="128" cy="86" r={state === "happy" ? 4 : 6} fill="#3a1f0a" />
            {/* sparkle for proud */}
            {state === "proud" && (
              <>
                <circle cx="69" cy="83" r="1.5" fill="#fff" />
                <circle cx="125" cy="83" r="1.5" fill="#fff" />
              </>
            )}
          </>
        )}
      </g>

      {/* Eyebrows (concerned shows worry) */}
      {state === "concerned" && (
        <g style={{ transform: browTransform, transformOrigin: "100px 70px" }}>
          <path d="M60 72 L84 76" stroke="#3a1f0a" strokeWidth="3" strokeLinecap="round" />
          <path d="M116 76 L140 72" stroke="#3a1f0a" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {/* Mouth */}
      {state === "happy" || state === "proud" ? (
        <path d="M70 122 Q100 148 130 122" stroke="#3a1f0a" strokeWidth="4" fill="#3a1f0a" strokeLinecap="round" />
      ) : state === "concerned" ? (
        <path d="M76 130 Q100 118 124 130" stroke="#3a1f0a" strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : state === "sleeping" ? (
        <ellipse cx="100" cy="128" rx="10" ry="4" fill="#3a1f0a" opacity="0.6" />
      ) : (
        <path d="M84 124 Q100 134 116 124" stroke="#3a1f0a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}

      {/* Cheek blushes for happy/proud */}
      {(state === "happy" || state === "proud") && (
        <>
          <ellipse cx="62" cy="112" rx="8" ry="5" fill="#f06292" opacity="0.5" />
          <ellipse cx="138" cy="112" rx="8" ry="5" fill="#f06292" opacity="0.5" />
        </>
      )}
    </svg>
  );
}
