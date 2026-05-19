#!/usr/bin/env tsx
/**
 * Vocab enrichment script (issue #140).
 *
 * Reads `seed/vocab.json`, calls Wiktionary + Wikimedia Commons + Tatoeba per
 * word, writes enriched fields back, and (optionally) applies the changes to
 * the local D1 database.
 *
 * Usage:
 *   pnpm seed:enrich-vocab                  # enrich all unenriched words
 *   pnpm seed:enrich-vocab --word brood     # single-word debug
 *   pnpm seed:enrich-vocab --force          # re-enrich already-enriched words
 *   pnpm seed:enrich-vocab --apply          # also UPDATE local D1
 *   pnpm seed:enrich-vocab --apply --remote # also UPDATE remote D1 (use with care)
 *
 * Rate limit: 1 req/sec per source (3 sources = ~3 s/word, ~5 min for 100 words).
 *
 * Responses are cached under `.enrich-cache/<word>.json` so re-runs are fast
 * and Wiktionary is not hammered while iterating on the parser.
 *
 * Licensing note:
 *   Wiktionary CC-BY-SA, Wikimedia Commons CC-BY-SA, Tatoeba CC-BY.
 *   In-app attribution popover + ATTRIBUTION.md discharge the requirement.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { enrichWord } from "../src/lib/server/enrich-vocab";
import type { EnrichResult } from "../src/lib/server/enrich-vocab";

// ============================================================================
// CLI flags
// ============================================================================

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const APPLY = args.includes("--apply");
const REMOTE = args.includes("--remote");
const WORD_FLAG_IDX = args.indexOf("--word");
const SINGLE_WORD_RAW = WORD_FLAG_IDX >= 0 ? args[WORD_FLAG_IDX + 1] : undefined;
const SINGLE_WORD = SINGLE_WORD_RAW ? SINGLE_WORD_RAW.toLowerCase() : null;

const RATE_LIMIT_MS = 1000; // 1 req/sec per API
const REPO_ROOT = resolve(__dirname, "..");
const VOCAB_PATH = join(REPO_ROOT, "seed", "vocab.json");
const CACHE_DIR = join(REPO_ROOT, ".enrich-cache");

// ============================================================================
// Vocab JSON shape
// ============================================================================

type VocabEntry = {
  nl: string;
  en: string;
  example_sentence_nl?: string | null;
  example_sentence_en?: string | null;
  source_image_path?: string | null;
  cefr_level?: string;
  // Enriched fields (all optional in JSON)
  ipa?: string | null;
  gender?: string | null;
  audio_url?: string | null;
  word_type?: string | null;
  enriched_at?: number | null;
  sources?: Partial<Record<string, string>> | null;
};

// ============================================================================
// Cache helpers
// ============================================================================

async function readCache(word: string): Promise<EnrichResult | null> {
  const file = join(CACHE_DIR, `${word}.json`);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as EnrichResult;
  } catch {
    return null;
  }
}

async function writeCache(word: string, result: EnrichResult): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${word}.json`);
  await writeFile(file, JSON.stringify(result, null, 2), "utf8");
}

// ============================================================================
// D1 apply helpers
// ============================================================================

async function applyToD1(
  entry: VocabEntry,
  result: EnrichResult,
  remote: boolean,
): Promise<void> {
  // Build the SQL UPDATE via wrangler d1 execute.
  const { execSync } = await import("node:child_process");
  const target = remote ? "--remote" : "--local";
  const sql = buildUpdateSql(entry, result);
  if (!sql) return;
  const cmd = `wrangler d1 execute lekkertaal_db ${target} --command ${JSON.stringify(sql)}`;
  try {
    execSync(cmd, { stdio: "pipe" });
  } catch (err) {
    console.error(`  ✗ D1 apply failed for "${entry.nl}":`, err);
  }
}

function buildUpdateSql(entry: VocabEntry, result: EnrichResult): string | null {
  const sets: string[] = [];
  if (result.ipa !== undefined) sets.push(`ipa = ${sqlStr(result.ipa)}`);
  if (result.gender !== undefined) sets.push(`gender = ${sqlStr(result.gender)}`);
  if (result.audioUrl !== undefined) sets.push(`audio_url = ${sqlStr(result.audioUrl)}`);
  if (result.wordType !== undefined) sets.push(`word_type = ${sqlStr(result.wordType)}`);
  if (result.exampleSentenceNl !== undefined)
    sets.push(`example_sentence_nl = ${sqlStr(result.exampleSentenceNl)}`);
  if (result.exampleSentenceEn !== undefined)
    sets.push(`example_sentence_en = ${sqlStr(result.exampleSentenceEn)}`);
  sets.push(`enriched_at = ${Date.now()}`);
  sets.push(`sources = ${sqlStr(JSON.stringify(result.sources))}`);

  if (sets.length === 0) return null;

  // Escape single quotes in nl/en for the WHERE clause.
  const nlSafe = entry.nl.replace(/'/g, "''");
  const enSafe = entry.en.replace(/'/g, "''");
  return `UPDATE vocab SET ${sets.join(", ")} WHERE nl = '${nlSafe}' AND en = '${enSafe}';`;
}

function sqlStr(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const raw = await readFile(VOCAB_PATH, "utf8");
  let entries = JSON.parse(raw) as VocabEntry[];

  if (SINGLE_WORD) {
    entries = entries.filter((e) => e.nl.toLowerCase() === SINGLE_WORD);
    if (entries.length === 0) {
      console.error(`No vocab entry found for word: ${SINGLE_WORD}`);
      process.exit(1);
    }
  }

  let enriched = 0;
  let partial = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    if (!FORCE && entry.enriched_at) {
      skipped++;
      continue;
    }

    const word = entry.nl.toLowerCase();

    // Check cache first (avoids hitting APIs on re-run).
    let result = FORCE ? null : await readCache(word);
    if (!result) {
      result = await enrichWord(
        word,
        entry.example_sentence_nl,
        fetch,
        RATE_LIMIT_MS,
      );
      await writeCache(word, result);
    }

    const fieldCount = Object.keys(result.sources).length;
    if (fieldCount === 0) {
      failed++;
      console.log(`  ✗ no data — ${entry.nl}`);
    } else if (
      result.ipa &&
      result.audioUrl &&
      (result.exampleSentenceNl || entry.example_sentence_nl)
    ) {
      enriched++;
      console.log(`  ✓ enriched (${fieldCount} fields) — ${entry.nl}`);
    } else {
      partial++;
      const fields = Object.keys(result.sources).join(", ");
      console.log(`  ⚠ partial (${fields}) — ${entry.nl}`);
    }

    // Write enriched fields back into the entry.
    if (result.ipa != null) entry.ipa = result.ipa;
    if (result.gender != null) entry.gender = result.gender;
    if (result.audioUrl != null) entry.audio_url = result.audioUrl;
    if (result.wordType != null) entry.word_type = result.wordType;
    if (result.exampleSentenceNl != null && !entry.example_sentence_nl) {
      entry.example_sentence_nl = result.exampleSentenceNl;
    }
    if (result.exampleSentenceEn != null && !entry.example_sentence_en) {
      entry.example_sentence_en = result.exampleSentenceEn;
    }
    entry.enriched_at = Date.now();
    entry.sources = result.sources;

    if (APPLY) {
      await applyToD1(entry, result, REMOTE);
    }
  }

  // Write enriched vocab.json back.
  await writeFile(VOCAB_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");

  console.log(
    `\nDone. enriched=${enriched} partial=${partial} failed=${failed} skipped=${skipped}`,
  );
  if (APPLY) {
    console.log(`D1 updates applied (${REMOTE ? "remote" : "local"}).`);
  } else {
    console.log("seed/vocab.json updated. Run with --apply to push to D1.");
  }
}

main().catch((err) => {
  console.error("enrich-vocab failed:", err);
  process.exit(1);
});
