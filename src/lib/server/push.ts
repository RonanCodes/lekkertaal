import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { users, pushSubscriptions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";

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
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
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
