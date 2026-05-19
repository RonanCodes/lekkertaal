/**
 * Levenshtein distance — classic 2-row dynamic-programming implementation.
 * Pure, no deps, no I/O. Treats every Unicode code unit as a character, which
 * is what we want for Dutch diacritics (`één`, `tïjdje`) since they get
 * counted as plain letters rather than special-cased.
 *
 * Lives in `src/lib/server/` because it's a non-React utility and the
 * listening-spell drill grades client-side via the same function the server
 * boundary might one day need (e.g. mirroring grading on a server-fn for
 * cheat-resistance). Import it from either side.
 *
 * The 2-row variant keeps memory at O(min(|a|, |b|) + 1) instead of the O(|a| * |b|)
 * full-matrix version. For our use case (short Dutch words) the difference is
 * cosmetic, but the smaller surface is easier to reason about and to test.
 *
 * @example
 *   levenshtein("hallo", "hallo") // 0  — identical
 *   levenshtein("hallo", "halo")  // 1  — single deletion
 *   levenshtein("hallo", "hello") // 1  — single substitution
 *   levenshtein("één", "een")     // 2  — two diacritic substitutions
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}
