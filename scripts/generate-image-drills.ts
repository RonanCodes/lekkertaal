#!/usr/bin/env tsx
/**
 * Image-input drill *file* generator (companion to seed-image-drills.ts).
 *
 * seed-image-drills.ts emits the 40 `image-word` seed rows + a Markdown
 * checklist of prompts. This script does the other half the operator used to
 * do by hand: it calls Gemini (`nano-banana-pro-preview`, a.k.a. Nano Banana 2)
 * for each noun's prompt and writes the bytes to disk, then (optionally) uploads
 * them to the `lekkertaal-images` R2 bucket under `vocab/<noun>.png`, matching
 * the `image_url` values seeded into the `image-word` drill rows.
 *
 * The model returns JPEG bytes; PR #163 stored those raw under the `.png` key
 * (served with `Content-Type: image/jpeg`), so this script does the same to stay
 * byte-for-byte consistent with the first 8 uploads.
 *
 * Env:
 *   GEMINI_API_KEY            required for generation
 *
 * Usage:
 *   # generate every noun not already in R2, into /tmp/vocab-imgs
 *   pnpm tsx scripts/generate-image-drills.ts
 *   # generate a subset
 *   pnpm tsx scripts/generate-image-drills.ts --only=appel,banaan
 *   # generate ALL 40 (even ones already uploaded)
 *   pnpm tsx scripts/generate-image-drills.ts --all
 *   # custom output dir
 *   pnpm tsx scripts/generate-image-drills.ts --out=/tmp/vocab-imgs
 *
 * Upload is done separately with wrangler (see seed/image-drills.todo.md):
 *   wrangler r2 object put lekkertaal-images/vocab/<noun>.png \
 *     --file=<noun>.png --content-type=image/jpeg --remote
 */
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

type Noun = { noun: string; prompt: string };

// Mirror of the NOUNS table in seed-image-drills.ts (prompt text only).
const NOUNS: Noun[] = [
  { noun: "kat", prompt: "Photo of a tabby cat sitting on a wooden floor, neutral background." },
  { noun: "hond", prompt: "Photo of a brown dog sitting in a park, side view." },
  { noun: "boek", prompt: "Photo of an open hardback book on a plain table, top-down." },
  { noun: "stoel", prompt: "Photo of a single wooden dining chair against a white wall." },
  { noun: "tafel", prompt: "Photo of a plain wooden kitchen table, empty, three-quarter view." },
  { noun: "huis", prompt: "Photo of a small Dutch terraced house with a red door." },
  { noun: "auto", prompt: "Photo of a small parked city car on a quiet street." },
  { noun: "fiets", prompt: "Photo of a black Dutch city bicycle leaning against a wall." },
  { noun: "appel", prompt: "Photo of a single red apple on a white plate." },
  { noun: "banaan", prompt: "Photo of a yellow banana on a wooden cutting board." },
  { noun: "brood", prompt: "Photo of a loaf of crusty brown bread on a board." },
  { noun: "kaas", prompt: "Photo of a wedge of yellow Gouda cheese." },
  { noun: "water", prompt: "Photo of a clear glass of water on a table." },
  { noun: "koffie", prompt: "Photo of a white cup of black coffee, top-down." },
  { noun: "melk", prompt: "Photo of a glass jug of milk on a kitchen counter." },
  { noun: "ei", prompt: "Photo of a single white egg in an egg cup." },
  { noun: "tomaat", prompt: "Photo of a single ripe red tomato on a wooden surface." },
  { noun: "wortel", prompt: "Photo of an orange carrot with green tops on a board." },
  { noun: "deur", prompt: "Photo of a wooden front door with a brass handle." },
  { noun: "raam", prompt: "Photo of a single residential window with white frames." },
  { noun: "trap", prompt: "Photo of a narrow wooden staircase indoors." },
  { noun: "klok", prompt: "Photo of a round wall clock with black hands." },
  { noun: "sleutel", prompt: "Photo of a single metal house key on a plain surface." },
  { noun: "tas", prompt: "Photo of a brown leather shoulder bag on a chair." },
  { noun: "schoen", prompt: "Photo of a single brown leather shoe, side view." },
  { noun: "jas", prompt: "Photo of a dark wool coat on a coat hanger." },
  { noun: "hoed", prompt: "Photo of a brown felt hat on a wooden surface." },
  { noun: "trui", prompt: "Photo of a knitted grey sweater folded on a table." },
  { noun: "broek", prompt: "Photo of a pair of folded blue jeans on a chair." },
  { noun: "sok", prompt: "Photo of a single woolly sock." },
  { noun: "bed", prompt: "Photo of a made single bed with white linen." },
  { noun: "kussen", prompt: "Photo of a single white pillow on a plain background." },
  { noun: "lamp", prompt: "Photo of a desk lamp switched on, neutral background." },
  { noun: "boom", prompt: "Photo of a single tall green tree in a park." },
  { noun: "bloem", prompt: "Photo of a single yellow tulip in a vase." },
  { noun: "regen", prompt: "Photo of rain falling on a window pane." },
  { noun: "zon", prompt: "Photo of bright sunlight over a flat Dutch landscape." },
  { noun: "wolk", prompt: "Photo of a single white cloud against a blue sky." },
  { noun: "trein", prompt: "Photo of a yellow Dutch NS train at a station platform." },
  { noun: "bus", prompt: "Photo of a city bus on a quiet street." },
];

// The 8 already uploaded by PR #163.
const ALREADY_UPLOADED = new Set(["kat", "hond", "boek", "stoel", "tafel", "huis", "auto", "fiets"]);

const MODEL = "nano-banana-pro-preview";

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const outArg = args.find((a) => a.startsWith("--out="));
const ALL = args.includes("--all");
const OUT_DIR = outArg ? outArg.split("=")[1] : "/tmp/vocab-imgs";

function pickNouns(): Noun[] {
  if (onlyArg) {
    const want = new Set(onlyArg.split("=")[1].split(",").map((s) => s.trim()));
    return NOUNS.filter((n) => want.has(n.noun));
  }
  if (ALL) return NOUNS;
  return NOUNS.filter((n) => !ALREADY_UPLOADED.has(n.noun));
}

async function generate(prompt: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData)?.inlineData;
  if (!inline) throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 500)}`);
  return Buffer.from(inline.data, "base64");
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set (source ~/.claude/.env.personal).");

  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const todo = pickNouns();
  console.log(`Generating ${todo.length} image(s) into ${OUT_DIR}`);

  for (const n of todo) {
    process.stdout.write(`  ${n.noun} … `);
    try {
      const bytes = await generate(n.prompt, apiKey);
      await writeFile(`${OUT_DIR}/${n.noun}.png`, bytes);
      console.log(`ok (${bytes.length} bytes)`);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      throw err;
    }
  }
  console.log("Done. Upload with the wrangler loop in seed/image-drills.todo.md.");
}

void main();
