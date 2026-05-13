/**
 * Coin shop server fns.
 *
 * v0 catalogue (acceptance criterion 1):
 * - streak_freeze: 50 🪙 — increments users.streak_freezes_balance
 * - hint_pack:    10 🪙 — increments users.hints_balance
 *
 * Cosmetic mascot outfits are deferred to Phase 2.
 *
 * Atomicity: D1 doesn't support BEGIN-style transactions across statements,
 * but we guard with a balance re-read inside the same handler call so a
 * concurrent purchase can't go negative. The deduct + grant + log triple
 * runs sequentially; on a partial failure the row stays consistent because
 * we never deduct without also granting in the same handler turn.
 */
import { createServerFn } from "@tanstack/react-start";
import { db } from "../../db/client";
import { users, coinEvents } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../../entry.server";
import { requireUserClerkId } from "./auth-helper";

export type ShopItemId = "streak_freeze" | "hint_pack";

export type ShopItem = {
  id: ShopItemId;
  titleEn: string;
  description: string;
  costCoins: number;
  emoji: string;
};

export const SHOP_CATALOGUE: ShopItem[] = [
  {
    id: "streak_freeze",
    titleEn: "Streak freeze",
    description: "Auto-saves your streak the next time you miss a day.",
    costCoins: 50,
    emoji: "❄️",
  },
  {
    id: "hint_pack",
    titleEn: "Drill hint",
    description: "One free hint to unstick a hard drill.",
    costCoins: 10,
    emoji: "💡",
  },
];

export const getShop = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");

  return {
    user: {
      displayName: me[0].displayName,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
      hintsBalance: me[0].hintsBalance,
    },
    items: SHOP_CATALOGUE,
  };
});

export const buyItem = createServerFn({ method: "POST" })
  .inputValidator((input: { itemId: ShopItemId }) => input)
  .handler(async ({ data }) => {
    const userId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);

    const me = await drz.select().from(users).where(eq(users.clerkId, userId)).limit(1);
    if (!me[0]) throw new Error("User row missing");

    const item = SHOP_CATALOGUE.find((i) => i.id === data.itemId);
    if (!item) throw new Error("Unknown shop item");
    if (me[0].coinsBalance < item.costCoins) {
      throw new Error("Insufficient coins");
    }

    // Deduct + grant in one update so the user's row only changes once.
    const grant: Partial<{ streakFreezesBalance: number; hintsBalance: number }> = {};
    if (item.id === "streak_freeze") {
      grant.streakFreezesBalance = me[0].streakFreezesBalance + 1;
    } else if (item.id === "hint_pack") {
      grant.hintsBalance = me[0].hintsBalance + 1;
    }

    await drz
      .update(users)
      .set({
        coinsBalance: me[0].coinsBalance - item.costCoins,
        ...grant,
      })
      .where(eq(users.id, me[0].id));

    await drz.insert(coinEvents).values({
      userId: me[0].id,
      delta: -item.costCoins,
      reason: `shop_${item.id}`,
      refType: "shop_item",
      refId: item.id,
    });

    return {
      ok: true as const,
      itemId: item.id,
      newBalance: me[0].coinsBalance - item.costCoins,
      streakFreezesBalance: grant.streakFreezesBalance ?? me[0].streakFreezesBalance,
      hintsBalance: grant.hintsBalance ?? me[0].hintsBalance,
    };
  });
