import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { pushSubscriptions } from "../../db/schema";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";
import { ensureUserRow } from "./ensure-user-row";

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
    const me = [await ensureUserRow(userId, drz, env)];
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
