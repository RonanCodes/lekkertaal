import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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
        <header className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full ring-2 ring-orange-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-neutral-900">{user.displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
              <span>CEFR {user.cefrLevel}</span>
              <span>·</span>
              <span>🔥 {user.streakDays}</span>
              <span>·</span>
              <span>⚡ {user.xpTotal} XP</span>
              {league && (
                <>
                  <span>·</span>
                  <span
                    data-testid="profile-league-badge"
                    className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"
                    title={`${league.name} league — ${league.weeklyXp} XP this week`}
                  >
                    <span aria-hidden>{league.emoji}</span>
                    {league.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Badges
            </h2>
            <span className="text-sm text-neutral-500">
              {earned.length} / {badges.length} unlocked
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {badges.map((b) => (
              <li
                key={b.id}
                className={`flex flex-col items-center rounded-xl p-3 text-center ${
                  b.awarded
                    ? "bg-amber-50 ring-1 ring-amber-200"
                    : "bg-neutral-50 opacity-50 grayscale ring-1 ring-neutral-200"
                }`}
                title={b.description ?? b.titleEn}
              >
                <div className="text-3xl" aria-hidden>
                  {b.iconEmoji ?? "🏅"}
                </div>
                <div className="mt-1 text-xs font-medium leading-tight">
                  {b.titleEn}
                </div>
                {b.awarded && b.awardedAt && (
                  <div className="mt-0.5 text-[10px] text-neutral-500">
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
    <section
      data-testid="reset-my-data-section"
      className="rounded-2xl border border-red-200 bg-red-50 p-5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">
        Danger zone
      </h2>
      <p className="mt-2 text-sm text-red-900">
        Wipe your XP, streak, lessons completed, drill attempts, friends, peer drills,
        and quest history. Your account stays signed in.
      </p>

      {stage === "idle" && (
        <button
          type="button"
          onClick={() => setStage("confirm")}
          className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          data-testid="reset-my-data-button"
        >
          Reset my learning data
        </button>
      )}

      {stage === "confirm" && (
        <div
          role="dialog"
          aria-labelledby="reset-confirm-title"
          className="mt-3 rounded-xl border border-red-300 bg-white p-4"
          data-testid="reset-my-data-confirm"
        >
          <h3 id="reset-confirm-title" className="text-base font-semibold text-red-800">
            Are you sure?
          </h3>
          <p className="mt-1 text-sm text-neutral-700">
            This will permanently clear your XP, streak, lessons completed, drill attempts,
            friends, peer drills, and quest history. Your account stays (you stay signed in).
            Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              data-testid="reset-my-data-confirm-yes"
            >
              Yes, reset everything
            </button>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === "running" && (
        <p className="mt-3 text-sm text-red-900" data-testid="reset-my-data-running">
          Resetting...
        </p>
      )}

      {stage === "error" && (
        <div className="mt-3 rounded-xl border border-red-300 bg-white p-3" data-testid="reset-my-data-error">
          <p className="text-sm font-semibold text-red-800">Reset failed</p>
          {errorMsg && <p className="mt-1 text-xs text-red-700">{errorMsg}</p>}
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
