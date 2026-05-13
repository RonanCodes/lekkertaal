import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/client";
import { users, pushSubscriptions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      endpoint: string;
      p256dh: string;
      authKey: string;
      userAgent?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw new Error("Not signed in");
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");
    try {
      await drz.insert(pushSubscriptions).values({
        userId: me[0].id,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        authKey: data.authKey,
        userAgent: data.userAgent ?? null,
      });
    } catch {
      // Unique on endpoint — idempotent retry
    }
    return { ok: true };
  });
