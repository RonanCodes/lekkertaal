import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ImageWordDrill } from "../ImageWordDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

/**
 * Builds a minimal `image_word` drill payload with sensible defaults that
 * each test can override per-field. Mirrors what `getLesson` ships down the
 * wire (answer is JSON-serialised; the component parses on its own).
 */
function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 1,
    slug: "image-word-kat",
    type: "image_word",
    promptNl: null,
    promptEn: "Type the Dutch word for what you see",
    options: null,
    answer: JSON.stringify(["kat", "de kat"]),
    hints: null,
    audioUrl: null,
    imageUrl: "https://images.example.test/kat.png",
    ...overrides,
  };
}

describe("ImageWordDrill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the image with descriptive alt text", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const img = screen.getByTestId("image-word-drill-image") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://images.example.test/kat.png");
    expect(img.getAttribute("alt")).toMatch(/dutch/i);
  });

  it("falls back to a placeholder when imageUrl is null", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill({ imageUrl: null })} onSubmit={onSubmit} />);
    expect(screen.queryByTestId("image-word-drill-image")).not.toBeInTheDocument();
    expect(screen.getByText(/image missing/i)).toBeInTheDocument();
  });

  it("accepts the canonical Dutch noun and calls onSubmit(true)", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByTestId("image-word-drill-input");
    fireEvent.change(input, { target: { value: "kat" } });
    fireEvent.click(screen.getByTestId("image-word-drill-check"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(true, "kat");
  });

  it("accepts the articled form when included in the answer array", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByTestId("image-word-drill-input");
    fireEvent.change(input, { target: { value: "de kat" } });
    fireEvent.click(screen.getByTestId("image-word-drill-check"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "de kat");
  });

  it("tolerates a single typo via Levenshtein <= 1", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByTestId("image-word-drill-input");
    fireEvent.change(input, { target: { value: "kut" } }); // 1 substitution off "kat"
    fireEvent.click(screen.getByTestId("image-word-drill-check"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "kut");
  });

  it("rejects an obviously wrong answer and reveals the canonical", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByTestId("image-word-drill-input");
    fireEvent.change(input, { target: { value: "hond" } });
    fireEvent.click(screen.getByTestId("image-word-drill-check"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(false, "hond");
    // Feedback panel shows the canonical answer
    expect(screen.getByTestId("image-word-drill-feedback")).toHaveTextContent("kat");
  });

  it("ignores empty submissions (Check button stays disabled)", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const check = screen.getByTestId("image-word-drill-check") as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    fireEvent.click(check);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits on Enter key", () => {
    const onSubmit = vi.fn();
    render(<ImageWordDrill drill={makeDrill()} onSubmit={onSubmit} />);
    const input = screen.getByTestId("image-word-drill-input");
    fireEvent.change(input, { target: { value: "kat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSubmit).toHaveBeenCalledWith(true, "kat");
  });
});
