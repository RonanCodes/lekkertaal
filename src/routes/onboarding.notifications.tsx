import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { setReminderPrefs } from "../lib/server/user";
import { savePushSubscription } from "../lib/server/push";

export const Route = createFileRoute("/onboarding/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate();
  const [hour, setHour] = useState(20);
  const [timezone, setTimezone] = useState("Europe/Amsterdam");
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
    await setReminderPrefs({ data: { hour, enabled: true, timezone } });
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
    await setReminderPrefs({ data: { hour, enabled: false, timezone } });
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
          Daily reminder
        </h1>
        <p className="mx-auto mt-2 max-w-md" style={{ color: "var(--text-soft)" }}>
          We ping you once a day at the time you pick. 5 minutes of Dutch keeps the streak alive.
        </p>
      </header>

      <section className="card mt-8">
        <label
          htmlFor="reminder-time"
          className="text-display block text-sm font-semibold"
          style={{ color: "var(--text-strong)" }}
        >
          When suits you?
        </label>
        <input
          id="reminder-time"
          type="time"
          value={`${String(hour).padStart(2, "0")}:00`}
          onChange={(e) => setHour(Number(e.target.value.split(":")[0] ?? 20))}
          className="mt-2 rounded-2xl border-2 px-4 py-2 text-lg"
          style={{
            borderColor: "var(--line-soft)",
            background: "var(--surface-input)",
            color: "var(--text-strong)",
          }}
        />
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Timezone: {timezone}
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={enableReminders}
          className="btn-3d btn-3d-lg btn-3d-full"
        >
          Enable reminders
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={skip}
          className="btn-3d btn-3d-ghost btn-3d-full"
        >
          Skip for now
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
