import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { getProfileBadges } from "../lib/server/badges";
import { AppShell } from "../components/AppShell";

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
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

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
  const { viewer, profile, badges } = Route.useLoaderData();
  const earned = badges.filter((b) => b.awarded);

  return (
    <AppShell user={viewer}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full ring-2 ring-orange-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
              {profile.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-neutral-900">
              {profile.displayName}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-neutral-600">
              <span>CEFR {profile.cefrLevel}</span>
              <span>·</span>
              <span>🔥 {profile.streakDays}</span>
              <span>·</span>
              <span>⚡ {profile.xpTotal} XP</span>
            </div>
          </div>
          {profile.isSelf && (
            <Link
              to="/app/profile"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              My profile
            </Link>
          )}
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Badges
            </h2>
            <span className="text-sm text-neutral-500">
              {earned.length} / {badges.length}
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
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
