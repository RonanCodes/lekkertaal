import { describe, it, expect } from "vitest";
import { buildDescribePrompt } from "../multimodal-prompts";

/**
 * Unit tests for the multimodal prompt builder used by
 * `POST /api/drills/describe-image` (AI-SDK-7). The route itself is auth-gated
 * and hits a real LLM, so the unit-test surface here is the pure helper that
 * shapes the user message into the `{ type: 'image' | 'text' }` content
 * parts the Vercel AI SDK expects for multimodal calls.
 */
describe("buildDescribePrompt", () => {
  it("returns a user-role message with one image and one text part", () => {
    const msg = buildDescribePrompt("https://images.example.test/kat.png");
    expect(msg.role).toBe("user");
    expect(msg.content).toHaveLength(2);

    const imagePart = msg.content.find((c) => c.type === "image");
    const textPart = msg.content.find((c) => c.type === "text");

    expect(imagePart).toBeDefined();
    expect(textPart).toBeDefined();
  });

  it("ships the imageUrl as a URL object on the image part", () => {
    const msg = buildDescribePrompt("https://images.example.test/hond.png");
    const imagePart = msg.content.find((c) => c.type === "image");
    if (!imagePart || imagePart.type !== "image") throw new Error("missing image part");
    expect(imagePart.image).toBeInstanceOf(URL);
    expect(imagePart.image.toString()).toBe("https://images.example.test/hond.png");
  });

  it("asks for a Dutch A2 description in the text part", () => {
    const msg = buildDescribePrompt("https://images.example.test/boek.png");
    const textPart = msg.content.find((c) => c.type === "text");
    if (!textPart || textPart.type !== "text") throw new Error("missing text part");
    // Dutch instruction, not English; mentions A2 level explicitly.
    expect(textPart.text.toLowerCase()).toContain("nederlands");
    expect(textPart.text.toLowerCase()).toContain("a2");
  });

  it("throws on a malformed URL string", () => {
    expect(() => buildDescribePrompt("not-a-url")).toThrow();
  });
});
