import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConjugationDrill } from "../ConjugationDrill";
import type * as LessonModule from "../../../lib/server/lesson";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Mock the server-fn so we can assert per-cell call shape without crossing the
 * RPC boundary. The mock returns a resolved promise so the drill's
 * fire-and-forget dispatch doesn't reject.
 */
const recordVocabPairResultMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../../../lib/server/lesson", async (orig) => {
  const actual = await orig<typeof LessonModule>();
  return {
    ...actual,
    recordVocabPairResult: (args: unknown) => recordVocabPairResultMock(args),
  };
});

function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 42,
    slug: "conj-pres-hebben",
    type: "conjugation",
    promptNl: null,
    promptEn: "Conjugate hebben in present tense",
    options: null,
    answer: JSON.stringify({
      infinitive: "hebben",
      tense: "present",
      forms: {
        ik: "heb",
        jij: "hebt",
        hij_zij: "heeft",
        wij: "hebben",
        jullie: "hebben",
        zij: "hebben",
      },
    }),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

const PERSON_KEYS = ["ik", "jij", "hij_zij", "wij", "jullie", "zij"] as const;
const CORRECT = {
  ik: "heb",
  jij: "hebt",
  hij_zij: "heeft",
  wij: "hebben",
  jullie: "hebben",
  zij: "hebben",
} as const;

function fillAll(values: Record<(typeof PERSON_KEYS)[number], string>) {
  for (const key of PERSON_KEYS) {
    fireEvent.change(screen.getByTestId(`conjugation-input-${key}`), {
      target: { value: values[key] },
    });
  }
}

