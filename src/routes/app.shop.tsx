import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Coins, Heart, Lightbulb, Snowflake, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getShop, buyItem } from "../lib/server/shop";
import type { ShopItem } from "../lib/server/shop";
import { AppShell } from "../components/AppShell";
import { Button } from "@/components/ui/button";
import { resolveShopIcon } from "../lib/shop-icons";

export const Route = createFileRoute("/app/shop")({
  loader: async () => await getShop(),
  component: ShopPage,
});

/**
 * Which design section a catalogue item belongs to.
 *
 * The live catalogue (`SHOP_CATALOGUE`) only has two real, server-backed items
 * today: `streak_freeze` and `hint_pack`. We map them onto the design's named
 * sections so the screen reads as designed even though the backend is thin.
 * Anything we can't classify falls back to the Power-ups bucket so a future
 * catalogue addition still renders without a code change here.
 */
type ShopSectionId = "streak-freeze" | "power-up";

// Server-backed catalogue sections, in the design's order. Heart refills and
// avatars are rendered between these two by ShopPage (they have no catalogue
// rows of their own), so the on-screen order is:
//   streak freezes → heart refills → avatars → power-ups.
const SECTION_ORDER: { id: ShopSectionId; title: string }[] = [
  { id: "streak-freeze", title: "Streak freezes" },
  { id: "power-up", title: "Power-ups" },
];

// Items that aren't streak freezes fall back to Power-ups, so a future
// catalogue addition still slots in without a code change here.
const SECTION_BY_ITEM: Partial<Record<string, ShopSectionId>> = {
  streak_freeze: "streak-freeze",
  hint_pack: "power-up",
};

function sectionForItem(item: ShopItem): ShopSectionId {
  return SECTION_BY_ITEM[item.id] ?? "power-up";
}

/**
 * Heart-refill catalogue.
 *
 * There is NO server schema for hearts yet (no `hearts` balance, no
 * `refill_hearts` catalogue item — see `shop.ts`). The design calls for a
 * dedicated "Heart refills" section, so we render the two designed cards in a
 * coming-soon state: the UI is present and on-brand, but the buy buttons are
 * disabled until the hearts/energy backend lands. Prices mirror the
 * `ScreenShop` prototype in `docs/design/screens-misc.jsx`.
 */
type HeartRefill = {
  id: string;
  title: string;
  description: string;
  price: number;
  Icon: typeof Heart;
  decorate?: boolean;
};

const HEART_REFILLS: HeartRefill[] = [
  {
    id: "refill_hearts",
    title: "Refill hearts",
    description: "Fill all 5 instantly",
    price: 50,
    Icon: Heart,
  },
  {
    id: "unlimited_30",
    title: "Unlimited 30 min",
    description: "Practice without limits",
    price: 150,
    Icon: Heart,
    decorate: true,
  },
];

/**
 * Cosmetic treat-avatar catalogue.
 *
 * There is NO server schema for equippable cosmetics yet (see `shop.ts`:
 * "Cosmetic mascot outfits are deferred to Phase 2"). Per the slice brief we
 * render the designed grid driven by the live coin balance for the
 * owned/can-afford state, and hold equipped/owned purely client-side for this
 * session. Buying or equipping does NOT persist — when the backend lands, the
 * `owned`/`equipped` sets below become server-derived. Prices mirror the
 * `ScreenShop` prototype in `docs/design/screens-misc.jsx`.
 */
type Cosmetic = {
  mascot: string;
  name: string;
  price: number;
};

const COSMETICS: Cosmetic[] = [
  { mascot: "poffertjes", name: "Poffertjes", price: 200 },
  { mascot: "oliebollen", name: "Oliebollen", price: 200 },
  { mascot: "tompouce", name: "Tompouce", price: 250 },
  { mascot: "kaas", name: "Kaas", price: 250 },
  { mascot: "kroket", name: "Kroket", price: 400 },
  { mascot: "drop", name: "Drop", price: 400 },
];

// The starter avatar everyone has equipped by default until cosmetics persist.
const DEFAULT_EQUIPPED = "poffertjes";

function ShopPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { user, items } = data;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Client-side cosmetic state (no backend yet — see COSMETICS note above).
  // Owned avatars are seeded with the two the design shows as already-bought so
  // the equip flow is exercisable; equipped tracks the active one.
  const [owned, setOwned] = useState<Set<string>>(
    () => new Set([DEFAULT_EQUIPPED, "oliebollen"]),
  );
  const [equipped, setEquipped] = useState<string>(DEFAULT_EQUIPPED);

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

  function buyCosmetic(c: Cosmetic) {
    if (owned.has(c.mascot)) {
      setEquipped(c.mascot);
      setMessage(`Equipped ${c.name}.`);
      return;
    }
    if (user.coinsBalance < c.price) return;
    // No server fn for cosmetics yet, so this is session-local.
    setOwned((prev) => new Set(prev).add(c.mascot));
    setEquipped(c.mascot);
    setMessage(`Unlocked ${c.name}! Equipped.`);
  }

  // Tone for the purchase toast: a successful buy/equip is upbeat.
  const toastTone =
    message &&
    (message.startsWith("Bought") ||
      message.startsWith("Equipped") ||
      message.startsWith("Unlocked"))
      ? "success"
      : "error";

  const sections = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      ...section,
      items: items.filter((item) => sectionForItem(item) === section.id),
    })).filter((section) => section.items.length > 0);
  }, [items]);

  const freezeSection = sections.find((s) => s.id === "streak-freeze");
  const powerupSection = sections.find((s) => s.id === "power-up");

  const equippedMascot = equipped;

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-xl space-y-6 py-2">
        {/* Stroopwafel-gradient balance hero */}
        <div className="sp-hero-balance">
          <img
            src={`/mascot/treats/${equippedMascot}/happy.png`}
            alt=""
            className="sp-hero-balance__mascot anim-idle-bob"
            aria-hidden
          />
          <div className="sp-hero-balance__body">
            <div className="sp-hero-balance__eyebrow">Your balance</div>
            <div className="sp-hero-balance__amount">
              <Coins size={28} className="text-amber-500" aria-hidden />
              <span>{user.coinsBalance}</span>
            </div>
            <p className="sp-hero-balance__hint">
              Spend the coins you earned from lessons and roleplays.
            </p>
          </div>
        </div>

        {/* Secondary balances (streak freezes / hints) — keeps the e2e
            balance-card selectors and the at-a-glance inventory. */}
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

        {/* Designed section order: freezes → heart refills → avatars →
            power-ups. Streak freezes + power-ups are the only server-backed
            catalogue sections; heart refills + avatars sit between them. */}
        {freezeSection && (
          <CatalogueSection
            section={freezeSection}
            coinsBalance={user.coinsBalance}
            pendingId={pendingId}
            onBuy={purchase}
          />
        )}

        {/* Heart refills — UI-only until the hearts/energy backend lands
            (see HEART_REFILLS note). Buttons disabled, marked coming soon. */}
        <section className="sp-cat" data-section="heart-refill">
          <h2 className="sp-cat__title">Heart refills</h2>
          <div className="sp-shopcards">
            {HEART_REFILLS.map((h) => {
              const HeartIcon = h.Icon;
              return (
                <div
                  key={h.id}
                  className="sp-shopcard"
                  data-coming-soon="true"
                  data-testid="shop-heart-refill"
                >
                  <div className="sp-shopcard__icon" aria-hidden>
                    <HeartIcon size={24} className="text-rose-500" />
                    {h.decorate && (
                      <Sparkles
                        size={13}
                        className="sp-shopcard__spark text-amber-500"
                      />
                    )}
                  </div>
                  <div className="sp-shopcard__title">{h.title}</div>
                  <div className="sp-shopcard__desc">{h.description}</div>
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="sp-shopcard__buy"
                    aria-label={`${h.title}, coming soon`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.price}
                      <Coins size={14} className="text-amber-200" aria-hidden />
                    </span>
                  </Button>
                  <span className="sp-shopcard__soon">Coming soon</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cosmetic treat-avatar grid. */}
        <section className="sp-cat" data-section="cosmetics">
          <h2 className="sp-cat__title">Avatars · treat family</h2>
          <div className="sp-cosmetics">
            {COSMETICS.map((c) => {
              const isOwned = owned.has(c.mascot);
              const isEquipped = equipped === c.mascot;
              const canAfford = user.coinsBalance >= c.price;
              const state = isEquipped
                ? "equipped"
                : isOwned
                  ? "owned"
                  : canAfford
                    ? "afford"
                    : "locked";
              return (
                <button
                  key={c.mascot}
                  type="button"
                  className="sp-cosmetic"
                  data-testid="shop-cosmetic"
                  data-state={state}
                  disabled={state === "locked"}
                  onClick={() => buyCosmetic(c)}
                  aria-label={
                    isEquipped
                      ? `${c.name} avatar, equipped`
                      : isOwned
                        ? `Equip ${c.name} avatar`
                        : `Buy ${c.name} avatar for ${c.price} coins`
                  }
                >
                  <img
                    src={`/mascot/treats/${c.mascot}/idle.png`}
                    alt=""
                    className="sp-cosmetic__mascot"
                    aria-hidden
                  />
                  <span className="sp-cosmetic__name">{c.name}</span>
                  {state === "equipped" ? (
                    <span className="sp-cosmetic__badge">Equipped</span>
                  ) : state === "owned" ? (
                    <span className="sp-cosmetic__action">Equip</span>
                  ) : (
                    <span className="sp-cosmetic__price">
                      <Coins size={12} aria-hidden />
                      {c.price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Power-ups — last, per the design. */}
        {powerupSection && (
          <CatalogueSection
            section={powerupSection}
            coinsBalance={user.coinsBalance}
            pendingId={pendingId}
            onBuy={purchase}
          />
        )}

        <p className="sp-cat__foot">
          Need more? <span>Earn coins on the path.</span>
        </p>

        {message && (
          <div className="sp-toast" data-tone={toastTone === "error" ? "error" : undefined}>
            {message}
          </div>
        )}
      </div>
    </AppShell>
  );
}

type CatalogueSectionData = {
  id: ShopSectionId;
  title: string;
  items: ShopItem[];
};

function CatalogueSection({
  section,
  coinsBalance,
  pendingId,
  onBuy,
}: {
  section: CatalogueSectionData;
  coinsBalance: number;
  pendingId: string | null;
  onBuy: (item: ShopItem) => void;
}) {
  return (
    <section className="sp-cat" data-section={section.id}>
      <h2 className="sp-cat__title">{section.title}</h2>
      <ul className="space-y-3">
        {section.items.map((item) => {
          const canAfford = coinsBalance >= item.costCoins;
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
              <Button
                type="button"
                size="sm"
                onClick={() => onBuy(item)}
                disabled={!canAfford || isPending}
                className="sp-item__buy"
                aria-label={`Buy ${item.titleEn} for ${item.costCoins} coins`}
              >
                {isPending ? "..." : (
                  <span className="inline-flex items-center gap-1">
                    {item.costCoins}
                    <Coins size={14} className="text-amber-200" aria-hidden />
                  </span>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
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
