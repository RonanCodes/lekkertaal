import { describe, it, expect } from "vitest";
import { isValidWord, stripHtml } from "../dictionary";

describe("isValidWord", () => {
  it("accepts lowercase Dutch single words", () => {
    expect(isValidWord("huis")).toBe(true);
    expect(isValidWord("gezellig")).toBe(true);
    expect(isValidWord("ijsje")).toBe(true);
  });
  it("accepts diacritics commonly found in Dutch", () => {
    expect(isValidWord("één")).toBe(true);
    expect(isValidWord("ëë")).toBe(true);
  });
  it("rejects whitespace, digits, punctuation", () => {
    expect(isValidWord("hello world")).toBe(false);
    expect(isValidWord("foo123")).toBe(false);
    expect(isValidWord("foo!")).toBe(false);
    expect(isValidWord("")).toBe(false);
  });
  it("rejects words above 40 chars", () => {
    expect(isValidWord("a".repeat(41))).toBe(false);
    expect(isValidWord("a".repeat(40))).toBe(true);
  });
});

describe("stripHtml", () => {
  it("removes tags but preserves text", () => {
    expect(stripHtml('a <a href="x">house</a>, home')).toBe("a house, home");
  });
  it("decodes common entities", () => {
    expect(stripHtml("foo&nbsp;bar &amp; baz")).toBe("foo bar & baz");
  });
  it("collapses runs of whitespace", () => {
    expect(stripHtml("foo   <span>bar</span>   baz")).toBe("foo bar baz");
  });
  it("trims surrounding whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });
});
