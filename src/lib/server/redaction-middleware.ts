/**
 * PII redaction for AI SDK calls and persisted transcripts.
 *
 * Two surfaces:
 *
 *  1. `redactText(input)` — pure regex sweep. Replaces emails, Dutch BSN
 *     numbers, phone numbers, and IBANs with stable placeholders. Returns
 *     the cleaned text plus a `matches` array describing what was hit, so
 *     the caller can log without re-leaking the original PII.
 *
 *  2. `createRedactionMiddleware()` — Vercel AI SDK
 *     `LanguageModelV3Middleware`. Wraps any model so:
 *
 *       - `transformParams` runs on the OUT-bound prompt: every text part
 *         in every message (and the `system` string) is rewritten. PII
 *         never reaches the provider.
 *       - `wrapStream` / `wrapGenerate` run on the IN-bound response: model
 *         output is redacted before the AI SDK hands it to consumers.
 *         Belt-and-suspenders for the rare case where the model parrots
 *         back something it should not have seen.
 *
 *     Both directions emit `log.info("ai.redacted", { direction, matches })`
 *     when at least one pattern hits. Counts and types only — never the raw
 *     PII. Sits alongside the `ai.call` telemetry sink (PR #65).
 *
 * The middleware is stateless and safe to share across requests. Wrap each
 * model export in `src/lib/models.ts` so call sites get redaction for free.
 *
 * Patterns covered:
 *   - email           — RFC-5322-lite, common shapes
 *   - bsn             — Dutch tax id, 8 or 9 digits, 11-proof checksum
 *   - phone           — international (+31 …), Dutch local (06 …, 020 …)
 *   - iban            — country code + 2 check digits + up to 30 alnum
 *
 * Trade-off: false positives are preferred over false negatives. A flagged
 * order number is harmless; a leaked BSN is not.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3Message,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import { log } from "../logger";

// ---------------------------------------------------------------------------
// Pattern types + placeholders
// ---------------------------------------------------------------------------

export type RedactionKind = "email" | "bsn" | "phone" | "iban";

export type RedactionMatch = {
  kind: RedactionKind;
  /** Length of the original token. The raw token is NEVER stored. */
  length: number;
};

const PLACEHOLDERS: Record<RedactionKind, string> = {
  email: "[REDACTED_EMAIL]",
  bsn: "[REDACTED_BSN]",
  phone: "[REDACTED_PHONE]",
  iban: "[REDACTED_IBAN]",
};

// Order matters: IBAN before phone (an IBAN's digit run can otherwise be
// chewed by the phone regex), email before phone (an email's local part can
// look like digits), BSN after phone (the phone regex eats the leading
// country/area code so the bare 8-9 digit run that's left is the BSN).
const PATTERNS: Array<{
  kind: RedactionKind;
  regex: RegExp;
  /** Optional gate so we can apply context checks (e.g. BSN 11-proof). */
  accept?: (match: string) => boolean;
}> = [
  {
    kind: "email",
    // RFC-5322-lite: local@domain.tld with common chars. Lower-case `i` so
    // `.UK` and `.uk` both match.
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    kind: "iban",
    // 2-letter country, 2 check digits, 11–30 alphanumerics (allowing
    // spaces every 4 chars in pretty-printed form). Strip spaces before
    // measuring length so "NL91 ABNA 0417 1643 00" matches.
    regex: /\b[A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]){11,30}\b/g,
  },
  {
    kind: "phone",
    // International (+CC, optional spaces / dashes / parens, 7-14 digits) OR
    // Dutch local (0 followed by 9 digits, with optional separators).
    // Tightened with leading word-boundary so we don't eat trailing digits
    // off random numerics.
    regex:
      /(?:\+\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){1,4}\d{2,4}|\b0\d(?:[\s.-]?\d){8})\b/g,
  },
  {
    kind: "bsn",
    // 8 or 9 contiguous digits, isolated by word boundaries. Validated
    // with the 11-proof checksum so we don't redact every order id.
    regex: /\b\d{8,9}\b/g,
    accept: isValidBsn,
  },
];

/**
 * Dutch BSN 11-proof checksum.
 * 9-digit form: sum of (digit_i * weight_i) where weights are
 *   [9, 8, 7, 6, 5, 4, 3, 2, -1] (last weight negative).
 * Sum must be divisible by 11 AND non-zero.
 *
 * 8-digit form: prepend a leading 0, then apply the 9-digit rule.
 */
