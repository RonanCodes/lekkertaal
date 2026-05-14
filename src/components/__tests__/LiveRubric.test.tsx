/**
 * Component test for <LiveRubric/>.
 *
 * The hook (`experimental_useObject`) does the network work, which we mock,
 * so this test focuses on the part the component owns:
 *
 *   - All 5 rubric rows render (grammar, vocabulary, taskCompletion,
 *     fluency, politeness) regardless of whether they have a value yet.
 *   - When a partial object arrives, the rows that have a number show it
 *     and the rows that don't still show the placeholder ("..."). This is
 *     the progressive-fill behaviour the issue spec calls for ("Scores
 *     fill in incrementally over the streaming window").
 *   - The progressbar role/aria values reflect the score.
 *   - An error state from the hook renders the error block.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveRubric } from "../LiveRubric";

// Mock the hook (vitest hoists vi.mock to the top of the file at runtime,
// so the import order above is fine even though we declare the mock here).
const useObjectMock = vi.fn();
vi.mock("@ai-sdk/react", () => ({
  experimental_useObject: (opts: unknown) => useObjectMock(opts),
}));

describe("<LiveRubric/>", () => {
  beforeEach(() => {
    useObjectMock.mockReset();
  });

  it("renders all 5 rubric rows even with no partial yet", () => {
    useObjectMock.mockReturnValue({
      object: undefined,
      submit: vi.fn(),
      isLoading: true,
      error: undefined,
    });

    render(<LiveRubric sessionId={42} />);

    expect(screen.getByTestId("live-rubric-row-grammar")).toBeInTheDocument();
    expect(screen.getByTestId("live-rubric-row-vocabulary")).toBeInTheDocument();
    expect(
      screen.getByTestId("live-rubric-row-taskCompletion"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("live-rubric-row-fluency")).toBeInTheDocument();
    expect(screen.getByTestId("live-rubric-row-politeness")).toBeInTheDocument();
  });

  it("shows a placeholder ('...') for rows that have no score yet", () => {
    useObjectMock.mockReturnValue({
      object: undefined,
      submit: vi.fn(),
      isLoading: true,
      error: undefined,
    });

    render(<LiveRubric sessionId={1} />);

    // All 5 score badges show '...'.
    const scores = screen.getAllByText("...");
    expect(scores).toHaveLength(5);
  });

  it("shows scores for the keys present in the partial, '...' for the rest", () => {
    // Mid-stream: grammar and vocabulary have landed, others not yet.
    useObjectMock.mockReturnValue({
      object: { grammar: 4, vocabulary: 3 },
      submit: vi.fn(),
      isLoading: true,
      error: undefined,
    });

    render(<LiveRubric sessionId={1} />);

    expect(
      screen.getByTestId("live-rubric-row-grammar-score"),
    ).toHaveTextContent("4/5");
    expect(
      screen.getByTestId("live-rubric-row-vocabulary-score"),
    ).toHaveTextContent("3/5");
    expect(
      screen.getByTestId("live-rubric-row-taskCompletion-score"),
    ).toHaveTextContent("...");
    expect(
      screen.getByTestId("live-rubric-row-fluency-score"),
    ).toHaveTextContent("...");
    expect(
      screen.getByTestId("live-rubric-row-politeness-score"),
    ).toHaveTextContent("...");
  });

  it("renders all 5 scores once the streaming completes", () => {
    useObjectMock.mockReturnValue({
      object: {
        grammar: 5,
        vocabulary: 4,
        taskCompletion: 4,
        fluency: 3,
        politeness: 5,
        feedbackEn: "Nice work.",
        errors: [],
      },
      submit: vi.fn(),
      isLoading: false,
      error: undefined,
    });

    render(<LiveRubric sessionId={1} />);

    expect(
      screen.getByTestId("live-rubric-row-grammar-score"),
    ).toHaveTextContent("5/5");
    expect(
      screen.getByTestId("live-rubric-row-politeness-score"),
    ).toHaveTextContent("5/5");
    expect(screen.getByTestId("live-rubric-feedback")).toHaveTextContent(
      "Nice work.",
    );
    expect(screen.getByTestId("live-rubric")).toHaveAttribute(
      "data-loading",
      "false",
    );
  });

  it("sets aria-valuenow on each progressbar to match the score", () => {
    useObjectMock.mockReturnValue({
      object: { grammar: 4 },
      submit: vi.fn(),
      isLoading: true,
      error: undefined,
    });

    render(<LiveRubric sessionId={1} />);
    const grammarBar = screen.getByRole("progressbar", { name: "Grammar" });
    expect(grammarBar).toHaveAttribute("aria-valuenow", "4");
    expect(grammarBar).toHaveAttribute("aria-valuemax", "5");
  });

  it("renders an error block when the hook reports an error", () => {
    useObjectMock.mockReturnValue({
      object: undefined,
      submit: vi.fn(),
      isLoading: false,
      error: new Error("stream broken"),
    });

    render(<LiveRubric sessionId={1} />);

    expect(screen.getByTestId("live-rubric-error")).toBeInTheDocument();
    // The 5 rubric rows are NOT rendered in the error state.
    expect(screen.queryByTestId("live-rubric-row-grammar")).toBeNull();
  });

  it("auto-submits exactly once on mount", () => {
    const submit = vi.fn();
    useObjectMock.mockReturnValue({
      object: undefined,
      submit,
      isLoading: true,
      error: undefined,
    });

    render(<LiveRubric sessionId={1} />);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
