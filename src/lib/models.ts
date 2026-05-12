import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

// Provider abstraction per /ro:new-tanstack-app canon.
// Swap providers by changing one import here. Ralph stories may extend.

export const models = {
  primary: anthropic("claude-sonnet-4-5"),
  fast: anthropic("claude-haiku-4-5"),
  alternate: openai("gpt-4o-mini"),
  cheap: google("gemini-2.0-flash"),
  image: google("gemini-2.5-flash-image-preview"), // Nano Banana 2
} as const;