export function isValidBsn(input: string): boolean {
  if (!/^\d{8,9}$/.test(input)) return false;
  const padded = input.length === 8 ? `0${input}` : input;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(padded[i]) * weights[i];
  }
  if (sum === 0) return false;
  return sum % 11 === 0;
}

// ---------------------------------------------------------------------------
// Pure redactor
// ---------------------------------------------------------------------------

export type RedactResult = {
  text: string;
  matches: RedactionMatch[];
};

/**
 * Run every PII pattern against `input` and return the cleaned string plus
 * a structured list of what was redacted (kind + length only — the raw
 * token is never returned). Pure; safe to call from anywhere.
 */
export function redactText(input: string): RedactResult {
  if (!input) return { text: input ?? "", matches: [] };

  let text = input;
  const matches: RedactionMatch[] = [];

  for (const { kind, regex, accept } of PATTERNS) {
    // Reset lastIndex on each pass — the regex objects are module-scoped
    // and stateful with the /g flag.
    regex.lastIndex = 0;
    text = text.replace(regex, (raw) => {
      if (accept && !accept(raw)) return raw;
      matches.push({ kind, length: raw.length });
      return PLACEHOLDERS[kind];
    });
  }

  return { text, matches };
}

/**
 * Sum match counts grouped by kind. Used to build a logger-safe summary.
 */
