import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PictureChoiceDrill } from "../PictureChoiceDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Builds a minimal `picture_choice` drill payload. The seed loader writes the
 * correct `{nl, en?, imageUrl}` triple into `answer` (JSON-encoded). Three
 * distractors come from `imagePool` at render time, sampled to fill the 2x2
 * grid.
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 7,
    slug: "picture-choice-fixture",
    type: "picture_choice",
    promptNl: null,
    promptEn: "Tap the picture that matches the word.",
    options: null,
    answer: JSON.stringify({
      nl: "huis",
      en: "house",
      imageUrl: "https://images.test/huis.png",
    }),
    hints: null,
    audioUrl: null,
    imageUrl: "https://images.test/huis.png",
    ...overrides,
  };
}

const POOL_WITH_4 = [
  { nl: "huis", en: "house", imageUrl: "https://images.test/huis.png" },
  { nl: "kat", en: "cat", imageUrl: "https://images.test/kat.png" },
  { nl: "boom", en: "tree", imageUrl: "https://images.test/boom.png" },
  { nl: "hond", en: "dog", imageUrl: "https://images.test/hond.png" },
];

describe("PictureChoiceDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 4 image tiles when the pool has at least 4 entries", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    expect(screen.getByTestId("picture-choice-grid")).toBeInTheDocument();
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`picture-choice-tile-${i}`)).toBeInTheDocument();
    }
  });

  it("renders the Dutch headword at the top", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    expect(screen.getByText("huis")).toBeInTheDocument();
  });

  it("picks 3 unique distractors that aren't the correct image", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    const imgs = screen.getAllByRole("img");
    const urls = imgs.map((i) => (i as HTMLImageElement).src);
    // Exactly one occurrence of the correct image.
    expect(urls.filter((u) => u === "https://images.test/huis.png")).toHaveLength(1);
    // All 4 image URLs distinct.
    expect(new Set(urls).size).toBe(4);
    // All come from the pool.
    for (const u of urls) {
      expect(POOL_WITH_4.map((p) => p.imageUrl)).toContain(u);
    }
  });

  it("auto-advances with onSubmit(true) when the pool has fewer than 4 images", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4.slice(0, 2)}
      />,
    );
    // No grid rendered.
    expect(screen.queryByTestId("picture-choice-grid")).not.toBeInTheDocument();
    // Auto-advance fires after the 200ms skip delay.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("auto-advances when the drill answer is malformed", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill({ answer: "not-json" })}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    expect(screen.queryByTestId("picture-choice-grid")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("tapping the correct tile fires onSubmit(true) after the flash delay", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    // Locate the correct tile by the data-correct attribute the component sets.
    const buttons = screen.getAllByRole("button");
    const correctBtn = buttons.find(
      (b) => b.getAttribute("data-testid")?.startsWith("picture-choice-tile-") &&
        b.getAttribute("data-correct") === "true",
    );
    expect(correctBtn).toBeDefined();
    fireEvent.click(correctBtn!);
    // onSubmit not called yet — there's a flash delay first.
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("tapping a wrong tile fires onSubmit(false) after the reveal+advance delay", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const wrongBtn = buttons.find(
      (b) => b.getAttribute("data-testid")?.startsWith("picture-choice-tile-") &&
        b.getAttribute("data-correct") === "false",
    );
    expect(wrongBtn).toBeDefined();
    fireEvent.click(wrongBtn!);
    // Wrong path waits 1200ms before advancing.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("ignores subsequent taps after the first pick", () => {
    const onSubmit = vi.fn();
    render(
      <PictureChoiceDrill
        drill={makeDrill()}
        onSubmit={onSubmit}
        imagePool={POOL_WITH_4}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const tiles = buttons.filter((b) =>
      b.getAttribute("data-testid")?.startsWith("picture-choice-tile-"),
    );
    fireEvent.click(tiles[0]);
    fireEvent.click(tiles[1]);
    fireEvent.click(tiles[2]);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
