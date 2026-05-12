#!/usr/bin/env tsx
/**
 * Seed ingestion pipeline (US-001)
 *
 * Reads:
 *  - WhatsApp transcript: <source>/WhatsApp Chat - Yellowtail Dutch Group/_chat.txt
 *  - Notepad photos:      <source>/notepad photos/IMG_*.jpeg
 *  - Course PDFs:         <source>/WhatsApp Chat - .../**.pdf
 *
 * Emits:
 *  - seed/units.json
 *  - seed/vocab.json
 *  - seed/exercises.json
 *  - seed/scenarios.json
 *  - seed/ingest-errors.txt
 *  - seed/.cache/<sha>.json (per-photo OCR cache; idempotent re-run)
 *
 * Run:
 *  pnpm seed:ingest --source "/Users/ronan/Downloads-Keep/learn-dutch/12th may"
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const args = process.argv.slice(2);
const sourceFlagIdx = args.indexOf("--source");
const SOURCE_DIR =
  sourceFlagIdx >= 0 && args[sourceFlagIdx + 1]
    ? resolve(args[sourceFlagIdx + 1])
    : "/Users/ronan/Downloads-Keep/learn-dutch/12th may";

const DRY_RUN = args.includes("--dry-run");
const LIMIT_PHOTOS = (() => {
  const idx = args.indexOf("--limit");
  return idx >= 0 ? Number(args[idx + 1]) : Infinity;
})();

const SEED_DIR = resolve("seed");
const CACHE_DIR = join(SEED_DIR, ".cache");

// Provider preference: Anthropic > Google Gemini > OpenAI.
// Operator's Anthropic key is missing; OpenAI quota is exhausted; Google Gemini key works.
const HAS_ANTHROPIC = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10);
const HAS_OPENAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10);
const HAS_GOOGLE = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GOOGLE_GENERATIVE_AI_API_KEY.length > 10);
const VISION_PROVIDER: "anthropic" | "google" | "openai" = HAS_ANTHROPIC
  ? "anthropic"
  : HAS_GOOGLE
    ? "google"
    : "openai";
console.log(`[vision] provider=${VISION_PROVIDER} (anthropic=${HAS_ANTHROPIC} google=${HAS_GOOGLE} openai=${HAS_OPENAI})`);

const anthropic = HAS_ANTHROPIC ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const openai = HAS_OPENAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const google = HAS_GOOGLE ? new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!) : null;

const VISION_PROMPT = `You are extracting Dutch vocabulary and grammar notes from a Dutch-class notepad photo.
Return STRICT JSON only (no prose, no markdown fences) with this shape:

{
  "raw_text": "<full OCR of the page, preserving line breaks>",
  "vocab": [
    {
      "nl": "<Dutch word or short phrase>",
      "en": "<English translation>",
      "example_sentence_nl": "<example sentence in Dutch if present on the page, else null>",
      "example_sentence_en": "<English translation of the example if you can confidently translate, else null>",
      "cefr_level": "A2"
    }
  ]
}

Rules:
- If the page has no Dutch vocab (e.g. a doodle or unrelated), return {"raw_text": "...", "vocab": []}.
- Default cefr_level to "A2". Use "A1" only for very basic words (hello, water, yes, no). Use "B1" only for clearly advanced idioms.
- Skip duplicate entries on the same page.
- DO NOT make up translations. If unsure, omit the entry.
- Return ONLY the JSON object, nothing else.`;

type VocabItem = {
  nl: string;
  en: string;
  example_sentence_nl: string | null;
  example_sentence_en: string | null;
  source_image_path: string;
  cefr_level: "A1" | "A2" | "B1";
};

type Unit = {
  slug: string;
  title_nl: string;
  title_en: string;
  description: string;
  cefr_level: "A1" | "A2" | "B1";
  order: number;
  grammar_concept_slug: string | null;
};

type Exercise = {
  slug: string;
  unit_slug: string;
  type: "match-pairs" | "multiple-choice" | "translation-typing" | "fill-in-the-blank" | "word-ordering" | "listening-mc";
  prompt_nl: string | null;
  prompt_en: string | null;
  options: string[] | null;
  answer: string;
  hints: string[];
  source_ref: string;
};

type Scenario = {
  slug: string;
  unit_slug: string;
  title_nl: string;
  title_en: string;
  difficulty: "A1" | "A2" | "B1";
  npc_name: string;
  npc_persona: string;
  npc_voice_id: string;
  opening_nl: string;
  must_use_vocab: string[];
  must_use_grammar: string[];
  success_criteria: string[];
  failure_modes: string[];
  estimated_minutes: number;
  xp_reward: number;
  badge_unlock: string | null;
};

async function sha256File(path: string): Promise<string> {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

async function ensureDirs() {
  await mkdir(SEED_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
}

/**
 * Claude Vision OCR on a single image. Cached by SHA of file content.
 */
