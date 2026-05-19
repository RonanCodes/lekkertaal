import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TranslationTypingDrill } from "../TranslationTypingDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Minimal translation_typing drill. `answer` is a plain string (the canonical
 * NL sentence) or a JSON-stringified array of accepted variants — matches the
 * shape parseField sees coming out of the exercises table.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 9001,
    slug: "trans-1",
    type: "translation_typing",
    promptNl: null,
    promptEn: "I want a coffee",
    options: null,
    answer: JSON.stringify("ik wil een koffie"),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    isSynthetic: false,
    ...overrides,
  };
}

describe("TranslationTypingDrill — Levenshtein-3 tolerance (US-132)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("grades an exact match as correct without a Close-enough hint", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "ik wil een koffie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "ik wil een koffie");
    expect(screen.queryByText(/close enough/i)).not.toBeInTheDocument();
  });

  it("treats trim+lowercase normalisation as exact (no Close-enough)", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "  Ik wil een koffie  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "  Ik wil een koffie  ");
    expect(screen.queryByText(/close enough/i)).not.toBeInTheDocument();
  });

  it("accepts a 1-char typo as correct with a Close-enough hint", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    // "will" vs "wil" — one insertion.
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "ik will een koffie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "ik will een koffie");
    expect(screen.getByText(/close enough/i)).toBeInTheDocument();
  });

  it("accepts a distance-3 typo as correct with a Close-enough hint", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    // "ik wil een koffies" → distance 1 (insert). Push to 3 with two more edits.
    // "ik will een koffies" → distance 2. "ik will een koffiess" → distance 3.
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "ik will een koffiess" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "ik will een koffiess");
    expect(screen.getByText(/close enough/i)).toBeInTheDocument();
  });

  it("rejects a distance >3 answer as wrong and shows the canonical", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    // Wildly off: distance well above 3.
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "een hond loopt op straat" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(false, "een hond loopt op straat");
    expect(screen.queryByText(/close enough/i)).not.toBeInTheDocument();
    expect(screen.getByText("ik wil een koffie")).toBeInTheDocument();
  });

  it("does not submit when the input is empty (Check disabled)", () => {
    const onSubmit = vi.fn();
    render(<TranslationTypingDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const check = screen.getByRole<HTMLButtonElement>("button", { name: /^check$/i });
    expect(check.disabled).toBe(true);
    fireEvent.click(check);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts the second canonical variant when answer is a JSON array", () => {
    const onSubmit = vi.fn();
    render(
      <TranslationTypingDrill
        drill={makeDrill({
          answer: JSON.stringify(["ik ga naar school", "ik ga naar de school"]),
        })}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/type the dutch translation/i), {
      target: { value: "ik ga naar de school" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "ik ga naar de school");
    // Distance to second variant is 0, so no Close-enough hint.
    expect(screen.queryByText(/close enough/i)).not.toBeInTheDocument();
  });
});
