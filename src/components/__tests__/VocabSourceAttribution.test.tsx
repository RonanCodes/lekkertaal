/**
 * Component tests for VocabSourceAttribution.
 *
 * Verifies:
 *   - Hidden entirely when sources map is null/empty.
 *   - Info trigger renders and toggles the popover on click.
 *   - Popover lists correct per-field origins with deep-link URLs.
 *   - Tatoeba entry deep-links to the sentence ID when provided.
 *   - Manual source renders without a hyperlink (no upstream URL).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VocabSourceAttribution } from "../VocabSourceAttribution";
import type { SourceMap } from "../VocabSourceAttribution";

describe("VocabSourceAttribution", () => {
  it("renders nothing when sources is null", () => {
    const { container } = render(
      <VocabSourceAttribution word="brood" sources={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when sources is an empty object", () => {
    const { container } = render(
      <VocabSourceAttribution word="brood" sources={{}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the Info trigger when sources are present", () => {
    const sources: SourceMap = { ipa: "wiktionary", audioUrl: "wikimedia" };
    render(<VocabSourceAttribution word="brood" sources={sources} />);
    expect(screen.getByTestId("vocab-attribution-trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("vocab-attribution-popover")).not.toBeInTheDocument();
  });

  it("opens the popover on click and closes on second click", () => {
    const sources: SourceMap = { ipa: "wiktionary" };
    render(<VocabSourceAttribution word="boom" sources={sources} />);

    const trigger = screen.getByTestId("vocab-attribution-trigger");
    fireEvent.click(trigger);
    expect(screen.getByTestId("vocab-attribution-popover")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId("vocab-attribution-popover")).not.toBeInTheDocument();
  });

  it("shows Wiktionary link for ipa source", () => {
    const sources: SourceMap = { ipa: "wiktionary" };
    render(<VocabSourceAttribution word="boom" sources={sources} />);
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    const popover = screen.getByTestId("vocab-attribution-popover");
    expect(popover).toHaveTextContent("Wiktionary");

    const link = screen.getByRole("link", { name: /wiktionary/i });
    expect(link).toHaveAttribute("href", "https://en.wiktionary.org/wiki/boom");
  });

  it("shows Wikimedia Commons link for audioUrl source", () => {
    const sources: SourceMap = { audioUrl: "wikimedia" };
    render(<VocabSourceAttribution word="fiets" sources={sources} />);
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    const link = screen.getByRole("link", { name: /wikimedia commons/i });
    expect(link).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Nl-fiets.ogg",
    );
  });

  it("shows Tatoeba link with sentence ID when provided", () => {
    const sources: SourceMap = { exampleSentenceNl: "tatoeba" };
    render(
      <VocabSourceAttribution word="brood" sources={sources} tatoebaSentenceId={12345} />,
    );
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    const link = screen.getByRole("link", { name: /tatoeba/i });
    expect(link).toHaveAttribute("href", "https://tatoeba.org/en/sentences/show/12345");
  });

  it("shows Tatoeba search link when sentence ID is missing", () => {
    const sources: SourceMap = { exampleSentenceNl: "tatoeba" };
    render(<VocabSourceAttribution word="brood" sources={sources} />);
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    const link = screen.getByRole("link", { name: /tatoeba/i });
    expect(link.getAttribute("href")).toContain("tatoeba.org");
    expect(link.getAttribute("href")).toContain("brood");
  });

  it("renders manual source without a hyperlink", () => {
    const sources: SourceMap = { ipa: "manual" };
    render(<VocabSourceAttribution word="gezellig" sources={sources} />);
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    expect(screen.queryByRole("link", { name: /lekkertaal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/lekkertaal team/i)).toBeInTheDocument();
  });

  it("groups multiple fields from the same source on one line", () => {
    const sources: SourceMap = { ipa: "wiktionary", gender: "wiktionary", wordType: "wiktionary" };
    render(<VocabSourceAttribution word="boom" sources={sources} />);
    fireEvent.click(screen.getByTestId("vocab-attribution-trigger"));

    // Only one Wiktionary link should exist (grouped), not three.
    const links = screen.getAllByRole("link", { name: /wiktionary/i });
    expect(links).toHaveLength(1);
  });
});
