import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <div className="mb-6 text-8xl">🥨</div>

      <h1 className="text-6xl font-extrabold tracking-tight">
        <span style={{ color: "var(--color-brand-orange)" }}>Lekker</span>
        <span style={{ color: "var(--color-brand-blue)" }}>taal</span>
      </h1>

      <p className="mt-4 text-2xl font-semibold" style={{ color: "var(--color-ink-soft)" }}>
        Dutch, made tasty.
      </p>

      <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--color-ink-soft)" }}>
        Five-minute daily drills. End-of-unit roleplay boss fights with Stroop the stroopwafel.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a href="/sign-up" className="btn-3d">Start learning</a>
        <a href="/sign-in" className="btn-3d btn-3d-ghost">Sign in</a>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
        <div className="card">
          <div className="text-3xl">📚</div>
          <h3 className="mt-2 text-lg">Daily drills</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Vocab, grammar, listening. 5 minutes a day keeps your streak alive.
          </p>
        </div>
        <div className="card">
          <div className="text-3xl">💬</div>
          <h3 className="mt-2 text-lg">AI roleplay</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Practice ordering coffee, work standups, the doctor's office, with an AI tutor.
          </p>
        </div>
        <div className="card">
          <div className="text-3xl">🔥</div>
          <h3 className="mt-2 text-lg">Streaks &amp; XP</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Streak freezes, coins, badges, leaderboards. Habit-first, hassle-free.
          </p>
        </div>
      </div>
    </main>
  );
}
