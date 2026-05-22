import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLesson } from "../lib/server/lesson";
import { AppShell } from "../components/AppShell";
import { motion } from "motion/react";
import { Stroop } from "../components/Stroop";
import { useSfx } from "../lib/use-sfx";
import { useEffect, useMemo } from "react";

/**
 * Optional search params. The lesson player navigates here without params, so
 * every field is optional and the screen degrades to the "normal" celebration
 * when nothing is supplied. When the player is later wired to pass per-lesson
 * results, dropping `correct`/`total` in unlocks the perfect-lesson state and
 * `milestone` forces the milestone treatment. Award + nav logic is unchanged —
 * these only steer which celebration variant renders.
 */
type CompleteSearch = {
  correct?: number;
  total?: number;
  milestone?: boolean;
};

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 150, 200, 365] as const;

export const Route = createFileRoute("/app/lesson/$lessonId/complete")({
  validateSearch: (search: Record<string, unknown>): CompleteSearch => {
    const num = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      correct: num(search.correct),
      total: num(search.total),
      milestone: search.milestone === true || search.milestone === "true" || undefined,
    };
  },
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

export type CelebrationState = "normal" | "perfect" | "milestone";

/**
 * Pick the celebration variant from the lesson result + the user's streak.
 *
 * - milestone wins (rarest, biggest moment): forced via `?milestone=true` or
 *   when the current streak lands on a milestone day.
 * - perfect: a flawless run, i.e. `correct >= total > 0`.
 * - normal: everything else, including a missing/partial result.
 *
 * Pure so the player→complete wiring (#234) can be asserted without rendering.
 */
export function pickCelebration(args: {
  correct?: number;
  total?: number;
  milestone?: boolean;
  streakDays: number;
}): CelebrationState {
  const isPerfect =
    typeof args.correct === "number" &&
    typeof args.total === "number" &&
    args.total > 0 &&
    args.correct >= args.total;

  const isMilestone =
    args.milestone === true || STREAK_MILESTONES.includes(args.streakDays as never);

  return isMilestone ? "milestone" : isPerfect ? "perfect" : "normal";
}

/** A treat to crown a streak milestone — rotates so a long streak isn't stale. */
const MILESTONE_TREATS = ["oliebollen", "tompouce", "poffertjes", "kaas"] as const;

function LessonCompletePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { lesson, user } = data;
  const backTo = lesson.unitSlug ? `/app/unit/${lesson.unitSlug}` : "/app/path";
  const sfx = useSfx(user.sfxEnabled);

  const celebration = pickCelebration({
    correct: search.correct,
    total: search.total,
    milestone: search.milestone,
    streakDays: user.streakDays,
  });

  useEffect(() => {
    sfx.play("lesson-complete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = COPY[celebration];
  const treat = useMemo(
    () => MILESTONE_TREATS[user.streakDays % MILESTONE_TREATS.length],
    [user.streakDays],
  );

  return (
    <AppShell user={user}>
      <div className={`lesson-complete lesson-complete--${celebration}`}>
        <ConfettiField variant={celebration} />

        <div className="lesson-complete__stage">
          {/* Mascot — Stroop for normal/perfect, the streak treat for milestone. */}
          <motion.div
            className="lesson-complete__mascot"
            initial={{ scale: 0.3, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 13 }}
          >
            {celebration === "milestone" ? (
              <img
                src={`/mascot/treats/${treat}/happy.png`}
                alt=""
                width={208}
                height={208}
                className="mascot-anim mascot-happy lesson-complete__treat"
              />
            ) : (
              <Stroop state={celebration === "perfect" ? "proud" : "happy"} size="xl" />
            )}
          </motion.div>

          {/* Stat postcard — sits over the mascot, springs in after it lands. */}
          <motion.div
            className="lesson-complete__postcard"
            initial={{ scale: 0.85, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 220, damping: 16 }}
          >
            <div className="lesson-complete__badge">{copy.badge}</div>
            <h1 className="lesson-complete__title">{copy.title}</h1>
            <p className="lesson-complete__subtitle">
              {lesson.titleNl} &middot; {lesson.titleEn}
            </p>

            <dl className="lesson-complete__stats">
              <Stat
                className="lesson-complete__stat--xp"
                label="XP"
                value={`+${lesson.xpReward}`}
              />
              <Stat
                className="lesson-complete__stat--coins"
                label="Coins"
                value={`${user.coinsBalance}`}
              />
              <Stat
                className="lesson-complete__stat--streak"
                label="Streak"
                value={`${user.streakDays}d`}
                emphasised={celebration === "milestone"}
              />
            </dl>
          </motion.div>
        </div>

        <motion.div
          className="lesson-complete__actions"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <a href={backTo} className="btn-3d btn-3d-green btn-3d-lg btn-3d-full">
            {copy.cta}
          </a>
        </motion.div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  className = "",
  emphasised = false,
}: {
  label: string;
  value: string;
  className?: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={`lesson-complete__stat ${className} ${
        emphasised ? "lesson-complete__stat--pop" : ""
      }`}
    >
      <dd className="lesson-complete__stat-value">{value}</dd>
      <dt className="lesson-complete__stat-label">{label}</dt>
    </div>
  );
}

/**
 * Waffle confetti. A scatter of stroopwafel-tan tiles drifting down behind the
 * stage. Perfect/milestone add more pieces and a touch of gold. Honours
 * prefers-reduced-motion (the CSS pins them static).
 */
function ConfettiField({ variant }: { variant: CelebrationState }) {
  const count = variant === "normal" ? 14 : 24;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.round((i / count) * 100 + (i % 3) * 6),
        delay: (i % 7) * 0.18,
        duration: 2.6 + (i % 5) * 0.4,
        gold: variant !== "normal" && i % 3 === 0,
        rotate: (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 25),
      })),
    [count, variant],
  );

  return (
    <div className="lesson-complete__confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`lesson-complete__waffle ${
            p.gold ? "lesson-complete__waffle--gold" : ""
          }`}
          style={{ left: `${p.left}%` }}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: "110%", opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{
            delay: p.delay,
            duration: p.duration,
            repeat: Infinity,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}

const COPY: Record<CelebrationState, {
  badge: string;
  title: string;
  subtitle?: string;
  cta: string;
}> = {
  normal: {
    badge: "Les voltooid",
    title: "Lesson complete!",
    cta: "Back to path",
  },
  perfect: {
    badge: "Foutloos",
    title: "Perfect lesson!",
    cta: "Keep it going",
  },
  milestone: {
    badge: "Streak milestone",
    title: "You're on fire!",
    cta: "Back to path",
  },
};
