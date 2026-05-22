import type { ReactElement } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAuth } from "@clerk/tanstack-react-start";
import { tryGetUserClerkId } from "../lib/server/auth-helper";

/**
 * Server-only auth probe used by the landing loader. Wrapped in
 * `createServerFn` so the server-only helper (and its `entry.server`
 * dependency) never reaches the client bundle.
 */
const probeAuth = createServerFn({ method: "GET" }).handler(async () => {
  return { signedIn: (await tryGetUserClerkId()) !== null };
});

export const Route = createFileRoute("/")({
  /**
   * Server-side auth probe. If the visitor has a real Clerk session OR the
   * dev/e2e bypass is active, skip the landing and forward straight to the
   * app. Signed-out visitors fall through to render `<Home>`.
   *
   * `LandingCtas` below still client-side-detects auth as a fallback for
   * the rare case where the server-side check missed (slow Clerk hydration,
   * loader re-run after sign-in without a fresh navigation, etc.).
   */
  loader: async () => {
    const { signedIn } = await probeAuth();
    if (signedIn) {
      throw redirect({ to: "/app/path" });
    }
    return null;
  },
  component: Home,
});

/**
 * Feature tag colour → soft background + readable foreground.
 * Mirrors the redesign's FeatureRow tag pills (orange / blue / pink).
 */
const FEATURE_COLORS = {
  orange: { bg: "var(--color-brand-orange-soft)", fg: "var(--color-brand-orange-dark)" },
  blue: { bg: "var(--color-brand-blue-soft)", fg: "var(--color-brand-blue-dark)" },
  pink: { bg: "var(--color-brand-pink-soft)", fg: "#B83A6E" },
} as const;

type FeatureColor = keyof typeof FEATURE_COLORS;

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {/* Hero — eyebrow, accented headline, mascot, CTAs */}
      <div className="text-center">
        <p
          className="text-display text-sm font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-brand-blue-dark)" }}
        >
          Leer Nederlands · gezellig
        </p>

        <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Dutch that <span style={{ color: "var(--color-brand-orange)" }}>actually</span> sticks.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--color-ink-soft)" }}>
          Five minutes a day, real bakkerij conversations, and a stroopwafel who genuinely roots
          for you.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <LandingCtas />
        </div>

        {/* Signature canal-scene hero illustration */}
        <CanalScene />

        {/* Mascot + tilted phone-in-phone path preview */}
        <HeroPreview />
      </div>

      {/* Why it works — staggered, asymmetric feature rows with tag pills */}
      <section className="mt-20">
        <p
          className="text-display mb-4 text-sm font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Why it works
        </p>
        <div className="flex flex-col gap-4">
          <FeatureRow
            tag="Daily drills"
            title="Nine drill types, one rhythm."
            body="Pairs, listening, speaking, fill-the-blank. Variety keeps your brain from autopiloting."
            color="orange"
          />
          <FeatureRow
            tag="Boss fight"
            title="Roleplay a real bakery."
            body="Order broodjes from an AI tutor. It corrects you, kindly. Streaming replies; speak or type."
            color="blue"
            offset
          />
          <FeatureRow
            tag="Streaks that mean it"
            title="Show up. Bring snacks."
            body="Stroopwafel freezes, weekly leagues, peer drills from friends. Quietly competitive."
            color="pink"
          />
        </div>
      </section>

      {/* Social proof — rating line + testimonial beside the bitterballen mascot */}
      <ProofCard />

      {/* Closing CTA */}
      <div className="mt-16 flex flex-col items-center">
        <LandingCtas variant="closing" />
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          No card. Cancel anytime. Doei!
        </p>
      </div>
    </main>
  );
}

/**
 * Hero motif: the animated Stroop mascot beside a 7°-tilted phone-in-phone
 * preview of the lesson path (done / current / locked tiles). Mirrors the
 * `ScreenLanding` prototype. Decorative, so it's `aria-hidden`.
 */
