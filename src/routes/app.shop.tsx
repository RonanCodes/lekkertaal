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

  // Tone for the purchase toast: a successful buy starts with "Bought".
  const toastTone = message && message.startsWith("Bought") ? "success" : "error";

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-xl space-y-6 py-2">
        <header className="sp-head">
          <img
            src="/mascot/treats/oliebollen/idle.png"
            alt=""
            className="sp-head__mascot anim-idle-bob"
            aria-hidden
          />
          <div>
            <h1 className="sp-head__title">Shop</h1>
            <p className="sp-head__sub">
              Spend the coins you earned from lessons and roleplays.
            </p>
          </div>
        </header>

        {/* Balances */}
        <div className="sp-balances">
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
              <li key={item.id} className="sp-item">
                <div
                  className="sp-item__icon"
                  data-icon-name={item.iconName}
                  data-testid="shop-item-icon"
                  aria-hidden
                >
                  <ItemIcon size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="sp-item__title">{item.titleEn}</div>
                  <div className="sp-item__desc">{item.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => purchase(item)}
                  disabled={!canAfford || isPending}
                  className="btn-3d btn-3d-sm sp-item__buy"
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
          <div className="sp-toast" data-tone={toastTone === "error" ? "error" : undefined}>
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
      data-highlight={highlight ? "true" : undefined}
      className="sp-balance"
    >
      <div className="sp-balance__icon">
        <Icon size={28} className={iconClassName} aria-hidden />
      </div>
      <div className="sp-balance__value">{value}</div>
      <div className="sp-balance__label">{label}</div>
    </div>
  );
}
