/**
 * Static name → Lucide-component map for shop item icons.
 *
 * Why static, not dynamic: `await import("lucide-react")[name]` defeats
 * tree-shaking and pulls the entire ~1k-icon Lucide barrel into the bundle.
 * We explicitly import every icon name the shop catalogue can produce, plus
 * a fallback (`Gift`) so an unknown / stale `iconName` never blanks the UI.
 *
 * Add a new shop item icon here AND in the seed/catalogue at the same time.
 *
 * See US-010 (#137) for context — this replaces the previous per-item emoji
 * glyphs (❄️, 💡) with Lucide components to match the rest of the app's icon
 * sweep from PR #123.
 */
import { Coins, Gift, Lightbulb, Snowflake, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SHOP_ICON_MAP: Record<string, LucideIcon> = {
  Coins,
  Gift,
  Lightbulb,
  Snowflake,
  Ticket,
};

export const SHOP_ICON_FALLBACK: LucideIcon = Gift;

/**
 * Resolve a shop item's `iconName` to a Lucide component.
 *
 * Null / unknown name → `Gift` fallback. Never throws.
 */
export function resolveShopIcon(name: string | null | undefined): LucideIcon {
  if (!name) return SHOP_ICON_FALLBACK;
  return SHOP_ICON_MAP[name] ?? SHOP_ICON_FALLBACK;
}