describe("ConjugationDrill", () => {
  beforeEach(() => {
    recordVocabPairResultMock.mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 6 inputs labelled with the right person strings", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    expect(screen.getByTestId("conjugation-drill")).toBeInTheDocument();
    // Infinitive + tense header — both surfaces (prompt + header) carry the
    // tense so use getAllByText.
    expect(screen.getByText("hebben")).toBeInTheDocument();
    expect(screen.getAllByText(/present/).length).toBeGreaterThan(0);
    // Each input present + each label displayed (note: keys are storage-safe,
    // labels are UI-only).
    for (const key of PERSON_KEYS) {
      expect(screen.getByTestId(`conjugation-input-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByText("ik")).toBeInTheDocument();
    expect(screen.getByText("jij / je")).toBeInTheDocument();
    expect(screen.getByText("hij / zij / het")).toBeInTheDocument();
    expect(screen.getByText("wij")).toBeInTheDocument();
    expect(screen.getByText("jullie")).toBeInTheDocument();
    expect(screen.getByText("zij (plural)")).toBeInTheDocument();
  });

  it("submit is disabled until all six cells are filled", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const submit = screen.getByTestId<HTMLButtonElement>("conjugation-submit");
    expect(submit.disabled).toBe(true);
    // Fill five cells — still disabled.
    for (const key of PERSON_KEYS.slice(0, 5)) {
      fireEvent.change(screen.getByTestId(`conjugation-input-${key}`), {
        target: { value: CORRECT[key] },
      });
    }
    expect(submit.disabled).toBe(true);
    // Fill the sixth — enabled.
    fireEvent.change(screen.getByTestId("conjugation-input-zij"), {
      target: { value: CORRECT.zij },
    });
    expect(submit.disabled).toBe(false);
  });

  it("all correct → onSubmit(true) after the Continue tap", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fillAll(CORRECT);
    fireEvent.click(screen.getByTestId("conjugation-submit"));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("conjugation-continue"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("mixed correct/wrong → onSubmit(false), per-cell border colour reflects per-cell grading", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fillAll({
      ik: "heb", // ✓
      jij: "hebt", // ✓
      hij_zij: "hebt", // ✗ (wrong, should be heeft)
      wij: "hebben", // ✓
      jullie: "hebben", // ✓
      zij: "hebbe", // ✗ (typo)
    });
    fireEvent.click(screen.getByTestId("conjugation-submit"));
    // Border colours: green for correct, rose for wrong.
    expect(
      screen.getByTestId("conjugation-cell-ik").className,
    ).toContain("border-emerald-500");
    expect(
      screen.getByTestId("conjugation-cell-hij_zij").className,
    ).toContain("border-rose-500");
    expect(
      screen.getByTestId("conjugation-cell-zij").className,
    ).toContain("border-rose-500");
    expect(
      screen.getByTestId("conjugation-cell-wij").className,
    ).toContain("border-emerald-500");
    // Canonical revealed for the wrong cells only.
    expect(
      screen.getByTestId("conjugation-canonical-hij_zij"),
    ).toHaveTextContent("heeft");
    expect(
      screen.queryByTestId("conjugation-canonical-ik"),
    ).not.toBeInTheDocument();
    // Continue → onSubmit(false).
    fireEvent.click(screen.getByTestId("conjugation-continue"));
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("fires recordVocabPairResult once per cell with the right itemKey shape", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fillAll({
      ik: "heb",
      jij: "wrong",
      hij_zij: "heeft",
      wij: "hebben",
      jullie: "hebben",
      zij: "hebben",
    });
    fireEvent.click(screen.getByTestId("conjugation-submit"));
    expect(recordVocabPairResultMock).toHaveBeenCalledTimes(6);
    // Each call is wrapped as { data: { nl, en, correct, exerciseId } }
    const calls = recordVocabPairResultMock.mock.calls.map((c) => c[0]);
    const byKey = new Map<string, { en: string; correct: boolean; exerciseId: number }>();
    for (const c of calls) {
      byKey.set(c.data.nl, {
        en: c.data.en,
        correct: c.data.correct,
        exerciseId: c.data.exerciseId,
      });
    }
    expect(byKey.get("hebben_ik")).toEqual({ en: "heb", correct: true, exerciseId: 42 });
    expect(byKey.get("hebben_jij")).toEqual({ en: "hebt", correct: false, exerciseId: 42 });
    expect(byKey.get("hebben_hij_zij")).toEqual({
      en: "heeft",
      correct: true,
      exerciseId: 42,
    });
    expect(byKey.get("hebben_wij")).toEqual({
      en: "hebben",
      correct: true,
      exerciseId: 42,
    });
    expect(byKey.get("hebben_jullie")).toEqual({
      en: "hebben",
      correct: true,
      exerciseId: 42,
    });
    expect(byKey.get("hebben_zij")).toEqual({
      en: "hebben",
      correct: true,
      exerciseId: 42,
    });
  });

  it("grades case-insensitively and ignores surrounding whitespace", () => {
    const onSubmit = vi.fn();
    render(<ConjugationDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fillAll({
      ik: "  HEB ",
      jij: "Hebt",
      hij_zij: "HEEFT",
      wij: "hebben",
      jullie: "hebben",
      zij: "hebben",
    });
    fireEvent.click(screen.getByTestId("conjugation-submit"));
    fireEvent.click(screen.getByTestId("conjugation-continue"));
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("falls back to a skip frame when answer is malformed", () => {
    const onSubmit = vi.fn();
    render(
      <ConjugationDrill
        drill={makeDrill({ answer: "not-json" })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByTestId("conjugation-drill")).not.toBeInTheDocument();
    expect(screen.getByText(/Conjugation unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Skip"));
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("falls back when forms is missing a person key", () => {
    const onSubmit = vi.fn();
    render(
      <ConjugationDrill
        drill={makeDrill({
          answer: JSON.stringify({
            infinitive: "hebben",
            tense: "present",
            // missing `zij`
            forms: {
              ik: "heb",
              jij: "hebt",
              hij_zij: "heeft",
              wij: "hebben",
              jullie: "hebben",
            },
          }),
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/Conjugation unavailable/i)).toBeInTheDocument();
  });
});
