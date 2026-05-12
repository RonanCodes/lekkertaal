import { createFileRoute } from "@tanstack/react-router";
import { requireWorkerContext } from "../entry.server";

/**
 * Returns the VAPID public key so the client can subscribe via
 * pushManager.subscribe({ applicationServerKey }).
 *
 * The matching private key + subject live in env (set via
 * `wrangler secret put VAPID_PRIVATE` etc).
 */
export const Route = createFileRoute("/api/push-vapid")({
  server: {
    handlers: {
      GET: async () => {
        const { env } = requireWorkerContext();
        if (!env.VAPID_PUBLIC) {
          return new Response(
            JSON.stringify({ error: "VAPID_PUBLIC not configured" }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ publicKey: env.VAPID_PUBLIC }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
