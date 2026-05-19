import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ListeningSpellDrill } from "../ListeningSpellDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Build a minimal listening-spell drill. Mirrors the shape buildListeningSpellTail
 * emits: answer is a JSON-serialised `{nl, en}` pair, synthetic id range.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: -2_000_100,
    slug: "synthetic-listening-spell-1-0",
    type: "listening_spell",
    promptNl: null,
    promptEn: "Listen and type what you hear",
    options: null,
    answer: JSON.stringify({ nl: "huis", en: "house" }),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    isSynthetic: true,
    ...overrides,
  };
}

describe("ListeningSpellDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders a speaker button without revealing the word up-front", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    // Prompt is the generic copy; the Dutch word itself must not appear
    // before grading or the drill is a freebie.
    expect(screen.getByText(/listen and type/i)).toBeInTheDocument();
    expect(screen.queryByText("huis")).not.toBeInTheDocument();
    // Speaker exposes an aria-label we can match.
    expect(screen.getByLabelText(/play the dutch word/i)).toBeInTheDocument();
  });

  it("disables the check button until the input has content", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const check = screen.getByRole<HTMLButtonElement>("button", { name: /check/i });
    expect(check.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch word/i), {
      target: { value: "h" },
    });
    expect(check.disabled).toBe(false);
  });

  it("grades an exact match as correct and fires onSubmit(true)", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch word/i), {
      target: { value: "huis" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true, "huis");
  });

  it("grades a one-typo answer as correct (Levenshtein <= 1)", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch word/i), {
      target: { value: "huos" }, // 1 substitution off "huis"
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "huos");
    // "Close enough" hint surfaces when distance is exactly 1.
    expect(screen.getByText(/close enough/i)).toBeInTheDocument();
  });

  it("rejects an obviously wrong answer and reveals the canonical word", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch word/i), {
      target: { value: "kat" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(false, "kat");
    // Feedback panel now shows the canonical Dutch word.
    expect(screen.getByText("huis")).toBeInTheDocument();
  });

  it("treats trim+lowercase normalisation as not-an-edit (Huis vs huis is exact)", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch word/i), {
      target: { value: "  Huis  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "  Huis  ");
    // No "close enough" hint — that only appears for distance===1.
    expect(screen.queryByText(/close enough/i)).not.toBeInTheDocument();
  });

  it("submits on Enter key", () => {
    const onSubmit = vi.fn();
    render(<ListeningSpellDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/type the dutch word/i);
    fireEvent.change(input, { target: { value: "huis" } });
    fireEvent.keyDown(input, { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "huis");
  });

  it("renders a Skip fallback when the answer payload is malformed", () => {
    const onSubmit = vi.fn();
    render(
      <ListeningSpellDrill
        drill={makeDrill({ answer: JSON.stringify({ nl: "huis" }) })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/card unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(onSubmit).toHaveBeenCalledWith(true);
  });
});
