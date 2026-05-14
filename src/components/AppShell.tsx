import type { ReactNode } from "react";
import { NotificationBell } from "./NotificationBell";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Path prefixes that should mark the link active. */
  matches: string[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app/path", label: "Path", icon: "🛤️", matches: ["/app/path"] },
  { href: "/app/peer", label: "Peer drills", icon: "🎯", matches: ["/app/peer"] },
];

function isActive(item: NavItem, pathname: string): boolean {
  return item.matches.some(
    (m) => pathname === m || pathname.startsWith(`${m}/`),
  );
}

/**
 * Resolve the current pathname on both server and client. On the client we
 * use `window.location.pathname`; on the server (SSR) we fall back to an
 * empty string so no nav item is marked active. The active class only
 * affects styling, so the SSR/CSR mismatch on first render is cosmetic and
 * resolves on hydration without layout shift.
 */
function currentPathname(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function AppShell({
  user,
  children,
}: {
  user: {
    displayName: string;
    xpTotal: number;
    coinsBalance: number;
    streakDays: number;
    streakFreezesBalance?: number;
  };
  children: ReactNode;
}) {
  const freezes = user.streakFreezesBalance ?? 0;
  const pathname = currentPathname();
  return (
    <div className="min-h-screen bg-amber-50/40">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <a href="/app/path" className="text-lg font-bold text-orange-600">
              Lekkertaal
            </a>
            <nav aria-label="Primary" className="hidden gap-1 sm:flex">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                      (active
                        ? "bg-orange-100 text-orange-700"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")
                    }
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span
              title={
                freezes > 0
                  ? `${user.streakDays}-day streak · ${freezes} freeze${
                      freezes === 1 ? "" : "s"
                    } in reserve`
                  : "Daily streak"
              }
              aria-label="streak"
              className="inline-flex items-center gap-1"
            >
              🔥 {user.streakDays}
              {freezes > 0 && (
                <span
                  className="ml-0.5 rounded-full bg-sky-100 px-1.5 text-xs font-semibold text-sky-700"
                  aria-label={`${freezes} streak freezes available`}
                >
                  ❄️{freezes}
                </span>
              )}
            </span>
            <span title="Total XP" aria-label="xp">⚡ {user.xpTotal}</span>
            <a
              href="/app/shop"
              title="Coins (tap to open shop)"
              aria-label="coins"
              className="hover:text-orange-600"
            >
              🪙 {user.coinsBalance}
            </a>
            <NotificationBell />
            <span className="hidden text-neutral-500 sm:inline">{user.displayName}</span>
          </div>
        </div>
        <nav
          aria-label="Primary (mobile)"
          className="mx-auto mt-2 flex max-w-4xl gap-1 sm:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium " +
                  (active
                    ? "bg-orange-100 text-orange-700"
                    : "text-neutral-600 hover:bg-neutral-100")
                }
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

const _NAV_ITEMS_FOR_TESTING = NAV_ITEMS;
export { _NAV_ITEMS_FOR_TESTING };
