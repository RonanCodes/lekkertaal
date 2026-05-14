import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../db/client";
import { users } from "../db/schema";
import { desc, asc, eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { AppShell } from "../components/AppShell";

const sortSchema = z.object({
  sort: z.enum(["xp", "streak", "level", "joined"]).catch("xp"),
  page: z.number().int().min(1).catch(1),
});

const PAGE_SIZE = 25;

function levelForXp(xp: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (xp >= 10000) return "Platinum";
  if (xp >= 2500) return "Gold";
  if (xp >= 500) return "Silver";
  return "Bronze";
}

const listUsers = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { sort: "xp" | "streak" | "level" | "joined"; page: number }) => input,
  )
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = [await ensureUserRow(clerkId, drz, env)];

    // Sort: level reuses xp ordering since level is derived from xp.
    const orderColumn =
      data.sort === "streak"
        ? desc(users.streakDays)
        : data.sort === "joined"
          ? asc(users.createdAt)
          : desc(users.xpTotal);

    const offset = (data.page - 1) * PAGE_SIZE;

    const rows = await drz
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        cefrLevel: users.cefrLevel,
        xpTotal: users.xpTotal,
        streakDays: users.streakDays,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.isPublic, true))
      .orderBy(orderColumn)
      .limit(PAGE_SIZE + 1)
      .offset(offset);

    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE).map((r) => ({
      ...r,
      level: levelForXp(r.xpTotal),
    }));

    return {
      user: {
        displayName: me[0].displayName,
        xpTotal: me[0].xpTotal,
        coinsBalance: me[0].coinsBalance,
        streakDays: me[0].streakDays,
        streakFreezesBalance: me[0].streakFreezesBalance,
      },
      sort: data.sort,
      page: data.page,
      hasMore,
      rows: page,
    };
  });

export const Route = createFileRoute("/app/users")({
  validateSearch: sortSchema,
  loaderDeps: ({ search }) => ({ sort: search.sort, page: search.page }),
  loader: async ({ deps }) =>
    await listUsers({ data: { sort: deps.sort, page: deps.page } }),
  component: UsersDirectoryPage,
});

const SORTS: Array<{ id: "xp" | "streak" | "level" | "joined"; label: string }> = [
  { id: "xp", label: "XP" },
  { id: "streak", label: "Streak" },
  { id: "level", label: "Level" },
  { id: "joined", label: "Joined" },
];

function UsersDirectoryPage() {
  const data = Route.useLoaderData();
  const { user, sort, page, hasMore, rows } = data;

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-neutral-500">
            Everyone learning Dutch on Lekkertaal.
          </p>
        </header>

        {/* Sort tabs */}
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {SORTS.map((s) => (
            <Link
              key={s.id}
              to="/app/users"
              search={{ sort: s.id, page: 1 }}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium ${
                sort === s.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <ul className="space-y-1 rounded-2xl border border-neutral-200 bg-white p-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/app/profile/$displayName"
                params={{ displayName: r.displayName }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-orange-50"
              >
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                    {r.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {r.displayName}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline">
                  {r.cefrLevel}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline">
                  🔥 {r.streakDays}
                </span>
                <span className="w-20 text-right font-semibold tabular-nums text-orange-600">
                  {r.xpTotal.toLocaleString()} XP
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              to="/app/users"
              search={{ sort, page: page - 1 }}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-neutral-500">Page {page}</span>
          {hasMore ? (
            <Link
              to="/app/users"
              search={{ sort, page: page + 1 }}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </AppShell>
  );
}
