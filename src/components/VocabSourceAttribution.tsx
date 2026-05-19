/**
 * VocabSourceAttribution — subtle source attribution for vocab cards.
 *
 * Renders a single small Info icon in the corner of a vocab card. Tapping or
 * hovering opens a popover listing per-field provenance with deep-links back
 * to the upstream sources (Wiktionary page, Wikimedia Commons file, Tatoeba
 * sentence). Hidden entirely when the sources map is empty.
 *
 * Required by the CC-BY / CC-BY-SA licences of the upstream sources.
 * Design spec: icon only (no label), size-3.5, muted foreground, top-right.
 */
import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import type { VocabField, VocabSource } from "../db/schema";

export type SourceMap = Partial<Record<VocabField, VocabSource>>;

type Props = {
  /** The Dutch word (used to build upstream deep-links). */
  word: string;
  /** Per-field source map from the `sources` column. */
  sources: SourceMap | null | undefined;
  /** Tatoeba sentence ID, if the example sentence came from Tatoeba. */
  tatoebaSentenceId?: number | null;
  className?: string;
};

const FIELD_LABELS: Record<VocabField, string> = {
  ipa: "IPA",
  gender: "Gender",
  audioUrl: "Audio",
  wordType: "Word type",
  exampleSentenceNl: "Example",
  exampleSentenceEn: "Example (English)",
};

const SOURCE_LABELS: Record<VocabSource, string> = {
  wiktionary: "Wiktionary",
  wikimedia: "Wikimedia Commons",
  tatoeba: "Tatoeba",
  manual: "Lekkertaal team",
};

function sourceUrl(
  source: VocabSource,
  word: string,
  tatoebaSentenceId?: number | null,
): string | null {
  switch (source) {
    case "wiktionary":
      return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    case "wikimedia":
      return `https://commons.wikimedia.org/wiki/File:Nl-${encodeURIComponent(word.toLowerCase())}.ogg`;
    case "tatoeba":
      return tatoebaSentenceId
        ? `https://tatoeba.org/en/sentences/show/${tatoebaSentenceId}`
        : `https://tatoeba.org/en/sentences/search?from=nld&to=eng&query=${encodeURIComponent(word)}`;
    case "manual":
      return null;
  }
}

/**
 * Deduplicate sources for display: group by source, list all fields per source
 * on one line. E.g. "Wiktionary · IPA, Gender, Word type".
 */
function groupSources(
  sources: SourceMap,
): Array<{ source: VocabSource; label: string; fields: VocabField[] }> {
  const bySource = new Map<VocabSource, VocabField[]>();
  for (const [field, source] of Object.entries(sources) as [VocabField, VocabSource][]) {
    if (!source) continue;
    const existing = bySource.get(source) ?? [];
    existing.push(field);
    bySource.set(source, existing);
  }
  return Array.from(bySource.entries()).map(([source, fields]) => ({
    source,
    label: SOURCE_LABELS[source],
    fields,
  }));
}

export function VocabSourceAttribution({
  word,
  sources,
  tatoebaSentenceId,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const entries = sources ? Object.entries(sources).filter(([, v]) => v) : [];
  if (entries.length === 0) return null;

  const grouped = groupSources(sources!);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex ${className ?? ""}`}
      data-testid="vocab-attribution"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Data sources"
        aria-expanded={open}
        data-testid="vocab-attribution-trigger"
        className="inline-flex items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-orange-500"
      >
        <Info size={14} aria-hidden />
      </button>

      {open && (
        <span
          role="dialog"
          aria-label="Data sources"
          data-testid="vocab-attribution-popover"
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-neutral-200 bg-white p-3 shadow-md text-xs"
        >
          <p className="mb-2 font-semibold text-neutral-700">Data sources</p>
          <ul className="space-y-1.5">
            {grouped.map(({ source, label, fields }) => {
              const url = sourceUrl(source, word, tatoebaSentenceId);
              const fieldLabels = fields.map((f) => FIELD_LABELS[f]).join(", ");
              return (
                <li key={source} className="flex flex-col gap-0.5">
                  <span className="text-neutral-500">{fieldLabels}</span>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 underline-offset-2 hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    <span className="text-neutral-700">{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </span>
      )}
    </span>
  );
}
