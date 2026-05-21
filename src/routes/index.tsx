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

        <img
          src="/mascot/stroop-512.png"
          alt="Stroop the stroopwafel"
          className="anim-idle-bob mx-auto mt-4 mb-2 h-32 w-32"
        />

        <h1 className="mt-2 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Dutch that <span style={{ color: "var(--color-brand-orange)" }}>actually</span> sticks.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--color-ink-soft)" }}>
          Five minutes a day, real bakkerij conversations, and a stroopwafel who genuinely roots
          for you.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <LandingCtas />
        </div>
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
