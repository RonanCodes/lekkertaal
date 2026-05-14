/**
 * Unit tests for the PII redaction layer.
 *
 * Two halves:
 *
 *   1. `redactText` — pattern coverage. Each PII type gets a positive case
 *      (must redact) and a negative case (must not redact).
 *   2. `createRedactionMiddleware` — wraps a stub `LanguageModelV3` and
 *      asserts the prompt-going-out shape and the response-coming-back
 *      shape have both been cleaned, and that a log entry is emitted with
 *      counts only.
 *
 * Provider types are imported via `@ai-sdk/provider` so the stub model
 * matches the real interface; vitest will fail-fast at type-check time if
 * the shape drifts.
 */
import { describe, it, expect, vi } from "vitest";
import { wrapLanguageModel, streamText, generateText } from "ai";
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";

import {
  redactText,
  isValidBsn,
  summariseMatches,
  createRedactionMiddleware,
  redactionMiddleware,
} from "../redaction-middleware";

// ---------------------------------------------------------------------------
// redactText — pattern coverage
// ---------------------------------------------------------------------------

describe("redactText", () => {
  describe("email", () => {
    it("redacts a plain email address", () => {
      const { text, matches } = redactText("Mail me at ronan@example.com today.");
      expect(text).toBe("Mail me at [REDACTED_EMAIL] today.");
      expect(matches).toHaveLength(1);
      expect(matches[0].kind).toBe("email");
    });

    it("redacts multiple emails in one string", () => {
      const { text, matches } = redactText("a@b.io and c@d.co are both me");
      expect(text).toBe("[REDACTED_EMAIL] and [REDACTED_EMAIL] are both me");
      expect(matches).toHaveLength(2);
      expect(matches.every((m) => m.kind === "email")).toBe(true);
    });

    it("does not redact a bare @ symbol or hashtag", () => {
      const { text, matches } = redactText("hello @world #ai");
      expect(text).toBe("hello @world #ai");
      expect(matches).toHaveLength(0);
    });
  });

  describe("bsn", () => {
    it("redacts a valid 9-digit BSN", () => {
      // 111222333 — passes 11-proof.
      // 1*9 + 1*8 + 1*7 + 2*6 + 2*5 + 2*4 + 3*3 + 3*2 + 3*-1
      // = 9 + 8 + 7 + 12 + 10 + 8 + 9 + 6 - 3 = 66 = 11*6. OK.
      const { text, matches } = redactText("Mijn BSN is 111222333 ja.");
      expect(text).toBe("Mijn BSN is [REDACTED_BSN] ja.");
      expect(matches.find((m) => m.kind === "bsn")).toBeDefined();
    });

    it("does not redact a 9-digit number that fails the 11-proof", () => {
      // 123456789: 1*9+2*8+3*7+4*6+5*5+6*4+7*3+8*2+9*-1 = 9+16+21+24+25+24+21+16-9 = 147, 147%11 = 4. Fails.
      const { text, matches } = redactText("Order id is 123456789 thanks");
      expect(text).toBe("Order id is 123456789 thanks");
      expect(matches.find((m) => m.kind === "bsn")).toBeUndefined();
    });

    it("does not match phone-prefixed runs as BSN twice", () => {
      // The phone regex should claim "0612345678" before BSN sees it.
      const { matches } = redactText("Bel me op 0612345678");
      const bsnMatches = matches.filter((m) => m.kind === "bsn");
      expect(bsnMatches).toHaveLength(0);
    });

    it("isValidBsn rejects non-numeric and wrong-length input", () => {
      expect(isValidBsn("abc")).toBe(false);
      expect(isValidBsn("1234567")).toBe(false); // 7 digits
      expect(isValidBsn("1234567890")).toBe(false); // 10 digits
      expect(isValidBsn("000000000")).toBe(false); // all zeros
    });
  });

  describe("phone", () => {
    it("redacts a Dutch mobile in 06-format", () => {
      const { text, matches } = redactText("Bel me op 0612345678 morgen.");
      expect(text).toBe("Bel me op [REDACTED_PHONE] morgen.");
      expect(matches.find((m) => m.kind === "phone")).toBeDefined();
    });

    it("redacts an international +31 number", () => {
      const { text } = redactText("Phone: +31 6 1234 5678");
      expect(text).toContain("[REDACTED_PHONE]");
      expect(text).not.toContain("+31");
    });

    it("does not redact a short number like a year", () => {
      const { text, matches } = redactText("This was in 2026.");
      expect(text).toBe("This was in 2026.");
      expect(matches.filter((m) => m.kind === "phone")).toHaveLength(0);
    });
  });

  describe("iban", () => {
    it("redacts a Dutch IBAN with spaces", () => {
      const { text, matches } = redactText("Bank: NL91 ABNA 0417 1643 00 done");
      expect(text).toContain("[REDACTED_IBAN]");
      expect(text).not.toContain("ABNA");
      expect(matches.find((m) => m.kind === "iban")).toBeDefined();
    });

    it("redacts a compact IBAN with no spaces", () => {
      const { text } = redactText("IBAN=NL91ABNA0417164300 ok");
      expect(text).toBe("IBAN=[REDACTED_IBAN] ok");
    });

    it("does not redact a short country-code-shaped token", () => {
      const { text, matches } = redactText("EU 12 short");
      expect(text).toBe("EU 12 short");
      expect(matches.filter((m) => m.kind === "iban")).toHaveLength(0);
    });
  });

  it("returns empty result for empty / nullish input", () => {
    expect(redactText("")).toEqual({ text: "", matches: [] });
    // @ts-expect-error — exercising the runtime guard
    expect(redactText(undefined)).toEqual({ text: "", matches: [] });
  });

  it("summariseMatches groups by kind", () => {
    const { matches } = redactText(
      "Mail a@b.co and a2@b.co, phone 0612345678, IBAN NL91ABNA0417164300",
    );
    const counts = summariseMatches(matches);
    expect(counts.email).toBe(2);
    expect(counts.phone).toBe(1);
    expect(counts.iban).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createRedactionMiddleware — wraps a stub model
// ---------------------------------------------------------------------------

/**
 * Build a stub `LanguageModelV3` that captures the prompt it received and
 * emits a deterministic response (text + finish). Lets us assert the
 * out-bound transformParams pass and the in-bound wrap pass independently
 * without hitting a real provider.
 */
function makeStubModel(opts: {
  generateText?: string;
  streamText?: string;
}): {
  model: LanguageModelV3;
  capturedPrompt: () => LanguageModelV3CallOptions["prompt"] | undefined;
} {
  let captured: LanguageModelV3CallOptions["prompt"] | undefined;

  const model: LanguageModelV3 = {
    specificationVersion: "v3",
    provider: "stub",
    modelId: "stub-model",
    supportedUrls: {},
    async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
      captured = options.prompt;
      const text = opts.generateText ?? "ok";
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
        warnings: [],
      };
    },
    async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
      captured = options.prompt;
      const text = opts.streamText ?? opts.generateText ?? "ok";
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "t1" });
          controller.enqueue({ type: "text-delta", id: "t1", delta: text });
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
          });
          controller.close();
        },
      });
      return { stream };
    },
  };

  return { model, capturedPrompt: () => captured };
}

