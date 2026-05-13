#!/usr/bin/env tsx
/**
 * Seed loader (US-003)
 *
 * Reads seed/*.json (produced by US-001 ingest) and emits an idempotent SQL
 * file using INSERT OR IGNORE so re-runs are safe. Then invokes
 * `wrangler d1 execute lekkertaal_db --file=<out> --local|--remote` to apply.
 *
 * Usage:
 *   pnpm seed:load                  # --local by default
 *   pnpm seed:load --remote         # remote D1
 *   pnpm seed:load --emit-only      # write SQL but don't execute
 *
 * Tables loaded:
 *   - grammar_concepts (derived from units.grammar_concept_slug)
 *   - units
 *   - vocab
 *   - exercises
 *   - scenarios
 *   - badges (15 hardcoded v0 badges)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";

const args = process.argv.slice(2);
const REMOTE = args.includes("--remote");
const EMIT_ONLY = args.includes("--emit-only");
const SEED_DIR = resolve("seed");
const OUT_DIR = resolve("drizzle/seed");
const OUT_SQL = join(OUT_DIR, "seed-data.sql");

function sqlString(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return sqlString(JSON.stringify(v));
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

// SQLite reserved words we use as column names — must be backtick-quoted in INSERTs.
const RESERVED = new Set(["order", "group", "key"]);
function quoteCol(c: string): string {
  return RESERVED.has(c) ? `\`${c}\`` : c;
}

function insertRow(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row);
  const vals = cols.map((c) => sqlString(row[c]));
  return `INSERT OR IGNORE INTO ${table} (${cols.map(quoteCol).join(", ")}) VALUES (${vals.join(", ")});`;
}

async function readSeedJson<T>(file: string): Promise<T[]> {
  const path = join(SEED_DIR, file);
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T[];
  } catch {
    console.warn(`  ⚠ no seed file at ${path}`);
    return [];
  }
}

type UnitSeed = {
  slug: string;
  title_nl: string;
  title_en: string;
  description: string | null;
  cefr_level: string;
  order: number;
  grammar_concept_slug: string | null;
};

type VocabSeed = {
  nl: string;
  en: string;
  example_sentence_nl: string | null;
  example_sentence_en: string | null;
  source_image_path: string | null;
  cefr_level: string;
};

type ExerciseSeed = {
  slug: string;
  unit_slug: string;
  type: string;
  prompt_nl: string | null;
  prompt_en: string | null;
  options: unknown;
  answer: unknown;
  hints: string[] | null;
  source_ref: string | null;
};

type ScenarioSeed = {
  slug: string;
  unit_slug: string | null;
  title_nl: string;
  title_en: string;
  difficulty: string;
  npc_name: string;
  npc_persona: string;
  npc_voice_id: string | null;
  opening_nl: string;
  must_use_vocab: string[];
  must_use_grammar: string[];
  success_criteria: string[];
  failure_modes: string[];
  estimated_minutes: number;
  xp_reward: number;
  badge_unlock: string | null;
};

const BADGES_V0 = [
  { slug: "first-lesson", title_nl: "Eerste les", title_en: "First lesson", description: "Complete your first lesson", icon_emoji: "🎉", rule: { kind: "lessons_completed", threshold: 1 } },
  { slug: "streak-3", title_nl: "Drie dagen op rij", title_en: "3-day streak", description: "Keep a 3-day streak", icon_emoji: "🔥", rule: { kind: "streak_days", threshold: 3 } },
  { slug: "streak-7", title_nl: "Een week!", title_en: "7-day streak", description: "Keep a 7-day streak", icon_emoji: "🔥", rule: { kind: "streak_days", threshold: 7 } },
  { slug: "streak-30", title_nl: "Een maand!", title_en: "30-day streak", description: "Keep a 30-day streak", icon_emoji: "🔥", rule: { kind: "streak_days", threshold: 30 } },
  { slug: "xp-100", title_nl: "Honderd XP", title_en: "100 XP", description: "Earn 100 XP total", icon_emoji: "⭐", rule: { kind: "xp_total", threshold: 100 } },
  { slug: "xp-1000", title_nl: "Duizend XP", title_en: "1000 XP", description: "Earn 1000 XP total", icon_emoji: "🌟", rule: { kind: "xp_total", threshold: 1000 } },
  { slug: "xp-10000", title_nl: "Tienduizend XP", title_en: "10K XP", description: "Earn 10000 XP total", icon_emoji: "💫", rule: { kind: "xp_total", threshold: 10000 } },
  { slug: "boss-fight-1", title_nl: "Eerste roleplay", title_en: "First roleplay", description: "Pass your first boss fight roleplay", icon_emoji: "💬", rule: { kind: "roleplays_passed", threshold: 1 } },
  { slug: "boss-fight-5", title_nl: "Vijf roleplays", title_en: "5 roleplays", description: "Pass 5 boss fight roleplays", icon_emoji: "🗣️", rule: { kind: "roleplays_passed", threshold: 5 } },
  { slug: "perfect-lesson", title_nl: "Perfect!", title_en: "Perfect lesson", description: "Finish a lesson with no mistakes", icon_emoji: "💯", rule: { kind: "perfect_lesson", threshold: 1 } },
  { slug: "vocab-100", title_nl: "Honderd woorden", title_en: "100 words", description: "Learn 100 vocab items", icon_emoji: "📚", rule: { kind: "vocab_learned", threshold: 100 } },
  { slug: "unit-complete-1", title_nl: "Eerste unit", title_en: "First unit done", description: "Complete a full unit", icon_emoji: "🏆", rule: { kind: "units_completed", threshold: 1 } },
  { slug: "unit-complete-all", title_nl: "Alle units", title_en: "All units complete", description: "Complete the whole A2 path", icon_emoji: "👑", rule: { kind: "units_completed", threshold: 8 } },
  { slug: "early-bird", title_nl: "Vroege vogel", title_en: "Early bird", description: "Practise before 9am", icon_emoji: "🐦", rule: { kind: "practice_before", threshold: 9 } },
  { slug: "night-owl", title_nl: "Nachtuil", title_en: "Night owl", description: "Practise after 10pm", icon_emoji: "🦉", rule: { kind: "practice_after", threshold: 22 } },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const units = await readSeedJson<UnitSeed>("units.json");
  const vocab = await readSeedJson<VocabSeed>("vocab.json");
  const exercises = await readSeedJson<ExerciseSeed>("exercises.json");
  const scenarios = await readSeedJson<ScenarioSeed>("scenarios.json");

  console.log(`Loaded seeds: ${units.length} units, ${vocab.length} vocab, ${exercises.length} exercises, ${scenarios.length} scenarios`);

  const lines: string[] = [];
  lines.push("-- Lekkertaal seed data (idempotent via INSERT OR IGNORE)");
  lines.push("-- Generated by scripts/seed-load.ts");
  lines.push("");

  // Course
  lines.push(insertRow("courses", {
    slug: "a2-yellowtail",
    title: "Dutch A2 (Yellowtail edition)",
    description: "A2-level Dutch following the Yellowtail Dutch Group curriculum",
    cefr_level: "A2",
    language: "nl",
    is_published: true,
  }));
  lines.push("");

  // Grammar concepts (derived from units)
  const grammarSlugs = new Set<string>();
  for (const u of units) {
    if (u.grammar_concept_slug) grammarSlugs.add(u.grammar_concept_slug);
  }
  for (const slug of grammarSlugs) {
    lines.push(insertRow("grammar_concepts", {
      slug,
      title_nl: slug.replace(/-/g, " "),
      title_en: slug.replace(/-/g, " "),
      explanation_md: null,
      cefr_level: "A2",
    }));
  }
  lines.push("");

  // Units
  for (const u of units) {
    lines.push(insertRow("units", {
      course_id: 1,
      slug: u.slug,
      title_nl: u.title_nl,
      title_en: u.title_en,
      description: u.description,
      cefr_level: u.cefr_level,
      order: u.order,
      grammar_concept_slug: u.grammar_concept_slug,
    }));
  }
  lines.push("");

  // Lessons (one per unit for v0 — drills group under it)
  for (const u of units) {
    lines.push(insertRow("lessons", {
      unit_id: u.order, // assumes units load 1..N in order
      slug: `${u.slug}--lesson-1`,
      title_nl: `${u.title_nl} — oefening`,
      title_en: `${u.title_en} — practice`,
      order: 1,
      xp_reward: 15,
    }));
  }
  lines.push("");

  // Vocab
  for (const v of vocab) {
    lines.push(insertRow("vocab", {
      nl: v.nl,
      en: v.en,
      example_sentence_nl: v.example_sentence_nl,
      example_sentence_en: v.example_sentence_en,
      source_image_path: v.source_image_path,
      cefr_level: v.cefr_level || "A2",
    }));
  }
  lines.push("");

  // Exercises
  const unitSlugToOrder = new Map(units.map((u) => [u.slug, u.order]));
  for (const e of exercises) {
    const unitOrder = unitSlugToOrder.get(e.unit_slug);
    lines.push(insertRow("exercises", {
      lesson_id: unitOrder ?? null,
      unit_slug: e.unit_slug,
      slug: e.slug,
      type: e.type,
      prompt_nl: e.prompt_nl,
      prompt_en: e.prompt_en,
      options: e.options ?? null,
      answer: e.answer ?? null,
      hints: e.hints ?? null,
      source_ref: e.source_ref,
      audio_url: null,
    }));
  }
  lines.push("");

  // Scenarios
  for (const s of scenarios) {
    const unitOrder = s.unit_slug ? unitSlugToOrder.get(s.unit_slug) : null;
    lines.push(insertRow("scenarios", {
      unit_id: unitOrder ?? null,
      unit_slug: s.unit_slug,
      slug: s.slug,
      title_nl: s.title_nl,
      title_en: s.title_en,
      difficulty: s.difficulty,
      npc_name: s.npc_name,
      npc_persona: s.npc_persona,
      npc_voice_id: s.npc_voice_id,
      opening_nl: s.opening_nl,
      must_use_vocab: s.must_use_vocab,
      must_use_grammar: s.must_use_grammar,
      success_criteria: s.success_criteria,
      failure_modes: s.failure_modes,
      estimated_minutes: s.estimated_minutes,
      xp_reward: s.xp_reward,
      badge_unlock: s.badge_unlock,
    }));
  }
  lines.push("");

  // Badges
  for (const b of BADGES_V0) {
    lines.push(insertRow("badges", {
      slug: b.slug,
      title_nl: b.title_nl,
      title_en: b.title_en,
      description: b.description,
      icon_emoji: b.icon_emoji,
      icon_asset: null,
      rule: b.rule,
    }));
  }
  lines.push("");

  await writeFile(OUT_SQL, lines.join("\n"), "utf8");
  console.log(`✓ Wrote ${OUT_SQL} (${lines.length} lines)`);

  if (EMIT_ONLY) {
    console.log("emit-only: skipping wrangler execute");
    return;
  }

  const flag = REMOTE ? "--remote" : "--local";
  const cmd = `npx wrangler d1 execute lekkertaal_db ${flag} --file=${OUT_SQL}`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

main().catch((err) => {
  console.error("seed-load failed:", err);
  process.exit(1);
});
