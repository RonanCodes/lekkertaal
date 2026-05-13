import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";

/**
 * Clerk user.created / user.updated / user.deleted webhook receiver.
 *
 * Signature: Svix-signed payload. We delegate to verifyWebhook from
 * @clerk/backend/webhooks which reads CLERK_WEBHOOK_SECRET from env.
 *
 * Wire the URL `https://lekkertaal.ronanconnolly.dev/api/clerk-webhook` into
 * the Clerk dashboard's Webhooks tab. Subscribe to user.* events.
 */
export const Route = createFileRoute("/api/clerk-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { env } = requireWorkerContext();

        if (!env.CLERK_WEBHOOK_SECRET) {
          console.warn("[clerk-webhook] CLERK_WEBHOOK_SECRET not set — accepting unsigned payload (dev only)");
        }

        let event;
        try {
          event = await verifyWebhook(request, {
            signingSecret: env.CLERK_WEBHOOK_SECRET,
          });
        } catch (err) {
          console.error("[clerk-webhook] verify failed:", err);
          return new Response("Invalid signature", { status: 401 });
        }

        const drz = db(env.DB);

        try {
          if (event.type === "user.created" || event.type === "user.updated") {
            const u = event.data;
            const email = u.email_addresses?.[0]?.email_address ?? null;
            const displayName =
              [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
              u.username ||
              (email ? email.split("@")[0] : `user-${u.id.slice(-6)}`);
            const avatarUrl = u.image_url ?? null;

            const existing = await drz.select().from(users).where(eq(users.clerkId, u.id)).limit(1);
            if (existing.length === 0) {
              await drz.insert(users).values({
                clerkId: u.id,
                email,
                displayName,
                avatarUrl,
              });
            } else {
              await drz
                .update(users)
                .set({ email, displayName, avatarUrl, updatedAt: new Date().toISOString() })
                .where(eq(users.clerkId, u.id));
            }
          } else if (event.type === "user.deleted") {
            const u = event.data;
            if (u.id) {
              await drz.delete(users).where(eq(users.clerkId, u.id));
            }
          }
        } catch (err) {
          console.error("[clerk-webhook] db error:", err);
          return new Response("DB error", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true, type: event.type }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
