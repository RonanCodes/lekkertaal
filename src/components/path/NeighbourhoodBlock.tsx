import { Check, Lock, Star, Swords } from "lucide-react";
import type { PathUnit } from "../../lib/server/path";

/**
 * Neighbourhood block (issue #207). One unit rendered as a "block" card
 * holding a staggered grid of lesson tiles, capped by a wide boss-fight bar.
 * NOT a winding tree — a brick-offset tile grid per the redesign.
 *
 * The path loader is unit-grained (each unit carries lessonsCompleted /
 * lessonsTotal), so we derive per-tile state from those counts: tiles below
 * the completed count read "done", the next one reads "current", the rest
 * "available" (within an unlocked unit) or "locked".
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
  const href = `/app/unit/${unit.slug}`;

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
        {Array.from({ length: total }).map((_, i) => {
          const state: TileState = isLocked
            ? "locked"
            : i < done
              ? "done"
              : i === done
                ? "current"
                : "available";
          return (
            <PathTile
              key={i}
              index={i + 1}
              state={state}
              href={state === "locked" ? undefined : href}
            />
          );
        })}
      </div>

      <BossFightBar slug={unit.slug} locked={!isDone && !isCurrent} />
    </section>
  );
}

type TileState = "done" | "current" | "available" | "locked";

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
