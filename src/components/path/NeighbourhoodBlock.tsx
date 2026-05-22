import { Check, Lock, Star, Swords } from "lucide-react";
import type { PathUnit, PathLesson, PathLessonState } from "../../lib/server/path";

/**
 * Neighbourhood block (issue #207, lesson-grained in #224). One unit rendered
 * as a "block" card holding a staggered grid of lesson tiles, capped by a wide
 * boss-fight bar. NOT a winding tree — a brick-offset tile grid per the
 * redesign.
 *
 * The path loader is now lesson-grained: each unit carries `lessons[]` with a
 * per-lesson `state` (done / current / available / locked) and a deep-link
 * `href` straight to `/app/lesson/:id`. Tiles consume those rows directly.
 * When a unit has no lesson rows yet (count-only fallback) we still render a
 * single tile from `lessonsTotal` so the block never collapses to nothing.
 */
export function NeighbourhoodBlock({ unit }: { unit: PathUnit }) {
  const isLocked = unit.status === "locked";
  const isDone = unit.status === "completed";
  const isCurrent = unit.status === "in_progress";

  const blockClass = isDone
    ? "path-block path-block--done"
    : isCurrent
      ? "path-block path-block--current"
      : isLocked
        ? "path-block path-block--locked"
        : "path-block";

  const total = Math.max(unit.lessonsTotal, 1);
  const done = Math.min(unit.lessonsCompleted, total);

  // Prefer real lesson rows; fall back to a single synthesised tile when the
  // loader returned none (e.g. content not yet seeded for the unit).
  const tiles: PathLesson[] =
    unit.lessons.length > 0
      ? unit.lessons
      : [
          {
            id: -1,
            slug: `${unit.slug}-pending`,
            order: 1,
            titleNl: unit.titleNl,
            titleEn: unit.titleEn,
            state: isLocked ? "locked" : "available",
            href: isLocked ? null : `/app/unit/${unit.slug}`,
          },
        ];

  return (
    <section
      className={`${blockClass} p-4 sm:p-5`}
      aria-label={`Unit ${unit.order}: ${unit.titleEn}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Unit {unit.order}
          </div>
          <div className="text-lg font-bold text-neutral-900">{unit.titleNl}</div>
          <div className="text-sm text-neutral-600">{unit.titleEn}</div>
        </div>
        <UnitBadge isDone={isDone} isLocked={isLocked} done={done} total={total} />
      </header>

      <div className="path-grid" role="list">
        {tiles.map((lesson, i) => (
          <PathTile
            key={lesson.id >= 0 ? lesson.id : `pending-${i}`}
            index={i + 1}
            state={lesson.state}
            href={lesson.href ?? undefined}
          />
        ))}
      </div>

      <BossFightBar slug={unit.slug} locked={!isDone && !isCurrent} />
    </section>
  );
}

type TileState = PathLessonState;

function PathTile({
  index,
  state,
  href,
}: {
  index: number;
  state: TileState;
  href?: string;
}) {
  const cls = `path-tile path-tile--${state}`;
  const label =
    state === "done"
      ? `Lesson ${index}, completed`
      : state === "current"
        ? `Lesson ${index}, continue`
        : state === "locked"
          ? `Lesson ${index}, locked`
          : `Lesson ${index}`;

  const inner =
    state === "done" ? (
      <Check size={22} aria-hidden />
    ) : state === "locked" ? (
      <Lock size={18} aria-hidden />
    ) : state === "current" ? (
      <Star size={22} aria-hidden />
    ) : (
      <span className="text-base">{index}</span>
    );

  if (!href) {
    return (
      <span className={cls} role="listitem" aria-label={label} aria-disabled="true">
        {inner}
      </span>
    );
  }
  return (
    <a className={cls} role="listitem" href={href} aria-label={label}>
      {inner}
    </a>
  );
}

function BossFightBar({ slug, locked }: { slug: string; locked: boolean }) {
  const cls = locked ? "path-boss path-boss--locked" : "path-boss";
  const content = (
    <>
      <Swords size={22} aria-hidden className="shrink-0" />
      <span className="flex-1">
        <span className="block text-sm font-extrabold uppercase tracking-wide">
          Boss fight
        </span>
        <span className="block text-xs font-medium opacity-90">
          {locked
            ? "Finish the unit to unlock the roleplay"
            : "Take on the AI roleplay scenario"}
        </span>
      </span>
      {locked && <Lock size={16} aria-hidden className="shrink-0" />}
    </>
  );

  if (locked) {
    return (
      <div className={`${cls} mt-4`} aria-label="Boss fight (locked)" aria-disabled="true">
        {content}
      </div>
    );
  }
  return (
    <a className={`${cls} mt-4`} href={`/app/unit/${slug}`} aria-label="Boss fight">
      {content}
    </a>
  );
}

function UnitBadge({
  isDone,
  isLocked,
  done,
  total,
}: {
  isDone: boolean;
  isLocked: boolean;
  done: number;
  total: number;
}) {
  if (isDone) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: "var(--color-good)", color: "#fff" }}
      >
        <Star size={14} aria-hidden /> Done
      </span>
    );
  }
  if (isLocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-500">
        <Lock size={14} aria-hidden /> Locked
      </span>
    );
  }
  return (
    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
      {done} / {total}
    </span>
  );
}
