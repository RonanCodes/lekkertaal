import { createFileRoute } from "@tanstack/react-router";
import { getPath } from "../lib/server/path";
import { getWordOfTheDay } from "../lib/server/wordOfDay";
import { AppShell } from "../components/AppShell";
import { Stroop } from "../components/Stroop";
import { DailyQuests } from "../components/DailyQuests";
import { WordOfTheDay } from "../components/WordOfTheDay";
import { PathStatusStrip } from "../components/path/PathStatusStrip";
import { NeighbourhoodBlock } from "../components/path/NeighbourhoodBlock";

export const Route = createFileRoute("/app/path")({
  loader: async () => {
    const [path, wordOfDay] = await Promise.all([
      getPath(),
      getWordOfTheDay(),
    ]);
    return { ...path, wordOfDay };
  },
  component: PathPage,
});

function PathPage() {
  const data = Route.useLoaderData();

  return (
    <AppShell user={data.user}>
      <PathStatusStrip
        streakDays={data.user.streakDays}
        xpTotal={data.user.xpTotal}
        coinsBalance={data.user.coinsBalance}
        freezes={data.user.streakFreezesBalance}
      />

      <div className="mb-5 flex items-center gap-4">
        <Stroop
          state={data.user.streakDays === 0 ? "concerned" : "idle"}
          size="md"
        />
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Your path</h1>
          <p className="text-sm text-neutral-500">Level: {data.user.cefrLevel}</p>
        </div>
      </div>

      <DailyQuests initial={data.quests} />

      <WordOfTheDay data={data.wordOfDay} />

      <div className="canal-bg mt-2 rounded-3xl">
        <div className="space-y-5 py-2">
          {data.path.map((unit) => (
            <NeighbourhoodBlock key={unit.id} unit={unit} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
