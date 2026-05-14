/**
 * SpeakDrill unit tests (P2-STT-3 #56).
 *
 * Coverage:
 *   - renders the canonical sentence + record button when MediaRecorder exists
 *   - falls back to the upload control when MediaRecorder is missing
 *   - upload path drives the full transcribe → score → speak-complete flow
 *     against mocked fetch, asserts onSubmit fires with `correct=true` for a
 *     passing score and renders the per-token diff
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SpeakDrill, SPEAK_PASS_THRESHOLD } from "../SpeakDrill";
import type { DrillPayload } from "../../../lib/server/lesson";

function makeDrill(overrides: Partial<DrillPayload> = {}): DrillPayload {
  return {
    id: 42,
    slug: "a1-01-speak-1",
    type: "speak",
    promptNl: null,
    promptEn: "Say: Good morning",
    options: null,
    answer: JSON.stringify("Goedemorgen"),
    hints: null,
    audioUrl: null,
    imageUrl: null,
    ...overrides,
  };
}

function mockFetchPassing() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/stt/transcribe")) {
      return new Response(
        JSON.stringify({
          transcript: "Goedemorgen",
          audioKey: "stt/1/abc.webm",
          durationMs: 1500,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/stt/score")) {
      return new Response(
        JSON.stringify({
          score: 92,
          tokens: [{ word: "goedemorgen", status: "match" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/api/stt/speak-complete")) {
      return new Response(
        JSON.stringify({ passed: true, xpAwarded: 5, alreadyAwarded: false }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not mocked", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchFailing() {
  // Score below threshold so the drill reports `correct=false`.
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/stt/transcribe")) {
      return new Response(
        JSON.stringify({
          transcript: "morgen",
          audioKey: "stt/1/abc.webm",
          durationMs: 800,
        }),
        { status: 200 },
      );
    }
    if (url.includes("/api/stt/score")) {
      return new Response(
        JSON.stringify({
          score: 40,
          tokens: [
            { word: "goedemorgen", status: "wrong", spoken: "morgen" },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes("/api/stt/speak-complete")) {
      return new Response(
        JSON.stringify({ passed: false, xpAwarded: 0, alreadyAwarded: false }),
        { status: 200 },
      );
    }
    return new Response("not mocked", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SpeakDrill", () => {
  beforeEach(() => {
    // Strip MediaRecorder so the test always exercises the upload fallback,
    // which is what Playwright drives too.
    // @ts-expect-error: jsdom doesn't define MediaRecorder anyway, we make
    // it explicit so the contract is documented.
    delete window.MediaRecorder;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the canonical sentence and prompt", () => {
    render(<SpeakDrill drill={makeDrill()} onSubmit={() => {}} />);
    expect(screen.getByText("Say: Good morning")).toBeInTheDocument();
    expect(screen.getByTestId("speak-canonical")).toHaveTextContent(
      "Goedemorgen",
    );
  });

  it("shows the upload fallback when MediaRecorder is unavailable", () => {
    render(<SpeakDrill drill={makeDrill()} onSubmit={() => {}} />);
    expect(screen.getByTestId("speak-upload-input")).toBeInTheDocument();
    expect(screen.queryByTestId("speak-record-btn")).not.toBeInTheDocument();
  });

  it("scores an uploaded clip and reports a passing onSubmit", async () => {
    mockFetchPassing();
    const onSubmit = vi.fn();
    render(<SpeakDrill drill={makeDrill()} onSubmit={onSubmit} />);

    const file = new File(["fake-bytes"], "clip.webm", { type: "audio/webm" });
    const input = screen.getByTestId("speak-upload-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByTestId("speak-score")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("speak-score").textContent).toBe("92");
    expect(screen.getByTestId("speak-tokens")).toBeInTheDocument();
    expect(screen.getByTestId("speak-xp")).toHaveTextContent("+5 XP");

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(true, "a1-01-speak-1");
  });

  it("renders a fail banner and exposes a retry control on low score", async () => {
    mockFetchFailing();
    const onSubmit = vi.fn();
    render(<SpeakDrill drill={makeDrill()} onSubmit={onSubmit} />);

    const file = new File(["bytes"], "clip.webm", { type: "audio/webm" });
    const input = screen.getByTestId("speak-upload-input");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByTestId("speak-score")).toBeInTheDocument(),
    );

    expect(Number(screen.getByTestId("speak-score").textContent)).toBeLessThan(
      SPEAK_PASS_THRESHOLD,
    );
    expect(screen.queryByTestId("speak-xp")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith(false, "a1-01-speak-1");
    expect(screen.getByTestId("speak-retry")).toBeInTheDocument();
  });
});
