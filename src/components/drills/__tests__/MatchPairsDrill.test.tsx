import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MatchPairsDrill } from "../MatchPairsDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Builds a minimal `match_pairs` drill payload. The seed loader puts the
 * pairs array into the `answer` column, so the drill reads from there. We
 * pass a deterministic 4-pair set; shuffling means tile order varies but
 * lookups by `data-testid` use the pair index, not display position.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 1,
    slug: "match-pairs-fixture",
    type: "match_pairs",
    promptNl: null,
    promptEn: "Match each Dutch word with its English meaning.",
    options: null,
    answer: JSON.stringify([
      { nl: "Nederlands", en: "Dutch" },
      { nl: "met", en: "with" },
      { nl: "en", en: "and" },
      { nl: "Opdracht", en: "Assignment" },
    ]),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("MatchPairsDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the prompt and a tile per pair on each side", () => {
    const onSubmit = vi.fn();
    render(<MatchPairsDrill drill={makeDrill()} onSubmit={onSubmit} />);
    expect(screen.getByTestId("match-pairs-drill")).toBeInTheDocument();
    expect(screen.getByText(/match each dutch word/i)).toBeInTheDocument();
    // 4 NL tiles + 4 EN tiles regardless of shuffle order.
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`match-pairs-nl-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`match-pairs-en-${i}`)).toBeInTheDocument();
    }
  });

  it("locks a correct pair (NL then matching EN)", () => {
    const onSubmit = vi.fn();
    render(<MatchPairsDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("match-pairs-nl-0"));
    fireEvent.click(screen.getByTestId("match-pairs-en-0"));
    // Correct-flash window before the tiles unmount.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId("match-pairs-nl-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-pairs-en-0")).not.toBeInTheDocument();
  });

  it("rejects a wrong pair and keeps both tiles visible", () => {
    const onSubmit = vi.fn();
    render(<MatchPairsDrill drill={makeDrill()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("match-pairs-nl-0"));
    fireEvent.click(screen.getByTestId("match-pairs-en-1"));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    // Wrong pair stays on the board.
    expect(screen.getByTestId("match-pairs-nl-0")).toBeInTheDocument();
    expect(screen.getByTestId("match-pairs-en-1")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fires onSubmit(true) once every pair is matched", () => {
    const onSubmit = vi.fn();
    render(<MatchPairsDrill drill={makeDrill()} onSubmit={onSubmit} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId(`match-pairs-nl-${i}`));
      fireEvent.click(screen.getByTestId(`match-pairs-en-${i}`));
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }
    // Final-match completion delay so the green flash is visible.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("falls back to drill.options when answer is null", () => {
    const onSubmit = vi.fn();
    render(
      <MatchPairsDrill
        drill={makeDrill({
          answer: null,
          options: JSON.stringify([
            { nl: "huis", en: "house" },
            { nl: "boom", en: "tree" },
          ]),
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText("huis")).toBeInTheDocument();
    expect(screen.getByText("house")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("tree")).toBeInTheDocument();
  });

  it("ignores malformed pair entries", () => {
    const onSubmit = vi.fn();
    render(
      <MatchPairsDrill
        drill={makeDrill({
          answer: JSON.stringify([
            { nl: "huis", en: "house" },
            { nl: "boom" }, // missing `en`
            null,
            { nl: "boek", en: "book" },
          ]),
        })}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText("huis")).toBeInTheDocument();
    expect(screen.getByText("boek")).toBeInTheDocument();
    // boom was malformed (no `en`), so its NL tile must NOT render.
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });
});
