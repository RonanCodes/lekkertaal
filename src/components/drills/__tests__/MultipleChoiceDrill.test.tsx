import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MultipleChoiceDrill } from "../MultipleChoiceDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Builds a minimal `multiple_choice` drill payload. `options` is a JSON array
 * of strings (or {text, explanation} objects); `answer` is the correct option
 * text. Covers the #210 option-card redesign: card states, kbd hints, and the
 * preserved answer -> onSubmit loop.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 11,
    slug: "mc-fixture",
    type: "multiple_choice",
    promptNl: "Welke is een fruit?",
    promptEn: "Which is a fruit?",
    options: JSON.stringify(["een appel", "een boek", "een huis", "een tafel"]),
    answer: JSON.stringify("een appel"),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("MultipleChoiceDrill (option cards, #210)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one option-card per option with a keyboard-hint chip", () => {
    render(<MultipleChoiceDrill drill={makeDrill()} onSubmit={vi.fn()} mode="text" />);
    const cards = screen.getAllByRole("option");
    expect(cards).toHaveLength(4);
    // kbd hints number 1..4
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    // idle state by default
    expect(cards[0]).toHaveAttribute("data-state", "idle");
  });

  it("flags the correct card and fires onSubmit(true) after the flash delay", () => {
    const onSubmit = vi.fn();
    render(<MultipleChoiceDrill drill={makeDrill()} onSubmit={onSubmit} mode="text" />);
    fireEvent.click(screen.getByText("een appel"));
    const correctCard = screen.getAllByRole("option").find(
      (c) => c.getAttribute("data-correct") === "true",
    );
    expect(correctCard).toHaveAttribute("data-state", "correct");
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "een appel");
  });

  it("marks a wrong pick and reveals the correct answer, then onSubmit(false)", () => {
    const onSubmit = vi.fn();
    render(<MultipleChoiceDrill drill={makeDrill()} onSubmit={onSubmit} mode="text" />);
    fireEvent.click(screen.getByText("een boek"));
    const cards = screen.getAllByRole("option");
    const wrong = cards.find((c) => c.textContent?.includes("een boek"));
    const correct = cards.find((c) => c.getAttribute("data-correct") === "true");
    expect(wrong).toHaveAttribute("data-state", "wrong");
    expect(correct).toHaveAttribute("data-state", "correct");
    // Inline explanation names the canonical answer (also present in the
    // correct card, hence getAllByText -> at least one match).
    expect(screen.getAllByText("een appel").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(onSubmit).toHaveBeenCalledWith(false, "een boek");
  });

  it("ignores taps after the first pick (cards disabled once submitted)", () => {
    const onSubmit = vi.fn();
    render(<MultipleChoiceDrill drill={makeDrill()} onSubmit={onSubmit} mode="text" />);
    fireEvent.click(screen.getByText("een appel"));
    fireEvent.click(screen.getByText("een boek"));
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("audio mode renders the speaker prompt instead of text", () => {
    render(<MultipleChoiceDrill drill={makeDrill()} onSubmit={vi.fn()} mode="audio" />);
    expect(screen.getByText("Tap to play")).toBeInTheDocument();
    // Still renders the 4 answer cards.
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });
});
