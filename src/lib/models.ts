import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { wrapLanguageModel } from "ai";
import { redactionMiddleware } from "./server/redaction-middleware";

// Provider abstraction per /ro:new-tanstack-app canon.
// Swap providers by changing one import here. Ralph stories may extend.
//
// Every language-model export is wrapped with `redactionMiddleware` so
// PII (email, Dutch BSN, phone, IBAN) is stripped from prompts BEFORE the
// provider sees them and from responses BEFORE the AI SDK hands them back
// to the caller. See `src/lib/server/redaction-middleware.ts`. Image
// generation runs unwrapped — it takes prompts, not chat messages, and
// call sites for image gen do not accept user-generated content.

export const models = {
  primary: wrapLanguageModel({
    model: anthropic("claude-sonnet-4-5"),
    middleware: redactionMiddleware,
  }),
  fast: wrapLanguageModel({
    model: anthropic("claude-haiku-4-5"),
    middleware: redactionMiddleware,
  }),
  alternate: wrapLanguageModel({
    model: openai("gpt-4o-mini"),
    middleware: redactionMiddleware,
  }),
  cheap: wrapLanguageModel({
    model: google("gemini-2.0-flash"),
    middleware: redactionMiddleware,
  }),
  image: google("gemini-2.5-flash-image-preview"), // Nano Banana 2 — image gen, not chat
} as const;
