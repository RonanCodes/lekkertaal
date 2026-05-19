import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DialogueReplyDrill } from "../DialogueReplyDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Builds a minimal `dialogue_reply` drill payload. The seed shape lives in
 * the `answer` column as JSON {dialogue, options}. Tests assert via tile
 * content (not data-testid position) when shuffle is in play, and via picked
 * tile index when we want to drive a specific path.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 1,
    slug: "dialogue-reply-fixture",
    type: "dialogue_reply",
    promptNl: null,
    promptEn: "Pick the best reply",
    options: null,
    answer: JSON.stringify({
      dialogue: [
        { speaker: "A", line: "Hoe gaat het?" },
        { speaker: "B", line: "Goed, en met jou?" },
      ],
      options: [
        { text: "Het gaat goed, dank je.", correct: true },
        { text: "Ik woon in Amsterdam.", correct: false },
        { text: "Ik heet Anna.", correct: false },
      ],
    }),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("DialogueReplyDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders dialogue lines and three reply tiles", () => {
    const onSubmit = vi.fn();
    render(<DialogueReplyDrill drill={makeDrill()} onSubmit={onSubmit} />);
    expect(screen.getByTestId("dialogue-reply-drill")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-line-0")).toHaveTextContent("A:");
    expect(screen.getByTestId("dialogue-line-0")).toHaveTextContent(
      "Hoe gaat het?",
    );
    expect(screen.getByTestId("dialogue-line-1")).toHaveTextContent("B:");
    expect(screen.getByTestId("dialogue-line-1")).toHaveTextContent(
      "Goed, en met jou?",
    );
    // Three tiles regardless of shuffle order; assert by text content so the
    // assertion is shuffle-agnostic.
    expect(screen.getByText("Het gaat goed, dank je.")).toBeInTheDocument();
    expect(screen.getByText("Ik woon in Amsterdam.")).toBeInTheDocument();
    expect(screen.getByText("Ik heet Anna.")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-reply-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-reply-option-1")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-reply-option-2")).toBeInTheDocument();
  });

  it("shuffles deterministically with a seeded Math.random", () => {
    // Math.random returns 0 each call → the Fisher-Yates inner loop picks
    // j = 0 every time, which means the implementation reverses the array.
    // We don't lock to that exact order in case the impl changes; instead we
    // assert that the option set is preserved (the real shuffle invariant).
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onSubmit = vi.fn();
    render(<DialogueReplyDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const tiles = [0, 1, 2].map((i) =>
      screen.getByTestId(`dialogue-reply-option-${i}`).textContent,
    );
    expect(tiles.sort()).toEqual(
      [
        "Het gaat goed, dank je.",
        "Ik heet Anna.",
        "Ik woon in Amsterdam.",
      ].sort(),
    );
  });

  it("fires onSubmit(true) after a flash delay when the correct tile is tapped", () => {
    const onSubmit = vi.fn();
    render(<DialogueReplyDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Het gaat goed, dank je."));
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("reveals the correct tile + explanation on a wrong pick, then onSubmit(false)", () => {
    const onSubmit = vi.fn();
    render(
      <DialogueReplyDrill
        drill={makeDrill({
          answer: JSON.stringify({
            dialogue: [
              { speaker: "A", line: "Wil je koffie?" },
              { speaker: "B", line: "Nee, dank je." },
            ],
            options: [
              {
                text: "Ja, graag.",
                correct: true,
                explanation: "'Graag' is the polite Dutch 'yes please'.",
              },
              { text: "Tot ziens.", correct: false },
              { text: "Goedemorgen.", correct: false },
            ],
          }),
        })}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByText("Tot ziens."));
    // Explanation appears before the submit delay completes.
    expect(screen.getByTestId("dialogue-reply-explanation")).toHaveTextContent(
      "'Graag' is the polite Dutch 'yes please'.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("does not render an explanation card when the seeded payload has none", () => {
    const onSubmit = vi.fn();
    render(<DialogueReplyDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("Ik woon in Amsterdam."));
    expect(
      screen.queryByTestId("dialogue-reply-explanation"),
    ).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("falls back to a skip frame when answer is malformed", () => {
    const onSubmit = vi.fn();
    render(
      <DialogueReplyDrill
        drill={makeDrill({ answer: "not-json" })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByTestId("dialogue-reply-drill")).not.toBeInTheDocument();
    expect(screen.getByText(/Dialogue unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Skip"));
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("falls back when answer is missing a correct option", () => {
    const onSubmit = vi.fn();
    render(
      <DialogueReplyDrill
        drill={makeDrill({
          answer: JSON.stringify({
            dialogue: [{ speaker: "A", line: "Hi" }],
            options: [
              { text: "X", correct: false },
              { text: "Y", correct: false },
            ],
          }),
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/Dialogue unavailable/i)).toBeInTheDocument();
  });
});
