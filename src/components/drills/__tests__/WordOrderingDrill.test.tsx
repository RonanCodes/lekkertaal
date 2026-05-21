import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { WordOrderingDrill } from "../WordOrderingDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Minimal `word_ordering` drill payload. The seed loader stuffs the shuffled
 * word pool into `options` and the canonical sentence (or array of accepted
 * forms) into `answer`, both JSON-encoded. The chip-tray UI is exercised by
 * chip label rather than position so the shuffle order doesn't matter.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 7,
    slug: "word-ordering-fixture",
    type: "word_ordering",
    promptNl: null,
    promptEn: "Build: \"I am going to school today\"",
    options: JSON.stringify(["Ik", "ga", "vandaag", "naar", "school"]),
    answer: JSON.stringify("Ik ga vandaag naar school"),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

function poolChip(text: string): HTMLButtonElement {
  const found = screen
    .getAllByRole("button")
    .find(
      (b) =>
        b.getAttribute("data-testid")?.startsWith("word-ordering-pool-chip-") &&
        b.textContent === text,
    );
  if (!found) throw new Error(`pool chip not found: ${text}`);
  return found as HTMLButtonElement;
}

function trayChip(text: string): HTMLButtonElement {
  const found = screen
    .getAllByRole("button")
    .find(
      (b) =>
        b.getAttribute("data-testid")?.startsWith("word-ordering-tray-chip-") &&
        b.textContent === text,
    );
  if (!found) throw new Error(`tray chip not found: ${text}`);
  return found as HTMLButtonElement;
}

const ORDER = ["Ik", "ga", "vandaag", "naar", "school"];

describe("WordOrderingDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the prompt and a chip per pool word", () => {
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    expect(screen.getByTestId("word-ordering-drill")).toBeInTheDocument();
    expect(screen.getByText(/build:/i)).toBeInTheDocument();
    for (const w of ORDER) {
      expect(poolChip(w)).toBeInTheDocument();
    }
  });

  it("moves a chip into the tray when tapped in the pool", () => {
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    fireEvent.click(poolChip("Ik"));
    expect(trayChip("Ik")).toBeInTheDocument();
    const stillInPool = screen
      .getAllByRole("button")
      .find(
        (b) =>
          b.getAttribute("data-testid")?.startsWith("word-ordering-pool-chip-") &&
          b.textContent === "Ik",
      );
    expect(stillInPool).toBeUndefined();
  });

  it("returns a placed chip to the pool when tapped in the tray", () => {
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    fireEvent.click(poolChip("ga"));
    fireEvent.click(trayChip("ga"));
    expect(poolChip("ga")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("word-ordering-tray")).getByText(/tap the chips below/i),
    ).toBeInTheDocument();
  });

  it("fires onSubmit(true) when the placed order matches the canonical", () => {
    const onSubmit = vi.fn();
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    for (const w of ORDER) fireEvent.click(poolChip(w));
    fireEvent.click(screen.getByTestId("word-ordering-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true, "Ik ga vandaag naar school");
  });

  it("fires onSubmit(false) when the placed order does not match", () => {
    const onSubmit = vi.fn();
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    for (const w of ["school", "naar", "vandaag", "ga", "Ik"]) {
      fireEvent.click(poolChip(w));
    }
    fireEvent.click(screen.getByTestId("word-ordering-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toBe(false);
  });

  it("Reset clears the tray and returns every chip to the pool", () => {
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    fireEvent.click(poolChip("Ik"));
    fireEvent.click(poolChip("ga"));
    fireEvent.click(screen.getByTestId("word-ordering-reset"));
    expect(
      within(screen.getByTestId("word-ordering-tray")).getByText(/tap the chips below/i),
    ).toBeInTheDocument();
    for (const w of ORDER) expect(poolChip(w)).toBeInTheDocument();
  });

  it("gives every chip a touch target of at least 44x44px (mobile-first)", () => {
    render(<WordOrderingDrill drill={makeDrill()} onSubmit={vi.fn()} />);
    const chips = screen
      .getAllByRole("button")
      .filter((b) =>
        b.getAttribute("data-testid")?.startsWith("word-ordering-pool-chip-"),
      );
    expect(chips.length).toBeGreaterThan(0);
    // The 44px minimum is enforced in the screen-scoped .word-order-chip rule
    // (min-height/min-width: 44px); jsdom can't compute layout, so we assert
    // the class is attached.
    for (const chip of chips) {
      expect(chip.className).toMatch(/word-order-chip/);
    }
  });

  it("accepts an array of canonical forms (Levenshtein tolerance)", () => {
    const onSubmit = vi.fn();
    render(
      <WordOrderingDrill
        drill={makeDrill({
          answer: JSON.stringify(["Ik ga naar school", "Ik ga vandaag naar school"]),
        })}
        onSubmit={onSubmit}
      />,
    );
    for (const w of ORDER) fireEvent.click(poolChip(w));
    fireEvent.click(screen.getByTestId("word-ordering-submit"));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit.mock.calls[0][0]).toBe(true);
  });
});