describe("createRedactionMiddleware (generate path)", () => {
  it("strips PII from the prompt before the model sees it", async () => {
    const logInfo = vi.fn();
    const { model, capturedPrompt } = makeStubModel({ generateText: "thanks" });
    const wrapped = wrapLanguageModel({
      model,
      middleware: createRedactionMiddleware({ logger: { info: logInfo } }),
    });

    await generateText({
      model: wrapped,
      messages: [
        { role: "user", content: "Mijn BSN is 111222333 en mijn email is ronan@example.com" },
      ],
    });

    const prompt = capturedPrompt();
    expect(prompt).toBeDefined();
    const userMsg = prompt!.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    // The text part should no longer contain the raw PII.
    const userContent = JSON.stringify(userMsg);
    expect(userContent).not.toContain("111222333");
    expect(userContent).not.toContain("ronan@example.com");
    expect(userContent).toContain("[REDACTED_BSN]");
    expect(userContent).toContain("[REDACTED_EMAIL]");

    // Out-bound log entry fired with counts only.
    const outCalls = logInfo.mock.calls.filter(
      (c) => c[0] === "ai.redacted" && c[1].direction === "out",
    );
    expect(outCalls).toHaveLength(1);
    expect(outCalls[0][1].total).toBeGreaterThanOrEqual(2);
    expect(outCalls[0][1]).not.toHaveProperty("text");
  });

  it("strips PII from the model's response", async () => {
    const logInfo = vi.fn();
    const { model } = makeStubModel({
      generateText: "Bel naar 0612345678 of mail ronan@example.com",
    });
    const wrapped = wrapLanguageModel({
      model,
      middleware: createRedactionMiddleware({ logger: { info: logInfo } }),
    });

    const result = await generateText({
      model: wrapped,
      messages: [{ role: "user", content: "geef contactgegevens" }],
    });

    expect(result.text).toContain("[REDACTED_PHONE]");
    expect(result.text).toContain("[REDACTED_EMAIL]");
    expect(result.text).not.toContain("0612345678");
    expect(result.text).not.toContain("ronan@example.com");

    const inCalls = logInfo.mock.calls.filter(
      (c) => c[0] === "ai.redacted" && c[1].direction === "in",
    );
    expect(inCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("createRedactionMiddleware (stream path)", () => {
  it("redacts text-delta parts in the stream", async () => {
    const logInfo = vi.fn();
    const { model } = makeStubModel({
      streamText: "Mijn email is ronan@example.com.",
    });
    const wrapped = wrapLanguageModel({
      model,
      middleware: createRedactionMiddleware({ logger: { info: logInfo } }),
    });

    const result = streamText({
      model: wrapped,
      messages: [{ role: "user", content: "Hoi" }],
    });

    let full = "";
    for await (const chunk of result.textStream) {
      full += chunk;
    }
    expect(full).toContain("[REDACTED_EMAIL]");
    expect(full).not.toContain("ronan@example.com");
  });
});

describe("redactionMiddleware default export", () => {
  it("is a v3 middleware with all three handlers", () => {
    expect(redactionMiddleware.specificationVersion).toBe("v3");
    expect(typeof redactionMiddleware.transformParams).toBe("function");
    expect(typeof redactionMiddleware.wrapGenerate).toBe("function");
    expect(typeof redactionMiddleware.wrapStream).toBe("function");
  });
});
