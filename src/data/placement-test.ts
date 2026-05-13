/**
 * 5-question placement test. Score determines starting CEFR level.
 *
 * Scoring:
 *   - Each correct answer worth 1 point.
 *   - score 0-1  -> A1 (start)
 *   - score 2    -> A1 (later)
 *   - score 3    -> A2 (start)
 *   - score 4    -> A2 (later)
 *   - score 5    -> B1
 *
 * v0 ships A2 content, so anything 3+ maps to A2-unit-1; under 3 also maps
 * there with a label "Recommended starting point" so we don't ship an A1
 * curriculum yet.
 */

export type PlacementQuestion = {
  id: string;
  level: "A1" | "A2-early" | "A2-late" | "B1-early" | "B1-late";
  promptEn: string;
  promptNl: string;
  options: { value: string; label: string }[];
  answer: string;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "q1-vocab-a1",
    level: "A1",
    promptEn: "Which word means 'house'?",
    promptNl: "Welk woord betekent 'house'?",
    options: [
      { value: "huis", label: "huis" },
      { value: "boek", label: "boek" },
      { value: "auto", label: "auto" },
      { value: "stoel", label: "stoel" },
    ],
    answer: "huis",
  },
  {
    id: "q2-perfectum-a2-early",
    level: "A2-early",
    promptEn: "Which form is correct: 'I have eaten an apple'?",
    promptNl: "Welke zin is correct?",
    options: [
      { value: "ik heb een appel gegeten", label: "Ik heb een appel gegeten." },
      { value: "ik heb gegeten een appel", label: "Ik heb gegeten een appel." },
      { value: "ik gegeten heb een appel", label: "Ik gegeten heb een appel." },
      { value: "ik heb gegeet een appel", label: "Ik heb gegeet een appel." },
    ],
    answer: "ik heb een appel gegeten",
  },
  {
    id: "q3-word-order-a2-late",
    level: "A2-late",
    promptEn: "Pick the correct word order: 'Yesterday I went to the cinema'.",
    promptNl: "Welke is de juiste woordvolgorde?",
    options: [
      { value: "gisteren ben ik naar de bioscoop geweest", label: "Gisteren ben ik naar de bioscoop geweest." },
      { value: "ik ben gisteren naar de bioscoop geweest", label: "Ik ben gisteren naar de bioscoop geweest." },
      { value: "gisteren ik ben naar de bioscoop geweest", label: "Gisteren ik ben naar de bioscoop geweest." },
      { value: "ben ik gisteren naar de bioscoop geweest", label: "Ben ik gisteren naar de bioscoop geweest." },
    ],
    answer: "gisteren ben ik naar de bioscoop geweest",
  },
  {
    id: "q4-subordinate-b1-early",
    level: "B1-early",
    promptEn: "Choose the correct subordinate clause form.",
    promptNl: "Kies de juiste bijzin.",
    options: [
      { value: "ik weet dat hij komt morgen", label: "Ik weet dat hij komt morgen." },
      { value: "ik weet dat hij morgen komt", label: "Ik weet dat hij morgen komt." },
      { value: "ik weet hij morgen komt dat", label: "Ik weet hij morgen komt dat." },
      { value: "ik weet morgen dat hij komt", label: "Ik weet morgen dat hij komt." },
    ],
    answer: "ik weet dat hij morgen komt",
  },
  {
    id: "q5-idiom-b1-late",
    level: "B1-late",
    promptEn: "What does 'de kat uit de boom kijken' mean?",
    promptNl: "Wat betekent 'de kat uit de boom kijken'?",
    options: [
      { value: "wait and see how things unfold", label: "To wait and see how things unfold." },
      { value: "climb a tree", label: "To literally climb a tree to look at a cat." },
      { value: "be very curious", label: "To be very curious about something." },
      { value: "make a quick decision", label: "To make a quick decision." },
    ],
    answer: "wait and see how things unfold",
  },
];

export function scoreToLevel(score: number): "A1" | "A2" | "B1" {
  if (score <= 1) return "A1";
  if (score <= 3) return "A2";
  return "B1";
}

/** For v0, every level routes to a2-unit-1 since A2 is the only seeded content. */
export function startingUnitSlug(_level: "A1" | "A2" | "B1"): string {
  return "a2-unit-1-werkwoorden-hebben-zijn";
}
