import type { ReactNode } from "react";

export function AppShell({
  user,
  children,
}: {
  user: { displayName: string; xpTotal: number; coinsBalance: number; streakDays: number };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-amber-50/40">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <a href="/app/path" className="text-lg font-bold text-orange-600">
            Lekkertaal
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span title="Streak">🔥 {user.streakDays}</span>
            <span title="XP">⭐ {user.xpTotal}</span>
            <span title="Coins">🪙 {user.coinsBalance}</span>
            <span className="hidden text-neutral-500 sm:inline">{user.displayName}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
