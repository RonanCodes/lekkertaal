import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../db/client";
import { users, scenarios } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";

/**
 * Roleplay streaming endpoint.
 *
 * POST /api/roleplay/:slug/stream
 *
 * Wire-compatible with the AI SDK v6 `useChat()` UI message protocol — the
 * client sends `{ messages, id, trigger }`, we reply with a UI message stream.
 *
 * We hydrate the NPC system prompt from the scenarios row keyed on :slug, so
 * the persona, opening line, must-use vocab/grammar, and success criteria all
 * shape the model's behaviour.
 */
export const Route = createFileRoute("/api/roleplay/$slug/stream")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await auth();
        if (!a.userId) {
          return new Response("Not signed in", { status: 401 });
        }

        const { env } = requireWorkerContext();
        if (!env.ANTHROPIC_API_KEY) {
          return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
        }

        const drz = db(env.DB);
        const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
        if (!me[0]) return new Response("User row missing", { status: 500 });

        const scenarioRow = await drz
          .select()
          .from(scenarios)
          .where(eq(scenarios.slug, params.slug))
          .limit(1);
        if (!scenarioRow[0]) return new Response("Scenario not found", { status: 404 });
        const s = scenarioRow[0];

        const body = (await request.json()) as { messages: UIMessage[] };

        const systemPrompt = buildSystemPrompt({
          npcName: s.npcName,
          npcPersona: s.npcPersona,
          titleNl: s.titleNl,
          openingNl: s.openingNl,
          mustUseVocab: s.mustUseVocab ?? [],
          mustUseGrammar: s.mustUseGrammar ?? [],
          successCriteria: s.successCriteria ?? [],
          difficulty: s.difficulty,
        });

        // Bind the Anthropic key from the Worker env. The static import from
        // @ai-sdk/anthropic relies on process.env which doesn't exist in CF
        // Workers; createAnthropic({ apiKey }) is the explicit form.
        const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

        const result = streamText({
          model: anthropic("claude-haiku-4-5"),
          system: systemPrompt,
          messages: convertToModelMessages(body.messages),
          temperature: 0.7,
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});

function buildSystemPrompt(s: {
  npcName: string;
  npcPersona: string;
  titleNl: string;
  openingNl: string;
  mustUseVocab: string[];
  mustUseGrammar: string[];
  successCriteria: string[];
  difficulty: string;
}): string {
  return `You are ${s.npcName}. ${s.npcPersona}

You are roleplaying with a Dutch language learner at CEFR level ${s.difficulty}.
Scenario: ${s.titleNl}
Your opening line was: "${s.openingNl}"

RULES — non-negotiable:
- Reply ONLY in Dutch. Never switch to English, even if the user does.
- Stay in character as ${s.npcName} at all times.
- Keep replies short (1 to 3 sentences). This is a spoken-style conversation, not an essay.
- Speak naturally at CEFR ${s.difficulty} level — simple sentence structures, common vocab. No idioms or advanced register unless the learner uses them first.
- Do NOT correct the user's Dutch. Do NOT explain grammar. Just respond as the character would.
- If the user types in English or asks for help in English, gently nudge back to Dutch in character (e.g. "Sorry, ik begrijp het niet helemaal. Kun je het in het Nederlands proberen?").
- If the user types "klaar", "done", or "einde", the conversation will end on the next turn — give a brief, in-character farewell.

Scenario success looks like the user achieving: ${s.successCriteria.join("; ") || "a natural conversation"}.
${s.mustUseVocab.length > 0 ? `Try to organically draw the user toward using: ${s.mustUseVocab.join(", ")}.` : ""}
${s.mustUseGrammar.length > 0 ? `Encourage natural use of grammar: ${s.mustUseGrammar.join(", ")}.` : ""}

Begin the conversation in your role. The user will reply.`;
}
