#!/usr/bin/env tsx
/**
 * Image-input drill seed generator (AI-SDK-7).
 *
 * Builds 40 vocab→image pairs as `image_word` drill rows, mapping a small
 * set of concrete A2 nouns to R2-hosted images.
 *
 * The image *files* themselves are generated via `/ro:generate-image`
 * (Nano Banana 2). This script does NOT call the image model — it emits
 * the seed rows + a Markdown checklist (`seed/image-drills.todo.md`) the
 * operator works through:
 *
 *   1. Run `/ro:generate-image "<prompt>" out=<noun>.png` for each row.
 *   2. Upload to R2:
 *        wrangler r2 object put lekkertaal-images/vocab/<noun>.png \
 *          --file=<noun>.png --remote
 *   3. Confirm the bucket has `public_access` enabled, or front it with
 *      a Worker route.
 *
 * Output:
 *   seed/image-drills.json       — appendable to seed/exercises.json
 *   seed/image-drills.todo.md    — operator checklist with the prompts
 *
 * Usage:
 *   pnpm tsx scripts/seed-image-drills.ts
 *   pnpm tsx scripts/seed-image-drills.ts --r2-base=https://images.lekkertaal.dev
 */
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const args = process.argv.slice(2);
const r2BaseArg = args.find((a) => a.startsWith("--r2-base="));
const R2_BASE = (r2BaseArg ? r2BaseArg.split("=")[1] : "https://images.lekkertaal.dev").replace(
  /\/+$/,
  "",
);

const SEED_DIR = resolve("seed");

/**
 * 40 concrete A2 nouns, weighted toward picturable everyday items. Articles
 * are stored on the row so the grader accepts both bare and articled forms.
 * The `prompt` text is what gets piped into `/ro:generate-image`.
 */
type ImageDrillSeed = {
  noun: string;
  article: "de" | "het";
  en: string;
  prompt: string;
};

const NOUNS: ImageDrillSeed[] = [
  { noun: "kat", article: "de", en: "cat", prompt: "Photo of a tabby cat sitting on a wooden floor, neutral background." },
  { noun: "hond", article: "de", en: "dog", prompt: "Photo of a brown dog sitting in a park, side view." },
  { noun: "boek", article: "het", en: "book", prompt: "Photo of an open hardback book on a plain table, top-down." },
  { noun: "stoel", article: "de", en: "chair", prompt: "Photo of a single wooden dining chair against a white wall." },
  { noun: "tafel", article: "de", en: "table", prompt: "Photo of a plain wooden kitchen table, empty, three-quarter view." },
  { noun: "huis", article: "het", en: "house", prompt: "Photo of a small Dutch terraced house with a red door." },
  { noun: "auto", article: "de", en: "car", prompt: "Photo of a small parked city car on a quiet street." },
  { noun: "fiets", article: "de", en: "bicycle", prompt: "Photo of a black Dutch city bicycle leaning against a wall." },
  { noun: "appel", article: "de", en: "apple", prompt: "Photo of a single red apple on a white plate." },
  { noun: "banaan", article: "de", en: "banana", prompt: "Photo of a yellow banana on a wooden cutting board." },
  { noun: "brood", article: "het", en: "bread", prompt: "Photo of a loaf of crusty brown bread on a board." },
  { noun: "kaas", article: "de", en: "cheese", prompt: "Photo of a wedge of yellow Gouda cheese." },
  { noun: "water", article: "het", en: "water", prompt: "Photo of a clear glass of water on a table." },
  { noun: "koffie", article: "de", en: "coffee", prompt: "Photo of a white cup of black coffee, top-down." },
  { noun: "melk", article: "de", en: "milk", prompt: "Photo of a glass jug of milk on a kitchen counter." },
  { noun: "ei", article: "het", en: "egg", prompt: "Photo of a single white egg in an egg cup." },
  { noun: "tomaat", article: "de", en: "tomato", prompt: "Photo of a single ripe red tomato on a wooden surface." },
  { noun: "wortel", article: "de", en: "carrot", prompt: "Photo of an orange carrot with green tops on a board." },
  { noun: "deur", article: "de", en: "door", prompt: "Photo of a wooden front door with a brass handle." },
  { noun: "raam", article: "het", en: "window", prompt: "Photo of a single residential window with white frames." },
  { noun: "trap", article: "de", en: "staircase", prompt: "Photo of a narrow wooden staircase indoors." },
  { noun: "klok", article: "de", en: "clock", prompt: "Photo of a round wall clock with black hands." },
  { noun: "sleutel", article: "de", en: "key", prompt: "Photo of a single metal house key on a plain surface." },
  { noun: "tas", article: "de", en: "bag", prompt: "Photo of a brown leather shoulder bag on a chair." },
  { noun: "schoen", article: "de", en: "shoe", prompt: "Photo of a single brown leather shoe, side view." },
  { noun: "jas", article: "de", en: "coat", prompt: "Photo of a dark wool coat on a coat hanger." },
  { noun: "hoed", article: "de", en: "hat", prompt: "Photo of a brown felt hat on a wooden surface." },
  { noun: "trui", article: "de", en: "sweater", prompt: "Photo of a knitted grey sweater folded on a table." },
  { noun: "broek", article: "de", en: "trousers", prompt: "Photo of a pair of folded blue jeans on a chair." },
  { noun: "sok", article: "de", en: "sock", prompt: "Photo of a single woolly sock." },
  { noun: "bed", article: "het", en: "bed", prompt: "Photo of a made single bed with white linen." },
  { noun: "kussen", article: "het", en: "pillow", prompt: "Photo of a single white pillow on a plain background." },
  { noun: "lamp", article: "de", en: "lamp", prompt: "Photo of a desk lamp switched on, neutral background." },
  { noun: "boom", article: "de", en: "tree", prompt: "Photo of a single tall green tree in a park." },
  { noun: "bloem", article: "de", en: "flower", prompt: "Photo of a single yellow tulip in a vase." },
  { noun: "regen", article: "de", en: "rain", prompt: "Photo of rain falling on a window pane." },
  { noun: "zon", article: "de", en: "sun", prompt: "Photo of bright sunlight over a flat Dutch landscape." },
  { noun: "wolk", article: "de", en: "cloud", prompt: "Photo of a single white cloud against a blue sky." },
  { noun: "trein", article: "de", en: "train", prompt: "Photo of a yellow Dutch NS train at a station platform." },
  { noun: "bus", article: "de", en: "bus", prompt: "Photo of a city bus on a quiet street." },
];

