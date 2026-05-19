import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { WordBankDrill } from "../WordBankDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Minimal `word_bank` drill payload. The seed loader stuffs the canonical
 * sentence into `answer` (JSON-encoded string). Distractor sourcing is tested
 * by passing a `vocabPool` separately; the slot/bank UI is tested by tile
 * label rather than position so the shuffle order doesn't matter.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 42,
    slug: "word-bank-fixture",
    type: "word_bank",
    promptNl: null,
    promptEn: "Translate: \"I want a coffee\"",
    options: null,
    answer: JSON.stringify("ik wil een koffie"),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

/**
 * Locate the bank tile (button) whose text content matches `text`. The bank
 * is the second slot region; we use a section query because tile ids are
 * shuffled at mount. Returns the matching button.
 */
function bankTile(text: string): HTMLButtonElement {
  const buttons = screen.getAllByRole("button");
  const found = buttons.find(
    (b) =>
      b.getAttribute("data-testid")?.startsWith("word-bank-bank-tile-") &&
      b.textContent === text,
  );
  if (!found) throw new Error(`bank tile not found: ${text}`);
  return found as HTMLButtonElement;
}

function slotTile(text: string): HTMLButtonElement {
  const buttons = screen.getAllByRole("button");
  const found = buttons.find(
    (b) =>
      b.getAttribute("data-testid")?.startsWith("word-bank-slot-tile-") &&
      b.textContent === text,
  );
  if (!found) throw new Error(`slot tile not found: ${text}`);
  return found as HTMLButtonElement;
}

describe("WordBankDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the prompt and a tile per canonical token", () => {
    render(<WordBankDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId("word-bank-drill")).toBeInTheDocument();
    expect(screen.getByText(/translate/i)).toBeInTheDocument();
    for (const t of ["ik", "wil", "een", "koffie"]) {
      expect(bankTile(t)).toBeInTheDocument();
    }
  });

  it("moves a tile to the slot when tapped in the bank", () => {
    render(<WordBankDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    fireEvent.click(bankTile("ik"));
    expect(slotTile("ik")).toBeInTheDocument();
    // The bank no longer shows that tile.
    const remainingBankIk = screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.getAttribute("data-testid")?.startsWith("word-bank-bank-tile-") &&
          b.textContent === "ik",
      );
    expect(remainingBankIk).toBeUndefined();
  });

  it("returns a slotted tile to the bank when tapped", () => {
    render(<WordBankDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    fireEvent.click(bankTile("wil"));
    fireEvent.click(slotTile("wil"));
    expect(bankTile("wil")).toBeInTheDocument();
    // Slot empty-state copy reappears.
    expect(
      within(screen.getByTestId("word-bank-slot")).getByText(/tap tiles below/i),
    ).toBeInTheDocument();
  });

  it("fires onSubmit(true) when the slotted order matches the canonical", () => {
    const onSubmit = vi.fn();
    render(<WordBankDrill drill={makeDrill()} onSubmit={onSubmit} />);
    for (const t of ["ik", "wil", "een", "koffie"]) {
      fireEvent.click(bankTile(t));
    }
    fireEvent.click(screen.getByTestId("word-bank-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true, "ik wil een koffie");
  });

  it("fires onSubmit(false) when the slotted order does not match", () => {
    const onSubmit = vi.fn();
    render(<WordBankDrill drill={makeDrill()} onSubmit={onSubmit} />);
    // Deliberately wrong order: "koffie ik wil een".
    for (const t of ["koffie", "ik", "wil", "een"]) {
      fireEvent.click(bankTile(t));
    }
    fireEvent.click(screen.getByTestId("word-bank-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toBe(false);
  });

  it("renders distractor tiles from vocabPool when no options.distractors is set", () => {
    render(
      <WordBankDrill
        drill={makeDrill()}
        onSubmit={vi.fn()}
        vocabPool={[
          { nl: "thee", en: "tea" },
          { nl: "water", en: "water" },
          { nl: "bier", en: "beer" },
          // Multi-word entries must be skipped.
          { nl: "ik heb", en: "I have" },
          // Tokens already in the canonical must be skipped.
          { nl: "ik", en: "I" },
        ]}
      />,
    );
    // At least one of the vocab-pool distractors should appear in the bank.
    const buttons = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");
    const distractorHits = ["thee", "water", "bier"].filter((d) =>
      buttons.includes(d),
    );
    expect(distractorHits.length).toBeGreaterThan(0);
    // Multi-word distractor must NOT have leaked in.
    expect(buttons).not.toContain("ik heb");
  });

  it("uses options.distractors when provided", () => {
    render(
      <WordBankDrill
        drill={makeDrill({
          options: JSON.stringify({ distractors: ["thee", "melk", "bier"] }),
        })}
        onSubmit={vi.fn()}
      />,
    );
    expect(bankTile("thee")).toBeInTheDocument();
    expect(bankTile("melk")).toBeInTheDocument();
    expect(bankTile("bier")).toBeInTheDocument();
  });

  it("gives every tile a touch target of at least 44x44px (mobile-first)", () => {
    render(<WordBankDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    const tiles = screen
      .getAllByRole("button")
      .filter((b) =>
        b.getAttribute("data-testid")?.startsWith("word-bank-bank-tile-"),
      );
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      // Tailwind `min-h-[44px]` + `min-w-[44px]` satisfy the WCAG 2.5.5 / iOS HIG
      // 44pt minimum touch-target rule. We assert via className because jsdom
      // doesn't compute layout.
      expect(tile.className).toMatch(/min-h-\[44px\]/);
      expect(tile.className).toMatch(/min-w-\[44px\]/);
    }
  });

  it("normalises whitespace when grading (extra spaces still match)", () => {
    const onSubmit = vi.fn();
    // Canonical has a stray double-space; submission must still grade correct
    // because the grader collapses internal whitespace.
    render(
      <WordBankDrill
        drill={makeDrill({ answer: JSON.stringify("ik  wil een koffie") })}
        onSubmit={onSubmit}
      />,
    );
    for (const t of ["ik", "wil", "een", "koffie"]) {
      fireEvent.click(bankTile(t));
    }
    fireEvent.click(screen.getByTestId("word-bank-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "ik wil een koffie");
  });
});
