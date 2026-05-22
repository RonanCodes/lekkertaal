/**
 * Roleplay inline-correction extraction (#246, gap 4).
 *
 * The roleplay model flags learner mistakes silently via the
 * `flagSuspectedError` tool. In the AI SDK v6 UI message protocol that lands
 * as a `tool-flagSuspectedError` part on the assistant message answering the
 * learner turn. These tests lock the client-side mapping that turns those tool
 * parts into "Tiny tweak" cards under the learner's own bubble.
 */
import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  extractCorrections,
  buildCorrectionMap,
} from "../app.scenario.$slug";

function userMsg(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMsg(
  id: string,
  text: string,
  corrections: Array<{
    category?: string;
    incorrect?: string;
    correction?: string;
    explanationEn?: string;
  }> = [],
): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      { type: "text", text },
      ...corrections.map((c) => ({
        type: "tool-flagSuspectedError",
        state: "output-available",
        input: c,
      })),
    ],
  } as unknown as UIMessage;
}

describe("extractCorrections", () => {
  it("pulls flagSuspectedError tool inputs off an assistant message", () => {
    const m = assistantMsg("a1", "Natuurlijk!", [
      {
        category: "register",
        incorrect: "Ja, en een koffie.",
        correction: "Ja, en een koffie, alstublieft.",
        explanationEn: "Polite forms like a closing 'alstublieft'.",
      },
    ]);
    const out = extractCorrections(m);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      category: "register",
      incorrect: "Ja, en een koffie.",
      correction: "Ja, en een koffie, alstublieft.",
      explanationEn: "Polite forms like a closing 'alstublieft'.",
    });
  });

  it("ignores tool parts missing incorrect/correction", () => {
    const m = assistantMsg("a1", "Goed!", [{ incorrect: "x" }]);
    expect(extractCorrections(m)).toHaveLength(0);
  });

  it("returns nothing for a plain text-only assistant message", () => {
    const m = assistantMsg("a1", "Goedemorgen!");
    expect(extractCorrections(m)).toHaveLength(0);
  });
});

describe("buildCorrectionMap", () => {
  it("attaches corrections to the preceding learner turn", () => {
    const messages: UIMessage[] = [
      assistantMsg("opening", "Goedemorgen! Wat mag het zijn?"),
      userMsg("u1", "Ja, en een koffie."),
      assistantMsg("a1", "Natuurlijk!", [
        {
          incorrect: "Ja, en een koffie.",
          correction: "Ja, en een koffie, alstublieft.",
        },
      ]),
    ];
    const map = buildCorrectionMap(messages);
    expect(map.get("u1")).toHaveLength(1);
    expect(map.get("u1")?.[0].correction).toBe(
      "Ja, en een koffie, alstublieft.",
    );
  });

  it("leaves clean learner turns unmapped", () => {
    const messages: UIMessage[] = [
      userMsg("u1", "Goedemorgen."),
      assistantMsg("a1", "Goedemorgen terug!"),
    ];
    expect(buildCorrectionMap(messages).has("u1")).toBe(false);
  });

  it("does not map when the next message is another user turn", () => {
    const messages: UIMessage[] = [
      userMsg("u1", "Hallo"),
      userMsg("u2", "Nog een keer"),
    ];
    expect(buildCorrectionMap(messages).size).toBe(0);
  });
});
