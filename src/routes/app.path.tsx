import { createFileRoute } from "@tanstack/react-router";
import { getPath } from "../lib/server/path";
import { AppShell } from "../components/AppShell";
import { Stroop } from "../components/Stroop";

export const Route = createFileRoute("/app/path")({
  loader: async () => await getPath(),
  component: PathPage,
});

function PathPage() {
  const data = Route.useLoaderData();

  return (
    <AppShell user={data.user}>
      <div className="mb-4 flex items-center gap-4">
        <Stroop
          state={data.user.streakDays === 0 ? "concerned" : "idle"}
          size="md"
        />
        <div>
          <h1 className="text-2xl font-bold">Your path</h1>
          <p className="text-sm text-neutral-500">Level: {data.user.cefrLevel}</p>
        </div>
      </div>

      <ol className="space-y-4">
        {data.path.map((u, i) => {
          const isLocked = u.status === "locked";
          const isCompleted = u.status === "completed";
          const isInProgress = u.status === "in_progress";
          const bgClass = isCompleted
            ? "bg-emerald-100 border-emerald-300"
            : isInProgress
              ? "bg-orange-100 border-orange-300"
              : isLocked
                ? "bg-neutral-100 border-neutral-200 opacity-60"
                : "bg-white border-orange-200 hover:border-orange-400";
          const indent = i % 2 === 0 ? "" : "ml-12";
          const inner = (
            <div
              className={`rounded-3xl border-2 ${bgClass} p-4 transition-all ${indent} shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-neutral-500">
                    Unit {u.order} · {u.status}
                  </div>
                  <div className="text-lg font-bold">{u.titleNl}</div>
                  <div className="text-sm text-neutral-600">{u.titleEn}</div>
                </div>
                <div className="text-2xl">
                  {isCompleted ? "✅" : isInProgress ? "🟠" : isLocked ? "🔒" : "🟡"}
                </div>
              </div>
              {!isLocked && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full bg-orange-500"
                    style={{
                      width: `${u.lessonsTotal > 0 ? (u.lessonsCompleted / u.lessonsTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );

          return (
            <li key={u.id}>
              {isLocked ? (
                inner
              ) : (
                <a href={`/app/unit/${u.slug}`} className="block">
                  {inner}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </AppShell>
  );
}
