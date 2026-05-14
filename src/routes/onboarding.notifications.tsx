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
      <h1 className="text-3xl font-bold">Daily reminder</h1>
      <p className="mt-2 text-neutral-600">
        We ping you once a day at the time you pick. 5 minutes of Dutch keeps the streak alive.
      </p>

      <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-6">
        <label className="block text-sm font-semibold">When?</label>
        <input
          type="time"
          value={`${String(hour).padStart(2, "0")}:00`}
          onChange={(e) => setHour(Number(e.target.value.split(":")[0] ?? 20))}
          className="mt-2 rounded-2xl border border-neutral-300 px-4 py-2 text-lg"
        />
        <p className="mt-1 text-xs text-neutral-500">Timezone: {timezone}</p>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          disabled={submitting}
          onClick={enableReminders}
          className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-orange-600 disabled:opacity-50"
        >
          Enable reminders
        </button>
        <button
          disabled={submitting}
          onClick={skip}
          className="rounded-2xl border border-neutral-300 px-6 py-3 font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>

      {pushStatus === "denied" && (
        <p className="mt-4 text-sm text-amber-700">
          You blocked notifications. We saved your reminder hour but cannot send pushes.
        </p>
      )}
    </main>
  );
}