export function summariseMatches(
  matches: RedactionMatch[],
): Record<RedactionKind, number> {
  const counts: Record<RedactionKind, number> = {
    email: 0,
    bsn: 0,
    phone: 0,
    iban: 0,
  };
  for (const m of matches) {
    counts[m.kind] += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Prompt + content walkers
// ---------------------------------------------------------------------------

/**
 * Walk a `LanguageModelV3Prompt` (the array of system / user / assistant /
 * tool messages) and redact every text-bearing leaf in place. Returns a new
 * array; never mutates input.
 */
export function redactPrompt(prompt: LanguageModelV3Message[]): {
  prompt: LanguageModelV3Message[];
  matches: RedactionMatch[];
} {
  const matches: RedactionMatch[] = [];
  const out: LanguageModelV3Message[] = prompt.map((message) => {
    if (message.role === "system") {
      const r = redactText(message.content);
      matches.push(...r.matches);
      return { ...message, content: r.text };
    }

    // user / assistant / tool: content is an array of parts. We rewrite text
    // and reasoning parts; tool-call inputs and tool-result outputs are
    // structured JSON and pass through untouched (redacting them risks
    // breaking schema-validated payloads). File parts hold binary data and
    // are not in scope.
    const newContent = (message.content as Array<unknown>).map((part) => {
      const p = part as { type: string; text?: string };
      if ((p.type === "text" || p.type === "reasoning") && typeof p.text === "string") {
        const r = redactText(p.text);
        matches.push(...r.matches);
        return { ...p, text: r.text };
      }
      return part;
    });
    return { ...message, content: newContent } as LanguageModelV3Message;
  });

  return { prompt: out, matches };
}

/**
 * Redact the text-bearing parts of a doGenerate result. Pure.
 */
function redactGenerateResult(
  result: LanguageModelV3GenerateResult,
): { result: LanguageModelV3GenerateResult; matches: RedactionMatch[] } {
  const matches: RedactionMatch[] = [];
  const newContent: LanguageModelV3Content[] = result.content.map((part) => {
    if (
      (part.type === "text" || part.type === "reasoning") &&
      typeof part.text === "string"
    ) {
      const r = redactText(part.text);
      matches.push(...r.matches);
      return { ...part, text: r.text };
    }
    return part;
  });
  return { result: { ...result, content: newContent }, matches };
}

/**
 * Wrap a stream so each `text-delta` and `reasoning-delta` part is
 * redacted on its way out. Counts are aggregated and emitted on the
 * `finish` part via a single `log.info("ai.redacted", ...)` call.
 *
 * Trade-off: per-delta redaction can split a PII token across two
 * deltas (e.g. "ronan@" / "example.com"). For chat replies that's
 * acceptable — most providers emit chunks of several tokens, so emails
 * and phone numbers usually arrive whole. Belt-and-suspenders, not a
 * perfect filter; the OUT-bound transformParams pass is the primary
 * defence.
 */
function wrapStreamWithRedaction(
  inner: ReadableStream<LanguageModelV3StreamPart>,
): { stream: ReadableStream<LanguageModelV3StreamPart>; finalMatches: () => RedactionMatch[] } {
  const matches: RedactionMatch[] = [];
  const transform = new TransformStream<
    LanguageModelV3StreamPart,
    LanguageModelV3StreamPart
  >({
    transform(part, controller) {
      if (
        (part.type === "text-delta" || part.type === "reasoning-delta") &&
        typeof part.delta === "string"
      ) {
        const r = redactText(part.delta);
        matches.push(...r.matches);
        controller.enqueue({ ...part, delta: r.text });
        return;
      }
      controller.enqueue(part);
    },
  });

  return {
    stream: inner.pipeThrough(transform),
    finalMatches: () => matches,
  };
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

export type RedactionMiddlewareOptions = {
  /**
   * Override the logger. Tests inject a mock; production leaves this
   * undefined so the module-level Logtape sink is used.
   */
  logger?: { info: (msg: string, payload: Record<string, unknown>) => void };
  /**
   * Optional tag passed through to `ai.redacted` log entries so we can tell
   * which model wrapper produced the event when several are stacked.
   */
  modelTag?: string;
};

/**
 * Build a `wrapLanguageModel`-compatible middleware that strips PII on the
 * way out and on the way in. Stateless and reusable.
 */
export function createRedactionMiddleware(
  opts: RedactionMiddlewareOptions = {},
): LanguageModelV3Middleware {
  const sink = opts.logger ?? log;
  const tag = opts.modelTag;

  function emit(direction: "out" | "in", matches: RedactionMatch[], extra?: Record<string, unknown>) {
    if (matches.length === 0) return;
    try {
      sink.info("ai.redacted", {
        direction,
        total: matches.length,
        counts: summariseMatches(matches),
        modelTag: tag,
        ...extra,
      });
    } catch {
      // Telemetry must never break the request.
    }
  }

  return {
    specificationVersion: "v3",

    async transformParams({ params }): Promise<LanguageModelV3CallOptions> {
      const { prompt, matches } = redactPrompt(params.prompt);
      emit("out", matches, { messageCount: params.prompt.length });
      return { ...params, prompt };
    },

    async wrapGenerate({ doGenerate }): Promise<LanguageModelV3GenerateResult> {
      const result = await doGenerate();
      const { result: cleaned, matches } = redactGenerateResult(result);
      emit("in", matches);
      return cleaned;
    },

    async wrapStream({ doStream }): Promise<LanguageModelV3StreamResult> {
      const inner = await doStream();
      const { stream, finalMatches } = wrapStreamWithRedaction(inner.stream);

      // Emit a single in-bound log line when the stream fully drains. We do
      // it via a tail TransformStream so consumers don't need to do anything
      // special.
      let emitted = false;
      const tail = new TransformStream<
        LanguageModelV3StreamPart,
        LanguageModelV3StreamPart
      >({
        transform(part, controller) {
          if (part.type === "finish" && !emitted) {
            emitted = true;
            emit("in", finalMatches());
          }
          controller.enqueue(part);
        },
        flush() {
          if (!emitted) {
            emitted = true;
            emit("in", finalMatches());
          }
        },
      });

      return { ...inner, stream: stream.pipeThrough(tail) };
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: pre-built middleware instance for the default models.ts wiring
// ---------------------------------------------------------------------------

/**
 * The middleware instance applied to `models.*` in `src/lib/models.ts`.
 * Re-exported so tests can assert reference equality and so call sites
 * that build models on the fly (with a Worker-bound API key) can re-use
 * the same wrapping.
 */
export const redactionMiddleware = createRedactionMiddleware();

/**
 * Convenience helper: wrap any LanguageModelV3 with our redaction middleware.
 * Lets streaming endpoints that build a per-request `createAnthropic({ apiKey })`
 * model still get the redaction without restating the wrap-options each time.
 */
export function withRedaction<TModel extends LanguageModelV3>(model: TModel): LanguageModelV3 {
  return wrapLanguageModel({ model, middleware: redactionMiddleware });
}
