import type { ReactNode } from "react";

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
  return (
    <div className="min-h-screen bg-amber-50/40">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <a href="/app/path" className="text-lg font-bold text-orange-600">
            Lekkertaal
          </a>
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
            <span className="hidden text-neutral-500 sm:inline">{user.displayName}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