if (NOUNS.length !== 40) {
  throw new Error(`Expected exactly 40 image-drill seeds; got ${NOUNS.length}.`);
}

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
  image_url: string | null;
};

function exerciseFor(seed: ImageDrillSeed): ExerciseSeed {
  // Slug stays stable across regenerations so re-runs are idempotent under
  // INSERT OR IGNORE. Unit assignment uses the A2 "objecten" slot;
  // re-routing is a one-line change in seed-load.
  return {
    slug: `image-word-${seed.noun}`,
    unit_slug: "a2-unit-1-werkwoorden-hebben-zijn",
    type: "image_word",
    prompt_nl: null,
    prompt_en: "Type the Dutch word for what you see",
    options: null,
    // Accept bare noun, articled noun, and capitalised forms.
    answer: [seed.noun, `${seed.article} ${seed.noun}`],
    hints: [`Article: ${seed.article}`],
    source_ref: `image-drills/${seed.noun}`,
    image_url: `${R2_BASE}/vocab/${seed.noun}.png`,
  };
}

async function main() {
  if (!existsSync(SEED_DIR)) await mkdir(SEED_DIR, { recursive: true });

  const exercises = NOUNS.map(exerciseFor);
  const jsonPath = join(SEED_DIR, "image-drills.json");
  await writeFile(jsonPath, JSON.stringify(exercises, null, 2) + "\n", "utf8");

  const todoLines = [
    "# Image drills — generation checklist",
    "",
    "Generate each of the 40 images via `/ro:generate-image`, upload to R2,",
    "then merge `seed/image-drills.json` into `seed/exercises.json` (or extend",
    "`scripts/seed-load.ts` to read the file directly).",
    "",
    `Public base URL: \`${R2_BASE}\``,
    "",
    "| # | Noun | Article | EN | Image prompt |",
    "| - | ---- | ------- | -- | ------------ |",
    ...NOUNS.map(
      (n, i) =>
        `| ${i + 1} | \`${n.noun}\` | ${n.article} | ${n.en} | ${n.prompt} |`,
    ),
    "",
    "R2 upload (per noun):",
    "",
    "```bash",
    "wrangler r2 object put lekkertaal-images/vocab/<noun>.png \\",
    "  --file=<noun>.png --remote",
    "```",
    "",
  ];
  const todoPath = join(SEED_DIR, "image-drills.todo.md");
  await writeFile(todoPath, todoLines.join("\n"), "utf8");

  console.log(`Wrote ${exercises.length} image-drill seed rows to ${jsonPath}`);
  console.log(`Wrote operator checklist to ${todoPath}`);
}

void main();