function HeroPreview() {
  const tiles = ["done", "done", "current", "locked", "locked"] as const;
  return (
    <div className="lp-hero-stage" aria-hidden>
      <img src="/mascot/stroop-512.png" alt="" className="anim-idle-bob lp-hero-mascot" />
      <div className="lp-phone">
        <div className="lp-phone__bar">
          <FlameIcon />
          <span>12</span>
          <span style={{ flex: 1 }} />
          <span>320</span>
        </div>
        <div className="lp-phone__body">
          <div className="lp-phone__eyebrow">Unit 3 · Bij de bakker</div>
          <div className="mt-3 flex flex-col gap-2">
            {tiles.map((s, i) => (
              <div key={i} className="lp-tile-row">
                <span className={`lp-tile lp-tile--${s}`}>
                  {s === "done" ? <CheckIcon /> : s === "current" ? <StarIcon /> : <LockIcon />}
                </span>
                <span
                  className="text-display text-xs font-semibold"
                  style={{ color: s === "locked" ? "var(--text-muted)" : "var(--text-strong)" }}
                >
                  Les {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Signature landing illustration — a Dutch gracht (canal scene). Gable canal
 * houses across the back, a brick bridge over the water, Stroop waving across
 * to Kroket at his bakkerij, and Drop drifting past in a rowboat. Ported from
 * the `CanalScene` hero in `docs/design/screens-onboarding.jsx`. Purely
 * decorative, so the whole stage is `aria-hidden`. The painterly fills (sky,
 * water, house facades) are illustration colours, not theme tokens, so they
 * stay constant in light + dark; brand accents route through tokens.
 */
function CanalScene() {
  return (
    <div className="lp-canal" aria-hidden>
      {/* sun */}
      <div className="lp-canal__sun" />

      {/* birds */}
      <svg
        viewBox="0 0 120 30"
        className="lp-canal__birds"
        fill="none"
        stroke="var(--color-brand-orange-dark)"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M6 16c3-6 6-6 9 0 3-6 6-6 9 0" />
        <path d="M44 8c2-4 4-4 6 0 2-4 4-4 6 0" />
        <path d="M82 18c2-4 4-4 6 0 2-4 4-4 6 0" />
      </svg>

      {/* gable houses silhouette */}
      <GableRow />

      {/* canal water surface (waterline at 56%) */}
      <div className="lp-canal__water" />
      {/* sparkles on water */}
      <svg
        viewBox="0 0 368 70"
        preserveAspectRatio="none"
        className="lp-canal__sparkles"
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M20 12h6M80 22h8M150 14h6M210 32h8M280 18h6M330 28h8M50 42h6M120 50h8M200 58h6M280 50h8M340 60h6" />
      </svg>
      {/* waterline highlight */}
      <div className="lp-canal__waterline" />

      {/* the bridge — brick arch left → right */}
      <Bridge />

      {/* the rowboat drifting across */}
      <Boat />

      {/* Stroop on the left platform */}
      <span className="mascot anim-idle-bob lp-canal__stroop">
        <img src="/mascot/stroop-512.png" alt="" draggable={false} />
      </span>
      {/* Stroop's small left platform/cobbles */}
      <div className="lp-canal__platform" />

      {/* Kroket at his bakkerij awning on the right */}
      <BakkerijAwning />
      <span className="mascot anim-idle-bob lp-canal__kroket">
        <img src="/mascot/treats/kroket/happy.png" alt="" draggable={false} />
      </span>

      {/* speech bubble from Kroket */}
      <div className="lp-canal__bubble">
        Goedemorgen!
        <span className="lp-canal__bubble-tail" />
      </div>

      {/* tiny scene-label badge */}
      <span className="lp-canal__badge">AMSTERDAM · 08:42</span>
    </div>
  );
}

/** Row of seven stepped/bell/pointed canal-house gables behind the water. */
function GableRow() {
  return (
    <svg
      viewBox="0 0 368 120"
      preserveAspectRatio="none"
      className="lp-canal__gables"
    >
      <g>
        <House x={0} w={56} h={96} color="#D54E00" roof="step" win={2} />
        <House x={58} w={50} h={88} color="#FAEADB" roof="bell" win={2} />
        <House x={111} w={48} h={108} color="#1F6FB2" roof="point" win={3} />
        <House x={162} w={42} h={94} color="#FF7AA2" roof="step" win={2} />
        <House x={207} w={56} h={100} color="#7A3A1A" roof="bell" win={3} />
        <House x={266} w={48} h={86} color="#FFF8EE" roof="step" win={2} />
        <House x={317} w={50} h={94} color="#D54E00" roof="point" win={2} />
      </g>
      {/* the cobbled embankment top edge */}
      <rect x="0" y="115" width="368" height="6" fill="#8A6D45" />
      <rect x="0" y="118" width="368" height="3" fill="#6B5232" />
    </svg>
  );
}

type RoofKind = "step" | "bell" | "point";

/** A single canal house: facade + gable top + two rows of windows. */
function House({
  x,
  w,
  h,
  color,
  roof,
  win,
}: {
  x: number;
  w: number;
  h: number;
  color: string;
  roof: RoofKind;
  win: number;
}) {
  const top = 120 - h;
  const cx = x + w / 2;

  let gable: ReactElement;
  if (roof === "step") {
    gable = (
      <g>
        <rect x={x} y={top + 4} width={w} height={h - 4} fill={color} />
        <rect x={x + 2} y={top - 2} width={w - 4} height={8} fill={color} />
        <rect x={x + 6} y={top - 8} width={w - 12} height={8} fill={color} />
        <rect x={cx - 4} y={top - 14} width={8} height={8} fill={color} />
      </g>
    );
  } else if (roof === "bell") {
    gable = (
      <g>
        <rect x={x} y={top + 6} width={w} height={h - 6} fill={color} />
        <path
          d={`M ${x},${top + 8} Q ${x + w / 2},${top - 12} ${x + w},${top + 8} Z`}
          fill={color}
        />
      </g>
    );
  } else {
    gable = (
      <g>
        <rect x={x} y={top + 8} width={w} height={h - 8} fill={color} />
        <polygon
          points={`${x},${top + 10} ${cx},${top - 6} ${x + w},${top + 10}`}
          fill={color}
        />
      </g>
    );
  }

  const isLight = color === "#FAEADB" || color === "#FFF8EE";
  const winColor = isLight ? "rgba(30, 79, 135, 0.85)" : "#FFE5D2";
  const winLit = "#FFD66B";
  const trim = isLight ? "#7A3A1A" : "white";

  const winRows = [{ y: top + 18 }, { y: 120 - 38 }];
  const winGap = (w - 4) / win;
  const wW = Math.min(8, winGap - 4);

  return (
    <g>
      {gable}
      {/* trim line at bottom of facade */}
      <rect x={x} y={119 - 4} width={w} height={2} fill="rgba(0,0,0,0.2)" />
      {/* windows */}
      {winRows.map((r, ri) => (
        <g key={ri}>
          {Array.from({ length: win }).map((_, i) => {
            const wx = x + 2 + i * winGap + (winGap - wW) / 2;
            const lit = ri === 0 && i === 0;
            return (
              <rect
                key={i}
                x={wx}
                y={r.y}
                width={wW}
                height={10}
                fill={lit ? winLit : winColor}
                stroke={trim}
                strokeWidth="0.8"
              />
            );
          })}
        </g>
      ))}
      {/* small door on house if tall enough */}
      {h > 95 && (
        <rect
          x={x + w / 2 - 4}
          y={120 - 14}
          width={8}
          height={10}
          fill="#3F2F22"
          stroke={trim}
          strokeWidth="0.8"
        />
      )}
    </g>
  );
}

/** The brick canal bridge — arched deck, balusters, keystone. */
function Bridge() {
  return (
    <svg
      viewBox="0 0 368 140"
      preserveAspectRatio="none"
      className="lp-canal__bridge"
    >
      {/* deck */}
      <path d="M 120 60 Q 184 28 248 60 L 248 70 L 120 70 Z" fill="#9E4200" />
      <path d="M 120 60 Q 184 28 248 60" stroke="#7A3010" strokeWidth="2" fill="none" />
      {/* arch underneath */}
      <path
        d="M 130 70 Q 184 110 238 70"
        fill="rgba(14,79,135,0.35)"
        stroke="#7A3010"
        strokeWidth="1.5"
      />
      {/* railing balusters */}
      {[140, 155, 170, 184, 198, 213, 228].map((cx, i) => {
        const t = (cx - 184) / 64;
        const y = 60 + 16 * t * t - 6;
        return <rect key={i} x={cx - 1} y={y} width={2} height={60 - y + 5} fill="#7A3010" />;
      })}
      {/* railing top */}
      <path d="M 130 55 Q 184 24 238 55" stroke="#7A3010" strokeWidth="2" fill="none" />
      {/* keystone */}
      <rect x="180" y="68" width="8" height="6" fill="#7A3010" />
    </svg>
  );
}

/** Kroket's striped bakkerij awning + shop sign, anchored bottom-right. */
function BakkerijAwning() {
  return (
    <div className="lp-canal__awning">
      <div className="lp-canal__awning-stripes" />
      <div className="lp-canal__awning-sign">BAKKERIJ</div>
    </div>
  );
}

/** The drifting rowboat carrying Drop, with a Dutch tricolor flag. */
function Boat() {
  return (
    <div className="lp-canal__boat">
      <svg viewBox="0 0 96 60" className="lp-canal__boat-svg">
        {/* mast */}
        <rect x="46" y="2" width="2" height="28" fill="#3F2F22" />
        {/* Dutch tricolor flag */}
        <rect x="48" y="2" width="18" height="4" fill="#AE1C28" />
        <rect x="48" y="6" width="18" height="4" fill="white" />
        <rect x="48" y="10" width="18" height="4" fill="#21468B" />
        {/* hull — flat deck on top, curved hull below */}
        <path d="M 4 30 Q 48 58 92 30 Z" fill="#3F2F22" />
        {/* deck plank trim */}
        <rect x="6" y="28" width="84" height="3" fill="#7A3010" />
        {/* gunwale highlight along the deck */}
        <rect x="6" y="26" width="84" height="2" fill="#A85510" />
        {/* small bench/seats */}
        <rect x="22" y="22" width="14" height="6" fill="#7A3010" rx="1" />
        <rect x="58" y="22" width="14" height="6" fill="#7A3010" rx="1" />
      </svg>
      {/* Drop passenger — sits on the deck */}
      <span className="mascot lp-canal__boat-drop">
        <img src="/mascot/treats/drop/idle.png" alt="" draggable={false} />
      </span>
    </div>
  );
}

/** Social-proof card: bitterballen mascot + rating line + a testimonial. */
function ProofCard() {
  return (
    <div className="card lp-proof mt-8">
      <img
        src="/mascot/treats/bitterballen/idle.png"
        alt="Bitterballen mascot"
        className="lp-proof__mascot"
      />
      <div>
        <div className="lp-proof__rating">
          <span>★ 4.8</span>
          <span>·</span>
          <span>12k learners</span>
          <span>·</span>
          <span>A1 → B2</span>
        </div>
        <p className="lp-proof__quote">
          &ldquo;Eindelijk een app waar ik niet over de skip-knop fantaseer.&rdquo; — Liesbeth, A2
        </p>
      </div>
    </div>
  );
}

/* Small decorative glyphs for the phone preview (no icon-lib dependency). */
function FlameIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-brand-orange-dark)" aria-hidden>
      <path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c0-1-.3-2-.8-2.7C16 9 18 11 18 14a6 6 0 11-12 0c0-4 4-6 6-12z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 6.9L12 17.5 5.7 21l1.5-6.9L2 9.3l7-.8z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 016 0v3z" />
    </svg>
  );
}

function FeatureRow({
  tag,
  title,
  body,
  color = "orange",
  offset = false,
}: {
  tag: string;
  title: string;
  body: string;
  color?: FeatureColor;
  offset?: boolean;
}) {
  const { bg, fg } = FEATURE_COLORS[color];
  return (
    <div
      className="card flex flex-col gap-3 text-left sm:flex-row sm:items-start"
      style={{ marginLeft: offset ? "2rem" : 0, marginRight: offset ? 0 : "2rem" }}
    >
      <span
        className="text-display self-start rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: bg, color: fg }}
      >
        {tag}
      </span>
      <div>
        <h3 className="text-display text-lg font-semibold" style={{ color: "var(--text-strong)" }}>
          {title}
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}

/**
 * Auth-aware landing CTAs.
 * - signed-out: Start learning / Sign in
 * - signed-in: Continue learning (-> /app/path)
 * - loading (Clerk still hydrating): empty slot, no layout shift after load
 */
function LandingCtas({ variant = "hero" }: { variant?: "hero" | "closing" }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <div className="h-14" aria-hidden />;
  }

  // Closing CTA: a single full-width primary action.
  if (variant === "closing") {
    const href = isSignedIn ? "/app/path" : "/sign-up";
    const label = isSignedIn ? "Continue learning" : "Start learning, free";
    return (
      <a href={href} className="btn-3d btn-3d-lg btn-3d-full max-w-sm">
        {label}
      </a>
    );
  }

  if (isSignedIn) {
    return (
      <a href="/app/path" className="btn-3d btn-3d-lg">
        Continue learning
      </a>
    );
  }
  return (
    <>
      <a href="/sign-up" className="btn-3d btn-3d-lg">
        Start learning
      </a>
      <a href="/sign-in" className="btn-3d btn-3d-ghost btn-3d-lg">
        Sign in
      </a>
    </>
  );
}
