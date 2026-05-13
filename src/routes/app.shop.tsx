import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getShop, buyItem, type ShopItem } from "../lib/server/shop";
import { AppShell } from "../components/AppShell";

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
      setMessage(`Bought ${item.titleEn}! New balance: ${res.newBalance} 🪙`);
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
          <BalanceCard label="Coins" value={user.coinsBalance} emoji="🪙" highlight />
          <BalanceCard
            label="Streak freezes"
            value={user.streakFreezesBalance}
            emoji="❄️"
          />
          <BalanceCard label="Hints" value={user.hintsBalance} emoji="💡" />
        </div>

        {/* Catalogue */}
        <ul className="space-y-3">
          {items.map((item) => {
            const canAfford = user.coinsBalance >= item.costCoins;
            const isPending = pendingId === item.id;
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="text-3xl" aria-hidden>
                  {item.emoji}
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
                  {isPending ? "..." : `${item.costCoins} 🪙`}
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
  value,
  emoji,
  highlight,
}: {
  label: string;
  value: number;
  emoji: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center ${
        highlight
          ? "border-orange-300 bg-orange-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="text-2xl">{emoji}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}
