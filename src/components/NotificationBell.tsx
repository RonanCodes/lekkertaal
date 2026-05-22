/**
 * Notification bell + bottom-sheet for the app shell header.
 *
 * Drains unread in-app notifications from `/api/notifications/inbox`. Tapping
 * the bell opens a bottom-sheet (grab handle + "Mark all read") whose rows are
 * grouped by Today / Yesterday / Earlier with a coloured icon tile per kind
 * (or a mascot when the row carries one) plus an unread dot. Tapping a row
 * marks it read (POST /api/notifications/:id/read) and navigates to the row's
 * deep link. The unread badge reflects the fetched count, capped at "9+".
 *
 * Fetches on mount and whenever the sheet is opened. No polling — a future
 * refresh comes from the user opening the sheet or navigating back to a page
 * that mounts `AppShell`. Keeps the worker-CPU budget thin.
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

type IconKind = "flame" | "target" | "crown" | "trophy" | "sparkle" | "bell";
type TileColor = "orange" | "blue" | "amber" | "pink";

type KindPresentation = {
  /** Headline copy for the row. */
  title: (n: InboxNotification) => string;
  /** Glyph for the coloured icon tile (ignored when a mascot is shown). */
  icon: IconKind;
  /** Tile colour family; routes through dark-aware CSS classes. */
  color: TileColor;
};

const ICON_GLYPH: Record<IconKind, string> = {
  flame: "🔥",
  target: "🎯",
  crown: "👑",
  trophy: "🏆",
  sparkle: "✨",
  bell: "🔔",
};

/**
 * Per-kind presentation. Covers the kinds the inbox emits today
 * (`peer_drill_completed`) plus the streak / badge / league / friend / shop
 * kinds illustrated in the design so new producers light up correctly without
 * a follow-up edit. Anything unmapped falls back to a humanised kind string
 * on a neutral bell tile.
 */
const KIND_PRESENTATION: Record<string, KindPresentation> = {
  peer_drill_completed: {
    title: (n) =>
      n.fromDisplayName
        ? `${n.fromDisplayName} answered your peer drill`
        : "A peer drill was answered",
    icon: "target",
    color: "blue",
  },
  peer_drill_assigned: {
    title: (n) =>
      n.fromDisplayName
        ? `Peer drill from ${n.fromDisplayName}`
        : "New peer drill",
    icon: "target",
    color: "blue",
  },
  streak_recovery: {
    title: () => "Don't break your streak",
    icon: "flame",
    color: "orange",
  },
  daily_nag: {
    title: () => "Your daily lesson is waiting",
    icon: "flame",
    color: "orange",
  },
  badge_unlocked: {
    title: () => "Badge unlocked",
    icon: "crown",
    color: "amber",
  },
  league_promoted: {
    title: () => "You moved up a league",
    icon: "trophy",
    color: "blue",
  },
  friend_request: {
    title: (n) =>
      n.fromDisplayName
        ? `${n.fromDisplayName} sent a friend request`
        : "New friend request",
    icon: "sparkle",
    color: "pink",
  },
  shop_drop: {
    title: () => "New cosmetic in the shop",
    icon: "sparkle",
    color: "pink",
  },
  weekly_digest: {
    title: () => "Your weekly recap is ready",
    icon: "sparkle",
    color: "pink",
  },
};

function presentationFor(n: InboxNotification): KindPresentation {
  return (
    KIND_PRESENTATION[n.kind] ?? {
      title: () => n.kind.replaceAll("_", " "),
      icon: "bell" as const,
      color: "blue" as const,
    }
  );
}

/** Headline copy for a notification. Exported shape preserved for callers. */
function describeKind(n: InboxNotification): string {
  return presentationFor(n).title(n);
}

/**
 * Parse a stored `sent_at` value. SQLite's CURRENT_TIMESTAMP yields
 * `YYYY-MM-DD HH:MM:SS` in UTC with no zone marker, so normalise to ISO-Z
 * before handing it to Date. Returns null on anything unparseable.
 */
function parseSentAt(value: string): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d;
}

type DayBucket = "Today" | "Yesterday" | "Earlier";

function bucketFor(d: Date | null, now: Date): DayBucket {
  if (!d) return "Earlier";
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / dayMs);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

