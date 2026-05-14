/**
 * Logger built on Logtape. Two sinks:
 *
 *   - `console` — always on. Structured JSON to stdout, which becomes the
 *                Vite terminal locally + `wrangler tail` in prod.
 *   - `sentry`  — enabled when SENTRY_DSN is set. `@logtape/sentry`'s
 *                `getSentrySink()` forwards records to the global Sentry
 *                instance, and `enableBreadcrumbs` turns info+ records into
 *                Sentry breadcrumbs so error reports carry the trail.
 *
 * Level rules (lowest-permits → highest-only):
 *
 *   trace < debug < info < warning < error < fatal
 *
 *   - Default minimum: `info`
 *   - Override globally via env `LOG_LEVEL=debug|info|warning|error|fatal`
 *   - Override per-request via `?debug=1` (or `x-lekkertaal-debug: 1` header).
 *     Wrap the request handler with `withRequestLogContext(request, fn)`.
 *     AsyncLocalStorage carries the effective minimum level per-request.
 *
 * Configure ONCE per worker boot via `configureLogger({ env })` from
 * `entry.server.ts`. Subsequent calls are idempotent and cheap.
 *
 * Usage:
 *
 *   import { log } from '#/lib/logger'
 *   log.info('user signed in', { userId, plan: 'free' })
 *   log.debug('drill graded', { drillId, ok, attempts })
 *   log.error('TTS fetch failed', { text, voiceId, status, err })
 */
import { AsyncLocalStorage } from "node:async_hooks";
import {
  configure,
  getConsoleSink,
  getLogger
  
  
  
} from "@logtape/logtape";
import type {LogLevel, LogRecord, Sink} from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";

const VALID_LEVELS: ReadonlyArray<LogLevel> = [
  "trace",
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
];

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warning: 30,
  error: 40,
  fatal: 50,
};

/**
 * Request-scoped log context. Each in-flight request that wants per-call
 * debug logging stores its effective minimum level here. The console sink's
 * filter reads this on every record; no store → fall back to env baseline.
 */
const requestContext = new AsyncLocalStorage<{ minLevel: LogLevel }>();

let configured = false;
let baselineLevel: LogLevel = "info";

function parseLevel(raw: string | undefined, fallback: LogLevel): LogLevel {
  if (!raw) return fallback;
  const cand = raw.toLowerCase() as LogLevel;
  return VALID_LEVELS.includes(cand) ? cand : fallback;
}

/**
 * Filter passed to every sink. Permits a record iff its level >= the effective
 * minimum, where the minimum is request-scoped if set, else the baseline.
 */
function effectiveMin(): LogLevel {
  return requestContext.getStore()?.minLevel ?? baselineLevel;
}

function shouldEmit(record: LogRecord): boolean {
  const min = effectiveMin();
  return LEVEL_ORDER[record.level] >= LEVEL_ORDER[min];
}

/**
 * Configure the logger. Idempotent — only configures once per worker.
 * Subsequent calls update the baseline level if env.LOG_LEVEL changed.
 */
export function configureLogger(opts: {
  env: { LOG_LEVEL?: string; SENTRY_DSN?: string };
}): void {
  baselineLevel = parseLevel(opts.env.LOG_LEVEL, "info");
  if (configured) return;
  configured = true;

  const sinks: Record<string, Sink> = {
    console: getConsoleSink({ formatter: jsonFormatter }),
  };

  if (opts.env.SENTRY_DSN) {
    try {
      sinks.sentry = getSentrySink({
        enableBreadcrumbs: true,
      });
    } catch {
      // Sentry sink wiring failed (e.g. no global Sentry). Fall back to
      // console-only; not worth surfacing further.
    }
  }

  configure({
    sinks,
    filters: { byLevel: shouldEmit },
    loggers: [
      {
        category: ["lekkertaal"],
        sinks: Object.keys(sinks),
        filters: ["byLevel"],
      },
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: "warning",
      },
    ],
    reset: false,
  });
}

/** JSON-line formatter; one event per line, easy to grep + parse. */
function jsonFormatter(record: LogRecord): string {
  return (
    JSON.stringify({
      ts: new Date(record.timestamp).toISOString(),
      level: record.level,
      category: record.category.join("."),
      msg: typeof record.message === "string" ? record.message : record.message.join(" "),
      ...record.properties,
    }) + "\n"
  );
}

/** Root logger for app code. Children: log.getChild('roleplay') etc. */
export const log = getLogger(["lekkertaal"]);

/**
 * Run a handler with a request-scoped log context. Inspects the request for
 * a `?debug=1` query param or an `x-lekkertaal-debug: 1` header; if either is
 * set, raises the per-request minimum level to `debug`.
 *
 * Usage from inside entry.server.ts:
 *
 *   await withRequestLogContext(request, () => baseFetch(request))
 */
export async function withRequestLogContext<T>(
  request: Request,
  fn: () => Promise<T>,
): Promise<T> {
  const url = new URL(request.url);
  const wantsDebug =
    url.searchParams.get("debug") === "1" ||
    request.headers.get("x-lekkertaal-debug") === "1";
  const minLevel: LogLevel = wantsDebug ? "debug" : baselineLevel;
  return requestContext.run({ minLevel }, fn);
}
