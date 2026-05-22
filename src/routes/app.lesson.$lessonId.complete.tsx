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

/**
 * Accuracy summary for the celebration's accuracy row. Returns null when the
 * player didn't pass a result (the row is then hidden rather than guessing).
 * `pct` is rounded for display; `correct`/`mistakes` are the raw counts.
 */
export function accuracyFromResult(args: {
  correct?: number;
  total?: number;
}): { pct: number; correct: number; mistakes: number } | null {
  const { correct, total } = args;
  if (typeof correct !== "number" || typeof total !== "number" || total <= 0) {
    return null;
  }
  const c = Math.max(0, Math.min(correct, total));
  return {
    pct: Math.round((c / total) * 100),
    correct: c,
    mistakes: total - c,
  };
}

/**
 * The badge a streak milestone unlocks. Mirrors the gamification milestone
 * ladder so the celebration names the same badge the user actually earns.
 */
export function milestoneBadge(streakDays: number): { name: string; blurb: string } {
  if (streakDays >= 365) return { name: "Jaar-held", blurb: "365 days — a full year of Dutch." };
  if (streakDays >= 200) return { name: "Twee-honderd", blurb: "200 days in a row. Onverwoestbaar." };
  if (streakDays >= 150) return { name: "Honderdvijftig", blurb: "150 days strong and counting." };
  if (streakDays >= 100) return { name: "Eeuweling", blurb: "100 days — a true centurion." };
  if (streakDays >= 50) return { name: "Vijftig", blurb: "50 days in a row. Echt sterk." };
  if (streakDays >= 30) return { name: "Maand-monster", blurb: "30 days in a row — that's the whole maand." };
  if (streakDays >= 14) return { name: "Twee-weker", blurb: "Two weeks straight. Lekker bezig." };
  return { name: "Week-winnaar", blurb: "Seven days in a row. Goed begin!" };
}

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
  const accuracy = useMemo(
    () => accuracyFromResult({ correct: search.correct, total: search.total }),
    [search.correct, search.total],
  );
  const badge = useMemo(() => milestoneBadge(user.streakDays), [user.streakDays]);

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

            {/* Perfect-lesson bonus — only on a flawless run. */}
            {celebration === "perfect" && (
              <div className="lesson-complete__callout lesson-complete__callout--bonus">
                <span className="lesson-complete__callout-icon" aria-hidden="true">
                  ✨
                </span>
                <div className="lesson-complete__callout-body">
                  <span className="lesson-complete__callout-title">Perfect lesson bonus</span>
                  <span className="lesson-complete__callout-sub">No mistakes — +6 XP, +5 coins</span>
                </div>
              </div>
            )}

            {/* Milestone badge unlock — names the streak badge just earned. */}
            {celebration === "milestone" && (
              <div className="lesson-complete__callout lesson-complete__callout--badge">
                <span className="lesson-complete__callout-icon" aria-hidden="true">
                  👑
                </span>
                <div className="lesson-complete__callout-body">
                  <span className="lesson-complete__callout-title">
                    Badge unlocked: {badge.name}
                  </span>
                  <span className="lesson-complete__callout-sub">{badge.blurb}</span>
                </div>
              </div>
            )}

            {/* Accuracy row — only when the player passed a result. */}
            {accuracy && (
              <div className="lesson-complete__accuracy">
                <div className="lesson-complete__accuracy-head">
                  <span className="lesson-complete__accuracy-label">Accuracy</span>
                  <span
                    className={`lesson-complete__accuracy-pct ${
                      accuracy.pct === 100 ? "lesson-complete__accuracy-pct--perfect" : ""
                    }`}
                  >
                    {accuracy.pct}%
                  </span>
                </div>
                <div
                  className="lesson-complete__accuracy-track"
                  role="progressbar"
                  aria-valuenow={accuracy.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Lesson accuracy"
                >
                  <div
                    className={`lesson-complete__accuracy-fill ${
                      accuracy.pct === 100 ? "lesson-complete__accuracy-fill--perfect" : ""
                    }`}
                    style={{ width: `${accuracy.pct}%` }}
                  />
                </div>
                <div className="lesson-complete__accuracy-counts">
                  <span>
                    <strong className="lesson-complete__count--correct">{accuracy.correct}</strong>{" "}
                    correct
                  </span>
                  <span>
                    <strong className="lesson-complete__count--mistakes">
                      {accuracy.mistakes}
                    </strong>{" "}
                    {accuracy.mistakes === 1 ? "mistake" : "mistakes"}
                  </span>
                </div>
              </div>
            )}
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
          {accuracy && accuracy.mistakes > 0 && (
            <a
              href={`/app/lesson/${lesson.id}?review=mistakes`}
              className="btn-3d btn-3d-ghost btn-3d-full lesson-complete__review"
            >
              Review mistakes
            </a>
          )}
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