/** Short relative age, e.g. "3u" (hours), "2d" (days), "nu" (just now). */
function relativeTime(d: Date | null, now: Date): string {
  if (!d) return "";
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

const BUCKET_ORDER: DayBucket[] = ["Today", "Yesterday", "Earlier"];

function groupByDay(
  items: InboxNotification[],
  now: Date,
): { bucket: DayBucket; items: InboxNotification[] }[] {
  const byBucket = new Map<DayBucket, InboxNotification[]>();
  for (const n of items) {
    const bucket = bucketFor(parseSentAt(n.sentAt), now);
    const arr = byBucket.get(bucket) ?? [];
    arr.push(n);
    byBucket.set(bucket, arr);
  }
  return BUCKET_ORDER.filter((b) => (byBucket.get(b)?.length ?? 0) > 0).map(
    (bucket) => ({ bucket, items: byBucket.get(bucket) ?? [] }),
  );
}

/** A `result` of the form "mascot:oliebollen" carries an avatar to show. */
function mascotFor(n: InboxNotification): string | null {
  if (!n.result) return null;
  const m = /^mascot:([a-z]+)$/.exec(n.result.trim());
  return m ? m[1] : null;
}

function NotifTile({ n }: { n: InboxNotification }) {
  const mascot = mascotFor(n);
  if (mascot) {
    return (
      <img
        src={`/mascot/treats/${mascot}/idle.png`}
        alt=""
        aria-hidden
        className="nb-tile-mascot"
      />
    );
  }
  const { icon, color } = presentationFor(n);
  return (
    <span aria-hidden className="nb-tile" data-color={color}>
      {ICON_GLYPH[icon]}
    </span>
  );
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function onItemClick(n: InboxNotification) {
    // Optimistic removal so the sheet updates immediately.
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

  async function onMarkAllRead() {
    const snapshot = items;
    // Optimistic clear; the empty state renders immediately.
    setItems([]);
    await Promise.all(
      snapshot.map((n) =>
        fetch(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(
          () => undefined,
        ),
      ),
    );
  }

  const unread = items.length;
  const badge = unread > 9 ? "9+" : String(unread);
  const now = new Date();
  const groups = groupByDay(items, now);

  return (
    <div ref={rootRef} className="nb-root">
      <button
        type="button"
        aria-label={`Notifications (${unread} unread)`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        className="nb-trigger"
        data-active={open}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span aria-hidden className="nb-badge text-display">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="nb-scrim"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="nb-sheet"
          >
            <div className="nb-grab" aria-hidden>
              <span className="nb-grab-bar" />
            </div>
            <div className="nb-sheet-head">
              <h3 className="text-display nb-sheet-title">Notifications</h3>
              <span className="nb-spacer" />
              {!loading && !error && items.length > 0 && (
                <button
                  type="button"
                  className="nb-mark-all"
                  onClick={onMarkAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="nb-scroll">
              {loading && (
                <div className="nb-state" style={{ color: "var(--text-muted)" }}>
                  Loading...
                </div>
              )}
              {error && (
                <div
                  className="nb-state font-semibold"
                  style={{ color: "var(--color-bad)" }}
                >
                  {error}
                </div>
              )}
              {!loading && !error && items.length === 0 && (
                <div className="nb-empty">
                  <img
                    src="/mascot/treats/kaas/happy.png"
                    alt=""
                    aria-hidden
                    className="anim-idle-bob h-14 w-14"
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-soft)" }}
                  >
                    You are all caught up.
                  </span>
                </div>
              )}
              {!loading &&
                !error &&
                groups.map(({ bucket, items: rows }) => (
                  <section key={bucket}>
                    <div className="nb-group-label">{bucket}</div>
                    <ul>
                      {rows.map((n) => {
                        const when = relativeTime(parseSentAt(n.sentAt), now);
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => onItemClick(n)}
                              className="nb-item"
                            >
                              <NotifTile n={n} />
                              <span className="nb-item-body">
                                <span className="nb-item-titlerow">
                                  <span
                                    className="text-display nb-item-title"
                                    style={{ color: "var(--text-strong)" }}
                                  >
                                    {describeKind(n)}
                                  </span>
                                  <span aria-hidden className="nb-unread-dot" />
                                </span>
                              </span>
                              {when && (
                                <span aria-hidden className="nb-item-time">
                                  {when}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
