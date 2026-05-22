import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { getProfileBadges } from "../lib/server/badges";
import { getCurrentLeagueForUser, tierMeta } from "../lib/server/leagues";
import {
  getActivityHeatmap,
  getLessonsCompleted,
} from "../lib/server/profile-activity";
import { AppShell } from "../components/AppShell";
import { ProfileHero } from "../components/ProfileHero";
import { Button } from "@/components/ui/button";

/**
 * Public profile view at /app/profile/:displayName.
 *
 * US-024 (leaderboard) links here so tapping a row routes to the user's
 * profile. The full read-model lands in US-025; this stub already covers
 * the path so the link doesn't 404 in the meantime.
 */
const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input: { displayName: string }) => input)
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = [await ensureUserRow(clerkId, drz, env)];

    const target = await drz
      .select()
      .from(users)
      .where(eq(users.displayName, data.displayName))
      .limit(1);
    if (!target[0]) throw new Error("Profile not found");
    if (!target[0].isPublic && target[0].id !== me[0].id) {
      throw new Error("Profile not found");
    }

    const badges = await getProfileBadges(drz, target[0].id);
    const league = await getCurrentLeagueForUser(drz, target[0].id);
    const heatmap = await getActivityHeatmap(drz, target[0].id);
    const lessonsCompleted = await getLessonsCompleted(drz, target[0].id);

    return {
      viewer: {
        displayName: me[0].displayName,
        cefrLevel: me[0].cefrLevel,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      profile: {
        displayName: target[0].displayName,
        avatarUrl: target[0].avatarUrl,
        cefrLevel: target[0].cefrLevel,
        xpTotal: target[0].xpTotal,
        streakDays: target[0].streakDays,
        isSelf: target[0].id === me[0].id,
      },
      badges,
      league: league
        ? { tier: league.tier, weeklyXp: league.weeklyXp, ...tierMeta(league.tier) }
        : null,
      heatmap,
      lessonsCompleted,
    };
  });

export const Route = createFileRoute("/app/profile/$displayName")({
  loader: async ({ params }) => {
    try {
      return await getPublicProfile({ data: { displayName: params.displayName } });
    } catch (err) {
      if (err instanceof Error && err.message === "Profile not found") throw notFound();
      throw err;
    }
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { viewer, profile, badges, league, heatmap, lessonsCompleted } =
    Route.useLoaderData();
  const earned = badges.filter((b) => b.awarded);

  return (
    <AppShell user={viewer}>
      <div className="mx-auto max-w-3xl space-y-6">
        <ProfileHero
          displayName={profile.displayName}
          cefrLevel={profile.cefrLevel}
          xpTotal={profile.xpTotal}
          streakDays={profile.streakDays}
          lessonsCompleted={lessonsCompleted}
          league={league}
          heatmap={heatmap}
          metaExtra={
            league && (
              <span
                data-testid="profile-league-badge"
                className="sp-pill sp-pill--league"
                title={`${league.name} league`}
              >
                <span aria-hidden>{league.emoji}</span>
                {league.name}
              </span>
            )
          }
          action={
            profile.isSelf ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/profile">My profile</Link>
              </Button>
            ) : undefined
          }
        />

        <section className="sp-section">
          <div className="sp-section__head">
            <h2 className="sp-section__title">Badges</h2>
            <span className="sp-section__count">
              {earned.length} / {badges.length}
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
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
