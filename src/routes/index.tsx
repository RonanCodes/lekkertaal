import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-5xl font-bold tracking-tight">Lekkertaal</h1>
      <p className="mt-4 text-xl text-neutral-600">Dutch, made tasty.</p>
      <p className="mt-2 text-neutral-500">
        Five-minute daily drills. End-of-unit roleplay boss fights with Stroop the stroopwafel.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <a
          href="/sign-up"
          className="rounded-2xl bg-orange-500 px-6 py-3 text-lg font-semibold text-white shadow-md hover:bg-orange-600"
        >
          Start learning
        </a>
        <a
          href="/sign-in"
          className="rounded-2xl border border-neutral-300 px-6 py-3 text-lg font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          Sign in
        </a>
      </div>
    </main>
  );
}
