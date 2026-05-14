/**
 * AI SDK telemetry sink.
 *
 * Every Vercel AI SDK Core call (`streamText`, `generateObject`, `streamObject`)
 * funnels token / latency / model info through this module. Two outputs:
 *
 *   1. Logtape `log.info("ai.call", payload)` — structured JSON to stdout +
 *      Sentry breadcrumbs (via the existing logger config).
 *   2. PostHog `$capture` event named `ai_sdk_call` — fire-and-forget HTTP
 *      POST when POSTHOG_PROJECT_KEY is set. Used for cost / retention
 *      dashboards.
 *
 * The AI SDK's `experimental_telemetry: { isEnabled, functionId, metadata }`
 * is still set on every call site so the option is wired and consistent
 * (and so if an OpenTelemetry tracer is later registered, spans flow without
 * touching call sites). The token + latency capture itself runs in
 * `onFinish` and posts here.
 *
 * Why not posthog-node: the SDK targets Node + drags timers / sockets that
 * don't survive Cloudflare Workers cleanly. PostHog's `/capture/` HTTP API
 * is a single POST with a JSON body; no SDK needed.
 */
import { log } from "./logger";

const POSTHOG_DEFAULT_HOST = "https://eu.i.posthog.com";

export type AiCallPayload = {
  /** Stable identifier for the call site, e.g. "roleplay.stream", "roleplay.grade". */
  functionId: string;
  /** Provider model id, e.g. "claude-haiku-4-5". */
  model: string;
  /** Wall-clock milliseconds from request start to onFinish. */
  latencyMs: number;
  /** Prompt / input tokens billed. */
  promptTokens?: number;
  /** Completion / output tokens billed. */
  completionTokens?: number;
  /** Total tokens (prompt + completion). */
  totalTokens?: number;
  /** Cached tokens (Anthropic prompt cache hit). */
  cachedTokens?: number;
  /** Reason the call stopped — "stop", "length", "tool-calls", "error". */
  finishReason?: string;
  /** Clerk user id when the call ran inside an authenticated request. */
  userId?: string;
  /** Roleplay scenario slug (or other domain-specific tag). */
  scenarioSlug?: string;
  /** Free-form extra metadata (sessionId, drillId, etc.). */
  extra?: Record<string, unknown>;
};

/**
 * Optional config for the PostHog sink. Pass at the call site (Worker
 * env vars are read inside the route handler, then handed in).
 */
export type AiTelemetryEnv = {
  POSTHOG_PROJECT_KEY?: string;
  POSTHOG_INGEST_HOST?: string;
};

/**
 * Normalise a raw AI SDK `usage` object into our flat payload. Tolerates the
 * v6 shape (inputTokens / outputTokens / totalTokens / cachedInputTokens) and
 * the older shape (promptTokens / completionTokens). Missing fields stay
 * `undefined` rather than 0 so we never imply data we don't have.
 */
export function normaliseUsage(usage: unknown): {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
} {
  if (!usage || typeof usage !== "object") return {};
  const u = usage as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const promptTokens = num(u.inputTokens) ?? num(u.promptTokens);
  const completionTokens = num(u.outputTokens) ?? num(u.completionTokens);
  const totalTokens =
    num(u.totalTokens) ??
    (promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined);
  const cachedTokens =
    num(u.cachedInputTokens) ?? num(u.cachedPromptTokens) ?? num(u.cacheReadInputTokens);

  return { promptTokens, completionTokens, totalTokens, cachedTokens };
}

/**
 * Build a payload from the AI SDK's `onFinish` arguments. Kept pure so it's
 * trivial to unit test.
 */
export function buildAiCallPayload(args: {
  functionId: string;
  model: string;
  startedAt: number;
  usage?: unknown;
  finishReason?: string;
  userId?: string;
  scenarioSlug?: string;
  extra?: Record<string, unknown>;
  now?: number;
}): AiCallPayload {
  const now = args.now ?? Date.now();
  const latencyMs = Math.max(0, now - args.startedAt);
  const usage = normaliseUsage(args.usage);
  return {
    functionId: args.functionId,
    model: args.model,
    latencyMs,
    ...usage,
    finishReason: args.finishReason,
    userId: args.userId,
    scenarioSlug: args.scenarioSlug,
    extra: args.extra,
  };
}

/**
 * Emit an AI call event. Always logs; optionally fires a PostHog capture if
 * `env.POSTHOG_PROJECT_KEY` is set. Never throws — telemetry must not break
 * the request that produced it.
 */
export function emitAiCall(
  payload: AiCallPayload,
  env?: AiTelemetryEnv,
  ctx?: { waitUntil?: (p: Promise<unknown>) => void },
): void {
  try {
    log.info("ai.call", { ...payload });
  } catch {
    // ignore: logger sink misconfigured
  }

  if (!env?.POSTHOG_PROJECT_KEY) return;

  const host = env.POSTHOG_INGEST_HOST || POSTHOG_DEFAULT_HOST;
  const body = {
    api_key: env.POSTHOG_PROJECT_KEY,
    event: "ai_sdk_call",
    distinct_id: payload.userId || "anonymous",
    properties: {
      function_id: payload.functionId,
      model: payload.model,
      latency_ms: payload.latencyMs,
      prompt_tokens: payload.promptTokens,
      completion_tokens: payload.completionTokens,
      total_tokens: payload.totalTokens,
      cached_tokens: payload.cachedTokens,
      finish_reason: payload.finishReason,
      scenario_slug: payload.scenarioSlug,
      ...payload.extra,
    },
    timestamp: new Date().toISOString(),
  };

  const send = fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(() => undefined)
    .catch((err) => {
      try {
        log.warning("ai.telemetry posthog capture failed", { err: String(err) });
      } catch {
        // ignore
      }
    });

  // Cloudflare Workers: hand the promise to waitUntil so it survives the
  // response without blocking. Outside a Worker context (tests, local), we
  // just leave it dangling — fetch is mocked or hits a stub.
  if (ctx?.waitUntil) {
    try {
      ctx.waitUntil(send);
    } catch {
      // ignore — fallback to dangling promise
    }
  }
}
