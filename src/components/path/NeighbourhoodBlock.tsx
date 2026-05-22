import { Check, Lock, Star, Swords } from "lucide-react";
import type { PathUnit, PathLesson, PathLessonState } from "../../lib/server/path";

/**
 * Neighbourhood block (issue #207, lesson-grained in #224, fidelity top-up in
 * #243). One unit rendered as a "block" card holding a staggered grid of lesson
 * tiles, capped by a wide boss-fight bar. NOT a winding tree — a brick-offset
 * tile grid per the redesign.
 *
 * The #243 fidelity pass adds three things from `docs/design/screens-path.jsx`:
 *   - a treat mascot in the unit header (idle when locked / in-progress, happy
 *     when the unit is done) plus an inline per-unit progress bar;
 *   - a visible truncated label under each lesson tile (muted when locked);
 *   - 1–3 absolutely-positioned bobbing decorative treats scattered in the grid
 *     gaps of non-locked units (`PathDeco`). They are purely visual
 *     (`aria-hidden`, `pointer-events: none`) and live OUTSIDE the tile list so
 *     the grid's `role="list"` only ever contains real lesson tiles.
 *
 * The path loader is lesson-grained: each unit carries `lessons[]` with a
 * per-lesson `state` (done / current / available / locked) and a deep-link
 * `href` straight to `/app/lesson/:id`. Tiles consume those rows directly.
 * When a unit has no lesson rows yet (count-only fallback) we still render a
 * single tile from `lessonsTotal` so the block never collapses to nothing.
 */

/**
 * The Dutch-treat mascot family doubles as unit characters (per the redesign
 * brief). Units don't carry a mascot field, so pick one deterministically from
 * the unit order: same unit always shows the same treat, consecutive units
 * cycle through the family. Mirrors `treatFor` in `app.unit.$slug.tsx`. Each
 * treat has idle / happy / surprised frames under `public/mascot/treats/`.
 */
const UNIT_TREATS = [
  "kroket",
  "bitterballen",
  "oliebollen",
  "drop",
  "poffertjes",
  "frikandel",
  "tompouce",
  "kaas",
] as const;

type Treat = (typeof UNIT_TREATS)[number];

function treatFor(order: number): Treat {
  const i = (((order - 1) % UNIT_TREATS.length) + UNIT_TREATS.length) % UNIT_TREATS.length;
  return UNIT_TREATS[i];
}

/**
 * Scatter slots for the decorative treats. Tuned to sit in the gaps of the
 * brick-offset grid so they never land on a tile. Each unit deterministically
 * picks 1–3 of these (by unit order) so the layout is stable per unit but
 * varied across the path.
 */
const DECO_SLOTS = [
  { left: "84%", top: "8%" },
  { left: "3%", top: "44%" },
  { left: "90%", top: "62%" },
  { left: "46%", top: "78%" },
] as const;

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
  const pct = Math.round((done / total) * 100);

  const treat = treatFor(unit.order);
  const mood: "idle" | "happy" = isDone ? "happy" : "idle";

  // Prefer real lesson rows. When the loader returned none (e.g. content not
  // yet seeded for the unit) synthesise one placeholder tile PER expected
  // lesson so the grid still reads as a staggered tile-grid, never a single
  // lonely box that looks like a broken image. The count tracks `lessonsTotal`
  // (clamped to a sane range); each synthesised tile is locked + inert when the
  // unit is locked, otherwise it deep-links to the unit overview.
  const placeholderCount = Math.min(Math.max(unit.lessonsTotal, 1), 8);
  const tiles: PathLesson[] =
    unit.lessons.length > 0
      ? unit.lessons
      : Array.from({ length: placeholderCount }, (_, i) => ({
          id: -(i + 1),
          slug: `${unit.slug}-pending-${i + 1}`,
          order: i + 1,
          titleNl: unit.titleNl,
          titleEn: unit.titleEn,
          state: isLocked ? ("locked" as const) : ("available" as const),
          href: isLocked ? null : `/app/unit/${unit.slug}`,
        }));

  // 1–3 scattered treats, only for non-locked units. Count + slot choice are
  // derived from the unit order so the same unit always reads the same.
  const decoCount = isLocked ? 0 : 1 + (unit.order % 3);
  const decos = DECO_SLOTS.slice(0, decoCount).map((slot, i) => ({
    slot,
    treat: treatFor(unit.order + i + 1),
  }));

  return (
    <section
      className={`${blockClass} p-4 sm:p-5`}
      aria-label={`Unit ${unit.order}: ${unit.titleEn}`}
    >
      <header className="path-block__header mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Unit {unit.order}
          </div>
          <div className="text-lg font-bold text-neutral-900">{unit.titleNl}</div>
          <div className="text-sm text-neutral-600">{unit.titleEn}</div>
          {!isLocked && (
            <div
              className="path-progress mt-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${done} of ${total} lessons complete`}
            >
              <span
                className="path-progress__fill"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          )}
        </div>
        <div className="path-block__header-end">
          <UnitBadge isDone={isDone} isLocked={isLocked} done={done} total={total} />
          <img
            src={`/mascot/treats/${treat}/${mood}.png`}
            alt=""
            aria-hidden
            className={`path-unit-mascot ${mood === "happy" ? "anim-happy-bounce" : "anim-idle-bob"}`}
            // Never leave a broken/empty image box: if the treat art fails to
            // load (missing asset on a unit) drop the element entirely.
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </header>

      <div className="path-grid-stage">
        <div className="path-grid" role="list">
          {tiles.map((lesson, i) => (
            <PathTile
              key={lesson.id >= 0 ? lesson.id : `pending-${i}`}
              index={i + 1}
              state={lesson.state}
              href={lesson.href ?? undefined}
              label={lesson.titleNl}
            />
          ))}
        </div>

        {/* Decorative treats — absolutely positioned in the grid gaps. Purely
            visual: aria-hidden + pointer-events-none, sat below the tiles. */}
        {decos.map(({ slot, treat: decoTreat }, i) => (
          <span
            key={`deco-${i}`}
            className="path-deco anim-idle-bob"
            aria-hidden
            style={{
              left: slot.left,
              top: slot.top,
              animationDelay: `${(i * 0.4).toFixed(1)}s`,
            }}
          >
            <img
              src={`/mascot/treats/${decoTreat}/idle.png`}
              alt=""
              aria-hidden
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
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
  label,
}: {
  index: number;
  state: TileState;
  href?: string;
  label: string;
}) {
  const cls = `path-tile path-tile--${state}`;
  const ariaLabel =
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

  const tile =
    !href ? (
      <span className={cls} aria-label={ariaLabel} aria-disabled="true">
        {inner}
      </span>
    ) : (
      <a className={cls} href={href} aria-label={ariaLabel}>
        {inner}
      </a>
    );

  // The cell is the grid child carrying the listitem role; the tile (anchor or
  // span) keeps the aria-label + href so it stays the queried/clickable target.
  // The visible label sits below, muted when the lesson is locked.
  return (
    <span className="path-cell" role="listitem">
      {tile}
      <span
        className={`path-tile-label ${state === "locked" ? "path-tile-label--muted" : ""}`}
      >
        {label}
      </span>
    </span>
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
