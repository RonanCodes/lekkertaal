import { createFileRoute } from "@tanstack/react-router";
import { lookupDictionary } from "../lib/server/dictionary";

/**
 * Thin HTTP wrapper over `lookupDictionary`. Server-side callers should
 * import the function directly to skip the round-trip.
 *
 *   GET /api/dictionary?word=huis
 *
 * Returns: { word, entries: [{ partOfSpeech, definitions: [{ text, examples? }] }], source, attribution }
 */
export const Route = createFileRoute("/api/dictionary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const word = url.searchParams.get("word") ?? "";
        const result = await lookupDictionary(word);
        if (!result.ok) {
          return Response.json({ error: result.reason }, { status: result.status });
        }
        return new Response(JSON.stringify(result.data), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=86400",
            "x-dict-cache": result.cache,
          },
        });
      },
    },
  },
});
