import { createFileRoute } from "@tanstack/react-router";
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
 * Owner profile view — the signed-in user's own profile. The PUBLIC version
 * at /app/profile/$displayName lands in US-025; for now this is enough to
 * render the badges grid (US-023 acceptance #5).
 */
const getOwnProfile = createServerFn({ method: "GET" }).handler(async () => {
  const a = await auth();
  if (!a.userId) throw redirect({ to: "/sign-in" });
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  const badges = await getProfileBadges(drz, me[0].id);
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
  };
});

export const Route = createFileRoute("/app/profile")({
  loader: async () => await getOwnProfile(),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, badges } = Route.useLoaderData();
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
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{user.displayName}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-neutral-600">
              <span>CEFR {user.cefrLevel}</span>
              <span>·</span>
              <span>🔥 {user.streakDays}</span>
              <span>·</span>
              <span>⚡ {user.xpTotal} XP</span>
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
      </div>
    </AppShell>
  );
}
