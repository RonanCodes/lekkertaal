/**
 * Multimodal prompt builders for AI-SDK-7 image-input drills.
 *
 * The Vercel AI SDK accepts user messages whose `content` is an array of
 * content parts. For multimodal (vision) calls the part array mixes
 * `{ type: 'image', image: URL | Uint8Array | string }` with
 * `{ type: 'text', text: string }`. This module centralises the
 * lekkertaal-specific Dutch A2 prompts so the routes that talk to Claude /
 * GPT vision stay thin.
 *
 * Tested in `src/lib/server/__tests__/multimodal-prompts.test.ts`.
 */

export type ImageContentPart = { type: "image"; image: URL };
export type TextContentPart = { type: "text"; text: string };
export type MultimodalUserMessage = {
  role: "user";
  content: Array<ImageContentPart | TextContentPart>;
};

/**
 * Build the prompt that asks the model to describe an object in a photo
 * using simple Dutch (A2 level). Used by
 * `POST /api/drills/describe-image` and (in future) any dynamic
 * image-driven exercise generator.
 */
export function buildDescribePrompt(imageUrl: string): MultimodalUserMessage {
  return {
    role: "user",
    content: [
      { type: "image", image: new URL(imageUrl) },
      {
        type: "text",
        text:
          "Beschrijf het object op deze foto in een korte zin, in eenvoudig Nederlands op A2-niveau. " +
          "Maximaal 12 woorden. Geen vertaling, geen Engelse woorden.",
      },
    ],
  };
}
