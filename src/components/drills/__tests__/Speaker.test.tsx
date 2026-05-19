import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Speaker, UNAVAILABLE_TOOLTIP } from "../Speaker";

/**
 * jsdom doesn't implement HTMLMediaElement playback. We stub the global
 * Audio constructor with a minimal recorder so we can assert `playbackRate`
 * and `play()` invocations without a real audio pipeline. Capturing the
 * instances in an array lets each test look at the latest one.
 */
type FakeAudio = {
  src: string;
  playbackRate: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  onplay: (() => void) | null;
  play: ReturnType<typeof vi.fn>;
};

let audios: FakeAudio[] = [];

beforeEach(() => {
  audios = [];
  // The Speaker uses `new Audio()`. We hijack the global with a real class
  // because vitest's `vi.fn()` arrow-implementation is NOT a valid
  // constructor (TypeError: ... is not a constructor). The class form is
  // both a constructor and assertion-friendly via the `audios` array.
  class FakeAudioCtor {
    src = "";
    playbackRate = 1;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onplay: (() => void) | null = null;
    play = vi.fn().mockImplementation(() => {
      // Fire onplay synchronously so `useState("playing")` lands before the
      // test inspects DOM. jsdom event-loop ordering is irrelevant: there
      // is no real audio pipeline.
      this.onplay?.();
      return Promise.resolve();
    });
    constructor() {
      audios.push(this);
    }
  }
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudioCtor;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Speaker", () => {
  it("renders the main play button and the slow-replay button", () => {
    render(<Speaker text="hallo" />);
    expect(screen.getByLabelText("Play audio for: hallo")).toBeInTheDocument();
    expect(screen.getByLabelText("Play slowly")).toBeInTheDocument();
  });

  it("plays at normal speed on the main button click", async () => {
    render(<Speaker text="hallo" />);
    const main = screen.getByLabelText("Play audio for: hallo");
    fireEvent.click(main);
    // The component's `play()` is async (setState → try → fetch URL → play),
    // so we wait for the Audio constructor to fire rather than racing it.
    await waitFor(() => expect(audios).toHaveLength(1));
    expect(audios[0].playbackRate).toBe(1);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
  });

  it("plays at 0.5× when the slow-replay button is clicked", async () => {
    render(<Speaker text="hallo" />);
    const slow = screen.getByLabelText("Play slowly");
    fireEvent.click(slow);
    await waitFor(() => expect(audios).toHaveLength(1));
    expect(audios[0].playbackRate).toBe(0.5);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
  });

  it("uses a custom aria-label on the main button when provided", () => {
    render(<Speaker text="hallo" ariaLabel="Speak this word" />);
    expect(screen.getByLabelText("Speak this word")).toBeInTheDocument();
    // Slow button keeps its own dedicated label regardless.
    expect(screen.getByLabelText("Play slowly")).toBeInTheDocument();
  });

  it("renders the slow button as a Turtle (separate from the main control)", () => {
    render(<Speaker text="hallo" />);
    const slow = screen.getByTestId("speaker-play-slow");
    expect(slow).toBeInTheDocument();
    expect(slow.getAttribute("aria-label")).toBe("Play slowly");
  });

  // --- unavailable state ---

  it("renders Info icon (not play button) when text is empty", () => {
    render(<Speaker text="" />);
    const unavailableBtn = screen.getByTestId("speaker-unavailable");
    expect(unavailableBtn).toBeInTheDocument();
    expect(unavailableBtn).toHaveAttribute("aria-label", UNAVAILABLE_TOOLTIP);
    // The main play button and slow button are NOT rendered.
    expect(screen.queryByTestId("speaker-play")).not.toBeInTheDocument();
    expect(screen.queryByTestId("speaker-play-slow")).not.toBeInTheDocument();
  });

  it("data-state is 'unavailable' when text is empty", () => {
    render(<Speaker text="" />);
    const wrapper = screen.getByTestId("speaker");
    expect(wrapper).toHaveAttribute("data-state", "unavailable");
  });

  it("renders Info icon when fetch rejects (play() throws)", async () => {
    // Override the FakeAudioCtor from beforeEach so play() rejects.
    class ErrorAudioCtor {
      src = "";
      playbackRate = 1;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onplay: (() => void) | null = null;
      play = vi.fn().mockRejectedValue(new Error("network error"));
      constructor() {
        audios.push(this);
      }
    }
    (globalThis as unknown as { Audio: unknown }).Audio = ErrorAudioCtor;

    render(<Speaker text="hallo" />);
    const main = screen.getByTestId("speaker-play");
    fireEvent.click(main);

    await waitFor(() =>
      expect(screen.getByTestId("speaker")).toHaveAttribute("data-state", "unavailable"),
    );
    expect(screen.getByTestId("speaker-unavailable")).toBeInTheDocument();
  });

  it("renders Info icon when onerror fires (non-2xx response)", async () => {
    // Override so play() resolves but onerror fires immediately after.
    class OnerrorAudioCtor {
      src = "";
      playbackRate = 1;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onplay: (() => void) | null = null;
      play = vi.fn().mockImplementation(() => {
        // Simulate the browser firing onerror after the src fails to load.
        setTimeout(() => this.onerror?.(), 0);
        return Promise.resolve();
      });
      constructor() {
        audios.push(this);
      }
    }
    (globalThis as unknown as { Audio: unknown }).Audio = OnerrorAudioCtor;

    render(<Speaker text="hallo" />);
    const main = screen.getByTestId("speaker-play");
    fireEvent.click(main);

    await waitFor(() =>
      expect(screen.getByTestId("speaker")).toHaveAttribute("data-state", "unavailable"),
    );
    expect(screen.getByTestId("speaker-unavailable")).toBeInTheDocument();
  });

  it("tooltip is not visible by default in unavailable state", () => {
    render(<Speaker text="" />);
    const tooltip = screen.getByTestId("speaker-unavailable-tooltip");
    // The tooltip has opacity-0 by default (toggle on tap).
    expect(tooltip).toHaveClass("opacity-0");
  });

  it("toggles tooltip visibility on click in unavailable state", () => {
    render(<Speaker text="" />);
    const btn = screen.getByTestId("speaker-unavailable");
    const tooltip = screen.getByTestId("speaker-unavailable-tooltip");

    expect(tooltip).toHaveClass("opacity-0");
    fireEvent.click(btn);
    expect(tooltip).toHaveClass("opacity-100");
    fireEvent.click(btn);
    expect(tooltip).toHaveClass("opacity-0");
  });
});