async function ocrPhoto(
  imagePath: string,
  errors: string[],
): Promise<{ raw_text: string; vocab: Array<Omit<VocabItem, "source_image_path">> } | null> {
  const sha = await sha256File(imagePath);
  const cachePath = join(CACHE_DIR, `${sha}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  if (DRY_RUN) {
    return { raw_text: "[dry-run]", vocab: [] };
  }
  try {
    const buf = readFileSync(imagePath);
    const b64 = buf.toString("base64");
    const ext = imagePath.toLowerCase().endsWith(".png") ? "png" : "jpeg";

    let rawText: string;
    if (VISION_PROVIDER === "google" && google) {
      const model = google.getGenerativeModel({ model: "gemini-2.5-flash" });
      const resp = await model.generateContent([
        { inlineData: { mimeType: `image/${ext}`, data: b64 } },
        VISION_PROMPT,
      ]);
      rawText = resp.response.text();
      if (!rawText) {
        errors.push(`${imagePath}\tno-text-block`);
        return null;
      }
    } else if (VISION_PROVIDER === "anthropic" && anthropic) {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: `image/${ext}`, data: b64 } },
              { type: "text", text: VISION_PROMPT },
            ],
          },
        ],
      });
      const textBlock = resp.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        errors.push(`${imagePath}\tno-text-block`);
        return null;
      }
      rawText = textBlock.text;
    } else if (openai) {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_PROMPT },
              { type: "image_url", image_url: { url: `data:image/${ext};base64,${b64}` } },
            ],
          },
        ],
      });
      rawText = resp.choices[0]?.message?.content ?? "";
      if (!rawText) {
        errors.push(`${imagePath}\tno-text-block`);
        return null;
      }
    } else {
      errors.push(`${imagePath}\tno-vision-provider`);
      return null;
    }

    let parsed: { raw_text: string; vocab: Array<Omit<VocabItem, "source_image_path">> };
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      errors.push(`${imagePath}\tjson-parse-fail\t${(err as Error).message.slice(0, 100)}`);
      return null;
    }
    await writeFile(cachePath, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (err) {
    errors.push(`${imagePath}\tapi-error\t${(err as Error).message.slice(0, 200)}`);
    return null;
  }
}

/**
 * Parse the WhatsApp chat transcript into homework messages (signal) and ignore noise.
 * The transcript is the canonical source for unit-level metadata (Michiel's huiswerk posts).
 */
function parseWhatsAppChat(chatText: string): {
  homework_posts: Array<{ date: string; sender: string; text: string }>;
  reading_passages: Array<{ date: string; sender: string; text: string }>;
} {
  const lines = chatText.split("\n");
  // WhatsApp export format: [DD/MM/YYYY, HH:MM:SS] Sender: message
  const lineRe = /^‎?\[(\d{2}\/\d{2}\/\d{4}), (\d{2}:\d{2}:\d{2})\] ([^:]+): (.*)$/;
  type Msg = { date: string; sender: string; text: string };
  const msgs: Msg[] = [];
  let current: Msg | null = null;
  for (const line of lines) {
    const m = line.match(lineRe);
    if (m) {
      if (current) msgs.push(current);
      current = { date: m[1], sender: m[3].replace(/^~ /, "").trim(), text: m[4] };
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  if (current) msgs.push(current);

  const homework_posts: Msg[] = [];
  const reading_passages: Msg[] = [];

  for (const m of msgs) {
    const txt = m.text.toLowerCase();
    if (m.sender.toLowerCase().includes("michiel") || m.sender === "Michiel Westbeek") {
      if (txt.includes("huiswerk")) homework_posts.push(m);
      // Reading passages: long Dutch text (>200 chars) from teacher
      if (m.text.length > 200 && !txt.includes("<attached:") && !txt.includes("http")) {
        reading_passages.push(m);
      }
    }
  }
  return { homework_posts, reading_passages };
}

/**
 * Build units from the homework cadence in the chat. Each weekly post = one unit roughly.
 * For v0 we hardcode 8 A2 units corresponding to the chat's Hoofdstuk progression.
 */
function buildUnits(): Unit[] {
  return [
    { slug: "a2-unit-1-werkwoorden-hebben-zijn", title_nl: "Werkwoorden: hebben & zijn", title_en: "Verbs: to have & to be", description: "Basis: vervoeging van hebben en zijn in OTT. Werkwoordfamilies I-II-III.", cefr_level: "A2", order: 1, grammar_concept_slug: "hebben-zijn-ott" },
    { slug: "a2-unit-2-werkwoordsspelling", title_nl: "Werkwoordsspelling", title_en: "Verb spelling rules", description: "Schrijfwijze van regelmatige werkwoorden in OTT. Stam + uitgang.", cefr_level: "A2", order: 2, grammar_concept_slug: "verb-spelling-ott" },
    { slug: "a2-unit-3-perfectum", title_nl: "Perfectum (voltooid tegenwoordige tijd)", title_en: "Present perfect", description: "Hebben/zijn + voltooid deelwoord. Regelmatige en onregelmatige werkwoorden.", cefr_level: "A2", order: 3, grammar_concept_slug: "perfectum" },
    { slug: "a2-unit-4-imperfectum", title_nl: "Imperfectum (onvoltooid verleden tijd)", title_en: "Simple past", description: "Imperfectum van regelmatige en onregelmatige werkwoorden.", cefr_level: "A2", order: 4, grammar_concept_slug: "imperfectum" },
    { slug: "a2-unit-5-vier-seizoenen", title_nl: "De vier seizoenen", title_en: "The four seasons", description: "Vocabulaire en leestekst over seizoenen. A2 leesvaardigheid.", cefr_level: "A2", order: 5, grammar_concept_slug: null },
    { slug: "a2-unit-6-iets-te-veel-van-het-goede", title_nl: "Iets te veel van het goede", title_en: "A bit too much of a good thing", description: "Hoofdstuk 4: gezondheid, eten, suikertaks discussie.", cefr_level: "A2", order: 6, grammar_concept_slug: "modal-verbs" },
    { slug: "a2-unit-7-woordvolgorde-v2", title_nl: "Woordvolgorde: V2 en bijzin", title_en: "Word order: V2 and subclause", description: "Hoofdzin V2 regel + bijzin met werkwoord achteraan.", cefr_level: "A2", order: 7, grammar_concept_slug: "word-order-v2" },
    { slug: "a2-unit-8-schrijven-oefenexamen", title_nl: "Schrijfvaardigheid oefenexamen", title_en: "Writing practice exam", description: "Oefenexamen schrijven A2: e-mails en korte teksten.", cefr_level: "A2", order: 8, grammar_concept_slug: null },
  ];
}

function buildScenarios(): Scenario[] {
  // 8 A2 scenarios per PRD US-016, one per unit boss-fight
  return [
    { slug: "cafe-ordering-coffee", unit_slug: "a2-unit-1-werkwoorden-hebben-zijn", title_nl: "Koffie bestellen", title_en: "Ordering coffee", difficulty: "A2", npc_name: "Anouk", npc_persona: "Vriendelijke barista in een drukke Amsterdamse koffiezaak.", npc_voice_id: "21m00Tcm4TlvDq8ikWAM", opening_nl: "Hoi! Welkom. Wat wil je drinken?", must_use_vocab: ["koffie", "thee", "alstublieft", "dank u wel"], must_use_grammar: ["hebben-zijn-ott"], success_criteria: ["Bestelt een drankje", "Vraagt de prijs", "Bedankt beleefd"], failure_modes: ["Geen begroeting", "Direct Engels"], estimated_minutes: 5, xp_reward: 100, badge_unlock: "first-boss-fight" },
    { slug: "weekend-recap-with-friend", unit_slug: "a2-unit-3-perfectum", title_nl: "Weekend met een vriend(in)", title_en: "Weekend recap with a friend", difficulty: "A2", npc_name: "Sander", npc_persona: "Goede vriend, enthousiast en geïnteresseerd in wat je gedaan hebt.", npc_voice_id: "ErXwobaYiN019PkySvjV", opening_nl: "Hé! Hoe was je weekend? Vertel eens, wat heb je gedaan?", must_use_vocab: ["weekend", "gisteren", "leuk"], must_use_grammar: ["perfectum"], success_criteria: ["Gebruikt minstens 3 perfectumvormen", "Beschrijft minstens 2 activiteiten", "Stelt zelf een wedervraag"], failure_modes: ["Alleen OTT gebruiken", "Geen wedervraag"], estimated_minutes: 7, xp_reward: 100, badge_unlock: null },
    { slug: "doctor-appointment", unit_slug: "a2-unit-6-iets-te-veel-van-het-goede", title_nl: "Bij de huisarts", title_en: "Doctor appointment", difficulty: "A2", npc_name: "Dr. de Vries", npc_persona: "Geduldige huisarts. Vraagt naar symptomen en geeft advies.", npc_voice_id: "VR6AewLTigWG4xSOukaG", opening_nl: "Goedemiddag. Komt u maar binnen. Wat zijn uw klachten?", must_use_vocab: ["hoofdpijn", "ziek", "pijn", "moe"], must_use_grammar: ["modal-verbs"], success_criteria: ["Beschrijft minstens 2 symptomen", "Gebruikt modale werkwoorden (kunnen/moeten)", "Beleefde u-vorm"], failure_modes: ["Je-vorm gebruiken", "Te kort antwoord"], estimated_minutes: 8, xp_reward: 100, badge_unlock: null },
    { slug: "supermarket-find-it", unit_slug: "a2-unit-2-werkwoordsspelling", title_nl: "In de supermarkt", title_en: "Supermarket: find an item", difficulty: "A2", npc_name: "Joris", npc_persona: "Vriendelijke vakkenvuller bij de Albert Heijn.", npc_voice_id: "pNInz6obpgDQGcFmaJgB", opening_nl: "Hallo, kan ik u helpen?", must_use_vocab: ["waar", "vinden", "schap", "afdeling"], must_use_grammar: ["verb-spelling-ott"], success_criteria: ["Vraagt waar een product is", "Bedankt", "Stelt een vervolgvraag"], failure_modes: ["Verkeerde werkwoordsvorm"], estimated_minutes: 5, xp_reward: 100, badge_unlock: null },
    { slug: "work-standup", unit_slug: "a2-unit-4-imperfectum", title_nl: "Werk standup", title_en: "Work standup", difficulty: "A2", npc_name: "Esther", npc_persona: "Scrum master die je daily standup leidt.", npc_voice_id: "EXAVITQu4vr4xnSDxMaL", opening_nl: "Goedemorgen! Wat heb je gisteren gedaan en wat ga je vandaag doen?", must_use_vocab: ["gisteren", "vandaag", "klaar", "bezig"], must_use_grammar: ["imperfectum", "perfectum"], success_criteria: ["Beschrijft gisteren in verleden tijd", "Beschrijft vandaag in OTT", "Noemt minstens 1 blocker"], failure_modes: ["Alle werkwoorden in OTT"], estimated_minutes: 5, xp_reward: 100, badge_unlock: null },
    { slug: "haircut", unit_slug: "a2-unit-5-vier-seizoenen", title_nl: "Bij de kapper", title_en: "At the hairdresser", difficulty: "A2", npc_name: "Lotte", npc_persona: "Praatgrage kapster die smalltalk over het weer en seizoenen begint.", npc_voice_id: "AZnzlk1XvdvUeBnXmlld", opening_nl: "Hé! Ga zitten. Wat wil je vandaag laten doen?", must_use_vocab: ["kort", "lang", "knippen", "weer"], must_use_grammar: [], success_criteria: ["Beschrijft gewenst kapsel", "Voert smalltalk over weer/seizoen", "Bedankt"], failure_modes: ["Geen smalltalk"], estimated_minutes: 7, xp_reward: 100, badge_unlock: null },
    { slug: "landlord-leak", unit_slug: "a2-unit-7-woordvolgorde-v2", title_nl: "Lekkage melden bij de verhuurder", title_en: "Report a leak to the landlord", difficulty: "A2", npc_name: "Meneer Bakker", npc_persona: "Wat brommerige huisbaas die snel ter zake wil komen.", npc_voice_id: "VR6AewLTigWG4xSOukaG", opening_nl: "Hallo, met Bakker. Wat is er aan de hand?", must_use_vocab: ["lekkage", "badkamer", "snel", "kapot"], must_use_grammar: ["word-order-v2"], success_criteria: ["Legt het probleem duidelijk uit", "Gebruikt bijzin met 'omdat' of 'dat'", "Vraagt om snelle reparatie"], failure_modes: ["V2-regel breken in hoofdzin"], estimated_minutes: 8, xp_reward: 100, badge_unlock: null },
    { slug: "asking-directions", unit_slug: "a2-unit-8-schrijven-oefenexamen", title_nl: "De weg vragen", title_en: "Asking directions", difficulty: "A2", npc_name: "Voorbijganger", npc_persona: "Vriendelijke voorbijganger in het centrum van Utrecht.", npc_voice_id: "pNInz6obpgDQGcFmaJgB", opening_nl: "Ja hoor, wat zoekt u?", must_use_vocab: ["links", "rechts", "rechtdoor", "straat"], must_use_grammar: [], success_criteria: ["Vraagt naar een specifieke plek", "Begrijpt en herhaalt routebeschrijving", "Bedankt beleefd"], failure_modes: ["Geen herhaling van de route"], estimated_minutes: 5, xp_reward: 100, badge_unlock: "a2-complete" },
  ];
}

/**
 * Build exercises from vocab + grammar. For each vocab item, generate 1 match-pairs candidate
 * and 1 translation-typing exercise. Word-ordering exercises come from reading passages.
 */
function buildExercises(vocab: VocabItem[], readingPassages: string[]): Exercise[] {
  const out: Exercise[] = [];
  let n = 0;
  // Group vocab into chunks of 4 for match-pairs drills
  const chunks: VocabItem[][] = [];
  // Cycle vocab through units roughly evenly
  const units = buildUnits();
  for (let i = 0; i < vocab.length; i += 4) {
    chunks.push(vocab.slice(i, i + 4));
  }
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    if (chunk.length < 2) continue;
    const unit = units[ci % units.length];
    out.push({
      slug: `match-${unit.slug}-${ci}`,
      unit_slug: unit.slug,
      type: "match-pairs",
      prompt_nl: null,
      prompt_en: "Match each Dutch word with its English meaning.",
      options: null,
      answer: JSON.stringify(chunk.map((v) => ({ nl: v.nl, en: v.en }))),
      hints: [],
      source_ref: chunk[0].source_image_path,
    });
    n++;
  }
  // Translation-typing: one per vocab item that has an example sentence
  for (const v of vocab) {
    if (!v.example_sentence_nl || !v.example_sentence_en) continue;
    const unit = units[n % units.length];
    out.push({
      slug: `translate-${n}`,
      unit_slug: unit.slug,
      type: "translation-typing",
      prompt_nl: null,
      prompt_en: v.example_sentence_en,
      options: null,
      answer: v.example_sentence_nl,
      hints: [v.nl],
      source_ref: v.source_image_path,
    });
    n++;
  }
  // Word-ordering: from reading passages, take sentences 4-12 words long
  for (let pi = 0; pi < readingPassages.length; pi++) {
    const passage = readingPassages[pi];
    const sentences = passage.split(/(?<=[.!?])\s+/).filter((s) => {
      const words = s.trim().split(/\s+/);
      return words.length >= 4 && words.length <= 12;
    });
    for (const s of sentences.slice(0, 3)) {
      const unit = units[(pi + 1) % units.length];
      out.push({
        slug: `wordorder-${n}`,
        unit_slug: unit.slug,
        type: "word-ordering",
        prompt_nl: null,
        prompt_en: "Arrange the tiles to form a correct Dutch sentence.",
        options: s.trim().split(/\s+/),
        answer: s.trim(),
        hints: [],
        source_ref: `whatsapp-passage-${pi}`,
      });
      n++;
    }
  }
  return out;
}

async function main() {
  await ensureDirs();
  const errors: string[] = [];

  // 1. Parse WhatsApp transcript
  const chatPath = join(SOURCE_DIR, "WhatsApp Chat - Yellowtail Dutch Group", "_chat.txt");
  if (!existsSync(chatPath)) {
    throw new Error(`Missing WhatsApp transcript at ${chatPath}`);
  }
  const chatText = await readFile(chatPath, "utf8");
  const { homework_posts, reading_passages } = parseWhatsAppChat(chatText);
  console.log(`[whatsapp] ${homework_posts.length} homework posts, ${reading_passages.length} reading passages`);

  // 2. OCR notepad photos
  const photosDir = join(SOURCE_DIR, "notepad photos");
  const photoFiles = (await readdir(photosDir))
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort();
  console.log(`[photos] ${photoFiles.length} files; processing up to ${Math.min(photoFiles.length, LIMIT_PHOTOS)}`);
  const vocab: VocabItem[] = [];
  const seenVocab = new Set<string>();
  let processed = 0;
  for (const f of photoFiles) {
    if (processed >= LIMIT_PHOTOS) break;
    const full = join(photosDir, f);
    const result = await ocrPhoto(full, errors);
    processed++;
    if (!result) {
      console.log(`  [skip] ${f}`);
      continue;
    }
    for (const v of result.vocab) {
      if (!v?.nl || !v?.en || typeof v.nl !== "string" || typeof v.en !== "string") continue;
      const key = `${v.nl.toLowerCase()}|${v.en.toLowerCase()}`;
      if (seenVocab.has(key)) continue;
      seenVocab.add(key);
      vocab.push({
        nl: v.nl,
        en: v.en,
        example_sentence_nl: v.example_sentence_nl ?? null,
        example_sentence_en: v.example_sentence_en ?? null,
        source_image_path: `notepad photos/${f}`,
        cefr_level: (v.cefr_level || "A2") as "A1" | "A2" | "B1",
      });
    }
    if (processed % 10 === 0) console.log(`  [progress] ${processed}/${photoFiles.length} photos, ${vocab.length} unique vocab items`);
  }

  // 3. Build units + scenarios (deterministic, from PRD knowledge)
  const units = buildUnits();
  const scenarios = buildScenarios();

  // 4. Build exercises
  const exercises = buildExercises(vocab, reading_passages.map((p) => p.text));

  // 5. Write outputs (sorted for determinism)
  vocab.sort((a, b) => a.nl.localeCompare(b.nl));
  exercises.sort((a, b) => a.slug.localeCompare(b.slug));

  await writeFile(join(SEED_DIR, "units.json"), JSON.stringify(units, null, 2) + "\n");
  await writeFile(join(SEED_DIR, "vocab.json"), JSON.stringify(vocab, null, 2) + "\n");
  await writeFile(join(SEED_DIR, "exercises.json"), JSON.stringify(exercises, null, 2) + "\n");
  await writeFile(join(SEED_DIR, "scenarios.json"), JSON.stringify(scenarios, null, 2) + "\n");
  await writeFile(join(SEED_DIR, "ingest-errors.txt"), errors.join("\n") + (errors.length ? "\n" : ""));

  console.log(`\n[done]
  units:      ${units.length}
  vocab:      ${vocab.length}
  exercises:  ${exercises.length}
  scenarios:  ${scenarios.length}
  errors:     ${errors.length} (see seed/ingest-errors.txt)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
