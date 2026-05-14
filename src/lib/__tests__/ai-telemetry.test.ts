/**
 * Unit tests for the AI SDK telemetry sink.
 *
 * Focus: payload-shape correctness. We mock the logger and fetch to assert
 * the sink calls them with the right shape, without actually emitting logs
 * or hitting PostHog.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normaliseUsage,
  buildAiCallPayload,
  emitAiCall,
} from "../ai-telemetry";
import type { AiCallPayload } from "../ai-telemetry";

const logInfoMock = vi.fn();
const logWarningMock = vi.fn();

vi.mock("../logger", () => ({
  log: {
    info: (...args: unknown[]) => logInfoMock(...args),
    warning: (...args: unknown[]) => logWarningMock(...args),
  },
}));

describe("normaliseUsage", () => {
  it("returns empty object for nullish input", () => {
    expect(normaliseUsage(null)).toEqual({});
    expect(normaliseUsage(undefined)).toEqual({});
  });

  it("returns empty object for non-object input", () => {
    expect(normaliseUsage(42)).toEqual({});
    expect(normaliseUsage("hi")).toEqual({});
  });

  it("reads the AI SDK v6 shape (inputTokens / outputTokens / totalTokens)", () => {
    expect(
      normaliseUsage({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cachedInputTokens: 30,
      }),
    ).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cachedTokens: 30,
    });
  });

  it("falls back to legacy promptTokens / completionTokens", () => {
    expect(
      normaliseUsage({
        promptTokens: 80,
        completionTokens: 20,
      }),
    ).toEqual({
      promptTokens: 80,
      completionTokens: 20,
      totalTokens: 100,
      cachedTokens: undefined,
    });
  });

  it("computes totalTokens when missing if prompt + completion are known", () => {
    const r = normaliseUsage({ inputTokens: 10, outputTokens: 5 });
    expect(r.totalTokens).toBe(15);
  });

  it("leaves totalTokens undefined when both halves are missing", () => {
    const r = normaliseUsage({ inputTokens: 10 });
    expect(r.totalTokens).toBeUndefined();
  });

  it("rejects non-finite numbers", () => {
    expect(normaliseUsage({ inputTokens: NaN, outputTokens: Infinity })).toEqual({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
      cachedTokens: undefined,
    });
  });

  it("supports cacheReadInputTokens alias", () => {
    expect(normaliseUsage({ inputTokens: 5, cacheReadInputTokens: 3 })).toMatchObject({
      cachedTokens: 3,
    });
  });
});

describe("buildAiCallPayload", () => {
  it("normalises into a flat payload", () => {
    const p = buildAiCallPayload({
      functionId: "roleplay.stream",
      model: "claude-haiku-4-5",
      startedAt: 1_000,
      now: 1_250,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      finishReason: "stop",
      userId: "user_123",
      scenarioSlug: "bakery-order",
      extra: { sessionId: 7 },
    });
    expect(p).toEqual({
      functionId: "roleplay.stream",
      model: "claude-haiku-4-5",
      latencyMs: 250,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cachedTokens: undefined,
      finishReason: "stop",
      userId: "user_123",
      scenarioSlug: "bakery-order",
      extra: { sessionId: 7 },
    });
  });

  it("clamps negative latency to zero (clock skew)", () => {
    const p = buildAiCallPayload({
      functionId: "f",
      model: "m",
      startedAt: 2_000,
      now: 1_000,
    });
    expect(p.latencyMs).toBe(0);
  });

  it("handles missing usage gracefully", () => {
    const p = buildAiCallPayload({
      functionId: "f",
      model: "m",
      startedAt: 0,
      now: 10,
    });
    expect(p.functionId).toBe("f");
    expect(p.model).toBe("m");
    expect(p.latencyMs).toBe(10);
    expect(p.promptTokens).toBeUndefined();
    expect(p.completionTokens).toBeUndefined();
    expect(p.totalTokens).toBeUndefined();
  });
});

describe("emitAiCall", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    logInfoMock.mockReset();
    logWarningMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const basePayload: AiCallPayload = {
    functionId: "roleplay.stream",
    model: "claude-haiku-4-5",
    latencyMs: 200,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    cachedTokens: 20,
    finishReason: "stop",
    userId: "user_123",
    scenarioSlug: "bakery-order",
  };

  it("logs every call to log.info under msg 'ai.call'", () => {
    emitAiCall(basePayload);
    expect(logInfoMock).toHaveBeenCalledTimes(1);
    expect(logInfoMock).toHaveBeenCalledWith("ai.call", expect.objectContaining({
      functionId: "roleplay.stream",
      model: "claude-haiku-4-5",
      latencyMs: 200,
      promptTokens: 100,
      completionTokens: 50,
      cachedTokens: 20,
    }));
  });

  it("does not POST to PostHog when project key is absent", () => {
    emitAiCall(basePayload, {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to PostHog when project key is set", () => {
    emitAiCall(basePayload, { POSTHOG_PROJECT_KEY: "phc_test" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/capture\/$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "ai_sdk_call",
      distinct_id: "user_123",
      properties: {
        function_id: "roleplay.stream",
        model: "claude-haiku-4-5",
        latency_ms: 200,
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cached_tokens: 20,
        finish_reason: "stop",
        scenario_slug: "bakery-order",
      },
    });
  });

  it("uses POSTHOG_INGEST_HOST when provided", () => {
    emitAiCall(basePayload, {
      POSTHOG_PROJECT_KEY: "phc_test",
      POSTHOG_INGEST_HOST: "https://custom.posthog.example",
    });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://custom.posthog.example/capture/");
  });

  it("falls back to 'anonymous' distinct_id when userId is missing", () => {
    const { userId: _omit, ...anonPayload } = basePayload;
    emitAiCall(anonPayload, { POSTHOG_PROJECT_KEY: "phc_test" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.distinct_id).toBe("anonymous");
  });

  it("hands the PostHog fetch to ctx.waitUntil when available", () => {
    const waitUntilMock = vi.fn();
    emitAiCall(
      basePayload,
      { POSTHOG_PROJECT_KEY: "phc_test" },
      { waitUntil: waitUntilMock },
    );
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
    expect(waitUntilMock.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("never throws when log.info throws", () => {
    logInfoMock.mockImplementationOnce(() => {
      throw new Error("sink down");
    });
    expect(() => emitAiCall(basePayload)).not.toThrow();
  });

  it("swallows fetch failures (warning logged, no throw)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(() =>
      emitAiCall(basePayload, { POSTHOG_PROJECT_KEY: "phc_test" }),
    ).not.toThrow();
    // Let the rejected promise's catch handler run.
    await new Promise((r) => setTimeout(r, 0));
    expect(logWarningMock).toHaveBeenCalled();
  });
});
