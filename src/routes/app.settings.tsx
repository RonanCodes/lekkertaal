import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { AppShell } from "../components/AppShell";
import { Stroop } from "../components/Stroop";
import { applyThemePref, getThemePref, setThemePref } from "../lib/theme";
import type { ThemePref } from "../lib/theme";

// Daily-goal presets. Value = target XP/day stored in users.dailyGoalXp.
const DAILY_GOALS = [
  { label: "Casual", xp: 10 },
  { label: "Regular", xp: 20 },
  { label: "Serious", xp: 50 },
  { label: "Intense", xp: 100 },
] as const;

const THEME_OPTIONS: { label: string; value: ThemePref }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = [await ensureUserRow(clerkId, drz, env)];
  return {
    user: {
      displayName: me[0].displayName,
      email: me[0].email,
      cefrLevel: me[0].cefrLevel,
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
      dailyGoalXp: me[0].dailyGoalXp,
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
      dailyGoalXp?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const clerkId = await requireUserClerkId();
    const { env } = requireWorkerContext();
    const drz = db(env.DB);
    const patch: Record<string, unknown> = {};
    if (typeof data.sfxEnabled === "boolean") patch.sfxEnabled = data.sfxEnabled;
    if (typeof data.reminderEnabled === "boolean")
      patch.reminderEnabled = data.reminderEnabled;
    if (typeof data.reminderHour === "number") patch.reminderHour = data.reminderHour;
    if (typeof data.isPublic === "boolean") patch.isPublic = data.isPublic;
    if (typeof data.dailyGoalXp === "number") patch.dailyGoalXp = data.dailyGoalXp;
    if (Object.keys(patch).length > 0) {
      await drz.update(users).set(patch).where(eq(users.clerkId, clerkId));
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
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme is a client-side preference (localStorage + data-theme attribute),
  // hydrated from whatever the no-flash script already applied.
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => {
    setTheme(getThemePref());
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Show sleeping Stroop if user hasn't been active in 24h.
  const lastActive = data.user.streakLastActiveDate;
  const sleeping =
    !lastActive ||
    new Date().getTime() - new Date(lastActive).getTime() > 24 * 60 * 60 * 1000;

  const showSaved = useCallback(() => {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2200);
  }, []);

  async function update(patch: Parameters<typeof updateSettings>[0]["data"]) {
    setBusy(true);
    try {
      await updateSettings({ data: patch });
      router.invalidate();
      showSaved();
    } finally {
      setBusy(false);
    }
  }

  function pickTheme(next: ThemePref) {
    setTheme(next);
    setThemePref(next);
    applyThemePref(next);
    showSaved();
  }

  return (
    <AppShell user={data.user}>
      <div className="mx-auto max-w-xl space-y-6">
        <header className="sp-head">
          <Stroop state={sleeping ? "sleeping" : "idle"} size="md" />
          <div>
            <h1 className="sp-head__title">Settings</h1>
            <p className="sp-head__sub">Tune your Lekkertaal experience.</p>
          </div>
        </header>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Account</h2>
          <div className="sp-setting-row">
            <span className="sp-setting-row__label">Display name</span>
            <span className="sp-setting-row__value">{data.user.displayName}</span>
          </div>
          <div className="sp-setting-row">
            <span className="sp-setting-row__label">Email</span>
            <span className="sp-setting-row__value">
              {data.user.email ?? "—"}
            </span>
          </div>
          <div className="sp-setting-row">
            <span className="sp-setting-row__label">Subscription</span>
            <span className="sp-setting-row__value">Free</span>
          </div>
        </section>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Learning</h2>
          <div className="sp-setting-row">
            <span className="sp-setting-row__label">Level</span>
            <span className="sp-setting-row__value">{data.user.cefrLevel}</span>
          </div>
          <div className="space-y-2">
            <span className="sp-setting-row__label">Daily goal</span>
            <div className="sp-goal-grid">
              {DAILY_GOALS.map((g) => {
                const active = data.settings.dailyGoalXp === g.xp;
                return (
                  <button
                    key={g.xp}
                    type="button"
                    className="sp-goal-pill"
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => update({ dailyGoalXp: g.xp })}
                  >
                    <span className="sp-goal-pill__label">{g.label}</span>
                    <span className="sp-goal-pill__xp">{g.xp} XP</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Audio</h2>
          <Toggle
            label="Sound effects"
            description="Correct/wrong/complete cues during lessons."
            value={data.settings.sfxEnabled}
            disabled={busy}
            onChange={(v) => update({ sfxEnabled: v })}
          />
        </section>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Reminders</h2>
          <Toggle
            label="Daily reminder"
            description="Push notification at your chosen hour to keep the streak alive."
            value={data.settings.reminderEnabled}
            disabled={busy}
            onChange={(v) => update({ reminderEnabled: v })}
          />
          <label className="sp-setting-row">
            <span className="sp-setting-row__label">Reminder hour (UTC)</span>
            <select
              value={data.settings.reminderHour}
              disabled={busy}
              onChange={(e) => update({ reminderHour: Number(e.target.value) })}
              className="sp-select"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Appearance</h2>
          <div className="space-y-2">
            <span className="sp-setting-row__label">Theme</span>
            <div className="sp-theme-grid">
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="sp-theme-pill"
                    data-active={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() => pickTheme(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sp-section space-y-3">
          <h2 className="sp-section__title">Privacy</h2>
          <Toggle
            label="Show profile on leaderboard / users directory"
            description="Off makes your profile private to other learners."
            value={data.settings.isPublic}
            disabled={busy}
            onChange={(v) => update({ isPublic: v })}
          />
        </section>
      </div>

      <div
        className="sp-toast"
        role="status"
        aria-live="polite"
        data-show={toast ? "true" : "false"}
      >
        <span aria-hidden="true">✓</span> Opgeslagen
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
    <label className="sp-setting-row">
      <span className="flex-1">
        <span className="sp-setting-row__label">{label}</span>
        {description && (
          <span className="sp-setting-row__desc">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className="sp-toggle"
        data-on={value ? "true" : "false"}
      >
        <span className="sp-toggle__knob" />
      </button>
    </label>
  );
}
