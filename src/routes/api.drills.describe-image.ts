/**
 * POST /api/drills/describe-image
 *
 * Body: `{ imageUrl: string }`
 *
 * Calls Claude Sonnet with a multimodal user message: image + a Dutch A2-level
 * instruction. Returns the model's short Dutch description of what's in the
 * image. Used as the dynamic flavour-text generator for image-input drills
 * (AI-SDK-7) and as the "describe in Dutch then pick the image" mode.
 *
 * This route demonstrates the AI SDK multimodal content-part pattern:
 *
 *   await generateText({
 *     model: models.primary,
 *     messages: [
 *       { role: 'user', content: [
 *         { type: 'image', image: new URL(imageUrl) },
 *         { type: 'text', text: 'Beschrijf in eenvoudig Nederlands (A2)...' },
 *       ]},
 *     ],
 *   });
 *
 * Responses:
 *   - 401 not_signed_in
 *   - 400 invalid_json | missing_image_url | invalid_image_url
 *   - 502 ai_call_failed
 *   - 200 `{ descriptionNl: string }`
 *
 * Auth-gated. Reads no DB. Designed to be small, cacheable, and skippable
 * (the drill itself works fine without it — the description is decorative).
 */
import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { models } from "../lib/models";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { buildDescribePrompt } from "../lib/server/multimodal-prompts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/drills/describe-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireUserClerkId();
        } catch {
          return jsonResponse({ error: "not_signed_in" }, 401);
        }

        let body: { imageUrl?: unknown };
        try {
          body = (await request.json()) as { imageUrl?: unknown };
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400);
        }

        if (typeof body.imageUrl !== "string" || body.imageUrl.length === 0) {
          return jsonResponse({ error: "missing_image_url" }, 400);
        }

        let url: URL;
        try {
          url = new URL(body.imageUrl);
        } catch {
          return jsonResponse({ error: "invalid_image_url" }, 400);
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          return jsonResponse({ error: "invalid_image_url" }, 400);
        }

        try {
          const result = await generateText({
            model: models.primary,
            messages: [buildDescribePrompt(url.toString())],
          });
          const descriptionNl = result.text.trim();
          return jsonResponse({ descriptionNl });
        } catch (err) {
          console.error("[describe-image] ai call failed:", err);
          return jsonResponse({ error: "ai_call_failed" }, 502);
        }
      },
    },
  },
});
