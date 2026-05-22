import type { ReactNode } from "react";
import { CheckCircle2, Flame, Trophy, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HeatmapCell } from "../lib/server/profile-activity";

/**
 * Map an XP total to a level the same way the path status strip does
 * (`Math.floor(xp / 100) + 1`). Kept here so the profile badge and the path
 * header never drift apart.
 */
export function levelFromXp(xpTotal: number): number {
  return Math.floor(xpTotal / 100) + 1;
}

/**
 * The eight Dutch-treat mascots under `public/mascot/treats/`. The avatar
 * picks one deterministically from the user's display name so a given user
 * always shows the same treat.
 */
const AVATAR_TREATS = [
  "kroket",
  "bitterballen",
  "oliebollen",
  "drop",
  "poffertjes",
  "frikandel",
  "tompouce",
  "kaas",
] as const;

export function treatForName(name: string): (typeof AVATAR_TREATS)[number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const idx = ((h % AVATAR_TREATS.length) + AVATAR_TREATS.length) % AVATAR_TREATS.length;
  return AVATAR_TREATS[idx];
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Tone driving the block colour. */
  tone: "streak" | "xp" | "league" | "lessons";
}

function StatBlock({ icon: Icon, label, value, tone }: StatProps) {
  return (
    <div className={`ph-stat ph-stat--${tone}`}>
      <div className="ph-stat__head">
        <Icon size={14} aria-hidden />
        <span className="ph-stat__label">{label}</span>
      </div>
      <div className="ph-stat__value">{value}</div>
    </div>
  );
}

/**
 * Twelve-week (84-day) activity heatmap, GitHub-contributions style. Cells
 * run top-to-bottom, week-by-week (7 rows, one column per week). Colour level
 * is bucketed from the day's XP. Empty days render in the soft line colour.
 */
function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  return (
    <div className="ph-heatmap" data-testid="profile-heatmap">
      <div className="ph-heatmap__grid">
        {cells.map((cell) => {
          const lvl =
            cell.xp <= 0 ? 0 : cell.xp < 20 ? 1 : cell.xp < 50 ? 2 : cell.xp < 100 ? 3 : 4;
          return (
            <span
              key={cell.date}
              className="ph-heatmap__cell"
              data-level={lvl}
              title={`${cell.date} · ${cell.xp} XP`}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface ProfileHeroProps {
  displayName: string;
  cefrLevel: string;
  xpTotal: number;
  streakDays: number;
  lessonsCompleted: number;
  league: { name: string; emoji: string } | null;
  heatmap: HeatmapCell[];
  /** Top-right action (settings cog for own, add-friend for others). */
  action?: ReactNode;
  /** Extra meta pills rendered after the CEFR pill. */
  metaExtra?: ReactNode;
}

/**
 * Shared profile identity block: mascot avatar with a level-badge overlay,
 * four stat blocks (Streak / Total XP / League / Lessons), and a 12-week
 * activity heatmap. Used by both the own profile and the public friend view
 * so the two stay in fidelity lockstep.
 */
export function ProfileHero({
  displayName,
  cefrLevel,
  xpTotal,
  streakDays,
  lessonsCompleted,
  league,
  heatmap,
  action,
  metaExtra,
}: ProfileHeroProps) {
  const level = levelFromXp(xpTotal);
  const treat = treatForName(displayName);

  return (
    <section className="sp-hero">
      <div className="sp-hero__top">
        <div className="ph-avatar" data-testid="profile-avatar">
          <img
            src={`/mascot/treats/${treat}/happy.png`}
            alt=""
            className="ph-avatar__img"
          />
          <span className="ph-avatar__level" data-testid="profile-level-badge">
            Lv {level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="sp-hero__name truncate">{displayName}</h1>
          <div className="sp-hero__meta">
            <span className="sp-pill sp-pill--cefr">CEFR {cefrLevel}</span>
            {metaExtra}
          </div>
        </div>
        {action}
      </div>

      <div className="ph-stats">
        <StatBlock
          icon={Flame}
          label="Streak"
          tone="streak"
          value={streakDays}
        />
        <StatBlock
          icon={Zap}
          label="Total XP"
          tone="xp"
          value={xpTotal.toLocaleString("nl-NL")}
        />
        <StatBlock
          icon={Trophy}
          label="League"
          tone="league"
          value={
            league ? (
              <span className="ph-stat__league">
                <span aria-hidden>{league.emoji}</span>
                {league.name}
              </span>
            ) : (
              "—"
            )
          }
        />
        <StatBlock
          icon={CheckCircle2}
          label="Lessons"
          tone="lessons"
          value={lessonsCompleted}
        />
      </div>

      <div className="ph-heatmap-block">
        <div className="ph-heatmap-block__head">
          <span className="ph-heatmap-block__title">Activity · last 12 weeks</span>
          <span className="ph-heatmap-legend">
            <span>Less</span>
            <span className="ph-heatmap-legend__scale">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="ph-heatmap__cell" data-level={i} />
              ))}
            </span>
            <span>More</span>
          </span>
        </div>
        <Heatmap cells={heatmap} />
      </div>
    </section>
  );
}
