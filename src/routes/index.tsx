import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useAuth } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";
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
      <Button asChild variant="orange" size="lg" fullWidth className="max-w-sm">
        <a href={href}>{label}</a>
      </Button>
    );
  }

  if (isSignedIn) {
    return (
      <Button asChild variant="orange" size="lg">
        <a href="/app/path">Continue learning</a>
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="orange" size="lg">
        <a href="/sign-up">Start learning</a>
      </Button>
      <Button asChild variant="ghost" size="lg">
        <a href="/sign-in">Sign in</a>
      </Button>
    </>
  );
}
