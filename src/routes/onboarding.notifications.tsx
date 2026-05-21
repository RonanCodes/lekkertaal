import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setReminderPrefs } from "../lib/server/user";
import { savePushSubscription } from "../lib/server/push";

export const Route = createFileRoute("/onboarding/notifications")({
  component: NotificationsPage,
});

const REMINDER_TIMES = ["07:30", "12:30", "18:00", "20:30", "21:30"] as const;

/** Map an "HH:MM" chip to the hour we persist (server stores a single hour). */
function hourFromTime(time: string): number {
  return Number(time.split(":")[0] ?? 20);
}

function NotificationsPage() {
  const navigate = useNavigate();
  const [time, setTime] = useState<string>("20:30");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
  const [friendPings, setFriendPings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied" | "blocked">(
    "idle",
  );

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      /* fall through with default */
    }
  }, []);

  async function enableReminders() {
    setSubmitting(true);
    await setReminderPrefs({ data: { hour: hourFromTime(time), enabled: true, timezone } });
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setPushStatus("granted");
        try {
          const reg = await navigator.serviceWorker?.ready;
          if (reg && "pushManager" in reg) {
            // VAPID public key wired in US-027; for now we register without it
            // and store endpoint shape so US-027 just enriches.
            const sub = await reg.pushManager
              .subscribe({ userVisibleOnly: true })
              .catch(() => null);
            if (sub) {
              const json = sub.toJSON();
              await savePushSubscription({
                data: {
                  endpoint: json.endpoint!,
                  p256dh: json.keys?.p256dh ?? "",
                  authKey: json.keys?.auth ?? "",
                  userAgent: navigator.userAgent,
                },
              });
            }
          }
        } catch {
          /* push subscription is best-effort here; US-027 will retry */
        }
      } else if (perm === "denied") {
        setPushStatus("denied");
      }
    } else {
      setPushStatus("blocked");
    }
    navigate({ to: "/app/path" });
  }

  async function skip() {
    setSubmitting(true);
    await setReminderPrefs({ data: { hour: hourFromTime(time), enabled: false, timezone } });
    navigate({ to: "/app/path" });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="text-center">
        <p
          className="text-display text-sm font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-brand-blue-dark)" }}
        >
          One last thing
        </p>
        <img
          src="/mascot/stroop-512.png"
          alt="Stroop the stroopwafel"
          className="anim-idle-bob mx-auto mt-3 mb-1 h-24 w-24"
        />
        <h1
          className="text-display mt-1 text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--text-strong)" }}
        >
          One nudge a day, never twee
        </h1>
        <p className="mx-auto mt-2 max-w-md" style={{ color: "var(--text-soft)" }}>
          A tiny daily reminder so streaks don't slip. We won't spam, promise.
        </p>
      </header>

      <section className="card mt-8">
        <span
          className="text-display block text-sm font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--text-muted)" }}
        >
          Daily reminder time
        </span>
        <div className="onb-notif-chips mt-3" role="radiogroup" aria-label="Daily reminder time">
          {REMINDER_TIMES.map((t) => {
            const selected = t === time;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTime(t)}
                className="onb-notif-chip"
                data-selected={selected ? "true" : "false"}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Stroop will say hi at{" "}
          <span className="font-semibold" style={{ color: "var(--color-brand-orange-dark)" }}>
            {time}
          </span>
          .
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Timezone: {timezone}
        </p>
      </section>

      <section className="card onb-notif-friend mt-3">
        <span className="onb-notif-friend__icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <span className="onb-notif-friend__text">
          <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
            Friend pings &amp; peer drills
          </span>
          <span className="text-xs" style={{ color: "var(--text-soft)" }}>
            Only when someone challenges you.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={friendPings}
          aria-label="Friend pings and peer drills"
          onClick={() => setFriendPings((on) => !on)}
          className="sp-toggle"
          data-on={friendPings ? "true" : "false"}
        >
          <span className="sp-toggle__knob" />
        </button>
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={enableReminders}
          className="btn-3d btn-3d-lg btn-3d-full"
        >
          Allow notifications
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={skip}
          className="btn-3d btn-3d-ghost btn-3d-full"
        >
          Maybe later
        </button>
      </div>

      {pushStatus === "denied" && (
        <p
          className="mt-4 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "var(--surface-banner-amber)", color: "var(--text-on-banner)" }}
        >
          You blocked notifications. We saved your reminder hour but cannot send pushes.
        </p>
      )}
    </main>
  );
}
