import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { setCefrLevel, unlockStartingUnit } from "../lib/server/user";

export const Route = createFileRoute("/onboarding/level-pick")({ component: LevelPickPage });

function LevelPickPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function pick(level: "A1" | "A2" | "B1") {
    setSubmitting(level);
    await setCefrLevel({ data: { level } });
    await unlockStartingUnit();
    navigate({ to: "/onboarding/notifications" as never });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">Pick your level</h1>
      <p className="mt-2 text-neutral-600">
        You can change this later from your profile.
      </p>
      <div className="mt-8 grid gap-4">
        {(["A1", "A2", "B1"] as const).map((lvl) => (
          <button
            key={lvl}
            disabled={!!submitting}
            onClick={() => pick(lvl)}
            className="rounded-3xl border-2 border-neutral-200 p-6 text-left hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50"
          >
            <span className="block text-2xl font-bold">{lvl}</span>
            <span className="block text-sm text-neutral-600">
              {lvl === "A1"
                ? "Brand new to Dutch."
                : lvl === "A2"
                  ? "Basic conversations and verbs."
                  : "Intermediate: subordinate clauses, idioms."}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <a href="/onboarding" className="underline">
          Or take the 5-question check instead
        </a>
      </p>
    </main>
  );
}
