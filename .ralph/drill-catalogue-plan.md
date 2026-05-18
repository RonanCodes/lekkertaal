# Drill Catalogue — Babbel + Duolingo Parity Plan

_Drafted 2026-05-19. Source: screenshot-review session where user asked "we want all the games that Babbel and Duolingo have, you know"._

## What we already ship

Eight drill types live in `src/components/drills/`:

| Type | Component | Active in seed | Notes |
|---|---|---|---|
| `match_pairs` | MatchPairsDrill | yes (256) | 4-pair NL↔EN. Now samples from unit-wide vocab pool (PR #124). |
| `multiple_choice` | MultipleChoiceDrill (`mode="text"`) | (seeded as `translation_typing`?) | Pick the right answer from 4 text options. |
| `listening_mc` | MultipleChoiceDrill (`mode="audio"`) | (light) | Same but the prompt is an audio clip. |
| `translation_typing` | TranslationTypingDrill | yes (292) | Type the Dutch translation of an English prompt. |
| `fill_blank` | FillBlankDrill | (light) | Fill the gap in a sentence. |
| `word_ordering` | WordOrderingDrill | yes (3) | Arrange shuffled tiles into a sentence. |
| `speak` | SpeakDrill | (light) | Record your voice, STT scores it. |
| `image_word` | ImageWordDrill | (light) | Pick the word that matches the picture. |

So vocabulary, listening, typing, sentence assembly, and speaking are all covered at least in skeleton. What's missing is the variety + depth Babbel and Duolingo trade on.

## What Babbel / Duolingo ship that we don't

Catalogued from public app review + their own marketing. Grouped by mechanism.

### Vocabulary surfaces

1. **Flashcard reveal**. Show the Dutch word + audio; learner taps to flip to English (or vice-versa). Self-grades "I knew it / I didn't". Feeds the SM-2 queue directly. **Duolingo**: shown on review-mode cards. **Babbel**: core part of every lesson's vocab intro.
2. **Picture-from-word grid (4-up)**. Show "boom" + audio, ask the learner to tap the picture of a tree among 4 candidates. We have `image_word` which is the inverse (word matching a single picture); the 4-up grid is the more natural "vocab intro" surface.
3. **Word-from-picture grid (inverse)**. Show a picture, tap the matching Dutch word from 4 options. Useful for cementing reading without translation.
4. **Word puzzle / word bank type-the-answer**. Like translation typing but a bank of word tiles below the input (Duolingo's signature mechanic). Lowers typing friction for mobile.

### Listening surfaces

5. **Listening-then-spell**. Hear the audio, type what you heard. Tests both perception and spelling. The harder cousin of `translation_typing`.
6. **Listening + tap word bank**. Hear the sentence, build the answer by tapping tile words. Duolingo's listening default on mobile.
7. **Slow-replay button on every listening drill**. Not a drill type, a button. Plays the audio at 0.5× via the existing TTS layer. Cheap win.

### Production surfaces

8. **Sentence-translation typing**. Translate a full sentence, not a single word. Babbel does this from day one; Duolingo from level ~5. We have `translation_typing` for single words; extending to multi-word + accepting near-misses is the missing piece.
9. **Conjugation tables**. Fill the conjugation grid for a verb (ik, jij, hij/zij, wij, jullie, zij). Pure Duolingo. Heavy lift but unblocks the "Werkwoorden: hebben & zijn" unit name in the seed.
10. **Speaking + scoring on a full sentence**. Already have `speak` for short utterances; extend to full sentences with phoneme-level scoring (likely needs better STT than what's wired today).

### Conversation / context surfaces

11. **Dialogue: pick the reply**. Two-line dialogue, learner picks the appropriate response from 3 options. Babbel's signature B1+ drill. Cheap to build once we have the seed prompts.
12. **Story / cloze reading**. Short story with sparse blanks; learner fills them. Duolingo Stories. Cross-pollinates with `fill_blank`.

### Game-y surfaces (low pedagogy, high stickiness)

13. **Pair-up listening race**. Audio plays a Dutch word, learner taps the matching English under time pressure. Duolingo's "Match Madness" / Babbel's "Speedrun". Mostly for streak boost.
14. **Daily challenge / mini-game**. One drill picked daily, doubles XP. Currently `xp` quest covers this loosely; a dedicated daily-challenge surface lifts it.

## Priorities (build cost vs learner value)

| Rank | Drill | Cost | Value | Why |
|---|---|---|---|---|
| 1 | **Flashcard reveal** | low | high | Sits on top of the new `vocab_pair` queue from PR #124. Self-grading flashcards turn the queue into actual reviews. Unblocks the spaced-rep loop end-to-end. |
| 2 | **Listening-then-spell** | low | high | Reuses `/api/tts` + a text input. One new component, one new exercise type, no seed-shape change. Hardest-mode listening on day one. |
| 3 | **Word-bank typing** | medium | high | Shuffled tile bank below an input, tap-to-insert. Tile pool comes from the drill answer + 3-4 distractors. Lowers typing friction → higher completion rate on mobile. |
| 4 | **Sentence-translation typing** | medium | high | Extend `translation_typing` to multi-word answers with Levenshtein-based near-miss acceptance. The seed already has sentence prompts in the translation-typing rows. |
| 5 | **Picture-from-word grid (4-up)** | medium | medium | Needs 3 distractor images per drill. Images stored in `lekkertaal-images` R2 bucket already. Distractor selection is the only new logic. |
| 6 | **Dialogue: pick the reply** | medium | medium | Needs a new seed shape (two-line dialogue + 3 reply options). Cheap UI. The roleplay system can co-author the seed. |
| 7 | **Conjugation tables** | high | medium | Needs a new seed shape (verb root + 6 conjugated forms). Heavy UI (6 inputs + validation). Targeted: only verbs. |
| 8 | **Story / cloze reading** | high | low | Heavy authoring cost (each story is bespoke), limited variety per unit. Defer to Phase 3+. |
| 9 | **Pair-up listening race** | medium | low | Pure game mechanic, doesn't teach much. Worth doing for engagement, but not before #1-4. |
| 10 | **Speaking + sentence scoring** | high | high | Bottlenecked on STT quality. Punted to "after STT upgrade" (Phase 2 STT story). |

## Suggested next 3 PRs

1. **PR D** — Flashcard reveal drill. New `flashcard` drill type + reviews surface that renders `vocab_pair` queue rows as flashcards. Closes the loop opened by PR #124.
2. **PR E** — Listening-then-spell. New `listening_spell` drill type. Reuses Speaker + a normal text input with near-miss tolerance.
3. **PR F** — Word-bank typing. New `word_bank` drill type. Shuffled tile bank, tap-to-insert, tap-to-remove.

These three give us about 80% of the Babbel/Duolingo vocab + listening surface for low cost, without touching the more complex production / dialogue / story drills. After they land we can decide whether the next 3 (sentence translation, picture-grid, dialogue-reply) are worth picking up before tackling conjugation tables.

## Out of scope for this plan

- Native iOS / Android wrapper (Phase 4 territory).
- Live tutor chat (already exists via the boss-fight scenarios).
- Leaderboard / league mechanics (already shipped, see `app.leaderboard.tsx`).
- The Stroop mascot animations (Rive integration; separate plan).

## Open questions

- **Distractor selection for picture-from-word**: random pool, or topic-restricted? Topic-restricted needs a category column on the vocab pool.
- **Near-miss tolerance for typing drills**: Levenshtein with a fixed threshold, or per-word leniency from a `accepts: [...]` array on the seed? Latter is more flexible, former is cheaper.
- **Should flashcard self-grading feed SM-2 directly, or only "I didn't know" trigger a re-queue?** Probably the latter, matches PR #124's "wrongs queue, corrects no-op" pattern.
- **Audio for listening-then-spell on phrases**: Wikimedia only covers single words. Multi-word phrases fall to OpenAI synth. That's fine for v1 but worth knowing.
