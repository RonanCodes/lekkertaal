import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLesson } from "../lib/server/lesson";
import { AppShell } from "../components/AppShell";
import { motion } from "motion/react";
import { Stroop } from "../components/Stroop";

export const Route = createFileRoute("/app/lesson/$lessonId/complete")({
  loader: async ({ params }) => {
    const id = Number(params.lessonId);
    if (!Number.isFinite(id)) throw notFound();
    try {
      return await getLesson({ data: { lessonId: id } });
    } catch (err) {
      if (err instanceof Error && err.message === "Lesson not found") throw notFound();
      throw err;
    }
  },
  component: LessonCompletePage,
});

function LessonCompletePage() {
  const data = Route.useLoaderData();
  const { lesson, user } = data;
  const backTo = lesson.unitSlug ? `/app/unit/${lesson.unitSlug}` : "/app/path";

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-md py-10 text-center">
        <motion.div
          className="mx-auto mb-6"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
        >
          <Stroop state="happy" size="xl" />
        </motion.div>

        <motion.h1
          className="mb-2 text-3xl font-bold"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Lesson complete!
        </motion.h1>
        <motion.p
          className="mb-6 text-neutral-600"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {lesson.titleNl} &middot; {lesson.titleEn}
        </motion.p>

        <motion.div
          className="mb-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div className="text-xs uppercase tracking-wide text-amber-700">XP earned</div>
          <div className="text-4xl font-extrabold text-amber-700">+{lesson.xpReward}</div>
        </motion.div>

        <a
          href={backTo}
          className="inline-block rounded-full bg-orange-500 px-6 py-3 text-base font-semibold text-white hover:bg-orange-600"
        >
          Back to path
        </a>
      </div>
    </AppShell>
  );
}
