/**
 * Notification bell + dropdown for the app shell header.
 *
 * Drains unread in-app notifications from `/api/notifications/inbox`. Click
 * a row to mark it read (POST /api/notifications/:id/read) and navigate to
 * the row's deep link. The unread badge reflects the fetched count, capped
 * at "9+".
 *
 * Fetches on mount and whenever the dropdown is opened. No polling — a
 * future refresh comes from the user opening the menu or navigating back
 * to a page that mounts `AppShell`. Keeps the worker-CPU budget thin.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type InboxNotification = {
  id: number;
  kind: string;
  sentAt: string;
  result: string | null;
  link: string | null;
  fromDisplayName: string | null;
};

function describeKind(n: InboxNotification): string {
  switch (n.kind) {
    case "peer_drill_completed":
      return n.fromDisplayName
        ? `${n.fromDisplayName} answered your peer drill`
        : "A peer drill was answered";
    default:
      return n.kind.replaceAll("_", " ");
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/notifications/inbox");
      if (!r.ok) {
        setError("Could not load notifications.");
        setItems([]);
        return;
      }
      const body = (await r.json()) as { notifications: InboxNotification[] };
      setItems(body.notifications ?? []);
    } catch {
      setError("Could not load notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function onItemClick(n: InboxNotification) {
    // Optimistic removal so the dropdown updates immediately.
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    } catch {
      // Ignore: worst case the row reappears on the next fetch.
    }
    if (n.link) {
      window.location.assign(n.link);
    }
  }

  const unread = items.length;
  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications (${unread} unread)`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        className="relative inline-flex items-center justify-center rounded-full p-1 text-lg hover:bg-neutral-100"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-semibold text-white"
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Notifications
          </div>
          {loading && (
            <div className="px-2 py-3 text-sm text-neutral-500">Loading...</div>
          )}
          {error && (
            <div className="px-2 py-3 text-sm text-red-600">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="px-2 py-3 text-sm text-neutral-500">
              You are all caught up.
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => onItemClick(n)}
                    className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-amber-50"
                  >
                    <div className="font-medium text-neutral-900">
                      {describeKind(n)}
                    </div>
                    <div className="text-xs text-neutral-500">{n.sentAt}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
