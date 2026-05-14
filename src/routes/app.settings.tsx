import { createFileRoute, useRouter, redirect  } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { useState } from "react";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { AppShell } from "../components/AppShell";
import { Stroop } from "../components/Stroop";

const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const a = await auth();
  if (!a.userId) throw redirect({ to: "/sign-in" });
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, a.userId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  return {
    user: {
      displayName: me[0].displayName,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
      streakLastActiveDate: me[0].streakLastActiveDate,
    },
    settings: {
      sfxEnabled: me[0].sfxEnabled,
      reminderEnabled: me[0].reminderEnabled,
      reminderHour: me[0].reminderHour,
      isPublic: me[0].isPublic,
    },
  };
});

const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      sfxEnabled?: boolean;
      reminderEnabled?: boolean;
      reminderHour?: number;
      isPublic?: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const a = await auth();
    if (!a.userId) throw redirect({ to: "/sign-in" });
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const patch: Record<string, unknown> = {};
    if (typeof data.sfxEnabled === "boolean") patch.sfxEnabled = data.sfxEnabled;
    if (typeof data.reminderEnabled === "boolean")
      patch.reminderEnabled = data.reminderEnabled;
    if (typeof data.reminderHour === "number") patch.reminderHour = data.reminderHour;
    if (typeof data.isPublic === "boolean") patch.isPublic = data.isPublic;
    if (Object.keys(patch).length > 0) {
      await drz.update(users).set(patch).where(eq(users.clerkId, a.userId));
    }
    return { ok: true as const };
  });

export const Route = createFileRoute("/app/settings")({
  loader: async () => await getSettings(),
  component: SettingsPage,
});

function SettingsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Show sleeping Stroop if user hasn't been active in 24h.
  const lastActive = data.user.streakLastActiveDate;
  const sleeping =
    !lastActive ||
    new Date().getTime() - new Date(lastActive).getTime() > 24 * 60 * 60 * 1000;

  async function update(patch: Parameters<typeof updateSettings>[0]["data"]) {
    setBusy(true);
    try {
      await updateSettings({ data: patch });
      router.invalidate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell user={data.user}>
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center gap-4">
          <Stroop state={sleeping ? "sleeping" : "idle"} size="md" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-neutral-500">Tune your Lekkertaal experience.</p>
          </div>
        </header>

        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Audio
          </h2>
          <Toggle
            label="Sound effects"
            description="Correct/wrong/complete cues during lessons."
            value={data.settings.sfxEnabled}
            disabled={busy}
            onChange={(v) => update({ sfxEnabled: v })}
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Reminders
          </h2>
          <Toggle
            label="Daily reminder"
            description="Push notification at your chosen hour to keep the streak alive."
            value={data.settings.reminderEnabled}
            disabled={busy}
            onChange={(v) => update({ reminderEnabled: v })}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-700">Reminder hour (UTC)</span>
            <select
              value={data.settings.reminderHour}
              disabled={busy}
              onChange={(e) => update({ reminderHour: Number(e.target.value) })}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Privacy
          </h2>
          <Toggle
            label="Show profile on leaderboard / users directory"
            description="Off makes your profile private to other learners."
            value={data.settings.isPublic}
            disabled={busy}
            onChange={(v) => update({ isPublic: v })}
          />
        </section>
      </div>
    </AppShell>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
      <span className="flex-1">
        <span className="font-medium text-neutral-900">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "bg-orange-500" : "bg-neutral-300"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
