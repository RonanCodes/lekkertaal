/**
 * Unit tests for the shop icon resolver + integration that the catalogue's
 * `iconName` values are all covered by the static Lucide map.
 *
 * The static-map approach (US-010 / #137) is load-bearing for bundle size:
 * a missing entry would silently fall back to Gift in prod. Catching that in
 * a test means the engineer adding a new shop item is forced to also add the
 * matching Lucide import.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Gift, Snowflake, Lightbulb } from "lucide-react";
import {
  resolveShopIcon,
  SHOP_ICON_MAP,
  SHOP_ICON_FALLBACK,
} from "../shop-icons";
import { SHOP_CATALOGUE } from "../server/shop";

describe("resolveShopIcon", () => {
  it("resolves a known name to the matching Lucide component", () => {
    expect(resolveShopIcon("Snowflake")).toBe(Snowflake);
    expect(resolveShopIcon("Lightbulb")).toBe(Lightbulb);
  });

  it("falls back to Gift for null / undefined / empty name", () => {
    expect(resolveShopIcon(null)).toBe(Gift);
    expect(resolveShopIcon(undefined)).toBe(Gift);
    expect(resolveShopIcon("")).toBe(Gift);
  });

  it("falls back to Gift for an unknown name (no throw)", () => {
    expect(resolveShopIcon("ThisIconDoesNotExist")).toBe(Gift);
  });

  it("exposes Gift as the documented fallback", () => {
    expect(SHOP_ICON_FALLBACK).toBe(Gift);
  });

  it("renders the resolved icon component into the DOM", () => {
    const Icon = resolveShopIcon("Snowflake");
    const { container } = render(<Icon aria-label="snowflake" />);
    // Lucide ships an inline <svg> with a lucide-* class; assert the
    // resolved component actually mounts something visible.
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("snowflake");
  });
});

describe("SHOP_CATALOGUE icon coverage", () => {
  it("every catalogue item's iconName resolves to a non-fallback icon", () => {
    for (const item of SHOP_CATALOGUE) {
      expect(item.iconName, `${item.id} should declare an iconName`).toBeTruthy();
      const resolved = resolveShopIcon(item.iconName);
      expect(
        resolved,
        `${item.id} declares iconName="${item.iconName}" which falls back to Gift — ` +
          "add the Lucide import to src/lib/shop-icons.ts SHOP_ICON_MAP",
      ).not.toBe(SHOP_ICON_FALLBACK);
    }
  });

  it("every catalogue iconName is a key in SHOP_ICON_MAP", () => {
    const mapKeys = new Set(Object.keys(SHOP_ICON_MAP));
    for (const item of SHOP_CATALOGUE) {
      expect(mapKeys.has(item.iconName)).toBe(true);
    }
  });
});
