/**
 * Pronunciation scoring (issue #55, P2-STT-2).
 *
 * A pure function that diffs a Whisper transcript against the drill's
 * canonical Dutch string, returning a 0-100 score plus a per-token diff so
 * the UI can highlight which words landed and which slipped.
 *
 * Algorithm:
 *   1. Tokenise both strings to lowercased, punctuation-stripped words.
 *   2. Run word-level Levenshtein (Wagner-Fischer with edit traceback) to
 *      produce a minimal alignment between canonical and transcript tokens.
 *   3. Walk the alignment to emit `TokenDiff[]`:
 *        - match    : canonical word present in transcript at this slot
 *        - wrong    : canonical word substituted by a different word
 *        - missing  : canonical word not spoken
 *        - extra    : transcript word with no canonical counterpart
 *   4. Score = round(100 * (1 - distance / max(canonicalLen, 1))), clamped
 *      to [0, 100]. An empty canonical degenerates to 100 when the user
 *      also says nothing, 0 otherwise.
 *
 * The scorer is intentionally I/O-free: a wrapper endpoint owns the DB
 * lookup so this stays unit-testable with no fixtures.
 */

/** Per-token alignment entry returned alongside the score. */
export type TokenDiff = {
  /**
   * The word being reported on. For `match`/`wrong`/`missing` this is the
   * canonical word; for `extra` it's the transcript word.
   */
  word: string;
  status: "match" | "wrong" | "missing" | "extra";
  /**
   * Present on `wrong` only: what the speaker actually said in place of
   * the canonical word. Lets the UI render "you said X, expected Y".
   */
  spoken?: string;
};

export type PronunciationScore = {
  /** 0-100 integer; 100 = exact match (post-normalisation). */
  score: number;
  tokens: TokenDiff[];
};

/**
 * Tokenise a string into lowercased, punctuation-stripped words.
 * Empty / whitespace-only input yields `[]`.
 *
 * Mirrors the rules used by `normaliseAnswer` in DrillFrame.tsx so the
 * speak-grading and type-grading paths agree on what counts as the same
 * word (case-insensitive, punctuation-insensitive, whitespace-collapsed).
 */
export function tokeniseForScoring(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFKC")
    // Strip terminal + internal punctuation that Whisper tends to add.
    .replace(/[.,!?;:"'()\[\]{}]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Word-level Levenshtein with traceback. Returns the edit distance and
 * the alignment as a list of operations against the two token arrays.
 *
 * Operations:
 *   - `equal`     : tokens at (i, j) match
 *   - `substitute`: canonical[i] replaced by transcript[j]
 *   - `delete`    : canonical[i] not present in transcript (missing word)
 *   - `insert`    : transcript[j] not present in canonical (extra word)
 *
 * The matrix is small in practice (drills are short sentences) so the
 * straightforward O(m*n) build is fine; no need for a bitparallel variant.
 */
function alignWords(
  canonical: readonly string[],
  transcript: readonly string[],
): {
  distance: number;
  ops: Array<{ op: "equal" | "substitute" | "delete" | "insert"; ci?: number; ti?: number }>;
} {
  const m = canonical.length;
  const n = transcript.length;

  // dp[i][j] = edit distance between canonical[0..i] and transcript[0..j].
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = canonical[i - 1] === transcript[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // delete from canonical
        dp[i][j - 1] + 1, // insert from transcript
        dp[i - 1][j - 1] + cost, // substitute / equal
      );
    }
  }

  // Trace back to recover the alignment. Walk from (m, n) → (0, 0).
  const ops: Array<{ op: "equal" | "substitute" | "delete" | "insert"; ci?: number; ti?: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && canonical[i - 1] === transcript[j - 1]) {
      ops.push({ op: "equal", ci: i - 1, ti: j - 1 });
      i--;
      j--;
      continue;
    }
    // Pick the cheapest predecessor. Ties broken in a stable order:
    // prefer substitute, then delete (missing), then insert (extra).
    const sub = i > 0 && j > 0 ? dp[i - 1][j - 1] : Infinity;
    const del = i > 0 ? dp[i - 1][j] : Infinity;
    const ins = j > 0 ? dp[i][j - 1] : Infinity;
    const min = Math.min(sub, del, ins);
    if (sub === min) {
      ops.push({ op: "substitute", ci: i - 1, ti: j - 1 });
      i--;
      j--;
    } else if (del === min) {
      ops.push({ op: "delete", ci: i - 1 });
      i--;
    } else {
      ops.push({ op: "insert", ti: j - 1 });
      j--;
    }
  }
  ops.reverse();

  return { distance: dp[m][n], ops };
}

/**
 * Score a transcript against the canonical Dutch string.
 *
 * Edge cases:
 *   - Both empty   → score 100, no tokens.
 *   - Canonical empty, transcript non-empty → score 0, all tokens `extra`.
 *   - Transcript empty, canonical non-empty → score 0, all tokens `missing`.
 *   - Otherwise score = 100 * (1 - distance / canonicalLength), rounded.
 *
 * The denominator is canonical length (not max(m, n)) so adding garbage
 * words past a perfect prefix penalises but doesn't cap at 0.
 */
export function scorePronunciation(
  canonical: string,
  transcript: string,
): PronunciationScore {
  const cTokens = tokeniseForScoring(canonical);
  const tTokens = tokeniseForScoring(transcript);

  if (cTokens.length === 0 && tTokens.length === 0) {
    return { score: 100, tokens: [] };
  }
  if (cTokens.length === 0) {
    return {
      score: 0,
      tokens: tTokens.map((w) => ({ word: w, status: "extra" })),
    };
  }
  if (tTokens.length === 0) {
    return {
      score: 0,
      tokens: cTokens.map((w) => ({ word: w, status: "missing" })),
    };
  }

  const { distance, ops } = alignWords(cTokens, tTokens);

  const tokens: TokenDiff[] = ops.map((op) => {
    switch (op.op) {
      case "equal":
        return { word: cTokens[op.ci!], status: "match" };
      case "substitute":
        return {
          word: cTokens[op.ci!],
          status: "wrong",
          spoken: tTokens[op.ti!],
        };
      case "delete":
        return { word: cTokens[op.ci!], status: "missing" };
      case "insert":
        return { word: tTokens[op.ti!], status: "extra" };
    }
  });

  // Normalise distance against canonical length so that adding one extra
  // word to a 5-word sentence costs 20 points, not 16.6 (max(5,6)).
  const denom = cTokens.length;
  const raw = 100 * (1 - distance / denom);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { score, tokens };
}
