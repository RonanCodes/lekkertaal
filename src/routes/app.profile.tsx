import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Flame, Zap } from "lucide-react";
import { db } from "../db/client";
import { useState } from "react";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { getProfileBadges } from "../lib/server/badges";
import { getCurrentLeagueForUser, tierMeta } from "../lib/server/leagues";
import { resetMyData } from "../lib/server/user";
import { AppShell } from "../components/AppShell";

/**
 * Owner profile view, the signed-in user's own profile. The PUBLIC version
 * at /app/profile/$displayName lands in US-025; for now this is enough to
 * render the badges grid (US-023 acceptance #5).
 */
const getOwnProfile = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = [await ensureUserRow(clerkId, drz, env)];
  const badges = await getProfileBadges(drz, me[0].id);
  const league = await getCurrentLeagueForUser(drz, me[0].id);
  return {
    user: {
      displayName: me[0].displayName,
      cefrLevel: me[0].cefrLevel,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
      avatarUrl: me[0].avatarUrl,
    },
    badges,
    league: league
      ? { tier: league.tier, weeklyXp: league.weeklyXp, ...tierMeta(league.tier) }
      : null,
  };
});

export const Route = createFileRoute("/app/profile")({
  loader: async () => await getOwnProfile(),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, badges, league } = Route.useLoaderData();
  const earned = badges.filter((b) => b.awarded);

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="sp-hero">
          <div className="sp-hero__top">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="sp-avatar" />
            ) : (
              <div className="sp-avatar sp-avatar--fallback">
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="sp-hero__name">{user.displayName}</h1>
              <div className="sp-hero__meta">
                <span className="sp-pill sp-pill--cefr">CEFR {user.cefrLevel}</span>
                {league && (
                  <span
                    data-testid="profile-league-badge"
                    className="sp-pill sp-pill--league"
                    title={`${league.name} league — ${league.weeklyXp} XP this week`}
                  >
                    <span aria-hidden>{league.emoji}</span>
                    {league.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="sp-hero__stats">
            <div className="sp-stat">
              <div className="sp-stat__value inline-flex items-center justify-center gap-1">
                <Zap size={16} className="text-yellow-500" aria-hidden />
                {user.xpTotal}
              </div>
              <div className="sp-stat__label">XP</div>
            </div>
            <div className="sp-stat">
              <div className="sp-stat__value inline-flex items-center justify-center gap-1">
                <Flame size={16} className="text-orange-500" aria-hidden />
                {user.streakDays}
              </div>
              <div className="sp-stat__label">Day streak</div>
            </div>
            <div className="sp-stat">
              <div className="sp-stat__value">{user.coinsBalance}</div>
              <div className="sp-stat__label">Coins</div>
            </div>
          </div>
        </section>

        <section className="sp-section">
          <div className="sp-section__head">
            <h2 className="sp-section__title">Badges</h2>
            <span className="sp-section__count">
              {earned.length} / {badges.length} unlocked
            </span>
          </div>
          <ul className="sp-badges">
            {badges.map((b) => (
              <li
                key={b.id}
                className="sp-badge"
                data-earned={b.awarded ? "true" : "false"}
                title={b.description ?? b.titleEn}
              >
                <div className="sp-badge__icon" aria-hidden>
                  {b.iconEmoji ?? "🏅"}
                </div>
                <div className="sp-badge__name">{b.titleEn}</div>
                {b.awarded && b.awardedAt && (
                  <div className="sp-badge__date">
                    {new Date(b.awardedAt).toLocaleDateString()}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <ResetMyDataSection />
      </div>
    </AppShell>
  );
}

/**
 * "Reset my learning data" panel.
 *
 * Two-step confirm: click the button → inline modal-style confirmation card
 * → "Yes, reset everything". On confirm, fires the `resetMyData` server-fn,
 * waits for the response, then hard-navigates to `/app/path` so the loader
 * re-runs against the cleared DB state and the path page shows zero XP /
 * no streak / unit 1 active.
 */
function ResetMyDataSection() {
  const [stage, setStage] = useState<"idle" | "confirm" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onConfirm() {
    setStage("running");
    setErrorMsg(null);
    try {
      await resetMyData();
      // Hard navigate so /app/path loader re-runs and (via getPath) reseeds
      // the starting unit row in user_unit_progress.
      window.location.href = "/app/path";
    } catch (err) {
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <section data-testid="reset-my-data-section" className="sp-danger">
      <h2 className="sp-danger__title">Danger zone</h2>
      <p className="sp-danger__body mt-2 text-sm">
        Wipe your XP, streak, lessons completed, drill attempts, friends, peer drills,
        and quest history. Your account stays signed in.
      </p>

      {stage === "idle" && (
        <button
          type="button"
          onClick={() => setStage("confirm")}
          className="btn-3d btn-3d-red btn-3d-sm mt-3"
          data-testid="reset-my-data-button"
        >
          Reset my learning data
        </button>
      )}

      {stage === "confirm" && (
        <div
          role="dialog"
          aria-labelledby="reset-confirm-title"
          className="sp-danger__confirm mt-3"
          data-testid="reset-my-data-confirm"
        >
          <h3 id="reset-confirm-title" className="text-base font-semibold" style={{ color: "var(--color-bad)" }}>
            Are you sure?
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
            This will permanently clear your XP, streak, lessons completed, drill attempts,
            friends, peer drills, and quest history. Your account stays (you stay signed in).
            Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="btn-3d btn-3d-red btn-3d-sm"
              data-testid="reset-my-data-confirm-yes"
            >
              Yes, reset everything
            </button>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="btn-3d btn-3d-ghost btn-3d-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === "running" && (
        <p className="sp-danger__body mt-3 text-sm" data-testid="reset-my-data-running">
          Resetting...
        </p>
      )}

      {stage === "error" && (
        <div className="sp-danger__confirm mt-3" data-testid="reset-my-data-error">
          <p className="text-sm font-semibold" style={{ color: "var(--color-bad)" }}>Reset failed</p>
          {errorMsg && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{errorMsg}</p>}
          <button
            type="button"
            onClick={() => setStage("idle")}
            className="mt-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
