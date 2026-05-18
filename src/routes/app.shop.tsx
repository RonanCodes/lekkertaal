import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, Lightbulb, Snowflake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getShop, buyItem  } from "../lib/server/shop";
import type {ShopItem} from "../lib/server/shop";
import { AppShell } from "../components/AppShell";
import { resolveShopIcon } from "../lib/shop-icons";

export const Route = createFileRoute("/app/shop")({
  loader: async () => await getShop(),
  component: ShopPage,
});

function ShopPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { user, items } = data;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function purchase(item: ShopItem) {
    if (pendingId) return;
    setPendingId(item.id);
    setMessage(null);
    try {
      const res = await buyItem({ data: { itemId: item.id } });
      setMessage(`Bought ${item.titleEn}! New balance: ${res.newBalance} coins`);
      router.invalidate();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Purchase failed, try again.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-xl space-y-6 py-2">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Shop</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Spend the coins you earned from lessons and roleplays.
          </p>
        </header>

        {/* Balances */}
        <div className="grid grid-cols-3 gap-3">
          <BalanceCard
            label="Coins"
            balanceKey="coins"
            value={user.coinsBalance}
            Icon={Coins}
            iconClassName="text-amber-500"
            highlight
          />
          <BalanceCard
            label="Streak freezes"
            balanceKey="streak-freezes"
            value={user.streakFreezesBalance}
            Icon={Snowflake}
            iconClassName="text-sky-500"
          />
          <BalanceCard
            label="Hints"
            balanceKey="hints"
            value={user.hintsBalance}
            Icon={Lightbulb}
            iconClassName="text-yellow-500"
          />
        </div>

        {/* Catalogue */}
        <ul className="space-y-3">
          {items.map((item) => {
            const canAfford = user.coinsBalance >= item.costCoins;
            const isPending = pendingId === item.id;
            const ItemIcon = resolveShopIcon(item.iconName);
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700"
                  data-icon-name={item.iconName}
                  data-testid="shop-item-icon"
                  aria-hidden
                >
                  <ItemIcon size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-900">{item.titleEn}</div>
                  <div className="text-sm text-neutral-600">{item.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => purchase(item)}
                  disabled={!canAfford || isPending}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  aria-label={`Buy ${item.titleEn} for ${item.costCoins} coins`}
                >
                  {isPending ? "..." : (
                    <span className="inline-flex items-center gap-1">
                      {item.costCoins}
                      <Coins size={14} className="text-amber-200" aria-hidden />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {message && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            {message}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BalanceCard({
  label,
  balanceKey,
  value,
  Icon,
  iconClassName,
  highlight,
}: {
  label: string;
  balanceKey: "coins" | "streak-freezes" | "hints";
  value: number;
  Icon: LucideIcon;
  iconClassName?: string;
  highlight?: boolean;
}) {
  return (
    <div
      data-testid="shop-balance-card"
      data-balance-label={balanceKey}
      className={`rounded-2xl border p-3 text-center ${
        highlight
          ? "border-orange-300 bg-orange-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex justify-center">
        <Icon size={28} className={iconClassName} aria-hidden />
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}
