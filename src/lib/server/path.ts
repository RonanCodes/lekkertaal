import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import { users, units, userUnitProgress } from "../../db/schema";
import { eq, asc } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

export type PathUnit = {
  id: number;
  slug: string;
  titleNl: string;
  titleEn: string;
  order: number;
  status: "locked" | "unlocked" | "in_progress" | "completed";
  lessonsCompleted: number;
  lessonsTotal: number;
};

export const getPath = createServerFn({ method: "GET" }).handler(async () => {
  const a = await auth();
  if (!a.userId) throw redirect({ to: "/sign-in" });
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");

  const levelUnits = await drz
    .select()
    .from(units)
    .where(eq(units.cefrLevel, me[0].cefrLevel))
    .orderBy(asc(units.order));

  const progressRows = await drz
    .select()
    .from(userUnitProgress)
    .where(eq(userUnitProgress.userId, me[0].id));
  const progressByUnit = new Map(progressRows.map((p) => [p.unitId, p]));

  const path: PathUnit[] = levelUnits.map((u, i) => {
    const p = progressByUnit.get(u.id);
    let status: PathUnit["status"] = "locked";
    if (p) status = p.status as PathUnit["status"];
    // First unit defaults to unlocked even if no progress row exists yet
    if (!p && i === 0) status = "unlocked";
    return {
      id: u.id,
      slug: u.slug,
      titleNl: u.titleNl,
      titleEn: u.titleEn,
      order: u.order,
      status,
      lessonsCompleted: p?.lessonsCompleted ?? 0,
      lessonsTotal: p?.lessonsTotal ?? 1,
    };
  });

  return {
    user: {
      displayName: me[0].displayName,
      cefrLevel: me[0].cefrLevel,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
    },
    path,
  };
});
